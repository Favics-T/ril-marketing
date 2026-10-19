import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_PLATFORMS } from "@/lib/content/manual-posting";
import type { ContentAssetRow } from "@/lib/content/assets";

export const SOCIAL_QUEUE_STAGES = ["all", "drafts", "review", "approved", "scheduled", "published"] as const;
export type SocialQueueStage = typeof SOCIAL_QUEUE_STAGES[number];

export async function listSocialQueue(organizationId: string, filters: { stage?: string; platform?: string; page?: string } = {}) {
  const stage: SocialQueueStage = SOCIAL_QUEUE_STAGES.find(value => value === filters.stage) ?? "all";
  const platform = SOCIAL_PLATFORMS.find(value => value === filters.platform) ?? "all";
  const parsedPage = Number(filters.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const client = await createClient();
  const social = SOCIAL_PLATFORMS.join(",");
  let query = client.from("content_assets").select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .or(`channel.in.(${social}),platform.in.(${social})`)
    .in("status", ["idea","ai_generated","editing","review", "approved", "scheduled", "published", "analysing"])
    .order("updated_at", { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (stage === "published") query = query.in("status", ["published", "analysing"]);
  else if (stage === "drafts") query = query.in("status", ["idea","ai_generated","editing"]);
  else if (stage !== "all") query = query.eq("status", stage);
  if (platform !== "all") {
    const values = platform === "x" || platform === "twitter" ? "x,twitter" : platform;
    query = query.or(`platform.in.(${values}),and(platform.is.null,channel.in.(${values}))`);
  }
  const { data, count, error } = await query;
  if (error) throw new Error("Could not load social posts. Refresh to try again.");
  return { assets: (data ?? []) as ContentAssetRow[], total: count ?? 0, page, stage, platform };
}
