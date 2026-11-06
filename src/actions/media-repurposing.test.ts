import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), org: vi.fn(), analyze: vi.fn(), brand: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/ai/provider", () => ({ analyzeAudioVideoWithConfiguredProvider: mocks.analyze, analyzeImageWithConfiguredProvider: vi.fn(), completeWithConfiguredProvider: vi.fn() }));
vi.mock("@/lib/brand/knowledge", () => ({ getBrandGuidance: mocks.brand }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { analyzeActivityAudioVideo } from "./media";

const attachmentId = "00000000-0000-4000-8000-000000000001", activityId = "00000000-0000-4000-8000-000000000002";
const analysis = { transcript: "Source transcript", summary: "Factual summary of the recording", drafts: [["blog", "website"], ["newsletter", "email"], ["social post", "linkedin"], ["short-form video", "youtube"]].map(([format, platform]) => ({ title: "Grounded source draft", body: "Source-grounded draft copy for an editor to review. ".repeat(3), format, platform })) };
function setup(existing?: Record<string, unknown>, existingAssets: Array<Record<string, unknown>> = [], fail?: (q: Query) => boolean) {
  const database = databaseMock(q => {
    if (fail?.(q)) return { data: null, error: { message: "Database unavailable" } };
    if (q.operation === "select") {
      if (q.table === "activity_attachments") return { data: { id: attachmentId, activity_id: activityId, storage_path: "org/private.mp4", file_name: "source.mp4", mime_type: "video/mp4", byte_size: 500 } };
      if (q.table === "activities") return { data: { id: activityId, title: "Recorded activity", audience_segment_id: null, campaign_id: null } };
      if (q.table === "activity_media_analyses") return { data: existing ?? null };
      if (q.table === "content_assets") return { data: existingAssets };
    }
    if (q.table === "content_assets" && q.operation === "insert") return { data: (q.payload as unknown[]).map((_row, i) => ({ id: `draft-${i}` })) };
    return { data: { id: "analysis" }, error: null };
  });
  mocks.client.mockResolvedValue({ ...database, auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) }, storage: { from: () => ({ download: mocks.download }) } });
  mocks.admin.mockReturnValue(database);
  return database;
}
beforeEach(() => { vi.clearAllMocks(); mocks.org.mockResolvedValue("org"); mocks.brand.mockResolvedValue([]); mocks.download.mockResolvedValue({ data: new Blob(["mock source recording"]) }); mocks.analyze.mockResolvedValue({ text: JSON.stringify(analysis), model: "mock-gemini" }); });

describe("video to reviewable content", () => {
  it("saves all four drafts with source provenance and keeps them unapproved", async () => {
    const database = setup(); expect((await analyzeActivityAudioVideo(attachmentId, activityId)).ok).toBe(true);
    const rows = database.queries.find(q => q.table === "content_assets" && q.operation === "insert")!.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.status === "ai_generated" && row.source_activity_id === activityId && row.organization_id === "org")).toBe(true);
    expect(rows[3]).toMatchObject({ format: "short-form video", platform: "youtube", metadata: { media_analysis_id: "analysis", source_attachment_id: attachmentId } });
  });
  it("does not call the AI again for a complete four-draft analysis", async () => { setup({ id: "analysis", status: "completed", analysis, generated_asset_ids: ["a", "b", "c", "d"] }); expect((await analyzeActivityAudioVideo(attachmentId, activityId)).ok).toBe(true); expect(mocks.analyze).not.toHaveBeenCalled(); });
  it("upgrades an old analysis and creates only the missing short-form draft", async () => {
    const database = setup({ id: "analysis", status: "completed", analysis: { ...analysis, drafts: analysis.drafts.slice(0, 3) }, model: "old-model", generated_asset_ids: ["a", "b", "c"], updated_at: "2026-10-14T10:00:00Z" }, ["website", "email", "linkedin"].map((platform, i) => ({ id: `old-${i}`, platform, generation_id: "generation" })));
    expect((await analyzeActivityAudioVideo(attachmentId, activityId)).ok).toBe(true);
    const rows = database.queries.find(q => q.table === "content_assets" && q.operation === "insert")!.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1); expect(rows[0].format).toBe("short-form video");
  });
  it("resumes saved output after a partial database failure without another AI call", async () => {
    const database = setup({ id: "analysis", status: "failed", analysis, model: "mock-model", generated_asset_ids: [], updated_at: "2026-10-14T10:00:00Z" }, [{ id: "old-blog", platform: "website", generation_id: "generation" }]);
    expect((await analyzeActivityAudioVideo(attachmentId, activityId)).ok).toBe(true); expect(mocks.analyze).not.toHaveBeenCalled(); expect((database.queries.find(q => q.table === "content_assets" && q.operation === "insert")!.payload as unknown[])).toHaveLength(3);
  });
  it("reports a missing provider without inventing completed output", async () => { const database = setup(); mocks.analyze.mockResolvedValueOnce(null); expect(await analyzeActivityAudioVideo(attachmentId, activityId)).toMatchObject({ ok: false, error: expect.stringContaining("Gemini") }); expect(database.queries.some(q => q.table === "content_assets" && q.operation === "insert")).toBe(false); });
  it("rejects incomplete AI output before saving any draft", async () => { const database = setup(); mocks.analyze.mockResolvedValueOnce({ text: JSON.stringify({ ...analysis, drafts: analysis.drafts.slice(0, 3) }), model: "mock" }); expect((await analyzeActivityAudioVideo(attachmentId, activityId)).ok).toBe(false); expect(database.queries.some(q => q.table === "content_assets" && q.operation === "insert")).toBe(false); });
  it("does not contact AI when another request already owns this analysis", async () => { setup({ id: "analysis", status: "processing", updated_at: new Date().toISOString() }); expect((await analyzeActivityAudioVideo(attachmentId, activityId)).ok).toBe(false); expect(mocks.analyze).not.toHaveBeenCalled(); });
});
