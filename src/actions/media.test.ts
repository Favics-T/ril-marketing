import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";
import { MAX_FAILED_RESPONSE_LENGTH } from "@/lib/ai/image-analysis";

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), analyzeImage: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: vi.fn().mockResolvedValue("41600000-0000-4000-8000-0000000000a0") }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/brand/knowledge", () => ({ getBrandGuidance: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/content/document-text", () => ({ extractDocumentText: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({
  analyzeImageWithConfiguredProvider: mocks.analyzeImage,
  analyzeAudioVideoWithConfiguredProvider: vi.fn(),
  completeWithConfiguredProvider: vi.fn(),
}));
import { analyzeActivityImage } from "./media";

const ATTACHMENT_ID = "41600000-0000-4000-8000-0000000000c1";
const ACTIVITY_ID = "41600000-0000-4000-8000-0000000000c2";
const ANALYSIS_ID = "41600000-0000-4000-8000-0000000000c3";
const MODEL = "gemini-3.5-flash-lite";
const FAKE_KEY = `AIza${"x".repeat(35)}`;

afterEach(() => vi.clearAllMocks());

function setup(options: { assetInsertError?: boolean } = {}) {
  const resolve = (query: Query): QueryResult => {
    if (query.table === "activity_attachments") return { data: { id: ATTACHMENT_ID, activity_id: ACTIVITY_ID, storage_path: "org/activity/image.png", file_name: "image.png", mime_type: "image/png", byte_size: 1024 } };
    if (query.table === "activities") return { data: { id: ACTIVITY_ID, title: "Pitch Day", description: null, outcomes: null, audience_segment_id: null, campaign_id: null } };
    if (query.table === "activity_media_analyses") return query.operation === "select" ? { data: null } : { data: { id: ANALYSIS_ID }, error: null };
    if (query.table === "ai_generations") return { data: { id: "41600000-0000-4000-8000-0000000000c4" }, error: null };
    if (query.table === "content_assets" && query.operation === "insert") return options.assetInsertError ? { data: null, error: { message: "insert failed" } } : { data: [{ id: "asset" }], error: null };
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

const respond = (text: string) => mocks.analyzeImage.mockResolvedValue({ model: MODEL, text });
const failedUpdate = (db: ReturnType<typeof setup>) => db.queries.find((q) => q.table === "activity_media_analyses" && q.operation === "update" && (q.payload as { status?: string }).status === "failed")?.payload as Record<string, unknown> | undefined;
const generationKinds = (db: ReturnType<typeof setup>) => db.queries.filter((q) => q.table === "ai_generations" && q.operation === "insert").map((q) => q.payload as Record<string, unknown>);

const validCaption = (platform: string) => ({ platform, caption: "Founders pitched their prototypes to the panel.", hashtags: ["RIL"], rationale: "Shows the room." });
const validResponse = JSON.stringify({
  sceneSummary: "A presenter stands beside a projected slide in a full room.",
  altText: "Presenter speaking to a seated audience.",
  qualityNotes: [],
  captions: [validCaption("linkedin"), validCaption("instagram")],
});

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
    expect(generationKinds(db)).toEqual([{ organization_id: "41600000-0000-4000-8000-0000000000a0", activity_id: ACTIVITY_ID, kind: "image_analysis_captioning_failed", model: MODEL }]);
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
});
