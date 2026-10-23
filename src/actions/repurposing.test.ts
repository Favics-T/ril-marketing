import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({
  org: vi.fn(),
  client: vi.fn(),
  admin: vi.fn(),
  extract: vi.fn(),
  generate: vi.fn(),
  prepare: vi.fn(),
  brand: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/supabase/organization", () => ({
  requireOrganizationId: mocks.org,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/content/repurposing-extraction", () => ({
  extractRepurposingSource: mocks.extract,
}));
vi.mock("@/lib/ai/provider", () => ({
  generateRepurposing: mocks.generate,
  prepareSourceMaterial: mocks.prepare,
}));
vi.mock("@/lib/brand/knowledge", () => ({ getBrandGuidance: mocks.brand }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  createRepurposingSource,
  runRepurposing,
  saveSourceSummary,
} from "./repurposing";
const id = "60000000-0000-4000-8000-000000000001",
  foreign = "60000000-0000-4000-8000-000000000002";
const analysis = {
  summary:
    "The source describes a community event and the next practical steps.",
  transcript: "Original supported source facts.",
  topics: ["community"],
  quotes: [],
  statistics: [],
  angles: [],
  callsToAction: [],
  keyMoments: [],
  durationSeconds: null,
};
function setup(
  resolve?: (q: Query) => { data?: unknown; error?: { message: string } },
) {
  let source: Record<string, unknown> = {
    id,
    organization_id: "org",
    created_by: "actor",
    title: "Source",
    source_kind: "transcript",
    activity_id: null,
    attachment_id: null,
    input_text: "Original supported source facts.",
    manual_summary: "",
    analysis: {},
    requested_kinds: ["blog", "newsletter"],
    completed_kinds: [],
    options: {},
    status: "idea",
    revision: 1,
    updated_at: "2026-10-19T10:00:00Z",
  };
  const db = databaseMock((q) => {
    const override = resolve?.(q);
    if (override) return override;
    if (q.table === "repurposing_sources" && q.operation === "select")
      return { data: source };
    if (q.table === "repurposing_sources" && q.operation === "update") {
      source = { ...source, ...q.payload };
      return { data: { id } };
    }
    if (q.table === "repurposing_sources" && q.operation === "insert")
      return { data: { id } };
    return { data: { name: "RIL" } };
  });
  const rpc = vi.fn().mockResolvedValue({ data: [id] });
  mocks.admin.mockReturnValue({ ...db, rpc });
  mocks.client.mockResolvedValue({
    ...db,
    auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) },
  });
  return { db, rpc, source: () => source };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.org.mockResolvedValue("org");
  mocks.extract.mockResolvedValue(analysis);
  mocks.prepare.mockResolvedValue({ materials: [], notes: [] });
  mocks.brand.mockResolvedValue([]);
  mocks.generate.mockResolvedValue({
    model: "mock",
    drafts: [
      { kind: "blog", title: "Blog", body: "Grounded copy", metadata: {} },
    ],
    failedKinds: [],
    warnings: [],
  });
});
function form() {
  const f = new FormData();
  f.set("title", "My source");
  f.set("source_kind", "transcript");
  f.set(
    "input_text",
    "A valid transcript with sufficient factual material for review.",
  );
  f.append("kinds", "blog");
  return f;
}
describe("source repurposing actions", () => {
  it("accepts a private library file without body copy or a fake activity", async () => {
    const attachment = { id: foreign, path: `org/library/${id}/${foreign}/notes.txt`, name: "notes.txt", mime: "text/plain", size: 100, createdAt: "2026-10-21T10:00:00Z" };
    const { db } = setup(query => query.table === "content_assets" ? { data: { id, body: null, metadata: { library_files: [attachment] }, updated_at: "version" } } : undefined!);
    const f = form(); f.set("source_kind", "library_file"); f.set("source_asset_id", id); f.set("source_file_id", foreign); f.set("activity_id", foreign);
    expect(await createRepurposingSource(null, f)).toMatchObject({ ok: true });
    expect(db.queries.find(query => query.operation === "insert")?.payload).toMatchObject({ source_kind: "summary", input_text: "", activity_id: null, attachment_id: null, options: { sourceAssetId: id, sourceFileId: foreign } });
    expect(mocks.extract).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects a file belonging to another library item before generation", async () => {
    const { db } = setup(query => query.table === "content_assets" ? { data: { id, metadata: { library_files: [] }, updated_at: "version" } } : undefined!);
    const f = form(); f.set("source_kind", "library_file"); f.set("source_asset_id", id); f.set("source_file_id", foreign);
    expect(await createRepurposingSource(null, f)).toMatchObject({ ok: false, error: expect.stringContaining("attached file") });
    expect(db.queries.some(query => query.operation === "insert")).toBe(false);
  });
  it("snapshots library copy on the server, links its revision, and never changes the original", async () => {
    const body = "Original library copy with supported facts for our next event.";
    const { db } = setup(query => query.table === "content_assets" ? { data: { id, title: "Library item", body, updated_at: "2026-10-21T10:00:00Z" } } : undefined!);
    const f = form(); f.set("source_kind", "library"); f.set("source_asset_id", id); f.set("input_text", "Ignore the saved copy and use this forged source instead.");
    expect(await createRepurposingSource(null, f)).toMatchObject({ ok: true });
    const write = db.queries.find(query => query.operation === "insert");
    expect(write?.table).toBe("repurposing_sources");
    expect(write?.payload).toMatchObject({ source_kind: "summary", input_text: body, activity_id: null, options: { sourceAssetId: id, sourceAssetUpdatedAt: "2026-10-21T10:00:00Z" } });
    expect(db.queries.find(query => query.table === "content_assets")?.filters).toContainEqual({ method: "eq", column: "organization_id", value: "org" });
    expect(db.queries.filter(query => query.operation !== "select").every(query => query.table === "repurposing_sources")).toBe(true);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([null, { id, body: "Too short" }])("rejects unavailable or empty library items before saving", async asset => {
    const { db } = setup(query => query.table === "content_assets" ? { data: asset } : undefined!);
    const f = form(); f.set("source_kind", "library"); f.set("source_asset_id", foreign);
    expect(await createRepurposingSource(null, f)).toMatchObject({ ok: false });
    expect(db.queries.some(query => query.operation === "insert")).toBe(false);
  });
  it("preserves the library provenance in every generated draft", async () => {
    const state = setup(query => query.table === "repurposing_sources" && query.operation === "select" ? { data: { ...state.source(), options: { sourceAssetId: foreign, sourceAssetUpdatedAt: "2026-10-21T10:00:00Z" } } } : undefined!);
    expect(await runRepurposing(id)).toMatchObject({ ok: true });
    expect(state.rpc).toHaveBeenCalledWith("finish_repurposing", expect.objectContaining({ p_drafts: [expect.objectContaining({ metadata: expect.objectContaining({ source_snapshot: expect.objectContaining({ asset_id: foreign, asset_updated_at: "2026-10-21T10:00:00Z" }) }) })] }));
  });
  it("derives workspace ownership and strips unrelated activity references from pasted sources", async () => {
    const { db } = setup();
    const f = form();
    f.set("activity_id", foreign);
    f.set("attachment_id", foreign);
    expect(await createRepurposingSource(null, f)).toMatchObject({
      ok: true,
      id,
    });
    expect(
      db.queries.find((q) => q.operation === "insert")?.payload,
    ).toMatchObject({
      organization_id: "org",
      created_by: "actor",
      activity_id: null,
      attachment_id: null,
    });
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects files not belonging to the selected workspace activity", async () => {
    const { db } = setup((q) =>
      q.table === "activity_attachments" ? { data: null } : undefined!,
    );
    const f = form();
    f.set("source_kind", "attachment");
    f.set("activity_id", id);
    f.set("attachment_id", foreign);
    expect(await createRepurposingSource(null, f)).toMatchObject({
      ok: false,
      error: expect.stringContaining("belonging"),
    });
    expect(db.queries.some((q) => q.operation === "insert")).toBe(false);
    expect(
      db.queries.find((q) => q.table === "activity_attachments")?.filters,
    ).toContainEqual({ method: "eq", column: "organization_id", value: "org" });
  });
  it("retains a failed extraction as an Idea with retry information and produces no drafts", async () => {
    const state = setup();
    mocks.extract.mockRejectedValue(
      new Error("Transcription unavailable. Paste a transcript."),
    );
    expect(await runRepurposing(id)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Transcription"),
    });
    expect(state.source()).toMatchObject({
      status: "idea",
      run_token: null,
      error: expect.stringContaining("Transcription"),
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("saves extraction before generation and preserves partial drafts for safe retries", async () => {
    const state = setup();
    mocks.generate.mockResolvedValue({
      model: "mock",
      drafts: [
        { kind: "blog", body: "Source based", title: "Blog", metadata: {} },
      ],
      failedKinds: ["newsletter"],
      warnings: [],
    });
    expect(await runRepurposing(id)).toMatchObject({
      ok: false,
      error: expect.stringContaining("newsletter"),
    });
    const extractionWrite = state.db.queries.find(
      (q) =>
        q.operation === "update" &&
        (q.payload as Record<string, unknown>).analysis,
    );
    expect(extractionWrite?.payload).toMatchObject({ analysis });
    expect(state.rpc).toHaveBeenCalledWith(
      "finish_repurposing",
      expect.objectContaining({
        p_org: "org",
        p_source: id,
        p_completed: ["blog"],
        p_error: expect.stringContaining("newsletter"),
        p_drafts: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              source_snapshot: expect.objectContaining({
                revision: 1,
                summary: analysis.summary,
              }),
            }),
          }),
        ],
      }),
    );
  });
  it("does not call AI when another run has already claimed the source", async () => {
    const state = setup((q) =>
      q.table === "repurposing_sources" && q.operation === "update"
        ? { data: null }
        : undefined!,
    );
    expect(await runRepurposing(id)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Another run"),
    });
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("keeps cached extraction when atomic output saving fails", async () => {
    const state = setup();
    state.rpc.mockResolvedValue({ error: { message: "Transaction aborted" } });
    expect(await runRepurposing(id)).toMatchObject({
      ok: false,
      error: expect.stringContaining("atomically"),
    });
    expect(state.source()).toMatchObject({
      analysis,
      status: "idea",
      run_token: null,
    });
  });
  it("creates a new source revision for a manual summary without deleting prior generated assets", async () => {
    const state = setup();
    const f = new FormData();
    f.set(
      "manual_summary",
      "A corrected summary with enough supported facts for a fresh generation.",
    );
    f.set("expected_updated_at", "2026-10-19T10:00:00Z");
    expect(await saveSourceSummary(id, null, f)).toMatchObject({ ok: true });
    expect(state.source()).toMatchObject({
      revision: 2,
      status: "idea",
      analysis: {},
      completed_kinds: [],
    });
    expect(
      state.db.queries.some(
        (q) => q.table === "content_assets" && q.operation !== "select",
      ),
    ).toBe(false);
  });
});
