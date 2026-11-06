import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), reviewer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: async () => "workspace" }));
vi.mock("@/lib/audience/access", () => ({ requireReviewer: mocks.reviewer }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { createLandingPage, setLandingPageStatus, updateLandingPage } from "./landing-pages";
const id = "0ae379a3-9723-4780-869a-51dbee4dc256";
function setup(patch: Record<string, unknown> = {}, saved = true) {
  const record = { id, status: "draft", updated_at: "v1", slug: "programme", title: "Programme", headline: "Meet your peers", cta_label: "Join", campaign_id: id, created_by: "author", approved_by: "reviewer", metadata: { automation: "keep" }, ...patch };
  const db = databaseMock(q => q.operation === "select" ? { data: record } : { data: saved ? { id } : null });
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) } });
  return db;
}
function form() {
  const data = new FormData();
  Object.entries({ title: "Programme", slug: "programme", headline: "Meet your peers", cta_label: "Join", updated_at: "v1", builder: JSON.stringify({ description: "A focused invitation", benefits: ["Peer learning"] }) }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => { vi.resetAllMocks(); mocks.reviewer.mockResolvedValue("owner"); });
describe("landing page save and review actions", () => {
  it("preserves automation metadata and protects saves with a version and draft predicate", async () => {
    const db = setup();
    expect((await updateLandingPage(id, null, form())).ok).toBe(true);
    const write = db.queries.find(q => q.operation === "update")!;
    expect(write.payload).toMatchObject({ metadata: { automation: "keep", last_edited_by: "actor", builder: { benefits: ["Peer learning"] } } });
    expect(write.payload).not.toHaveProperty("builder");
    expect(write.filters).toEqual(expect.arrayContaining([{ method: "eq", column: "status", value: "draft" }, { method: "eq", column: "updated_at", value: "v1" }, { method: "eq", column: "organization_id", value: "workspace" }]));
  });
  it("refuses stale saves and never claims a concurrent update succeeded", async () => {
    const db = setup({ updated_at: "v2" });
    expect((await updateLandingPage(id, null, form())).error).toMatch(/Reload/);
    expect(db.queries.some(q => q.operation === "update")).toBe(false);
    setup({}, false);
    expect((await updateLandingPage(id, null, form())).error).toMatch(/changed/);
  });
  it("refuses malformed and incomplete content sections before saving", async () => {
    const db = setup(); const data = form(); data.set("builder", "{");
    expect((await createLandingPage(null, data)).ok).toBe(false);
    data.set("builder", JSON.stringify({ faqs: [{ question: "Who?", answer: "" }] }));
    expect((await createLandingPage(null, data)).ok).toBe(false);
    expect(db.queries).toEqual([]);
  });
  it.each([{ created_by: "actor" }, { metadata: { last_edited_by: "actor" } }])("prevents authors and latest editors approving their work %o", async patch => {
    const db = setup({ status: "review", ...patch });
    expect((await setLandingPageStatus(id, "approved", "v1")).error).toMatch(/did not write or edit/);
    expect(db.queries.some(q => q.operation === "update")).toBe(false);
  });
  it("requires a linked campaign, matching page version and an independent publisher", async () => {
    setup({ campaign_id: null });
    expect((await setLandingPageStatus(id, "review", "v1")).error).toMatch(/campaign/);
    setup();
    expect((await setLandingPageStatus(id, "review", "v0")).error).toMatch(/review the latest/);
    setup({ status: "approved", approved_by: "actor" });
    expect((await setLandingPageStatus(id, "published", "v1")).error).toMatch(/different owner/);
  });
  it("publishes only approved, unchanged content and records the publishing actor", async () => {
    const db = setup({ status: "approved" });
    expect((await setLandingPageStatus(id, "published", "v1")).ok).toBe(true);
    expect(db.queries.find(q => q.operation === "update")?.payload).toEqual({ status: "published", published_by: "actor" });
  });
});
