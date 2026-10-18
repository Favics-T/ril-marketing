import type { Metadata } from "next";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isReviewerRole } from "@/lib/audience/access";
import { ContentCalendar, type CalendarAsset } from "@/components/content/content-calendar";
import { zonedDayKey } from "@/lib/time";
import { needsSecondApproval } from "@/lib/content/workflow";
export const metadata: Metadata = { title: "Content Calendar" };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const org = await requireOrganizationId();
  const client = await createClient();
  const [result, campaigns, role, wordpress, params, signoffs] = await Promise.all([
    client.from("content_assets").select("id,title,status,channel,platform,format,campaign_id,scheduled_for,published_at,updated_at,metadata,approval_revision,approval_category,sensitivity", { count: "exact" }).eq("organization_id", org).order("created_at", { ascending: false }).range(0, 4999),
    client.from("campaigns").select("id,name").eq("organization_id", org).order("name"),
    getUserRole(org),
    client.from("integrations").select("status").eq("organization_id", org).eq("key", "cms_wordpress").maybeSingle(),
    searchParams,
    client.from("content_signoffs").select("content_asset_id,approval_revision,tier").eq("organization_id", org).limit(10000),
  ]);
  if (result.error || campaigns.error || signoffs.error) throw new Error("Could not load the calendar. Refresh to try again.");
  const recorded = new Map<string, number>();
  for (const signoff of signoffs.data ?? []) {
    const key = `${signoff.content_asset_id}:${signoff.approval_revision}`;
    recorded.set(key, (recorded.get(key) ?? 0) + 1);
  }
  const assets = (result.data ?? []).map(asset => ({...asset, review_required: (recorded.get(`${asset.id}:${asset.approval_revision}`) ?? 0) < (needsSecondApproval(asset.approval_category, asset.sensitivity) ? 2 : 1)}));
  const initialDay = params.m && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.m) ? params.m + "-01" : zonedDayKey(new Date());
  return <div className="workspace-page"><ContentCalendar assets={assets as CalendarAsset[]} campaigns={campaigns.data ?? []} canSchedule={isReviewerRole(role)} wordpressConnected={wordpress.data?.status === "connected"} initialDay={initialDay} today={zonedDayKey(new Date())} truncated={(result.count ?? 0) > (result.data?.length ?? 0)} /></div>;
}
