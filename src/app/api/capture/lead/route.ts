import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRegistrationToken } from "@/lib/audience/guards";
import { scoreLead } from "@/lib/leads/scoring";
import { getPublishedLandingPage } from "@/lib/landing-pages";
import { CAPTURE_FILLABLE_COLUMNS, fillEmptyLeadFields, type CapturedLead } from "@/lib/leads/capture";

const captureSchema = z.object({
  token: z.string().trim().max(64).optional().default(""),
  page: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("A valid email is required.").max(320),
  name: z.string().trim().max(200).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  organisation: z.string().trim().max(200).optional().default(""),
  interest: z.string().trim().max(500).optional().default(""),
  marketingConsent: z.boolean().optional().default(false),
});

// Best-effort per-instance throttle for the public endpoint. Production
// deployments should add edge rate-limiting (e.g. Upstash) in front of this.
const hits = new Map<string, { count: number; resetAt: number }>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  cur.count += 1;
  return cur.count > 20;
}

/**
 * POST /api/capture/lead â€” public lead capture (Â§6.14, Â§6.16).
 * Optional registration token attributes the lead to the exact asset,
 * channel, campaign and segment that produced it. No session required.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (throttled(ip)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
    }
    const parsed = captureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid lead." },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const admin = createAdminClient();

    let organizationId: string | null = null;
    let assetId: string | null = null;
    let segmentId: string | null = null;
    let platform: string | null = null;
    let campaignId: string | null = null;
    let landingPageId: string | null = null;
    let registrationToken: string | null = null;

    // A landing page decides the workspace. A tracked-link token only adds
    // attribution, and only when it belongs to that same workspace (REN-417).
    const page = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.page) ? await getPublishedLandingPage(d.page) : null;
    if (page) {
      organizationId = page.organization_id;
      landingPageId = page.id;
      campaignId = page.campaign_id;
      segmentId = page.audience_segment_id;
      platform = "landing_page";
    }

    if (isRegistrationToken(d.token)) {
      let linkQuery = admin
        .from("registration_links")
        .select(
          "organization_id, channel, content_assets(id, campaign_id, audience_segment_id, platform)"
        )
        .eq("token", d.token);
      if (organizationId) linkQuery = linkQuery.eq("organization_id", organizationId);
      const { data: link } = await linkQuery
        .maybeSingle<{
          organization_id: string;
          channel: string;
          content_assets: {
            id: string;
            campaign_id: string | null;
            audience_segment_id: string | null;
            platform: string | null;
          } | null;
        }>();
      if (link?.content_assets && (!organizationId || link.organization_id === organizationId)) {
        organizationId = link.organization_id;
        assetId = link.content_assets.id;
        campaignId = campaignId ?? link.content_assets.campaign_id;
        segmentId = segmentId ?? link.content_assets.audience_segment_id;
        platform = link.content_assets.platform ?? link.channel;
        registrationToken = d.token;
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "A valid registration token is required." },
        { status: 400 }
      );
    }

    // Merge duplicates on email â€” never delete (Â§13). The response is the same
    // for new and existing leads, so it never reveals whether an email is on file.
    const { data: existing, error: lookupError } = await admin
      .from("leads")
      .select(CAPTURE_FILLABLE_COLUMNS)
      .eq("organization_id", organizationId)
      .ilike("email", d.email.replace(/[\\%_]/g, "\\$&"))
      .limit(1)
      .maybeSingle<CapturedLead & { id: string }>();
    if (lookupError) return NextResponse.json({ error: "Could not submit your details." }, { status: 500 });
    if (existing) {
      const patch: Record<string, unknown> = fillEmptyLeadFields(existing, {
        name: d.name, phone: d.phone, organisation: d.organisation, interest: d.interest,
        segmentId, platform, assetId, campaignId, landingPageId, registrationToken,
      });
      if (d.marketingConsent) Object.assign(patch, { marketing_consent: true, marketing_consent_at: new Date().toISOString() });
      if (Object.keys(patch).length) {
        const { error: updateError } = await admin.from("leads")
          .update(patch)
          .eq("organization_id", organizationId)
          .eq("id", existing.id);
        if (updateError) return NextResponse.json({ error: "Could not submit your details." }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { score, reason } = scoreLead({
      is_qualified: false,
      is_converted: false,
      funnel_stage: "captured",
      eventCount: 0,
    });

    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        organization_id: organizationId,
        email: d.email,
        name: d.name || null,
        phone: d.phone || null,
        organisation: d.organisation || null,
        interest: d.interest || null,
        funnel_stage: "captured",
        audience_segment_id: segmentId,
        source_platform: platform,
        source_content_asset_id: assetId,
        campaign_id: campaignId,
        landing_page_id: landingPageId,
        registration_token: registrationToken,
        marketing_consent: d.marketingConsent,
        marketing_consent_at: d.marketingConsent ? new Date().toISOString() : null,
        score,
        score_reason: reason,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !lead) {
      return NextResponse.json({ error: "Could not submit your details." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
