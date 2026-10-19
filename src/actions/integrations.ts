"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { getUserRole, requireReviewer } from "@/lib/audience/access";
import { connectBufferApiKey, disconnectBuffer, getBufferChannels, publishToBuffer, type BufferChannel } from "@/lib/integrations/buffer";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";
import { claimPublication, noteUncertainDelivery, saveDelivery, syncPublication, recoverPublicationReceipt } from "@/lib/content/publishing";
import { futureSchedule } from "@/lib/content/scheduling";
import { bufferPostProblem } from "@/lib/content/social-publishing";
import { socialPost } from "@/lib/content/social-media";
import { readPublicResource } from "@/lib/integrations/public-resource";

export type { BufferChannel };
export interface IntegrationResult { ok: boolean; error?: string; message?: string; channels?: BufferChannel[]; publicationId?: string }

function refreshAsset(id: string) {
  for (const path of ["/library", `/library/${id}`, "/publishing", "/calendar", "/dashboard", "/approvals", "/audience/landing-pages"]) revalidatePath(path);
}

async function requireIntegrationManager(org: string) {
  const role = await getUserRole(org);
  if (!role || !["owner", "admin", "marketing_manager"].includes(role)) throw new Error("Connection settings require an owner, admin or marketing manager.");
}

export async function refreshBufferChannels(): Promise<IntegrationResult> {
  try {
    const org = await requireOrganizationId();
    await requireReviewer(org);
    const channels = await getBufferChannels(org);
    revalidatePath("/settings/ai");
    return { ok: true, channels };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not load channels." }; }
}

export async function disconnectBufferAction(): Promise<IntegrationResult> {
  try {
    const org = await requireOrganizationId();
    await requireIntegrationManager(org);
    await disconnectBuffer(org);
    revalidatePath("/settings/ai");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not disconnect Buffer." }; }
}

export async function saveBufferApiKey(formData: FormData): Promise<IntegrationResult> {
  try {
    const org = await requireOrganizationId();
    await requireIntegrationManager(org);
    const key = String(formData.get("api_key") ?? "").trim();
    if (key.length < 8 || key.length > 2000) return { ok: false, error: "Enter a valid Buffer API key." };
    const channels = await connectBufferApiKey(org, key);
    revalidatePath("/settings/ai");
    return { ok: true, channels, message: "Buffer connection verified and saved." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not connect Buffer." }; }
}

export async function publishAssetViaBuffer(assetId: string, channelId: string, scheduledFor?: string, expectedUpdatedAt?: string, queue = false): Promise<IntegrationResult> {
  let org = "", requestId = "";
  try {
    org = await requireOrganizationId();
    await requireReviewer(org);
    const date = scheduledFor ? futureSchedule(scheduledFor) : undefined;
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { ok: false, error: "Sign in before publishing." };
    const { data: asset, error } = await client.from("content_assets").select("id,title,body,status,channel,platform,format,metadata,updated_at").eq("organization_id", org).eq("id", assetId).maybeSingle();
    if (error || !asset) return { ok: false, error: "Content not found in this workspace." };
    if (asset.status !== "approved") return { ok: false, error: "Approve this content before sending it to Buffer." };
    if (expectedUpdatedAt && asset.updated_at !== expectedUpdatedAt) return { ok: false, error: "This post changed since you opened it. Refresh and review the current copy before sending." };
    const channels = await getBufferChannels(org);
    const channel = channels.find(c => c.id === channelId);
    if (!channel || channel.isDisconnected || channel.isLocked || channel.isQueuePaused) return { ok: false, error: "Choose an available channel from this workspace's Buffer connection." };
    const problem = bufferPostProblem(asset, channel);
    if (problem) return { ok: false, error: problem };
    if (queue && date) return { ok: false, error: "Choose a queue slot or an exact time, not both." };
    const media = socialPost(asset.metadata);
    for (const file of media.media) {
      const resource = await readPublicResource(file.url, { head: true });
      if (file.type === "image" ? !["image/jpeg","image/png","image/webp"].includes(resource.mimeType) : !["video/mp4","video/quicktime","video/webm"].includes(resource.mimeType)) return { ok: false, error: "A media URL does not open a supported direct image or video file. Correct it in Editing and request approval again." };
    }
    requestId = await claimPublication(org, asset, "buffer", user.id, date, channel.id);
    const post = media.media.length || queue ? await publishToBuffer(org, channel.id, asset.body.trim(), date, { queue, media, service: channel.service.toLowerCase() }) : await publishToBuffer(org, channel.id, asset.body.trim(), date);
    await saveDelivery(org, requestId, assetId, post);
    refreshAsset(assetId);
    return { ok: post.status !== "failed", publicationId: requestId, error: post.error, message: post.status === "published" ? "Buffer confirmed publication." : "Accepted by Buffer. This asset stays scheduled until delivery is confirmed." };
  } catch (error) {
    if (requestId) {
      try {
        if (error instanceof DeliveryRejected) await saveDelivery(org, requestId, assetId, { id: "", status: "failed", error: error.message });
        else await noteUncertainDelivery(org, requestId, error instanceof Error ? error.message : "Request failed.");
      } catch { /* Keep the reservation when the database cannot confirm the provider result. */ }
      refreshAsset(assetId);
    }
    return { ok: false, error: error instanceof Error ? error.message : "Could not submit the post." };
  }
}

export async function refreshPublicationStatus(assetId: string): Promise<IntegrationResult> {
  try {
    const org = await requireOrganizationId();
    await requireReviewer(org);
    const message = await syncPublication(org, assetId);
    refreshAsset(assetId);
    return { ok: true, message };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not check delivery." }; }
}

export async function recoverPublishingRequest(assetId: string, formData: FormData): Promise<IntegrationResult> {
  try {
    const org = await requireOrganizationId();
    await requireReviewer(org);
    const message = await recoverPublicationReceipt(org, assetId, String(formData.get("external_id") ?? ""));
    refreshAsset(assetId);
    return { ok: true, message };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not recover delivery." }; }
}
