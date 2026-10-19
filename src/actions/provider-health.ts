"use server";

import { requireOrganizationId } from "@/lib/supabase/organization";
import { getUserRole } from "@/lib/audience/access";
import { inspectProviderConnections, type ConnectionHealth } from "@/lib/integrations/connection-health";

export async function checkProviderConnections(): Promise<{ok: boolean; checkedAt?: string; connections?: ConnectionHealth[]; error?: string}> {
  try {
    const org = await requireOrganizationId();
    const role = await getUserRole(org);
    if (!role || !["owner", "admin", "marketing_manager"].includes(role)) return {ok: false, error: "Ask an owner, admin or marketing manager to check provider credentials."};
    const connections = await inspectProviderConnections(org);
    return {ok: true, checkedAt: new Date().toISOString(), connections};
  } catch {
    return {ok: false, error: "Could not check connections. Refresh and try again; saved credentials have not been replaced."};
  }
}
