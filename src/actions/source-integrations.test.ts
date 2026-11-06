import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ org: vi.fn(), role: vi.fn(), client: vi.fn(), notion: vi.fn(), youtube: vi.fn(), save: vi.fn(), disconnect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role }));
vi.mock("@/lib/integrations/source-connections", () => ({ saveNotionConnection: mocks.save, saveYouTubeApp: mocks.save, disconnectSource: mocks.disconnect, sourceAccess: vi.fn() }));
vi.mock("@/lib/integrations/content-import", async original => ({ ...await original<typeof import("@/lib/integrations/content-import")>(), readNotionPage: mocks.notion, readYouTubeVideo: mocks.youtube }));
import { importContentItem, saveNotionAction, disconnectSourceAction, saveYouTubeAppAction } from "./source-integrations";
beforeEach(() => { vi.resetAllMocks(); mocks.org.mockResolvedValue("org"); mocks.role.mockResolvedValue("owner"); mocks.notion.mockResolvedValue({ id: "page", title: "Notes", body: "Source evidence", url: "https://www.notion.so/page" }); mocks.youtube.mockResolvedValue({ id: "abcdefghijk", title: "Event", body: "Description", url: "https://www.youtube.com/watch?v=abcdefghijk" }); });
describe("source integration actions", () => {
  it.each(["member", "leadership", null])("blocks %s from replacing or disconnecting connection secrets", async role => {
    mocks.role.mockResolvedValue(role); const form = new FormData(); form.set("token", "long-notion-secret");
    expect((await saveNotionAction(form)).ok).toBe(false); expect((await disconnectSourceAction("youtube")).ok).toBe(false); expect((await saveYouTubeAppAction(form)).ok).toBe(false); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.disconnect).not.toHaveBeenCalled();
  });
  it("imports server-read source content as an editing draft and retains provenance", async () => {
    const db = databaseMock(query => ({ data: query.operation === "select" ? null : { id: "saved" } })); mocks.client.mockResolvedValue(db);
    const result = await importContentItem("notion", "page"); expect(result.ok).toBe(true);
    expect(db.queries.find(q=>q.operation === "insert")?.payload).toMatchObject({ organization_id: "org", status: "editing", title: "Notes", body: "Source evidence", metadata: { external_import: { provider: "notion", external_id: "page", source_url: "https://www.notion.so/page" } } });
    expect(mocks.notion).toHaveBeenCalledWith("org", "page");
  });
  it("returns the existing import without overwriting any edited copy", async () => {
    const db = databaseMock(()=>({ data: { id: "existing" } })); mocks.client.mockResolvedValue(db);
    expect((await importContentItem("notion", "page")).ok).toBe(true); expect(db.queries.every(q=>q.operation === "select")).toBe(true);
    expect(db.queries[0].filters).toContainEqual({ method: "eq", column: "organization_id", value: "org" });
  });
  it("does not save anything if the provider cannot read the source", async () => { mocks.notion.mockRejectedValue(new Error("Share the page")); expect((await importContentItem("notion", "page")).ok).toBe(false); expect(mocks.client).not.toHaveBeenCalled(); });
  it("labels a user-supplied transcript separately from the provider description", async () => { const db = databaseMock(query=>({data: query.operation === "select" ? null : {id:"saved"}})); mocks.client.mockResolvedValue(db); expect((await importContentItem("youtube", "abcdefghijk", "User supplied speech")).ok).toBe(true); expect(db.queries.find(q=>q.operation === "insert")?.payload).toMatchObject({ body: "Description\n\n## Supplied transcript\n\nUser supplied speech", metadata: { external_import: { supplied_transcript: true } } }); });
});
