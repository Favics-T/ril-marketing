import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashUnsubscribeToken } from "@/lib/email/tokens";

/** Escapes LIKE wildcards so `ilike` matches the address exactly, ignoring case. */
function exactIlike(value: string) { return value.replace(/[\\%_]/g, (char) => `\\${char}`); }

/**
 * Unsubscribes the address behind a delivery token. Every lead in the same
 * workspace with that email (case-insensitive) loses marketing consent, and
 * their pending deliveries are cancelled.
 */
export async function unsubscribeFromMarketing(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const admin = createAdminClient();
  const tokenHash = hashUnsubscribeToken(token);
  const { data: delivery } = await admin.from("email_campaign_deliveries").select("id,organization_id,lead_id").eq("unsubscribe_token_hash", tokenHash).maybeSingle<{id:string;organization_id:string;lead_id:string}>();
  if (!delivery) return false;
  const { data: lead, error: leadLookupError } = await admin.from("leads").select("email").eq("organization_id", delivery.organization_id).eq("id", delivery.lead_id).maybeSingle<{email:string|null}>();
  if (leadLookupError) return false;
  const leadIds = new Set([delivery.lead_id]);
  const email = lead?.email?.trim();
  if (email) {
    const { data: matches, error: matchError } = await admin.from("leads").select("id").eq("organization_id", delivery.organization_id).ilike("email", exactIlike(email));
    if (matchError) return false;
    for (const match of (matches ?? []) as Array<{id:string}>) leadIds.add(match.id);
  }
  const ids = [...leadIds];
  const now = new Date().toISOString();
  const [{ error: leadError }, { error: deliveryError }] = await Promise.all([
    admin.from("leads").update({ marketing_consent: false, email_unsubscribed_at: now }).eq("organization_id", delivery.organization_id).in("id", ids),
    admin.from("email_campaign_deliveries").update({ status: "unsubscribed", error: "Recipient unsubscribed." }).eq("organization_id", delivery.organization_id).in("lead_id", ids).in("status", ["queued", "sending"]),
  ]);
  return !leadError && !deliveryError;
}
