import { describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { getPublishedLandingPage } from "./landing-pages";

describe("public page data minimisation", () => {
  it("returns public sections without internal automation, AI or editor metadata", async () => {
    const db = databaseMock(() => ({ data: [{ id: "page", slug: "programme", headline: "Meet your peers", metadata: { builder: { description: "Public description" }, private_note: "Do not expose", copy_suggestions: { prompt: "Internal brand policy" }, last_edited_by: "user" } }] }));
    mocks.admin.mockReturnValue(db);
    const page = await getPublishedLandingPage("programme");
    expect(page?.metadata).toEqual({ builder: expect.objectContaining({ description: "Public description" }) });
    expect(JSON.stringify(page?.metadata)).not.toMatch(/private_note|Do not expose|copy_suggestions|Internal brand|last_edited_by/);
    expect(db.queries[0].columns?.split(/,\s*/)).not.toContain("title");
    expect(db.queries[0].filters).toContainEqual({ method: "eq", column: "status", value: "published" });
  });
});
