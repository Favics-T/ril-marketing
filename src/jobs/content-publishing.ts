import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPublication } from "@/lib/content/publishing";

export async function processContentPublishingBatch(
  limit = 20,
  organizationId?: string,
) {
  const admin = createAdminClient();
  let plans = admin
    .from("recurring_content")
    .select("id,next_due")
    .eq("enabled", true)
    .gt("remaining", 0)
    .lte("next_due", new Date(Date.now() + 7 * 86400000).toISOString())
    .order("next_due")
    .limit(limit);
  if (organizationId) plans = plans.eq("organization_id", organizationId);
  const { data: rules, error: rulesError } = await plans;
  if (rulesError) throw new Error("Could not load repeating content plans.");
  let recurringPrepared = 0,
    recurringFailed = 0;
  for (const rule of rules ?? []) {
    try {
      const { data, error } = await admin.rpc("prepare_recurring_content", {
        p_rule: rule.id,
        p_due: rule.next_due,
      });
      if (error) recurringFailed++;
      else if (data) recurringPrepared++;
    } catch {
      recurringFailed++;
    }
  }
  let pending = admin
    .from("publications")
    .select("organization_id,content_asset_id")
    .in("status", ["queued", "scheduled", "missed"])
    .in("channel", ["buffer", "wordpress"])
    .not("external_id", "is", null)
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (organizationId) pending = pending.eq("organization_id", organizationId);
  const { data, error } = await pending;
  if (error) throw new Error("Could not read pending publications.");
  let checked = 0,
    failed = 0;
  const rows = data ?? [];
  for (let start = 0; start < rows.length; start += 4) {
    await Promise.all(
      rows.slice(start, start + 4).map(async (row) => {
        try {
          await syncPublication(row.organization_id, row.content_asset_id);
          checked++;
        } catch {
          failed++;
        }
      }),
    );
  }
  return { checked, failed, recurringPrepared, recurringFailed };
}
