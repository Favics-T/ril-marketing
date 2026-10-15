import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceMaterial } from "@/lib/ai/types";
import { DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES, extractDocumentText } from "@/lib/content/document-text";

const MAX_DOCUMENTS = 4;

type AnalysisRow = {
  attachment_id: string;
  analysis: Record<string, unknown> | null;
  attachment: { file_name: string; mime_type: string } | Array<{ file_name: string; mime_type: string }> | null;
};

type AttachmentRow = { id: string; storage_path: string; file_name: string; mime_type: string; byte_size: number };

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Turn completed media analyses into source material (pure — unit tested). */
export function materialsFromAnalyses(rows: AnalysisRow[]): SourceMaterial[] {
  const materials: SourceMaterial[] = [];
  const photoNotes: string[] = [];
  for (const row of rows) {
    const analysis = row.analysis ?? {};
    const attachment = Array.isArray(row.attachment) ? row.attachment[0] : row.attachment;
    const file = attachment?.file_name ?? "attachment";
    if ("transcript" in analysis || "keyMoments" in analysis) {
      const transcript = str(analysis.transcript);
      if (transcript) materials.push({ kind: "transcript", label: `Transcript — ${file}`, text: transcript, timestamped: false });
      const moments = list<{ time?: string; note?: string }>(analysis.keyMoments).filter((m) => str(m.time) && str(m.note));
      const clips = list<{ start?: string; end?: string; title?: string; reason?: string }>(analysis.suggestedClips).filter((c) => str(c.start) && str(c.end));
      const summary = str(analysis.summary);
      const lines = [
        summary ? `Summary: ${summary}` : null,
        ...moments.map((m) => `${str(m.time)} — ${str(m.note)}`),
        ...clips.map((c) => `Possible clip ${str(c.start)}–${str(c.end)}: ${str(c.title)}${str(c.reason) ? ` (${str(c.reason)})` : ""}`),
      ].filter((line): line is string => Boolean(line));
      if (lines.length) {
        materials.push({
          kind: "key_moments",
          label: `Key moments — ${file}`,
          text: lines.join("\n"),
          timestamped: moments.length > 0 || clips.length > 0,
        });
      }
    } else if ("sceneSummary" in analysis) {
      const scene = str(analysis.sceneSummary);
      const alt = str(analysis.altText);
      if (scene) photoNotes.push(`${file}: ${scene}${alt ? ` Alt text: ${alt}` : ""}`);
    }
  }
  if (photoNotes.length) {
    materials.push({ kind: "image_notes", label: "Photo notes", text: photoNotes.join("\n"), timestamped: false });
  }
  return materials;
}

/**
 * Everything already known about an activity's files: transcripts, key
 * moments and photo notes from completed media analyses, plus text extracted
 * from attached documents. Problems with one file never block generation;
 * they come back as warnings.
 */
export async function loadActivitySourceMaterial(
  client: SupabaseClient,
  organizationId: string,
  activityId: string
): Promise<{ materials: SourceMaterial[]; warnings: string[] }> {
  const warnings: string[] = [];
  const [analysesResult, attachmentsResult] = await Promise.all([
    client
      .from("activity_media_analyses")
      .select("attachment_id, analysis, attachment:activity_attachments(file_name, mime_type)")
      .eq("organization_id", organizationId)
      .eq("activity_id", activityId)
      .eq("status", "completed")
      .order("created_at")
      .limit(20),
    client
      .from("activity_attachments")
      .select("id, storage_path, file_name, mime_type, byte_size")
      .eq("organization_id", organizationId)
      .eq("activity_id", activityId)
      .order("created_at")
      .limit(50),
  ]);
  if (analysesResult.error) warnings.push("Media transcripts could not be loaded, so drafts use the activity record only.");
  const materials = materialsFromAnalyses((analysesResult.data ?? []) as AnalysisRow[]);

  const documents = ((attachmentsResult.data ?? []) as AttachmentRow[]).filter((a) => DOCUMENT_MIME_TYPES.has(a.mime_type));
  for (const doc of documents.slice(0, MAX_DOCUMENTS)) {
    if (doc.byte_size > MAX_DOCUMENT_BYTES) {
      warnings.push(`${doc.file_name} is over 8 MB and was not used as a source.`);
      continue;
    }
    try {
      const { data, error } = await client.storage.from("ril-activity-media").download(doc.storage_path);
      if (error || !data) throw new Error("could not be read");
      const text = await extractDocumentText(doc.mime_type, doc.file_name, Buffer.from(await data.arrayBuffer()));
      materials.push({ kind: "document", label: `Document — ${doc.file_name}`, text, timestamped: false });
    } catch (error) {
      warnings.push(`${doc.file_name} was not used as a source: ${error instanceof Error ? error.message : "extraction failed"}`);
    }
  }
  if (documents.length > MAX_DOCUMENTS) {
    warnings.push(`Only the first ${MAX_DOCUMENTS} documents were used as sources.`);
  }
  return { materials, warnings };
}
