"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { getUserRole } from "@/lib/audience/access";
import { WORKSPACE_ROLES } from "@/lib/email/sensitivity";

export interface WorkspaceSettingsResult { ok: boolean; error?: string; message?: string; }

const roleList = z.array(z.enum(WORKSPACE_ROLES)).min(1, "Choose at least one role.").transform((roles) => [...new Set(roles)]);
const schema = z.object({ canFlagSensitive: roleList, sensitiveApproverRoles: roleList });

/**
 * Sets which roles may flag email campaigns as sensitive and which may give
 * the senior sign-off. Owners and admins only; RLS enforces the same.
 */
export async function updateSensitivityRoles(input: { canFlagSensitive: string[]; sensitiveApproverRoles: string[] }): Promise<WorkspaceSettingsResult> {
  try {
    const organizationId = await requireOrganizationId();
    const role = await getUserRole(organizationId);
    if (role !== "owner" && role !== "admin") return { ok: false, error: "Only an owner or admin can change workspace approval roles." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choose valid roles." };
    const supabase = await createClient();
    const { error } = await supabase.from("workspace_settings").upsert({
      organization_id: organizationId,
      can_flag_sensitive: parsed.data.canFlagSensitive,
      sensitive_approver_roles: parsed.data.sensitiveApproverRoles,
    }, { onConflict: "organization_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/email");
    revalidatePath("/approvals");
    return { ok: true, message: "Approval roles saved." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save workspace settings." };
  }
}
