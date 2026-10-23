"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { requireReviewer } from "@/lib/audience/access";
import { claimPublication, saveDelivery, noteUncertainDelivery } from "@/lib/content/publishing";
import { libraryFiles } from "@/lib/content/library-files";
import { futureSchedule } from "@/lib/content/scheduling";
import { startYouTubeUpload, youtubeContentProblem } from "@/lib/integrations/youtube-publishing";
import { sourceAccess } from "@/lib/integrations/source-connections";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";

export async function publishYouTubeAsset(assetId: string, form: FormData) {
  let org = "", requestId = "";
  try {
    org = await requireOrganizationId(); await requireReviewer(org);
    const fields = z.object({ fileId: z.uuid(), privacy: z.enum(["public", "unlisted"]), expected: z.string().min(1), schedule: z.string().max(80) }).parse({ fileId: form.get("file_id"), privacy: form.get("privacy"), expected: form.get("updated_at"), schedule: form.get("scheduled_for") ?? "" });
    const scheduled = fields.schedule ? futureSchedule(fields.schedule) : undefined;
    if (scheduled && fields.privacy !== "public") throw new Error("Scheduled YouTube videos must become public. Choose Public or remove the schedule.");
    const client = await createClient(), { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error("Sign in before publishing.");
    const { data: asset, error } = await client.from("content_assets").select("id,title,body,status,channel,platform,metadata,updated_at").eq("organization_id", org).eq("id", assetId).maybeSingle();
    if (error || !asset || asset.status !== "approved" || ![asset.platform, asset.channel].includes("youtube")) throw new Error("Choose approved YouTube content from this workspace.");
    if (asset.updated_at !== fields.expected) throw new Error("This draft changed. Refresh and review it before publishing.");
    const file = libraryFiles(asset.metadata, org, asset.id).find(file => file.id === fields.fileId), problem = youtubeContentProblem(asset, file);
    if (problem) throw new Error(problem);
    const connection = await sourceAccess(org, "youtube");
    if (!connection.accountId) throw new Error("Reconnect the YouTube channel before uploading.");
    requestId = await claimPublication(org, asset, "youtube", user.id, scheduled, connection.accountId);
    const post = await startYouTubeUpload(org, assetId, requestId, fields.fileId, fields.privacy, scheduled);
    await saveDelivery(org, requestId, assetId, post);
    return { ok: post.status !== "failed", message: post.status === "published" ? "YouTube confirmed publication." : "Video uploaded. Check delivery status until YouTube confirms processing and visibility.", error: post.error };
  } catch (error) {
    const message = error instanceof z.ZodError ? "Choose a video, visibility and valid schedule." : error instanceof Error ? error.message : "Could not reach YouTube.";
    if (requestId) {
      try { if (error instanceof DeliveryRejected) await saveDelivery(org, requestId, assetId, { id: "", status: "failed", error: message }); else await noteUncertainDelivery(org, requestId, message); } catch { /* Keep the reserved request available for delivery recovery. */ }
    }
    return { ok: false, error: message };
  } finally {
    for (const path of ["/library", `/library/${assetId}`, "/publishing", "/calendar", "/dashboard"]) revalidatePath(path);
  }
}
