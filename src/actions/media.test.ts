import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";
import { MAX_FAILED_RESPONSE_LENGTH } from "@/lib/ai/image-analysis";

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

const ORG_ID = "41600000-0000-4000-8000-0000000000a0";
const ATTACHMENT_ID = "41600000-0000-4000-8000-0000000000c1";
const ACTIVITY_ID = "41600000-0000-4000-8000-0000000000c2";
const ANALYSIS_ID = "41600000-0000-4000-8000-0000000000c3";
const OLD_RUN_ID = "41600000-0000-4000-8000-0000000000d1";
const MODEL = "gemini-3.5-flash-lite";
const FAKE_KEY = `AIza${"x".repeat(35)}`;
const BANNER = "Digital Skills Workshop — Week 3";

type Existing = { status: string; analysis?: Record<string, unknown>; generated_asset_ids?: string[]; updated_at?: string };
type Setup = { assetInsertError?: boolean; existing?: Existing; runAssets?: Array<{ id: string; platform: string; generation_id: string | null }>; activity?: Record<string, unknown> };

beforeEach(() => mocks.brand.mockResolvedValue([]));
afterEach(() => vi.clearAllMocks());

function setup(options: Setup = {}) {
  let inserted = 0;
  const resolve = (query: Query): QueryResult => {
    if (query.table === "activity_attachments") return { data: { id: ATTACHMENT_ID, activity_id: ACTIVITY_ID, storage_path: "org/activity/image.png", file_name: "image.png", mime_type: "image/png", byte_size: 1024 } };
    if (query.table === "activities") return { data: { id: ACTIVITY_ID, title: "Pitch Day", description: null, outcomes: null, event_date: null, speakers: [], partners: [], registration_url: null, audience_segment_id: null, campaign_id: null, ...options.activity } };
    if (query.table === "campaigns") return { data: { name: "Skills Month", objective: "Fill the cohort" } };
    if (query.table === "activity_media_analyses") {
      if (query.operation === "select") return { data: options.existing ? { id: ANALYSIS_ID, model: MODEL, generated_asset_ids: [], updated_at: "2026-10-01T00:00:00Z", analysis: {}, ...options.existing } : null };
      return { data: { id: ANALYSIS_ID }, error: null };
    }
    if (query.table === "ai_generations") return { data: { id: "41600000-0000-4000-8000-0000000000c4" }, error: null };
    if (query.table === "content_assets" && query.operation === "insert") {
      if (options.assetInsertError) return { data: null, error: { message: "insert failed" } };
      return { data: (query.payload as unknown[]).map(() => ({ id: `new-asset-${++inserted}` })), error: null };
    }
    if (query.table === "content_assets") return { data: options.runAssets ?? [], error: null };
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
  return db;
}

type Db = ReturnType<typeof setup>;
const respond = (text: string) => mocks.analyzeImage.mockResolvedValue({ model: MODEL, text });
const analysisUpdates = (db: Db) => db.queries.filter((q) => q.table === "activity_media_analyses" && q.operation === "update").map((q) => q.payload as Record<string, unknown>);
const failedUpdate = (db: Db) => analysisUpdates(db).find((payload) => payload.status === "failed");
const completedUpdate = (db: Db) => analysisUpdates(db).find((payload) => payload.status === "completed");
const generationKinds = (db: Db) => db.queries.filter((q) => q.table === "ai_generations" && q.operation === "insert").map((q) => q.payload as Record<string, unknown>);
const draftInserts = (db: Db) => db.queries.filter((q) => q.table === "content_assets" && q.operation === "insert").flatMap((q) => q.payload as Array<Record<string, unknown>>);
const contentAssetWrites = (db: Db) => db.queries.filter((q) => q.table === "content_assets" && q.operation !== "select" && q.operation !== "insert");

const caption = (platform: string, angle = 0) => ({ platform, caption: "Founders pitched their prototypes to the panel.", hashtags: ["RIL"], angle, rationale: "Shows the room." });
const v2Reply = (overrides: Record<string, unknown> = {}) => ({
  imageType: "event_photo", subtype: "workshop_in_action",
  purpose: { primary: "recap_past_event", rationale: "The event has happened." },
  onImageText: { lines: [BANNER], eventName: BANNER, date: null, venue: null, callToAction: null, partnerNames: [], conflicts: [] },
  angles: [
    { title: "Hands-on", angle: "Founders tested ideas with the panel.", groundedIn: ["image"] },
    { title: "Momentum", angle: "The cohort keeps building week on week.", groundedIn: ["title"] },
  ],
  captions: [caption("linkedin"), caption("instagram", 1)],
  otherUses: [{ use: "newsletter_feature", note: "Lead image." }],
  usability: { blurry: false, smallTextOnMobile: false, identifiableFaces: true, notes: [] },
  altText: `A presenter under a banner reading ${BANNER}.`,
  sceneSummary: "A presenter stands beside a projected slide in a full room.",
  ...overrides,
});
const validResponse = JSON.stringify(v2Reply());
const savedV2 = (runId = OLD_RUN_ID) => ({ ...v2Reply(), captions: [{ ...caption("linkedin"), hashtags: ["#RIL"] }, { ...caption("instagram", 1), hashtags: ["#RIL"] }], version: 2, runId, timing: "unknown", today: "2026-10-20", purposeRepair: null });
const savedV1 = { sceneSummary: "A presenter stands beside a projected slide.", altText: "Presenter speaking to a seated audience.", qualityNotes: [], captions: [{ platform: "linkedin", caption: "Founders pitched their prototypes.", hashtags: ["#RIL"], rationale: "Shows the room." }, { platform: "instagram", caption: "Pitch Day energy all round.", hashtags: ["#RIL"], rationale: "Upbeat." }] };

describe("analyzeActivityImage failure path", () => {
  it("returns the short error, records the failed run and saves a redacted, truncated response", async () => {
    const db = setup();
    const rawResponse = JSON.stringify({
      sceneSummary: `A presenter on stage. Slide text: ${FAKE_KEY}. ${"More detail. ".repeat(200)}`,
      altText: "Presenter on stage.",
      captions: [{ platform: "linkedin", hashtags: ["RIL"], rationale: "Shows the room." }],
    });
    respond(rawResponse);

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^Could not validate the image analysis: /);
    expect(result.error).not.toContain("Slide text");
    expect(result.error!.length).toBeLessThan(300);
    expect(generationKinds(db)).toEqual([{ organization_id: ORG_ID, activity_id: ACTIVITY_ID, kind: "image_analysis_captioning_failed", model: MODEL }]);
    const update = failedUpdate(db);
    expect(update?.error).toBe(result.error);
    const saved = (update?.analysis as { failedResponse: string }).failedResponse;
    expect(saved).toHaveLength(MAX_FAILED_RESPONSE_LENGTH);
    expect(saved).toContain("[redacted]");
    expect(saved).not.toContain(FAKE_KEY);
    expect(saved.startsWith('{"sceneSummary":"A presenter on stage. Slide text: [redacted]. More detail.')).toBe(true);
  });

  it("saves the response when it is not JSON at all", async () => {
    const db = setup();
    respond("Sorry, I can't describe this image.");

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result).toEqual({ ok: false, error: "Media analysis did not return the required structured result." });
    expect(generationKinds(db).map((row) => row.kind)).toEqual(["image_analysis_captioning_failed"]);
    expect(failedUpdate(db)?.analysis).toEqual({ failedResponse: "Sorry, I can't describe this image." });
  });

  it("keeps the validated analysis when a later step fails", async () => {
    const db = setup({ assetInsertError: true });
    respond(validResponse);

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result).toEqual({ ok: false, error: "Could not save caption drafts: insert failed" });
    expect(generationKinds(db).map((row) => row.kind)).toEqual(["image_analysis_captioning"]);
    expect(failedUpdate(db)).not.toHaveProperty("analysis");
    expect(analysisUpdates(db).find((payload) => payload.analysis && !payload.status)?.analysis).toMatchObject({ version: 2 });
  });

  it("records nothing extra when the provider call itself fails", async () => {
    const db = setup();
    mocks.analyzeImage.mockRejectedValue(new Error("Configured AI provider returned HTTP 500 while analyzing the image."));

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result.error).toBe("Configured AI provider returned HTTP 500 while analyzing the image.");
    expect(generationKinds(db)).toEqual([]);
    expect(failedUpdate(db)).not.toHaveProperty("analysis");
  });

  it("still succeeds with a valid response", async () => {
    const db = setup();
    respond(validResponse);

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result.ok).toBe(true);
    expect(generationKinds(db).map((row) => row.kind)).toEqual(["image_analysis_captioning"]);
    expect(failedUpdate(db)).toBeUndefined();
  });

  it("refuses while another run is still in progress", async () => {
    setup({ existing: { status: "processing", updated_at: new Date().toISOString() } });
    expect(await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID)).toEqual({ ok: false, error: "Image analysis is already in progress. Refresh this page in a moment." });
    expect(mocks.analyzeImage).not.toHaveBeenCalled();
  });
});

describe("v2 drafts", () => {
  it("saves each caption as an ai_generated draft with the v2 metadata and alt text marked unreviewed", async () => {
    const db = setup();
    respond(validResponse);

    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    const drafts = draftInserts(db);
    expect(drafts.map((draft) => draft.platform)).toEqual(["linkedin", "instagram"]);
    for (const draft of drafts) {
      expect(draft.status).toBe("ai_generated");
      expect(draft.metadata).toMatchObject({
        analysis_version: 2, alt_text_reviewed: false, ai_generated: true, media_analysis_id: ANALYSIS_ID,
        media_analysis_run_id: expect.stringMatching(/^[0-9a-f-]{36}$/), image_type: "event_photo",
        purpose: { primary: "recap_past_event", timing: "unknown", repaired_from: null },
        on_image_text: { lines: [BANNER] },
        usability: { identifiableFaces: true },
        image_alt_text: `A presenter under a banner reading ${BANNER}.`,
      });
    }
    expect((drafts[1].metadata as { angle: { title: string } }).angle.title).toBe("Momentum");
    expect(drafts[0].body).toBe("Founders pitched their prototypes to the panel.\n\n#RIL");
    expect(completedUpdate(db)).toMatchObject({ status: "completed", generated_asset_ids: ["new-asset-1", "new-asset-2"], analysis: { version: 2 } });
  });

  it("holds the drafts when the image and the activity record disagree", async () => {
    const db = setup();
    respond(JSON.stringify(v2Reply({ onImageText: { ...v2Reply().onImageText, conflicts: [{ field: "eventName", onImage: BANNER, activityRecord: "Pitch Day" }] } })));

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result).toMatchObject({ ok: true, message: "Caption drafts are on hold: the image and the activity record disagree on one detail. Choose which to use below." });
    expect(draftInserts(db)).toEqual([]);
    expect(generationKinds(db)).toEqual([]);
    expect(completedUpdate(db)).toMatchObject({ status: "completed", generated_asset_ids: [], analysis: { onImageText: { conflicts: [{ field: "eventName" }] } } });
  });

  it("says draft, not drafts, for one caption", async () => {
    setup();
    respond(JSON.stringify(v2Reply({ captions: [caption("linkedin")] })));
    expect((await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID)).message).toBe("1 image caption draft is in the Content Library for review.");
  });

  it("records a purpose repaired against the event date", async () => {
    const db = setup({ activity: { event_date: "2020-01-01" } });
    respond(JSON.stringify(v2Reply({ purpose: { primary: "drive_registrations", rationale: "Sign up." } })));

    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(draftInserts(db)[0].metadata).toMatchObject({ purpose: { primary: "recap_past_event", timing: "past", repaired_from: "drive_registrations" } });
    expect(completedUpdate(db)?.analysis).toMatchObject({ purposeRepair: { from: "drive_registrations", to: "recap_past_event" } });
  });

  it("sends the full activity record and searches brand knowledge with its people and partners", async () => {
    setup({ activity: { event_date: "2099-05-01", speakers: ["Ada Obi"], partners: ["Lagos Tech Hub"], registration_url: "https://ril.example/register", campaign_id: "41600000-0000-4000-8000-0000000000e1" } });
    respond(validResponse);

    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    const { prompt, system } = mocks.analyzeImage.mock.calls[0][0] as { prompt: string; system: string };
    expect(system).toContain("RIL's marketing assistant");
    expect(prompt).toContain("TIMING: UPCOMING");
    expect(prompt).toContain("Event date: 2099-05-01");
    expect(prompt).toContain("Speakers: Ada Obi");
    expect(prompt).toContain("Partners: Lagos Tech Hub");
    expect(prompt).toContain("call to action to register at https://ril.example/register");
    expect(prompt).toContain("Campaign: Skills Month. Objective: Fill the cohort");
    expect(mocks.brand).toHaveBeenCalledWith(ORG_ID, expect.stringContaining("Ada Obi Lagos Tech Hub Skills Month"));
  });
});

describe("analysing again", () => {
  it("runs a new analysis and adds a new draft set beside the old one, leaving old drafts untouched", async () => {
    const db = setup({ existing: { status: "completed", analysis: savedV2(), generated_asset_ids: ["old-asset-1", "old-asset-2"] } });
    respond(validResponse);

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result).toMatchObject({ ok: true, message: "2 new image caption drafts are in the Content Library for review. Earlier drafts are unchanged." });
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(1);
    // The claim starts a fresh run.
    expect(analysisUpdates(db)[0]).toEqual({ status: "processing", error: null, analysis: {} });
    const drafts = draftInserts(db);
    expect(drafts).toHaveLength(2);
    const runId = (drafts[0].metadata as { media_analysis_run_id: string }).media_analysis_run_id;
    expect(runId).not.toBe(OLD_RUN_ID);
    // Only this run's drafts are looked up, and existing drafts are never updated or deleted.
    const lookup = db.queries.find((q) => q.table === "content_assets" && q.operation === "select");
    expect(lookup?.filters).toContainEqual({ method: "contains", column: "metadata", value: { media_analysis_id: ANALYSIS_ID, media_analysis_run_id: runId } });
    expect(contentAssetWrites(db)).toEqual([]);
    expect(completedUpdate(db)?.generated_asset_ids).toEqual(["old-asset-1", "old-asset-2", "new-asset-1", "new-asset-2"]);
    expect(generationKinds(db).map((row) => row.kind)).toEqual(["image_analysis_captioning"]);
  });

  it("re-analyses an old v1 analysis into v2", async () => {
    const db = setup({ existing: { status: "completed", analysis: savedV1, generated_asset_ids: ["old-asset-1"] } });
    respond(validResponse);

    await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(mocks.analyzeImage).toHaveBeenCalledTimes(1);
    expect(draftInserts(db).every((draft) => (draft.metadata as { analysis_version?: number }).analysis_version === 2)).toBe(true);
  });
});

describe("retrying a failed analysis", () => {
  it("resumes a saved v2 analysis without paying again, adding only the missing drafts", async () => {
    const db = setup({ existing: { status: "failed", analysis: savedV2() }, runAssets: [{ id: "run-asset-1", platform: "linkedin", generation_id: "gen-1" }] });

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result.ok).toBe(true);
    expect(mocks.analyzeImage).not.toHaveBeenCalled();
    expect(draftInserts(db).map((draft) => draft.platform)).toEqual(["instagram"]);
    expect(draftInserts(db)[0]).toMatchObject({ generation_id: "gen-1", metadata: { media_analysis_run_id: OLD_RUN_ID, analysis_version: 2 } });
    expect(generationKinds(db)).toEqual([]);
    expect(completedUpdate(db)?.generated_asset_ids).toEqual(["run-asset-1", "new-asset-1"]);
  });

  it("still recognises a saved v1 analysis and finishes it in the original format", async () => {
    const db = setup({ existing: { status: "failed", analysis: savedV1 } });

    const result = await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID);

    expect(result.ok).toBe(true);
    expect(mocks.analyzeImage).not.toHaveBeenCalled();
    const lookup = db.queries.find((q) => q.table === "content_assets" && q.operation === "select");
    expect(lookup?.filters).toContainEqual({ method: "is", column: "metadata->>media_analysis_run_id", value: null });
    const drafts = draftInserts(db);
    expect(drafts.map((draft) => draft.platform)).toEqual(["linkedin", "instagram"]);
    expect(drafts[0]).toMatchObject({ status: "ai_generated", metadata: { image_scene_summary: savedV1.sceneSummary, image_quality_notes: [] } });
    expect(drafts[0].metadata).not.toHaveProperty("analysis_version");
  });

  it("calls the model again when the failed run saved only a failed response", async () => {
    const db = setup({ existing: { status: "failed", analysis: { failedResponse: "Sorry" } } });
    respond(validResponse);

    expect((await analyzeActivityImage(ATTACHMENT_ID, ACTIVITY_ID)).ok).toBe(true);
    expect(mocks.analyzeImage).toHaveBeenCalledTimes(1);
    expect(analysisUpdates(db)[0]).toEqual({ status: "processing", error: null });
  });
});
