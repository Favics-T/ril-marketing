import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePublicLandingPageKey } from "@/lib/landing-page-url";
import { pageContent } from "@/lib/landing-page-content";

export interface LandingPage {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  activity_id: string | null;
  audience_segment_id: string | null;
  slug: string;
  title: string;
  headline: string;
  body: string;
  cta_label: string;
  registration_url: string | null;
  meta_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
}

export async function listLandingPages(organizationId: string, campaignId?: string): Promise<LandingPage[]> {
  const supabase = await createClient();
  let query = supabase.from("landing_pages").select("*")
    .eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(200);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load landing pages: ${error.message}`);
  return (data ?? []) as LandingPage[];
}

export async function getLandingPage(organizationId: string, id: string): Promise<LandingPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("landing_pages").select("*")
    .eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load landing page: ${error.message}`);
  return (data ?? null) as LandingPage | null;
}

/**
 * A published page as the public site loads it. "title" is the internal page
 * name for the dashboard, so it is never loaded here and can't leak into the
 * public page, its metadata or link previews (REN-417).
 */
export type PublicLandingPage = Omit<LandingPage, "title">;

export async function getPublishedLandingPage(slug: string): Promise<PublicLandingPage | null> {
  const admin = createAdminClient();
  const pageKey = parsePublicLandingPageKey(slug);
  const fields = "id, organization_id, campaign_id, activity_id, audience_segment_id, slug, headline, body, cta_label, registration_url, meta_description, status, created_at, updated_at, metadata";
  const publicPage = (page: PublicLandingPage): PublicLandingPage => ({ ...page, metadata: { builder: pageContent(page.metadata) } });
  if (pageKey) {
    const { data, error } = await admin.from("landing_pages").select(fields)
      .eq("status", "published").eq("id", pageKey.id).eq("slug", pageKey.slug).maybeSingle();
    if (error) throw new Error(`Failed to load public page: ${error.message}`);
    return data ? publicPage(data as PublicLandingPage) : null;
  }
  const { data, error } = await admin.from("landing_pages").select(fields)
    .eq("status", "published").eq("slug", slug).limit(2);
  if (error) throw new Error(`Failed to load public page: ${error.message}`);
  return data?.length === 1 ? publicPage(data[0] as PublicLandingPage) : null;
}

export async function getLandingPageConnections(organizationId: string, page: LandingPage) {
  const client = await createClient();
  const [leads, views, emails] = await Promise.all([
    client.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("landing_page_id", page.id),
    client.from("analytics_events").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("event_type", "pageview").eq("metadata->>landing_page_id", page.id),
    page.campaign_id ? client.from("email_campaigns").select("id,name,status").eq("organization_id", organizationId).eq("campaign_id", page.campaign_id).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], error: null }),
  ]);
  return { leads: leads.error ? null : leads.count ?? 0, views: views.error ? null : views.count ?? 0, emails: emails.error ? null : emails.data ?? [] };
}

export async function getLandingPageOptions(organizationId: string): Promise<{
  campaigns: Array<{ id: string; name: string }>;
  activities: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
}> {
  const supabase = await createClient();
  const [campaigns, activities, segments] = await Promise.all([
    supabase.from("campaigns").select("id,name").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
    supabase.from("activities").select("id,title").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
    supabase.from("audience_segments").select("id,name").eq("organization_id", organizationId).order("name").limit(200),
  ]);
  if (campaigns.error || activities.error || segments.error) throw new Error("Could not load landing page references.");
  return {
    campaigns: campaigns.data ?? [],
    activities: (activities.data ?? []).map((activity) => ({ id: activity.id, name: activity.title })),
    segments: segments.data ?? [],
  };
}
