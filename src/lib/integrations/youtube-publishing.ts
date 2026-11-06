import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { libraryFiles, LIBRARY_FILE_BUCKET, type LibraryFile } from "@/lib/content/library-files";
import { sourceAccess } from "./source-connections";
import { youtubeRequest } from "./content-import";
import { DeliveryRejected } from "./delivery-error";
import type { DeliveryPost } from "@/lib/content/publishing";
import { socialPost } from "@/lib/content/social-media";

type Video = { id: string; snippet?: { channelId?: string; title?: string; description?: string }; status?: { uploadStatus?: string; privacyStatus?: string; publishAt?: string; failureReason?: string; rejectionReason?: string }; processingDetails?: { processingStatus?: string } };
export function youtubeDelivery(video: Video): DeliveryPost {
  if (!video.id) throw new Error("YouTube did not return a video receipt. Check YouTube Studio before sending again.");
  const status = video.status ?? {};
  if (["failed", "rejected", "deleted"].includes(status.uploadStatus ?? "") || video.processingDetails?.processingStatus === "failed") return { id: video.id, status: "failed", error: "YouTube could not process this video. Check YouTube Studio for its rejection details before retrying." };
  const visible = ["public", "unlisted"].includes(status.privacyStatus ?? "");
  return { id: video.id, status: visible && status.uploadStatus === "processed" ? "published" : "queued", url: `https://www.youtube.com/watch?v=${video.id}`, scheduledFor: status.publishAt ?? null, ...(visible && status.uploadStatus === "processed" ? { publishedAt: new Date().toISOString() } : {}), ...(!visible && !status.publishAt ? { error: "The video remains private in YouTube. Review its visibility in YouTube Studio, then check delivery again." } : {}) };
}
export function safeYouTubeSession(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || !url.pathname.startsWith("/upload/youtube/v3/videos") || url.username || url.password || url.port) throw new Error("YouTube returned an invalid upload session.");
  return url.toString();
}
export function youtubeContentProblem(asset: { title: string; body?: string | null; metadata: Record<string, unknown> | null }, file: LibraryFile | undefined) {
  if (!file || !["video/mp4", "video/quicktime", "video/webm"].includes(file.mime)) return "Choose an attached MP4, MOV or WebM video. Add it while the draft is in Editing, then request approval.";
  const media = socialPost(asset.metadata), title = media.videoTitle || asset.title;
  if (!title.trim() || title.length > 100 || /[<>]/.test(title)) return "The YouTube title must contain 1–100 characters and no angle brackets. Correct it in Editing and request approval again.";
  if (Buffer.byteLength(asset.body ?? "", "utf8") > 5000 || /[<>]/.test(asset.body ?? "")) return "YouTube descriptions allow up to 5,000 UTF-8 bytes and no angle brackets. Shorten the draft in Editing and request approval again.";
  return null;
}
async function fileBytes(org: string, assetId: string, fileId: string) {
  const admin = createAdminClient();
  const { data: asset, error } = await admin.from("content_assets").select("id,title,body,metadata,status").eq("organization_id", org).eq("id", assetId).maybeSingle();
  const file = asset ? libraryFiles(asset.metadata, org, assetId).find(file => file.id === fileId) : undefined;
  if (error || !asset || !file) throw new Error("The approved video attachment is unavailable in this workspace.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Video uploads support up to 100 MB.");
  const { data, error: downloadError } = await admin.storage.from(LIBRARY_FILE_BUCKET).download(file.path);
  if (downloadError || !data) throw new Error("Could not open the private video attachment.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== file.size) throw new Error("The attachment size changed. Return to Editing and attach the correct video before requesting approval.");
  return { file, bytes, asset };
}
export async function startYouTubeUpload(org: string, assetId: string, publicationId: string, fileId: string, privacy: "public" | "unlisted", scheduledFor?: string) {
  // Until the session is stored, this function sends metadata only, never video bytes.
  try {
  const { file, asset } = await fileBytes(org, assetId, fileId), problem = youtubeContentProblem(asset, file);
  if (problem) throw new DeliveryRejected(problem);
  const { accessToken, accountId } = await sourceAccess(org, "youtube"), media = socialPost(asset.metadata);
  if (asset.metadata?.publishing?.youtube_channel_id && asset.metadata.publishing.youtube_channel_id !== accountId) throw new DeliveryRejected("The connected channel changed. No video data was uploaded. Refresh and review the destination.");
  const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": file.mime, "X-Upload-Content-Length": String(file.size) }, body: JSON.stringify({ snippet: { title: media.videoTitle || asset.title, description: asset.body ?? "", categoryId: media.youtubeCategory }, status: { privacyStatus: scheduledFor ? "private" : privacy, selfDeclaredMadeForKids: media.madeForKids, ...(scheduledFor ? { publishAt: scheduledFor } : {}) } }), signal: AbortSignal.timeout(20000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new DeliveryRejected(response.status === 403 ? "YouTube denied this upload. Check the channel's permissions and API quota." : "YouTube did not accept the upload setup. Check the connection and video details.");
  const session = safeYouTubeSession(response.headers.get("location") ?? "");
  const admin = createAdminClient();
  const { data: current } = await admin.from("content_assets").select("metadata,updated_at").eq("organization_id", org).eq("id", assetId).maybeSingle();
  const publishing = current?.metadata?.publishing;
  if (!current || publishing?.publication_id !== publicationId) throw new DeliveryRejected("The publishing request changed. No video data was uploaded.");
  const saved = await admin.from("content_assets").update({ metadata: { ...current.metadata, publishing: { ...publishing, youtube_session: encryptSecret(session), youtube_file_id: fileId } } }).eq("organization_id", org).eq("id", assetId).eq("updated_at", current.updated_at).contains("metadata", { publishing: { publication_id: publicationId } }).select("id").maybeSingle();
  if (saved.error || !saved.data) throw new DeliveryRejected("Could not save the upload session. No video data was uploaded.");
  } catch (error) {
    throw new DeliveryRejected(error instanceof DeliveryRejected ? error.message : "Could not prepare the YouTube upload. No video data was sent. Check your connection and try again.");
  }
  return await getYouTubeDelivery(org, assetId);
}
export async function getYouTubeDelivery(org: string, assetId: string, externalId?: string | null): Promise<DeliveryPost> {
  const { accountId, accessToken } = await sourceAccess(org, "youtube");
  const connectionAsset = await createAdminClient().from("content_assets").select("metadata").eq("organization_id", org).eq("id", assetId).maybeSingle();
  const target = connectionAsset.data?.metadata?.publishing?.youtube_channel_id;
  if (connectionAsset.error || !connectionAsset.data) throw new Error("Content not found in this workspace.");
  if (target && target !== accountId) throw new Error("Reconnect the original YouTube channel to check this upload.");
  if (externalId) {
    if (!/^[\w-]{11}$/.test(externalId)) throw new Error("Invalid YouTube video receipt.");
    const payload = await (await youtubeRequest(org, `videos?part=status,snippet,processingDetails&id=${externalId}`)).json(), video = payload.items?.[0];
    if (!video || video.snippet?.channelId !== accountId) throw new Error("This video is unavailable on the connected YouTube channel. Check YouTube Studio.");
    return youtubeDelivery(video);
  }
  const admin = createAdminClient();
  const { data: asset } = await admin.from("content_assets").select("metadata,status").eq("organization_id", org).eq("id", assetId).maybeSingle();
  const publishing = asset?.metadata?.publishing;
  if (asset?.status !== "scheduled" || publishing?.provider !== "youtube" || !publishing.youtube_session || !publishing.youtube_file_id) throw new Error("The upload session was not saved. Check YouTube Studio before starting another request.");
  const { error: releaseError } = await admin.rpc("check_content_release", { p_asset: assetId, p_organization: org });
  if (releaseError) throw new Error("Recorded approval is required before continuing this upload.");
  const { file, bytes } = await fileBytes(org, assetId, publishing.youtube_file_id);
  const session = safeYouTubeSession(decryptSecret(publishing.youtube_session));
  const headers = { Authorization: `Bearer ${accessToken}` };
  const probe = await fetch(session, { method: "PUT", headers: { ...headers, "Content-Length": "0", "Content-Range": `bytes */${file.size}` }, signal: AbortSignal.timeout(20000), redirect: "manual", cache: "no-store" });
  if (probe.ok) return youtubeDelivery(await probe.json());
  if (probe.status !== 308) throw new Error("The upload session is no longer available. Check YouTube Studio before retrying to avoid duplicate videos.");
  const range = probe.headers.get("range");
  if (range && !/^bytes=0-\d+$/.test(range)) throw new Error("YouTube returned an invalid upload position. Check the video in Studio.");
  const offset = range ? Number(range.split("-")[1]) + 1 : 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= file.size) throw new Error("YouTube has not confirmed the complete upload. Check delivery again shortly.");
  // Resume this same session rather than creating another remote video after a timeout.
  const uploaded = await fetch(session, { method: "PUT", headers: { ...headers, "Content-Type": file.mime, "Content-Length": String(file.size - offset), "Content-Range": `bytes ${offset}-${file.size - 1}/${file.size}` }, body: new Uint8Array(bytes.subarray(offset)), signal: AbortSignal.timeout(120000), redirect: "manual", cache: "no-store" });
  if (!uploaded.ok) throw new Error("YouTube has not confirmed the upload. Use Check delivery status to continue the same upload; do not send another copy.");
  return youtubeDelivery(await uploaded.json());
}
