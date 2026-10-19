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
