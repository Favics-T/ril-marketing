import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPublication } from "@/lib/content/publishing";

export async function processContentPublishingBatch(limit = 20) {
  const { data, error } = await createAdminClient().from("publications").select("organization_id,content_asset_id").eq("status", "queued").in("channel", ["buffer", "wordpress"]).not("external_id", "is", null).or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`).order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error("Could not read pending publications.");
  let checked = 0, failed = 0;
  const rows = data ?? [];
  for (let start = 0; start < rows.length; start += 4) {
    await Promise.all(rows.slice(start, start + 4).map(async row => {
      try { await syncPublication(row.organization_id, row.content_asset_id); checked++; }
      catch { failed++; }
    }));
  }
  return { checked, failed };
}
