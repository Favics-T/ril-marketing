import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { getCallerOrganizationId } from "./organization";

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";

afterEach(() => vi.clearAllMocks());
function setup({ profileOrg, memberOf, membershipError = false, signedIn = true }: {
  profileOrg: string | null; memberOf: string[]; membershipError?: boolean; signedIn?: boolean;
}) {
  const db = databaseMock(q => q.table === "organization_members"
    ? membershipError ? { data: null, error: { message: "Read failed" } } : { data: memberOf.map(organization_id => ({ organization_id })), error: null }
    : { data: { organization_id: profileOrg }, error: null });
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: signedIn ? { id: "user-a" } : null } }) } });
  return db;
}

describe("getCallerOrganizationId (REN-416)", () => {
  it("ignores a profile workspace the caller is not a member of", async () => {
    setup({ profileOrg: ORG_B, memberOf: [ORG_A] });
    expect(await getCallerOrganizationId()).toBe(ORG_A);
  });
  it("returns null when the profile names a workspace and there is no membership", async () => {
    setup({ profileOrg: ORG_B, memberOf: [] });
    expect(await getCallerOrganizationId()).toBeNull();
  });
  it("honours the profile's workspace when the caller is a member there", async () => {
    setup({ profileOrg: ORG_B, memberOf: [ORG_A, ORG_B] });
    expect(await getCallerOrganizationId()).toBe(ORG_B);
  });
  it("falls back to the earliest membership when the profile has no workspace", async () => {
    const db = setup({ profileOrg: null, memberOf: [ORG_A, ORG_B] });
    expect(await getCallerOrganizationId()).toBe(ORG_A);
    expect(db.queries.find(q => q.table === "organization_members")?.filters).toContainEqual({ method: "eq", column: "user_id", value: "user-a" });
  });
  it("fails closed when memberships can't be read", async () => {
    setup({ profileOrg: ORG_A, memberOf: [ORG_A], membershipError: true });
    expect(await getCallerOrganizationId()).toBeNull();
  });
  it("returns null for a signed-out caller without querying", async () => {
    const db = setup({ profileOrg: ORG_A, memberOf: [ORG_A], signedIn: false });
    expect(await getCallerOrganizationId()).toBeNull();
    expect(db.queries).toHaveLength(0);
  });
});
