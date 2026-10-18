import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBufferPost } from "@/lib/integrations/buffer";
import { getWordPressConfig, getWordPressPost } from "@/lib/integrations/wordpress";
import { getStrapiConfig, getStrapiDelivery } from "@/lib/integrations/strapi";

export type DeliveryPost = { id: string; status: "queued" | "published" | "failed"; scheduledFor?: string | null; publishedAt?: string | null; url?: string; error?: string; sourceText?: string; sourceSlug?: string; seoSaved?: boolean | null };
export type PublishingAsset = { id: string; status: string; updated_at: string; metadata: Record<string, unknown> | null };

// Claim the asset version before any provider call; a second click cannot submit the same approved copy.
export async function claimPublication(org: string, asset: PublishingAsset, provider: "buffer" | "wordpress" | "strapi", actorId: string, scheduledFor?: string) {
  const previous = asset.metadata?.publishing as { state?: string } | undefined;
  if (previous && previous.state !== "failed") throw new Error("This asset already has a publishing request. Check its delivery status first.");
  const admin = createAdminClient();
  const { error: approvalError } = await admin.rpc("check_content_release", {p_asset: asset.id, p_organization: org});
  if (approvalError) throw new Error(approvalError.message);
  const id = randomUUID();
  const { data, error } = await admin.from("content_assets").update({
    status: "scheduled", scheduled_for: scheduledFor ?? new Date().toISOString(),
    metadata: { ...asset.metadata, publishing: { provider, publication_id: id } },
  }).eq("organization_id", org).eq("id", asset.id).eq("status", asset.status).eq("updated_at", asset.updated_at).select("id").maybeSingle();
  if (error || !data) throw new Error("This asset changed or could not be reserved. Refresh before publishing.");
  const { error: recordError } = await admin.from("publications").insert({ id, organization_id: org, content_asset_id: asset.id, channel: provider, status: "queued", scheduled_for: scheduledFor ?? null, actor_id: actorId });
  if (recordError) {
    await admin.from("content_assets").update({ status: asset.status, scheduled_for: null, metadata: asset.metadata ?? {} }).eq("organization_id", org).eq("id", asset.id).contains("metadata", { publishing: { publication_id: id } });
    throw new Error("Could not record the publishing request. Nothing was sent to the provider.");
  }
  return id;
}

export async function saveDelivery(org: string, publicationId: string, assetId: string, post: DeliveryPost) {
  const admin = createAdminClient();
  // Keep the request queued until both the asset and provider receipt are saved. Sync can recover a partial write.
  const { error: receiptError } = await admin.from("publications").update({ external_id: post.id, url: post.url ?? null, scheduled_for: post.scheduledFor ?? null, error: post.error ?? null }).eq("organization_id", org).eq("id", publicationId).in("status", ["queued", "scheduled", "missed"]);
  if (receiptError) throw new Error("Provider accepted the request, but its receipt could not be saved. Check the provider before retrying.");
  const { data: asset, error: loadError } = await admin.from("content_assets").select("metadata,status,updated_at").eq("organization_id", org).eq("id", assetId).maybeSingle();
  if (loadError || !asset) throw new Error("Provider receipt saved. Refresh delivery status to finish updating the asset.");
  const metadata = { ...(asset.metadata ?? {}) };
  if (post.url) metadata.published_url = post.url;
  const request = metadata.publishing as { provider?: string } | undefined;
  if (request?.provider === "wordpress" && post.status !== "failed") {
    metadata.wordpress_post_id = post.id;
    if (post.url) metadata.wordpress_url = post.url;
    if (post.status === "published") metadata.wordpress_published_at = post.publishedAt ?? new Date().toISOString();
    if (post.seoSaved !== undefined) metadata.wordpress_seo_saved = post.seoSaved;
  }
  if (post.status === "failed") metadata.publishing = { ...(metadata.publishing as Record<string, unknown>), state: "failed" };
  const { data: updated, error: assetError } = await admin.from("content_assets").update({
    status: post.status === "published" ? asset.status === "analysing" ? "analysing" : "published" : post.status === "failed" ? "approved" : "scheduled",
    published_at: post.status === "published" ? post.publishedAt ?? new Date().toISOString() : null,
    scheduled_for: post.status === "failed" ? null : post.scheduledFor ?? null, metadata,
  }).eq("organization_id", org).eq("id", assetId).eq("status", asset.status).eq("updated_at", asset.updated_at).contains("metadata", { publishing: { publication_id: publicationId } }).select("id").maybeSingle();
  if (assetError || !updated) throw new Error("Provider receipt saved, but the asset changed. Refresh delivery status before taking further action.");
  const deliveryStatus = post.status === "queued" && request?.provider === "wordpress" ? post.scheduledFor && Date.parse(post.scheduledFor) <= Date.now() ? "missed" : "scheduled" : post.status;
  const { error } = await admin.from("publications").update({ status: deliveryStatus, published_at: post.status === "published" ? post.publishedAt ?? new Date().toISOString() : null }).eq("organization_id", org).eq("id", publicationId).in("status", ["queued", "scheduled", "missed"]);
  if (error) throw new Error("Asset updated, but its delivery record needs another status check.");
}

export async function noteUncertainDelivery(org: string, id: string, message: string) {
  await createAdminClient().from("publications").update({ error: `Delivery not confirmed. Check the provider before retrying. ${message}`.slice(0, 1000) }).eq("organization_id", org).eq("id", id).in("status", ["queued", "scheduled", "missed"]);
}

export async function syncPublication(org: string, assetId: string) {
  const { data: publication, error } = await createAdminClient().from("publications").select("id,channel,external_id,status").eq("organization_id", org).eq("content_asset_id", assetId).in("status", ["queued", "scheduled", "missed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Could not read the publishing request.");
  if (!publication) return "No pending delivery.";
  if (!publication.external_id && publication.channel !== "strapi") throw new Error("The provider receipt is unavailable. Check the provider account before sending again; delivery may have started.");
  const {data: pendingChange, error: scheduleError} = await createAdminClient().from("content_schedule_changes").select("id").eq("organization_id", org).eq("content_asset_id", assetId).eq("status", "pending").maybeSingle();
  if (scheduleError) throw new Error("Could not check pending schedule changes. Refresh before checking delivery.");
  if (pendingChange) return "A schedule change needs recovery from the calendar.";
  let post: DeliveryPost;
  if (publication.channel === "buffer") post = await getBufferPost(org, publication.external_id);
  else if (publication.channel === "wordpress") {
    const config = await getWordPressConfig(org);
    if (!config) throw new Error("Reconnect WordPress to check delivery.");
    post = await getWordPressPost(config, Number(publication.external_id));
  } else if (publication.channel === "strapi") {
    const config = await getStrapiConfig(org);
    if (!config) throw new Error("Reconnect Strapi to check delivery.");
    post = await getStrapiDelivery(config, assetId);
  } else return "This provider does not support delivery checks.";
  await saveDelivery(org, publication.id, assetId, post);
  return post.status === "published" ? "Publication confirmed." : post.status === "failed" ? `Delivery stopped. ${post.error ?? "Review the post before resubmitting."}` : "The provider still has this post queued.";
}

export async function recoverPublicationReceipt(org: string, assetId: string, externalId: string) {
  if (!externalId.trim() || externalId.length > 200) throw new Error("Enter the provider's post ID.");
  const admin = createAdminClient();
  const { data: asset } = await admin.from("content_assets").select("id,status,body,metadata").eq("organization_id", org).eq("id", assetId).maybeSingle();
  const publishing = asset?.metadata?.publishing as { provider?: string; publication_id?: string } | undefined;
  if (asset?.status !== "scheduled" || !publishing?.publication_id) throw new Error("There is no reserved publishing request to recover.");
  const { data: publication } = await admin.from("publications").select("id,external_id").eq("organization_id", org).eq("content_asset_id", assetId).eq("id", publishing.publication_id).in("status", ["queued", "scheduled", "missed"]).maybeSingle();
  if (!publication || publication.external_id) throw new Error("This request already has a receipt. Use Check delivery status.");
  let post: DeliveryPost;
  if (publishing.provider === "buffer") {
    post = await getBufferPost(org, externalId.trim());
    if (!asset.body?.trim() || post.sourceText?.trim() !== asset.body.trim()) throw new Error("That Buffer post does not match this asset's approved text.");
  } else if (publishing.provider === "wordpress") {
    const config = await getWordPressConfig(org);
    if (!config) throw new Error("Reconnect WordPress to recover delivery.");
    post = await getWordPressPost(config, Number(externalId));
    if (post.sourceSlug !== `ril-${assetId}`) throw new Error("That WordPress post does not belong to this asset.");
  } else if (publishing.provider === "strapi") {
    const config = await getStrapiConfig(org);
    if (!config) throw new Error("Reconnect Strapi to recover delivery.");
    post = await getStrapiDelivery(config, assetId);
    if (post.id !== externalId.trim()) throw new Error("That Strapi entry does not belong to this content asset.");
  } else throw new Error("Unsupported publishing provider.");
  await saveDelivery(org, publication.id, assetId, post);
  return "Provider receipt verified and delivery status recovered. No new post was sent.";
}
