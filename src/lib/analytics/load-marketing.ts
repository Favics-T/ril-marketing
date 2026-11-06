import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getKpiProgress } from "@/lib/audience/kpis";
import { buildMarketingAnalytics, type AnalyticsAsset, type AnalyticsEmailEvent, type AnalyticsLead, type AnalyticsPeriod, type AnalyticsVisit } from "./marketing";

export async function loadMarketingAnalytics(organizationId: string, period: AnalyticsPeriod) {
  const client = await createClient();
  const [leads, assets, visits, segments, campaigns, emails, goals] = await Promise.all([
    client.from("leads").select("created_at,is_qualified,is_converted,source_platform,audience_segment_id,campaign_id,marketing_consent", { count: "exact" })
      .eq("organization_id", organizationId).gte("created_at", period.previousFrom).lt("created_at", period.to).order("created_at", { ascending: false }).limit(10000),
    client.from("content_assets").select("id,title,created_at,status,channel,platform,format,views,clicks,shares,comments,saves,registrations", { count: "exact" })
      .eq("organization_id", organizationId).gte("created_at", period.from).lt("created_at", period.to).order("created_at", { ascending: false }).limit(5000),
    client.from("analytics_events").select("created_at,metadata", { count: "exact" })
      .eq("organization_id", organizationId).eq("event_type", "pageview").or("metadata->>path.eq./,metadata->>path.like./p/%").gte("created_at", period.previousFrom).lt("created_at", period.to).order("created_at", { ascending: false }).limit(20000),
    client.from("audience_segments").select("id,name").eq("organization_id", organizationId).limit(1000),
    client.from("campaigns").select("id,name").eq("organization_id", organizationId).limit(1000),
    client.from("email_provider_events").select("event_type,occurred_at", { count: "exact" }).eq("organization_id", organizationId).gte("occurred_at", period.from).lt("occurred_at", period.to).order("occurred_at", { ascending: false }).limit(10000),
    getKpiProgress(organizationId).then(data => ({ data, error: false })).catch(() => ({ data: [], error: true })),
  ]);
  return {
    analytics: buildMarketingAnalytics(period, {
      leads: { ...leads, data: leads.data as AnalyticsLead[] | null },
      assets: { ...assets, data: assets.data as AnalyticsAsset[] | null },
      visits: { ...visits, data: visits.data as AnalyticsVisit[] | null },
      emails: { ...emails, data: emails.data as AnalyticsEmailEvent[] | null },
      segments: segments.data ?? [], campaigns: campaigns.data ?? [],
    }),
    goals: goals.data,
    goalsUnavailable: goals.error,
    referencesUnavailable: Boolean(segments.error || campaigns.error),
  };
}
