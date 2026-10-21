import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readSensitivitySettings, type SensitivitySettings } from "@/lib/email/sensitivity";

/**
 * The workspace's sensitive-campaign role settings, or the defaults when it
 * has none. Throws on a read error so permission checks fail closed.
 */
export async function getWorkspaceSettings(organizationId: string): Promise<SensitivitySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_settings").select("can_flag_sensitive,sensitive_approver_roles")
    .eq("organization_id", organizationId).maybeSingle<{ can_flag_sensitive: string[]; sensitive_approver_roles: string[] }>();
  if (error) throw new Error(`Could not load workspace settings: ${error.message}`);
  return readSensitivitySettings(data);
}
