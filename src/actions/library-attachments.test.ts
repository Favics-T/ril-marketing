import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ org: vi.fn(), client: vi.fn(), info: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { registerLibraryFile, setLibraryFileRemoved, setActivityLibraryLink, findLibraryContent } from "./library-attachments";
const org = "80000000-0000-4000-8000-000000000001", assetId = "80000000-0000-4000-8000-000000000002", activityId = "80000000-0000-4000-8000-000000000003", fileId = "80000000-0000-4000-8000-000000000004";
const path = `${org}/library/${assetId}/${fileId}/notes.txt`;
const file = { id: fileId, path, name: "notes.txt", mime: "text/plain", size: 120, createdAt: "2026-10-21T10:00:00Z" };
function setup(asset: Record<string, unknown> | null = {}, resolve?: (query: Query) => object | undefined) {
  const db = databaseMock(query => resolve?.(query) ?? (query.table === "content_assets" && query.operation === "select" ? { data: asset === null ? null : { id: assetId, status: "editing", updated_at: "version", source_activity_id: null, metadata: { seo: { title: "Existing metadata" } }, ...asset } } : { data: { id: query.table === "activities" ? activityId : assetId } }));
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: { id: "author" } } }) }, storage: { from: () => ({ info: mocks.info }) } });
  return db;
}
beforeEach(() => { vi.resetAllMocks(); mocks.org.mockResolvedValue(org); mocks.info.mockResolvedValue({ data: { contentType: "text/plain", size: 120 }, error: null }); });
describe("private library files", () => {
  it("verifies the stored object and preserves other metadata when registering a file", async () => {
    const db = setup();
    expect(await registerLibraryFile(assetId, path)).toEqual({ ok: true });
    expect(mocks.info).toHaveBeenCalledWith(path);
    const update = db.queries.find(query => query.operation === "update")!;
    expect(update.payload).toMatchObject({ metadata: { seo: { title: "Existing metadata" }, library_files: [expect.objectContaining({ id: fileId, size: 120, mime: "text/plain" })] } });
    expect(update.filters).toContainEqual({ method: "eq", column: "organization_id", value: org });
    expect(update.filters).toContainEqual({ method: "eq", column: "updated_at", value: "version" });
  });
  it.each([null, { status: "review" }, { status: "approved" }, { status: "published" }])("rejects unavailable or locked content before checking storage: %j", async asset => {
    const db = setup(asset);
    expect(await registerLibraryFile(assetId, path)).toMatchObject({ ok: false });
    expect(mocks.info).not.toHaveBeenCalled();
    expect(db.queries.some(query => query.operation === "update")).toBe(false);
  });
  it("rejects paths from other items or workspaces", async () => {
    setup();
    expect(await registerLibraryFile(assetId, path.replace(org, activityId))).toMatchObject({ ok: false });
    expect(mocks.info).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: { message: "missing" } }, { data: { contentType: "text/plain", size: 0 } }, { data: { contentType: "application/x-executable", size: 100 } }])("rejects unverified objects: %j", async response => {
    const db = setup(); mocks.info.mockResolvedValue(response);
    expect(await registerLibraryFile(assetId, path)).toMatchObject({ ok: false });
    expect(db.queries.some(query => query.operation === "update")).toBe(false);
  });
  it("is idempotent when an upload registration is retried", async () => {
    const db = setup({ metadata: { library_files: [file] } });
    expect(await registerLibraryFile(assetId, path)).toEqual({ ok: true });
    expect(mocks.info).not.toHaveBeenCalled();
    expect(db.queries.some(query => query.operation === "update")).toBe(false);
  });
  it("reports a concurrent change without claiming the file was attached", async () => {
    setup({}, query => query.operation === "update" ? { data: null } : undefined);
    expect(await registerLibraryFile(assetId, path)).toMatchObject({ ok: false, error: expect.stringContaining("changed") });
  });
  it("removes and restores attachments without purging source files or other metadata", async () => {
    let db = setup({ metadata: { library_files: [file], seo: { title: "Keep" } } });
    expect(await setLibraryFileRemoved(assetId, fileId, true)).toEqual({ ok: true });
    expect(db.queries.find(query => query.operation === "update")?.payload).toMatchObject({ metadata: { seo: { title: "Keep" }, library_files: [expect.objectContaining({ removedAt: expect.any(String), path })] } });
    db = setup({ metadata: { library_files: [{ ...file, removedAt: "2026-10-21T11:00:00Z" }] } });
    expect(await setLibraryFileRemoved(assetId, fileId, false)).toEqual({ ok: true });
    expect(db.queries.find(query => query.operation === "update")?.payload).toEqual({ metadata: { library_files: [file] } });
  });
});
describe("activity/library association", () => {
  it("links and detaches without changing original source, copy, status or files", async () => {
    const original = "80000000-0000-4000-8000-000000000005";
    const db = setup({ source_activity_id: original, status: "published", metadata: { library_files: [file], linked_activity_ids: [original] } });
    expect(await setActivityLibraryLink(activityId, assetId, true)).toEqual({ ok: true });
    const update = db.queries.find(query => query.operation === "update")!;
    expect(update.payload).toEqual({ metadata: { library_files: [file], linked_activity_ids: [original, activityId] } });
    expect(db.queries.find(query => query.table === "activities")?.filters).toContainEqual({ method: "eq", column: "organization_id", value: org });
    const detached = setup({ metadata: { library_files: [file], linked_activity_ids: [original, activityId] } });
    expect(await setActivityLibraryLink(activityId, assetId, false)).toEqual({ ok: true });
    expect(detached.queries.find(query => query.operation === "update")?.payload).toEqual({ metadata: { library_files: [file], linked_activity_ids: [original] } });
  });
  it("rejects foreign activities and preserves an original source relationship", async () => {
    let db = setup({}, query => query.table === "activities" ? { data: null } : undefined);
    expect(await setActivityLibraryLink(activityId, assetId, true)).toMatchObject({ ok: false });
    expect(db.queries.some(query => query.operation === "update")).toBe(false);
    db = setup({ source_activity_id: activityId });
    expect(await setActivityLibraryLink(activityId, assetId, false)).toMatchObject({ ok: false, error: expect.stringContaining("original source") });
  });
  it("scopes a title search to the authenticated workspace and escapes wildcard input", async () => {
    const db = setup({}, () => ({ data: [] }));
    expect(await findLibraryContent("100%_report")).toMatchObject({ ok: true });
    expect(db.queries[0].filters).toContainEqual({ method: "eq", column: "organization_id", value: org });
    expect(db.queries[0].filters).toContainEqual({ method: "ilike", column: "title", value: "%100\\%\\_report%" });
  });
});
