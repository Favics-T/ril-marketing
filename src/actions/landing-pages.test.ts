import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: vi.fn().mockResolvedValue("org-a") }));
vi.mock("@/lib/audience/access", () => ({ requireReviewer: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { createLandingPage, updateLandingPage } from "./landing-pages";

afterEach(() => vi.clearAllMocks());

function setup() {
  const db = databaseMock((q) => q.operation === "insert" ? { data: { id: "page-1" }, error: null } : { data: { status: "draft" }, error: null });
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } });
  return db;
}

function form(registrationUrl: string) {
  const data = new FormData();
  data.set("title", "Founders week internal");
  data.set("slug", "founders-week");
  data.set("headline", "Build what comes next.");
  data.set("cta_label", "Register");
  data.set("registration_url", registrationUrl);
  return data;
}

const writes = (db: ReturnType<typeof setup>) => db.queries.filter((q) => q.operation === "insert" || q.operation === "update");

describe("landing page registration links (REN-417)", () => {
  it.each(["javascript:alert(1)", "data:text/html,hi", "ftp://example.com/file", "https:ril", "https://localhost"])("refuses %s on create", async (url) => {
    const db = setup();
    const result = await createLandingPage(null, form(url));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/http:\/\/ or https:\/\//);
    expect(writes(db)).toEqual([]);
  });

  it("refuses an unsafe link on update", async () => {
    const db = setup();
    const result = await updateLandingPage("0ae379a3-9723-4780-869a-51dbee4dc256", null, form("javascript:alert(1)"));
    expect(result.ok).toBe(false);
    expect(writes(db)).toEqual([]);
  });

  it("saves an https link", async () => {
    const db = setup();
    expect(await createLandingPage(null, form("https://example.com/register"))).toEqual({ ok: true, id: "page-1" });
    expect(writes(db)[0]?.payload).toMatchObject({ registration_url: "https://example.com/register" });
  });

  it("saves no link when the field is empty", async () => {
    const db = setup();
    expect((await createLandingPage(null, form("  "))).ok).toBe(true);
    expect(writes(db)[0]?.payload).toMatchObject({ registration_url: null });
  });
});
