import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), org: vi.fn(), role: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { updateSensitivityRoles } from "./workspace-settings";

function setup() {
  const db = databaseMock(() => ({ data: null, error: null }));
  mocks.client.mockResolvedValue(db);
  return db;
}

beforeEach(() => { mocks.org.mockResolvedValue("org"); mocks.role.mockResolvedValue("owner"); });
afterEach(() => vi.clearAllMocks());

describe("updateSensitivityRoles", () => {
  it("saves both role lists for the workspace through the caller's own client", async () => {
    const db = setup();
    expect(await updateSensitivityRoles({ canFlagSensitive: ["owner", "leadership", "owner"], sensitiveApproverRoles: ["leadership"] })).toEqual({ ok: true, message: "Approval roles saved." });
    expect(db.queries[0]).toMatchObject({ table: "workspace_settings", operation: "upsert", payload: { organization_id: "org", can_flag_sensitive: ["owner", "leadership"], sensitive_approver_roles: ["leadership"] } });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each(["marketing_manager", "leadership", "member", null])("refuses a %s", async (role) => {
    mocks.role.mockResolvedValue(role);
    const db = setup();
    expect((await updateSensitivityRoles({ canFlagSensitive: ["owner"], sensitiveApproverRoles: ["owner"] })).ok).toBe(false);
    expect(db.queries).toHaveLength(0);
  });
  it("refuses an empty list or an unknown role", async () => {
    const db = setup();
    expect(await updateSensitivityRoles({ canFlagSensitive: [], sensitiveApproverRoles: ["owner"] })).toEqual({ ok: false, error: "Choose at least one role." });
    expect((await updateSensitivityRoles({ canFlagSensitive: ["owner"], sensitiveApproverRoles: ["intern"] })).ok).toBe(false);
    expect(db.queries).toHaveLength(0);
  });
});
