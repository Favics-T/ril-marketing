"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { isSocialAsset, parseLivePostUrl } from "@/lib/content/manual-posting";

export type ManualPostResult = { ok: boolean; error?: string; warning?: string };

export async function recordManualPost(assetId: string, formData: FormData): Promise<ManualPostResult> {
  try {
    const organizationId = await requireOrganizationId();
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { ok: false, error: "Sign in before recording a post." };
    const rawUrl = formData.get("live_url");
    const liveUrl = typeof rawUrl === "string" && rawUrl.length <= 2000 ? parseLivePostUrl(rawUrl) : null;
    if (!liveUrl) return { ok: false, error: "Paste the HTTPS link to the live post, rather than a channel homepage." };
    if (formData.get("confirm_posted") !== "on") return { ok: false, error: "Confirm that the content has already been posted." };
    const { data: asset, error } = await client.from("content_assets").select("id,status,channel,platform,body,metadata,updated_at")
      .eq("organization_id", organizationId).eq("id", assetId).maybeSingle();
    if (error) return { ok: false, error: "Could not load this asset. Try again." };
    if (!asset) return { ok: false, error: "Content asset not found." };
    if (asset.metadata?.publishing && (asset.metadata.publishing as { state?: string }).state !== "failed") return { ok: false, error: "A provider owns this publishing request. Check its delivery status before recording another post." };
    if (!isSocialAsset(asset.channel, asset.platform)) return { ok: false, error: "Manual social posting is available for social-channel assets." };
    if (!["approved", "scheduled"].includes(asset.status)) return { ok: false, error: "Only approved or scheduled content can be marked as posted." };
    if (!asset.body?.trim()) return { ok: false, error: "Add and approve the post copy first." };
    const recordedAt = new Date().toISOString();
    // The live link, actor and status are committed together; the version guard prevents stale form submissions.
    const { data: saved, error: saveError } = await client.from("content_assets").update({
      status: "published", published_at: recordedAt,
      metadata: { ...asset.metadata, manual_post: { url: liveUrl, recorded_at: recordedAt, recorded_by: user.id, from_status: asset.status } },
    }).eq("organization_id", organizationId).eq("id", assetId).eq("status", asset.status).eq("updated_at", asset.updated_at).select("id").maybeSingle();
    if (saveError) return { ok: false, error: "Could not save the post record. Your asset has not been marked as posted." };
    if (!saved) return { ok: false, error: "This asset changed while you were posting. Refresh before trying again." };
    const { error: historyError } = await client.from("asset_approvals").insert({
      organization_id: organizationId, content_asset_id: assetId, actor_id: user.id,
      from_status: asset.status, to_status: "published", note: `Manually posted: ${liveUrl}`,
    });
    for (const path of ["/library", `/library/${assetId}`, "/calendar", "/dashboard", "/analytics", "/approvals"]) revalidatePath(path);
    return { ok: true, ...(historyError ? { warning: "Post saved with its link and recorder. The separate transition history could not be updated." } : {}) };
  } catch { return { ok: false, error: "Could not record the post. Check your connection and try again." }; }
}
