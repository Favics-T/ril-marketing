import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn(), role: vi.fn(), org: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createEmailFromNewsletter, updateEmailDraft } from "./email-from-newsletter";

const ASSET = "11111111-1111-4111-8111-111111111111";
const EMAIL = "22222222-2222-4222-8222-222222222222";
const SEGMENT = "33333333-3333-4333-8333-333333333333";
const newsletter = {
  id: ASSET, title: "Inside the Lagos Solar Hack", body: "## What happened\n\nTeams built working prototypes.", format: "newsletter", status: "approved",
  metadata: { subject_lines: ["Inside the Lagos Solar Hack", "Five prototypes worth watching"], preview_text: "The fridge that texts you." },
  audience_segment_id: SEGMENT, campaign_id: null,
};

type Options = { asset?: Record<string, unknown> | null; existing?: Array<{ id: string }>; segment?: boolean; email?: { id: string; status: string } | null; updated?: boolean };
function setup(options: Options = {}) {
  const db = databaseMock((q: Query): QueryResult => {
    if (q.table === "content_assets") return { data: options.asset === undefined ? newsletter : options.asset };
    if (q.table === "audience_segments") return { data: options.segment === false ? null : { id: SEGMENT } };
    if (q.table === "email_campaigns" && q.operation === "insert") return { data: { id: EMAIL } };
    if (q.table === "email_campaigns" && q.operation === "update") return { data: options.updated === false ? null : { id: EMAIL } };
    if (q.table === "email_campaigns" && q.single) return { data: options.email === undefined ? { id: EMAIL, status: "draft" } : options.email };
    if (q.table === "email_campaigns") return { data: options.existing ?? [] };
    return { data: null };
  });
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: { id: "author" } } }) } });
  return db;
}

beforeEach(() => {
  mocks.org.mockResolvedValue("org");
  mocks.role.mockResolvedValue("marketing_manager");
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT ${path}`); });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network calls in these tests."); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

const inserts = (db: ReturnType<typeof setup>) => db.queries.filter((q) => q.operation === "insert");

describe("createEmailFromNewsletter", () => {
  it("creates a draft email from the approved newsletter and opens it", async () => {
    const db = setup();
    await expect(createEmailFromNewsletter(ASSET)).rejects.toThrow(`NEXT_REDIRECT /email/${EMAIL}`);
    const [insert] = inserts(db);
    expect(insert.table).toBe("email_campaigns");
    expect(insert.payload).toEqual({
      organization_id: "org", campaign_id: null, audience_segment_id: SEGMENT,
      name: "Newsletter · Inside the Lagos Solar Hack", subject: "Inside the Lagos Solar Hack",
      preview_text: "The fridge that texts you.", body: "What happened\n\nTeams built working prototypes.",
      status: "draft", created_by: "author",
      metadata: { source: "newsletter", source_content_asset_id: ASSET, subject_options: ["Inside the Lagos Solar Hack", "Five prototypes worth watching"] },
    });
    expect(db.queries.find((q) => q.table === "content_assets")?.filters).toContainEqual({ method: "eq", column: "organization_id", value: "org" });
  });

  it("opens the existing email instead of creating a second one", async () => {
    const db = setup({ existing: [{ id: "existing-email" }] });
    await expect(createEmailFromNewsletter(ASSET)).rejects.toThrow("NEXT_REDIRECT /email/existing-email");
    expect(inserts(db)).toHaveLength(0);
    const lookup = db.queries.find((q) => q.table === "email_campaigns");
    expect(lookup?.filters).toContainEqual({ method: "contains", column: "metadata", value: { source_content_asset_id: ASSET } });
  });

  it.each(["member", "leadership", null])("refuses the %s role before reading anything", async (role) => {
    mocks.role.mockResolvedValue(role);
    const db = setup();
    expect(await createEmailFromNewsletter(ASSET)).toEqual({ ok: false, error: expect.stringMatching(/owner, admin or marketing manager/) });
    expect(db.queries).toHaveLength(0);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("refuses a newsletter that is not approved", async () => {
    const db = setup({ asset: { ...newsletter, status: "review" } });
    expect(await createEmailFromNewsletter(ASSET)).toEqual({ ok: false, error: "Only an approved newsletter can become an email campaign." });
    expect(inserts(db)).toHaveLength(0);
  });

  it("refuses an approved asset that is not a newsletter", async () => {
    const db = setup({ asset: { ...newsletter, format: "blog" } });
    expect((await createEmailFromNewsletter(ASSET)).ok).toBe(false);
    expect(inserts(db)).toHaveLength(0);
  });

  it("treats a newsletter from another workspace as not found", async () => {
    const db = setup({ asset: null });
    expect(await createEmailFromNewsletter(ASSET)).toEqual({ ok: false, error: "Newsletter not found." });
    expect(inserts(db)).toHaveLength(0);
  });

  it("drops an audience segment that is not in this workspace", async () => {
    const db = setup({ segment: false });
    await expect(createEmailFromNewsletter(ASSET)).rejects.toThrow("NEXT_REDIRECT");
    expect(inserts(db)[0].payload).toMatchObject({ audience_segment_id: null });
  });

  it("never queues or sends email", async () => {
    const db = setup();
    await expect(createEmailFromNewsletter(ASSET)).rejects.toThrow("NEXT_REDIRECT");
    expect(fetch).not.toHaveBeenCalled();
    expect(db.queries.some((q) => q.table === "email_campaign_deliveries")).toBe(false);
    expect(inserts(db)[0].payload).toMatchObject({ status: "draft" });
  });
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const valid = { subject_choice: "Five prototypes worth watching", preview_text: "The fridge that texts you.", body: "Teams built working prototypes.", audience_segment_id: SEGMENT };

describe("updateEmailDraft", () => {
  it("saves the chosen subject, preview, copy and audience on a draft", async () => {
    const db = setup();
    expect(await updateEmailDraft(EMAIL, null, form(valid))).toEqual({ ok: true, message: "Draft saved." });
    const update = db.queries.find((q) => q.operation === "update");
    expect(update?.payload).toEqual({ subject: "Five prototypes worth watching", preview_text: "The fridge that texts you.", body: "Teams built working prototypes.", audience_segment_id: SEGMENT });
    expect(update?.filters).toContainEqual({ method: "eq", column: "status", value: "draft" });
  });

  it("uses the written subject when the custom option is chosen", async () => {
    const db = setup();
    await updateEmailDraft(EMAIL, null, form({ ...valid, subject_choice: "__custom", subject_custom: "  My own subject  ", audience_segment_id: "" }));
    expect(db.queries.find((q) => q.operation === "update")?.payload).toMatchObject({ subject: "My own subject", audience_segment_id: null });
  });

  it("refuses an email that is no longer a draft", async () => {
    const db = setup({ email: { id: EMAIL, status: "review" } });
    expect(await updateEmailDraft(EMAIL, null, form(valid))).toEqual({ ok: false, error: "Only a draft email can be edited." });
    expect(db.queries.some((q) => q.operation === "update")).toBe(false);
  });

  it("reports an email that left draft during the edit", async () => {
    setup({ updated: false });
    expect((await updateEmailDraft(EMAIL, null, form(valid))).error).toMatch(/left draft/);
  });

  it("refuses a segment from another workspace", async () => {
    const db = setup({ segment: false });
    expect(await updateEmailDraft(EMAIL, null, form(valid))).toEqual({ ok: false, error: "Choose an audience segment from this workspace." });
    expect(db.queries.some((q) => q.operation === "update")).toBe(false);
  });

  it.each([
    [{ subject_choice: "__custom", subject_custom: "" }, "Choose or write a subject line."],
    [{ subject_choice: "x".repeat(201) }, undefined],
    [{ preview_text: "p".repeat(241) }, undefined],
    [{ body: "short" }, "Add the email copy."],
  ])("validates the fields (%#)", async (override, message) => {
    const db = setup();
    const result = await updateEmailDraft(EMAIL, null, form({ ...valid, ...override }));
    expect(result.ok).toBe(false);
    if (message) expect(result.error).toBe(message);
    expect(db.queries).toHaveLength(0);
  });

  it("refuses roles that cannot create email campaigns", async () => {
    mocks.role.mockResolvedValue("member");
    const db = setup();
    expect((await updateEmailDraft(EMAIL, null, form(valid))).ok).toBe(false);
    expect(db.queries).toHaveLength(0);
  });
});
