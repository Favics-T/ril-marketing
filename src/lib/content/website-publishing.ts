import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ContentAssetRow } from "@/lib/content/assets";
import type { PublicationRow } from "@/lib/content/publications";

export const WEBSITE_STAGES = ["all", "drafts", "review", "approved", "scheduled", "published"] as const;
export const WEBSITE_PAGE_SIZE = 10;
export type WebsiteFilters = { stage?: string; q?: string; page?: string; campaign?: string };

export async function listWebsiteArticles(organizationId: string, filters: WebsiteFilters = {}) {
  const stage = WEBSITE_STAGES.find(value => value === filters.stage) ?? "all";
  const parsedPage = Number(filters.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const q = (filters.q ?? "").trim().slice(0, 200);
  const campaign = z.uuid().safeParse(filters.campaign).success ? filters.campaign : undefined;
  const client = await createClient();
  let query = client.from("content_assets").select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .or("channel.eq.website,format.eq.blog")
    .in("status", ["idea", "ai_generated", "editing", "review", "approved", "scheduled", "published", "analysing"])
    .order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * WEBSITE_PAGE_SIZE, page * WEBSITE_PAGE_SIZE - 1);
  if (stage === "published") query = query.in("status", ["published", "analysing"]);
  else if (stage === "drafts") query = query.in("status", ["idea", "ai_generated", "editing"]);
  else if (stage !== "all") query = query.eq("status", stage);
  if (campaign) query = query.eq("campaign_id", campaign);
  const terms = q.normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 6);
  for (const term of terms) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  const { data, count, error } = await query;
  if (error) throw new Error("Articles could not be loaded. Refresh to try again.");
  return { articles: (data ?? []) as ContentAssetRow[], total: count ?? 0, stage, page, q, campaign };
}

export async function listWebsiteDeliveryIssues(organizationId: string, campaignId?: string) {
  const client = await createClient();
  // The inner join prevents a campaign filter from returning unrelated deliveries.
  let query = client.from("publications")
    .select("*,asset:content_assets!inner(title,campaign_id,metadata)")
    .eq("organization_id", organizationId).in("channel", ["wordpress", "strapi"])
    .in("status", ["failed", "missed", "queued", "scheduled"])
    .order("created_at", { ascending: false }).limit(50);
  if (campaignId && z.uuid().safeParse(campaignId).success) query = query.eq("asset.campaign_id", campaignId);
  const { data, error } = await query;
  if (error) throw new Error("Delivery issues could not be loaded. Open an article to check its history.");
  const rows = (data ?? []) as Array<PublicationRow & { asset: { title: string; metadata: Record<string, unknown> | null } }>;
  return rows.filter(row => {
    const request = row.asset.metadata?.publishing as { publication_id?: string } | undefined;
    // A failed receipt from an older attempt is history, not a current failure.
    if (request?.publication_id && request.publication_id !== row.id) return false;
    return row.status === "failed" || row.status === "missed" || Boolean(row.error) || Boolean(row.scheduled_for && Date.parse(row.scheduled_for) < Date.now());
  });
}

export function articleSeo(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.seo;
  const seo = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return { title: typeof seo.title === "string" ? seo.title : "", description: typeof seo.description === "string" ? seo.description : "" };
}
