import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/email/tokens", () => ({ hashUnsubscribeToken: () => "hash" }));
import { unsubscribeFromMarketing } from "./unsubscribe";

const TOKEN = "a".repeat(43);

function setup(email: string | null, matches: string[] = []) {
  const db = databaseMock((q: Query): QueryResult => {
    if (q.operation === "update") return { error: null };
    if (q.table === "email_campaign_deliveries") return { data: { id: "delivery", organization_id: "org", lead_id: "lead-1" } };
    if (q.table === "leads" && q.single) return { data: { email } };
    if (q.table === "leads") return { data: matches.map((id) => ({ id })) };
    return { data: null };
  });
  mocks.admin.mockReturnValue(db);
  return db;
}
const updates = (db: ReturnType<typeof setup>) => db.queries.filter((q) => q.operation === "update");

afterEach(() => vi.clearAllMocks());

describe("unsubscribeFromMarketing", () => {
  it("unsubscribes every lead in the workspace with the same email, ignoring case", async () => {
    const db = setup("Reader@Example.com", ["lead-1", "lead-2", "lead-3"]);
    expect(await unsubscribeFromMarketing(TOKEN)).toBe(true);
    const lookup = db.queries.find((q) => q.table === "leads" && q.operation === "select" && !q.single);
    expect(lookup?.filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "org" },
      { method: "ilike", column: "email", value: "Reader@Example.com" },
    ]));
    const [leadUpdate, deliveryUpdate] = updates(db);
    expect(leadUpdate.table).toBe("leads");
    expect(leadUpdate.payload).toMatchObject({ marketing_consent: false });
    expect(leadUpdate.filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "org" },
      { method: "in", column: "id", value: ["lead-1", "lead-2", "lead-3"] },
    ]));
    expect(deliveryUpdate.table).toBe("email_campaign_deliveries");
    expect(deliveryUpdate.filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "org" },
      { method: "in", column: "lead_id", value: ["lead-1", "lead-2", "lead-3"] },
    ]));
  });

  it("matches wildcard characters in the address literally", async () => {
    const db = setup("first_last%x\\y@example.com", ["lead-1"]);
    await unsubscribeFromMarketing(TOKEN);
    expect(db.queries.find((q) => q.table === "leads" && !q.single)?.filters).toContainEqual({ method: "ilike", column: "email", value: "first\\_last\\%x\\\\y@example.com" });
  });

  it("changes only the token's lead when it has no email", async () => {
    const db = setup(null);
    expect(await unsubscribeFromMarketing(TOKEN)).toBe(true);
    expect(db.queries.some((q) => q.table === "leads" && q.operation === "select" && !q.single)).toBe(false);
    expect(updates(db)[0].filters).toContainEqual({ method: "in", column: "id", value: ["lead-1"] });
  });

  it("rejects malformed tokens without touching the database", async () => {
    expect(await unsubscribeFromMarketing("short")).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
