import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), analyzeImage: vi.fn(), brand: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: vi.fn().mockResolvedValue("41600000-0000-4000-8000-0000000000a0") }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/brand/knowledge", () => ({ getBrandGuidance: mocks.brand }));
vi.mock("@/lib/content/document-text", () => ({ extractDocumentText: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({
  analyzeImageWithConfiguredProvider: mocks.analyzeImage,
  analyzeAudioVideoWithConfiguredProvider: vi.fn(),
  completeWithConfiguredProvider: vi.fn(),
}));
import { analyzeActivityImage } from "./media";
import { resolveImageConflict } from "./image-conflicts";

const ATTACHMENT_ID = "41600000-0000-4000-8000-0000000000c1";
const ACTIVITY_ID = "41600000-0000-4000-8000-0000000000c2";
const ANALYSIS_ID = "41600000-0000-4000-8000-0000000000c3";
const MODEL = "gemini-3.5-flash-lite";

type Row = { id: string; status: string; analysis: Record<string, unknown>; model: string | null; generated_asset_ids: string[]; updated_at: string };
type State = { row: Row | null; activity: Record<string, unknown>; drafts: Array<Record<string, unknown>> };

beforeEach(() => { mocks.analyzeImage.mockReset(); mocks.brand.mockResolvedValue([]); });
afterEach(() => vi.clearAllMocks());

/**
 * A small in-memory database: the analysis row and the activity change as the
 * actions write them, and updates honour their eq filters, so the
 * compare-and-swap on updated_at behaves as it does in Postgres.
 */
function setup(options: { activityUpdateError?: boolean } = {}) {
  let clock = 0;
  const tick = () => new Date(Date.UTC(2026, 9, 21, 9, 0, clock++)).toISOString();
  const state: State = {
    row: null,
    activity: { id: ACTIVITY_ID, title: "Testing", description: null, outcomes: null, event_date: "2099-05-01", speakers: [], partners: [], registration_url: "https://ril.example/register", audience_segment_id: null, campaign_id: null },
    drafts: [],
  };
  const filtersMatch = (query: Query, target: Record<string, unknown>) => query.filters.every((filter) => filter.method !== "eq" || ["organization_id", "activity_id", "attachment_id"].includes(filter.column as string) || target[filter.column as string] === filter.value);
  const resolve = (query: Query): QueryResult => {
    if (query.table === "activity_attachments") return { data: { id: ATTACHMENT_ID, activity_id: ACTIVITY_ID, storage_path: "org/activity/flyer.png", file_name: "flyer.png", mime_type: "image/png", byte_size: 1024 } };
    if (query.table === "activities") {
      if (query.operation === "update") {
        if (options.activityUpdateError) return { data: null, error: { message: "permission denied for table activities" } };
        Object.assign(state.activity, query.payload);
        return { data: { id: ACTIVITY_ID }, error: null };
      }
      return { data: structuredClone(state.activity) };
    }
    if (query.table === "activity_media_analyses") {
      if (query.operation === "select") return { data: state.row ? structuredClone(state.row) : null, error: null };
      if (query.operation === "insert") {
        state.row = { id: ANALYSIS_ID, status: "processing", analysis: {}, model: null, generated_asset_ids: [], updated_at: tick(), ...(query.payload as object) };
        return { data: { id: ANALYSIS_ID }, error: null };
      }
      if (!state.row || !filtersMatch(query, state.row)) return { data: null, error: null };
      Object.assign(state.row, query.payload, { updated_at: tick() });
      return { data: { id: ANALYSIS_ID }, error: null };
    }
    if (query.table === "ai_generations") return { data: { id: "41600000-0000-4000-8000-0000000000c4" }, error: null };
    if (query.table === "content_assets" && query.operation === "insert") {
      const rows = query.payload as Array<Record<string, unknown>>;
      state.drafts.push(...rows);
      return { data: rows.map((_, index) => ({ id: `asset-${state.drafts.length - rows.length + index + 1}` })), error: null };
    }
    if (query.table === "content_assets") return { data: [], error: null };
    return { data: [], error: null };
  };
  const db = databaseMock(resolve);
  const client = {
    ...db,
    auth: { getUser: async () => ({ data: { user: { id: "41600000-0000-4000-8000-00000000000a" } } }) },
    storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null }) }) },
  };
  mocks.client.mockResolvedValue(client);
  mocks.admin.mockReturnValue(db);
  return { state, db };
}

const DEMO_DAY = { field: "eventName", onImage: "DEMO DAY", activityRecord: "Testing" };
const DATE_CONFLICT = { field: "date", onImage: "Sat 2 May 2099", activityRecord: "1 May 2099" };
const reply = (conflicts: unknown[], name = "Testing") => JSON.stringify({
  imageType: "graphic_design", subtype: "flyer",
  purpose: { primary: "drive_registrations", rationale: `The flyer invites founders to register for ${name}.` },
  onImageText: { lines: ["DEMO DAY", "Register now"], eventName: "DEMO DAY", date: null, venue: null, callToAction: "Register now", partnerNames: [], conflicts },
  angles: [
    { title: "Save the date", angle: `Founders pitch at ${name} to a panel of investors.`, groundedIn: ["title"] },
    { title: "Why attend", angle: "Meet the cohort and the people backing it.", groundedIn: ["description"] },
  ],
  captions: [
    { platform: "linkedin", caption: `Join us at ${name}. Register at https://ril.example/register`, hashtags: ["DemoDay"], angle: 0, rationale: "Announces the event." },
    { platform: "instagram", caption: `${name} is coming. Link in bio to register.`, hashtags: ["RIL"], angle: 1, rationale: "Short and upbeat." },
  ],
  otherUses: [],
  usability: { blurry: false, smallTextOnMobile: false, identifiableFaces: false, notes: [] },
  altText: "A flyer reading DEMO DAY, Register now.",
  sceneSummary: "A bold flyer reading \"DEMO DAY\" above \"Register now\".",
});
const respondInOrder = (...texts: string[]) => texts.forEach((text) => mocks.analyzeImage.mockResolvedValueOnce({ model: MODEL, text }));
const promptOf = (call: number) => (mocks.analyzeImage.mock.calls[call][0] as { prompt: string }).prompt;
const analysisUpdatesAfter = (db: ReturnType<typeof setup>["db"], from: number) => db.queries.slice(from).filter((q) => q.table === "activity_media_analyses" && q.operation === "update");

/** First analysis of the DEMO DAY flyer against an activity titled "Testing": held. */
async function heldDemoDay() {
  const ctx = setup();
  respondInOrder(reply([DEMO_DAY]));
  const first = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);
  return { ...ctx, first };
}

describe("DEMO DAY on the image, Testing in the activity record", () => {
  it("holds the caption drafts on the first analysis", async () => {
    const { state, first } = await heldDemoDay();
    expect(first).toMatchObject({ ok: true, message: "Caption drafts are on hold: the image and the activity record disagree on one detail. Choose which to use below." });
    expect(state.drafts).toEqual([]);
    expect(state.row).toMatchObject({ status: "completed", generated_asset_ids: [] });
    expect(state.row?.analysis).toMatchObject({ onImageText: { conflicts: [DEMO_DAY] }, resolutions: [] });
    // The flyer drives registrations but shows no date, venue or link.
    expect(state.row?.analysis.missingDetails).toEqual([
      { detail: "date", inRecord: true }, { detail: "venue", inRecord: false }, { detail: "registration", inRecord: true },
    ]);
  });

  it("“Use DEMO DAY” re-runs with the choice pinned and creates the drafts, leaving the record alone", async () => {
    const { state } = await heldDemoDay();
    // The model tries to raise the settled conflict again; it's dropped.
    respondInOrder(reply([DEMO_DAY], "DEMO DAY"));

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");

    expect(result).toMatchObject({ ok: true, message: "2 new image caption drafts are in the Content Library for review. Earlier drafts are unchanged." });
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(2);
    expect(promptOf(1)).toContain("USER-CONFIRMED VALUES");
    expect(promptOf(1)).toContain('- event name: "DEMO DAY" (not "Testing")');
    expect(state.activity.title).toBe("Testing");
    expect(state.drafts.map((draft) => draft.platform)).toEqual(["linkedin", "instagram"]);
    expect(state.drafts[0].body).toContain("Join us at DEMO DAY.");
    expect(state.row?.analysis).toMatchObject({ onImageText: { conflicts: [] }, resolutions: [{ field: "eventName", key: "eventName", value: "DEMO DAY", recordValue: "Testing", choice: "image" }] });
    expect(state.row?.generated_asset_ids).toEqual(["asset-1", "asset-2"]);
  });

  it("“Update activity record” writes DEMO DAY to the title, then re-runs and creates the drafts", async () => {
    const { state, db } = await heldDemoDay();
    respondInOrder(reply([], "DEMO DAY"));

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "update_record");

    expect(result.ok).toBe(true);
    expect(db.queries.filter((q) => q.table === "activities" && q.operation === "update").map((q) => q.payload)).toEqual([{ title: "DEMO DAY" }]);
    expect(state.activity.title).toBe("DEMO DAY");
    expect(promptOf(1)).toContain("Title: DEMO DAY");
    expect(state.drafts).toHaveLength(2);
    expect(state.row?.analysis).toMatchObject({ resolutions: [{ choice: "record_updated", value: "DEMO DAY" }] });
  });

  it("keeps the choice pinned when the image is analysed again by hand", async () => {
    const { state } = await heldDemoDay();
    respondInOrder(reply([DEMO_DAY], "DEMO DAY"), reply([DEMO_DAY], "DEMO DAY"));
    await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");

    const again = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(again.message).toBe("2 new image caption drafts are in the Content Library for review. Earlier drafts are unchanged.");
    expect(promptOf(2)).toContain('- event name: "DEMO DAY" (not "Testing")');
    expect(state.drafts).toHaveLength(4);
  });

  it("drops the pin once the activity record is edited, so the question is asked again", async () => {
    const { state } = await heldDemoDay();
    respondInOrder(reply([DEMO_DAY], "DEMO DAY"), reply([{ ...DEMO_DAY, activityRecord: "Pitch Night" }]));
    await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");
    state.activity.title = "Pitch Night";

    const again = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(promptOf(2)).not.toContain("USER-CONFIRMED VALUES");
    expect(again.message).toMatch(/^Caption drafts are on hold/);
    expect(state.drafts).toHaveLength(2);
  });
});

describe("a new conflict on the re-run", () => {
  it("holds the drafts again, keeping the earlier choice", async () => {
    const { state } = await heldDemoDay();
    respondInOrder(reply([DEMO_DAY, DATE_CONFLICT], "DEMO DAY"));

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");

    expect(result).toMatchObject({ ok: true, message: "Caption drafts are on hold: the image and the activity record disagree on one detail. Choose which to use below." });
    expect(state.drafts).toEqual([]);
    expect(state.row?.analysis).toMatchObject({ onImageText: { conflicts: [DATE_CONFLICT] }, resolutions: [{ field: "eventName", choice: "image" }] });
  });

  it("then creates the drafts once the new conflict is resolved too", async () => {
    const { state } = await heldDemoDay();
    respondInOrder(reply([DEMO_DAY, DATE_CONFLICT], "DEMO DAY"), reply([DEMO_DAY, DATE_CONFLICT], "DEMO DAY"));
    await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "date", "update_record");

    expect(result.ok).toBe(true);
    expect(state.activity.event_date).toBe("2099-05-02");
    expect(promptOf(2)).toContain('- event name: "DEMO DAY"');
    expect(promptOf(2)).toContain('- date: "2099-05-02"');
    expect(state.drafts).toHaveLength(2);
  });

  it("with two open conflicts, saves the first choice and waits for the second before re-running", async () => {
    const ctx = setup();
    respondInOrder(reply([DEMO_DAY, DATE_CONFLICT]));
    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");

    expect(result).toEqual({ ok: true, message: "Choice saved. Choose for the other conflict to create the caption drafts." });
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(1);
    expect(ctx.state.row).toMatchObject({ status: "completed", analysis: { resolutions: [{ field: "eventName" }] } });
  });
});

describe("duplicate requests", () => {
  it("runs only one re-run when the same choice is sent twice at once", async () => {
    const { state } = await heldDemoDay();
    respondInOrder(reply([], "DEMO DAY"), reply([], "DEMO DAY"));

    const results = await Promise.all([
      resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image"),
      resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)?.error).toBe("Another request is already handling this image. Refresh this page in a moment.");
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(2);
    expect(state.drafts).toHaveLength(2);
  });

  it("refuses while a re-run is in progress, without touching the record", async () => {
    const { state, db } = await heldDemoDay();
    state.row!.status = "processing";
    const before = db.queries.length;

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "update_record");

    expect(result).toEqual({ ok: false, error: "Captions are already being regenerated for this image. Refresh this page in a moment." });
    expect(db.queries.slice(before).filter((q) => q.operation !== "select")).toEqual([]);
    expect(state.activity.title).toBe("Testing");
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(1);
  });

  it("refuses a conflict that has already been resolved", async () => {
    await heldDemoDay();
    respondInOrder(reply([], "DEMO DAY"));
    await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image");

    expect(await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "image")).toEqual({ ok: false, error: "This conflict has already been resolved. Refresh this page." });
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(2);
  });
});

describe("a failed activity record update", () => {
  it("returns the error, saves no choice and doesn't re-run", async () => {
    const ctx = setup({ activityUpdateError: true });
    respondInOrder(reply([DEMO_DAY]));
    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);
    const before = ctx.db.queries.length;

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "eventName", "update_record");

    expect(result).toEqual({ ok: false, error: "Could not update the activity record: permission denied for table activities. Nothing was changed." });
    expect(analysisUpdatesAfter(ctx.db, before)).toEqual([]);
    expect(ctx.state.row?.analysis.resolutions).toEqual([]);
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(1);
    expect(ctx.state.drafts).toEqual([]);
  });

  it("refuses to write a value the record has no field for", async () => {
    const ctx = setup();
    respondInOrder(reply([{ field: "venue", onImage: "Lagos Tech Hub", activityRecord: "Yaba" }]));
    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    const result = await resolveImageConflict(ATTACHMENT_ID, ACTIVITY_ID, "venue", "update_record");

    expect(result).toEqual({ ok: false, error: "The activity record has no field this value can go in. Use the image's value instead." });
    expect(ctx.db.queries.filter((q) => q.table === "activities" && q.operation === "update")).toEqual([]);
  });
});
