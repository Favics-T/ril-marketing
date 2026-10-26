import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyDevice } from "@/lib/analytics/visitor-stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedLandingPage } from "@/lib/landing-pages";

const viewSchema = z.object({
  path: z
    .string()
    .trim()
    .max(300)
    .regex(/^\//, "Path must start with /.")
    .optional()
    .default("/"),
});

// Best-effort per-instance throttle, same stance as /api/capture/lead: the
// beacon fires once per navigation, so 90/min is generous for a human.
const hits = new Map<string, { count: number; resetAt: number }>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  cur.count += 1;
  return cur.count > 90;
}

const VISITOR_COOKIE = "ril_vid";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * analytics_events.organization_id is NOT NULL, and anonymous site traffic
 * belongs to no member's workspace — attribute it to the primary workspace
 * (the first-created org). Cached: one lookup per minute, not per hit.
 */
let orgCache: { id: string; at: number } | null = null;
async function resolveOrganizationId(): Promise<string | null> {
  if (orgCache && Date.now() - orgCache.at < 60_000) return orgCache.id;
  const { data } = await createAdminClient()
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!data) return null;
  orgCache = { id: data.id, at: Date.now() };
  return data.id;
}

/**
 * POST /api/track/view — anonymous pageview beacon (§6.26 website analytics).
 * Sets a first-party visitor cookie, classifies the device from the UA, and
 * best-effort inserts an analytics_events row. Never blocks or breaks a page:
 * the beacon swallows failures, and so do we.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (throttled(ip)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Expected a JSON body." },
        { status: 400 }
      );
    }
    const parsed = viewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid path." },
        { status: 400 }
      );
    }

    const device = classifyDevice(request.headers.get("user-agent") ?? "");
    const existing = request.cookies.get(VISITOR_COOKIE)?.value;
    const visitorId =
      existing && UUID_RE.test(existing) ? existing : randomUUID();

    const response = NextResponse.json({ ok: true });
    if (visitorId !== existing) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    // Crawlers get a cookie but never a row — the metric stays human-only.
    if (device === "bot") return response;

    try {
      const path = parsed.data.path.split(/[?#]/, 1)[0];
      const pageKey = path.match(/^\/p\/([a-z0-9-]+)\/?$/)?.[1];
      const landingPage = pageKey ? await getPublishedLandingPage(pageKey) : null;
      // An unpublished or unknown campaign page must never fall back to another workspace.
      const organizationId = path.startsWith("/p/") ? landingPage?.organization_id : await resolveOrganizationId();
      if (organizationId) {
        // Best-effort: a dropped pageview must never surface an error.
        await createAdminClient()
          .from("analytics_events")
          .insert({
            organization_id: organizationId,
            event_type: "pageview",
            metadata: { visitor_id: visitorId, path, device, ...(landingPage ? { landing_page_id: landingPage.id, campaign_id: landingPage.campaign_id } : {}) },
          });
      }
    } catch {
      // analytics is fire-and-forget
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
