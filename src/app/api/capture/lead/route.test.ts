import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), page: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/landing-pages", () => ({ getPublishedLandingPage: mocks.page }));
import { POST } from "./route";

afterEach(() => vi.clearAllMocks());
function setup(lookupError = false, consentError = false) {
  mocks.page.mockResolvedValue({ id: "page", organization_id: "org" });
  const db = databaseMock(q => q.operation === "update"
    ? { error: consentError ? { message: "Write failed" } : null }
    : { data: lookupError ? null : { id: "lead" }, error: lookupError ? { message: "Lookup failed" } : null });
  mocks.admin.mockReturnValue(db);
  return db;
}
const request = (email: string, marketingConsent = false) => new Request("http://localhost/api/capture/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "test", email, marketingConsent }) });

describe("public lead capture", () => {
  it("matches underscores in email addresses literally, case-insensitively", async () => {
    const db = setup();
    expect((await POST(request("first_last@example.com"))).status).toBe(200);
    expect(db.queries[0].filters).toContainEqual({ method: "ilike", column: "email", value: "first\\_last@example.com" });
  });
  it("returns a retryable error when duplicate lookup fails", async () => {
    const db = setup(true);
    expect((await POST(request("test@example.com"))).status).toBe(500);
    expect(db.queries.some(q => q.operation === "insert")).toBe(false);
  });
  it("does not report consent saved when the write fails", async () => {
    setup(false, true);
    expect((await POST(request("test@example.com", true))).status).toBe(500);
  });
  it("rejects malformed JSON before accessing the database", async () => {
    expect((await POST(new Request("http://localhost/api/capture/lead", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});

describe("public lead capture (REN-417)", () => {
  const PAGE = { id: "page-a", organization_id: "org-a", campaign_id: "campaign-page", audience_segment_id: "segment-page" };
  const TOKEN = "ril_abcDEF123456";
  const LINK = { organization_id: "org-a", channel: "linkedin", content_assets: { id: "asset-1", campaign_id: "campaign-asset", audience_segment_id: "segment-asset", platform: "linkedin" } };
  const emptyLead = { id: "lead-1", name: null, phone: null, organisation: null, interest: null, audience_segment_id: null, source_platform: null, source_content_asset_id: null, campaign_id: null, landing_page_id: null, registration_token: null };

  function setupCapture({ existing = null as Record<string, unknown> | null, link = LINK as typeof LINK | null } = {}) {
    mocks.page.mockResolvedValue(PAGE);
    const db = databaseMock((q: Query) => {
      if (q.table === "registration_links") {
        // Like the real query: a filter on another workspace finds nothing.
        const orgFilter = q.filters.find((f) => f.method === "eq" && f.column === "organization_id");
        return { data: link && (!orgFilter || orgFilter.value === link.organization_id) ? link : null, error: null };
      }
      if (q.table === "leads" && q.operation === "select") return { data: existing, error: null };
      if (q.table === "leads" && q.operation === "insert") return { data: { id: "lead-new" }, error: null };
      return { error: null };
    });
    mocks.admin.mockReturnValue(db);
    return db;
  }
  // A fresh client address per request keeps these tests clear of the per-IP throttle.
  let client = 0;
  const submit = (body: Record<string, unknown>) => POST(new Request("http://localhost/api/capture/lead", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${++client}` }, body: JSON.stringify({ page: "founders-week", email: "ada@example.com", ...body }) }));
  const inserted = (db: ReturnType<typeof setupCapture>) => db.queries.find((q) => q.table === "leads" && q.operation === "insert")?.payload as Record<string, unknown> | undefined;
  const updated = (db: ReturnType<typeof setupCapture>) => db.queries.find((q) => q.table === "leads" && q.operation === "update")?.payload as Record<string, unknown> | undefined;

  it("gives new and existing leads the same response", async () => {
    setupCapture();
    const fresh = await submit({ name: "Ada" });
    setupCapture({ existing: { ...emptyLead, name: "Ada" } });
    const repeat = await submit({ name: "Ada" });
    expect(fresh.status).toBe(200);
    expect(repeat.status).toBe(200);
    expect(await fresh.json()).toEqual({ ok: true });
    expect(await repeat.json()).toEqual({ ok: true });
  });

  it("fills only empty fields on an existing lead", async () => {
    const db = setupCapture({ existing: { ...emptyLead, name: "Ada Lovelace", organisation: "Analytical Engines", source_platform: "linkedin" } });
    await submit({ name: "Someone Else", phone: "+234 801 234 5678", organisation: "Other Org", interest: "Founder programme" });
    expect(updated(db)).toEqual({
      phone: "+234 801 234 5678", interest: "Founder programme",
      audience_segment_id: "segment-page", campaign_id: "campaign-page", landing_page_id: "page-a",
    });
    expect(inserted(db)).toBeUndefined();
  });

  it("does not write to an existing lead that already has every field", async () => {
    const db = setupCapture({ existing: { id: "lead-1", name: "Ada", phone: "1", organisation: "O", interest: "I", audience_segment_id: "s", source_platform: "p", source_content_asset_id: "a", campaign_id: "c", landing_page_id: "l", registration_token: "t" } });
    expect((await submit({ name: "Changed", phone: "2" })).status).toBe(200);
    expect(updated(db)).toBeUndefined();
  });

  it("still records marketing consent on an existing lead", async () => {
    const db = setupCapture({ existing: { ...emptyLead, landing_page_id: "page-a", campaign_id: "c", audience_segment_id: "s" } });
    await submit({ marketingConsent: true });
    expect(updated(db)).toMatchObject({ marketing_consent: true });
  });

  it("saves the phone number on a new lead", async () => {
    const db = setupCapture();
    await submit({ phone: " +234 801 234 5678 " });
    expect(inserted(db)).toMatchObject({ phone: "+234 801 234 5678" });
  });

  it("saves a token from this page's workspace with its attribution", async () => {
    const db = setupCapture();
    await submit({ token: TOKEN });
    const linkQuery = db.queries.find((q) => q.table === "registration_links");
    expect(linkQuery?.filters).toContainEqual({ method: "eq", column: "organization_id", value: "org-a" });
    expect(inserted(db)).toMatchObject({
      organization_id: "org-a", registration_token: TOKEN, source_content_asset_id: "asset-1", source_platform: "linkedin",
      landing_page_id: "page-a", campaign_id: "campaign-page", audience_segment_id: "segment-page",
    });
  });

  it("ignores a token from another workspace and keeps the lead in the page's workspace", async () => {
    const db = setupCapture({ link: { ...LINK, organization_id: "org-b" } });
    await submit({ token: TOKEN });
    expect(inserted(db)).toMatchObject({ organization_id: "org-a", registration_token: null, source_content_asset_id: null, source_platform: "landing_page", landing_page_id: "page-a" });
  });

  it("ignores a token that matches no link", async () => {
    const db = setupCapture({ link: null });
    await submit({ token: TOKEN });
    expect(inserted(db)).toMatchObject({ organization_id: "org-a", registration_token: null, landing_page_id: "page-a" });
  });

  it("never looks up or saves a malformed token", async () => {
    const db = setupCapture();
    await submit({ token: "not-a-token" });
    expect(db.queries.some((q) => q.table === "registration_links")).toBe(false);
    expect(inserted(db)).toMatchObject({ registration_token: null });
  });

  it("fills a missing token on an existing lead only when it has no source yet", async () => {
    const fresh = setupCapture({ existing: { ...emptyLead } });
    await submit({ token: TOKEN });
    expect(updated(fresh)).toMatchObject({ registration_token: TOKEN, source_content_asset_id: "asset-1", source_platform: "linkedin" });

    const sourced = setupCapture({ existing: { ...emptyLead, source_platform: "instagram" } });
    await submit({ token: TOKEN });
    expect(updated(sourced)).not.toHaveProperty("registration_token");
    expect(updated(sourced)).not.toHaveProperty("source_platform");
  });

  it("still accepts a valid token without a landing page", async () => {
    const db = setupCapture();
    await submit({ page: "", token: TOKEN });
    expect(mocks.page).not.toHaveBeenCalled();
    expect(inserted(db)).toMatchObject({ organization_id: "org-a", registration_token: TOKEN, landing_page_id: null, campaign_id: "campaign-asset" });
  });
});
