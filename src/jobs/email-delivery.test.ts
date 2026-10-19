import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/integrations/resend", () => ({ getResendConfig: mocks.config }));
import { processEmailDeliveryBatch } from "./email-delivery";

const lead = { id: "lead", organization_id: "org", email: "optin@example.com", name: "Test", marketing_consent: true, email_unsubscribed_at: null, email_suppressed_at: null };
const campaign = { id: "campaign", organization_id: "org", status: "scheduled", delivery_authorized_at: "2026-10-01", subject: "Update", preview_text: "", body: "Approved content", name: "Test" };
const metadata = { nurture: true, nurture_sequence_id: "sequence", nurture_enrollment_id: "enrollment", nurture_step: 1 };

function setup(options: { sequence?: string; enrollment?: string; revoked?: boolean; countError?: boolean; readError?: boolean; nurture?: boolean } = {}) {
  const db = databaseMock((q: Query) => {
    if (q.operation !== "select") return { data: q.columns ? { id: "delivery" } : null, error: null };
    if (q.table === "email_campaigns") {
      if (q.single) return options.readError ? { error: { message: "Database unavailable" } } : { data: { ...campaign, metadata: options.nurture === false ? {} : metadata } };
      return { data: q.columns === "id" ? [{ id: "campaign" }] : [campaign] };
    }
    if (q.table === "leads") return { data: q.single ? { ...lead, marketing_consent: !options.revoked } : [lead] };
    if (q.table === "nurture_sequences") return { data: { status: options.sequence ?? "active", created_by: "author", approved_by: "reviewer" } };
    if (q.table === "nurture_enrollments") return { data: { status: options.enrollment ?? "active", current_step: 1, lead_id: "lead", sequence_id: "sequence" } };
    if (q.head) return options.countError ? { count: null, error: { message: "Count failed" } } : { count: options.sequence === "paused" || options.readError ? 1 : 0 };
    return { data: [{ id: "delivery", organization_id: "org", campaign_id: "campaign", lead_id: "lead", attempts: 0, unsubscribe_token_hash: "hash" }] };
  });
  mocks.admin.mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "x".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
  mocks.config.mockResolvedValue({ apiKey: "test", fromName: "Test", fromEmail: "sender@example.com", webhookSecret: "test" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "message" }), { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("email delivery authorization at send time", () => {
  it("does not claim queued email when unsubscribe and webhook URLs would point at localhost", async () => {
    const db = setup({});
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3001");
    await expect(processEmailDeliveryBatch()).rejects.toThrow("public HTTPS");
    expect(fetch).not.toHaveBeenCalled();
    expect(db.queries.some(q => q.operation === "update" && q.payload && !Array.isArray(q.payload) && q.payload.status === "sending")).toBe(false);
  });
  it.each(["paused", "draft"])("holds retries when the nurture sequence is %s", async (sequence) => {
    const db = setup({ sequence });
    expect((await processEmailDeliveryBatch()).pending).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.queries.some(q => q.payload && !Array.isArray(q.payload) && q.payload.status === "queued" && q.payload.attempts === 0)).toBe(true);
  });
  it.each(["cancelled", "completed", "suppressed"])("does not send for a %s enrollment", async (enrollment) => {
    setup({ enrollment });
    expect((await processEmailDeliveryBatch()).sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rechecks consent after the recipient list was loaded", async () => {
    setup({ revoked: true, nurture: false });
    expect((await processEmailDeliveryBatch()).sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends an active approved step with an idempotency key and unsubscribe link", async () => {
    setup();
    expect((await processEmailDeliveryBatch()).sent).toBe(1);
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "ril-delivery-delivery" }), body: expect.stringContaining("/api/email/unsubscribe") }));
  });
  it("defers database errors instead of cancelling the recipient", async () => {
    const db = setup({ readError: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await processEmailDeliveryBatch()).pending).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.queries.some(q => q.payload && !Array.isArray(q.payload) && q.payload.status === "cancelled")).toBe(false);
    consoleError.mockRestore();
  });
  it("does not mark a campaign complete when its remaining-delivery count fails", async () => {
    const db = setup({ countError: true });
    await processEmailDeliveryBatch();
    expect(db.queries.some(q => q.table === "email_campaigns" && q.operation === "update")).toBe(false);
  });
  it("limits interrupted-send recovery to the requested workspace and campaign", async () => {
    const db = setup();
    await processEmailDeliveryBatch({ organizationId: "org", campaignId: "campaign" });
    expect(db.queries[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "org" },
      { method: "eq", column: "campaign_id", value: "campaign" },
    ]));
  });
});
