import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the caller's organization from their memberships (REN-416).
 * profiles.organization_id is only a preference for which workspace to open:
 * it is honoured when the caller is a member there, and ignored otherwise.
 * Many server actions pass this ID to the service-role client, which skips
 * RLS, so it must never name a workspace the caller doesn't belong to.
 */
export async function getCallerOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [memberships, profile] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle<{ organization_id: string | null }>(),
  ]);
  // Fail closed: without a readable membership list there is no workspace.
  if (memberships.error) return null;

  const memberOf = ((memberships.data ?? []) as Array<{ organization_id: string }>).map((m) => m.organization_id);
  const preferred = profile.data?.organization_id;
  if (preferred && memberOf.includes(preferred)) return preferred;
  return memberOf[0] ?? null;
}

export async function requireOrganizationId(): Promise<string> {
  const orgId = await getCallerOrganizationId();
  if (!orgId) {
    throw new Error("Not authenticated or no organization membership found.");
  }
  return orgId;
}
