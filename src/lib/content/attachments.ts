import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ActivityAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
  signed_url: string | null;
  image_analysis: {
    id: string;
    status: string;
    model: string;
    analysis: Record<string, unknown>;
    error: string | null;
    updated_at: string;
  } | null;
}

export async function listActivityAttachments(
  organizationId: string,
  activityId: string
): Promise<ActivityAttachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_attachments")
    .select("id, storage_path, file_name, mime_type, byte_size, created_at")
    .eq("organization_id", organizationId)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to load activity files: ${error.message}`);
  const rows = (data ?? []) as Array<Omit<ActivityAttachment, "signed_url"> & { storage_path: string }>;
  if (!rows.length) return [];
  const [signedResult, analysesResult] = await Promise.all([
    supabase.storage.from("ril-activity-media").createSignedUrls(rows.map((row) => row.storage_path), 3600),
    supabase.from("activity_media_analyses").select("id,attachment_id,status,model,analysis,error,updated_at").eq("organization_id", organizationId).in("attachment_id", rows.map((row) => row.id)),
  ]);
  const { data: signed, error: signedError } = signedResult;
  if (signedError) throw new Error(`Failed to sign activity files: ${signedError.message}`);
  // This lets existing environments keep rendering attachments while the new
  // analysis migration is waiting to be applied.
  // Only completed analyses reach the browser; failed ones may hold a raw model response.
  const analyses = new Map((analysesResult.error ? [] : analysesResult.data ?? []).map((analysis) => [analysis.attachment_id, analysis.status === "completed" ? analysis : { ...analysis, analysis: {} }]));
  return rows.map((row, index) => ({ ...row, signed_url: signed?.[index]?.signedUrl ?? null, image_analysis: analyses.get(row.id) ?? null }));
}
