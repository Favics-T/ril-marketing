"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { analyzeActivityImage, type ImageAnalysisResult } from "@/actions/media";
import { readSavedImageAnalysis } from "@/lib/ai/image-analysis-v2";
import {
  activityRecordKey, conflictFieldKey, isUnclear, openConflicts, recordUpdateFor, type ConflictResolution,
} from "@/lib/ai/image-conflicts";

const resolveSchema = z.object({
  attachmentId: z.string().uuid(),
  activityId: z.string().uuid(),
  field: z.string().trim().min(1).max(80),
  choice: z.enum(["image", "update_record"]),
});

type ConflictActivity = { id: string; title: string; description: string | null; event_date: string | null; speakers: string[] | null; partners: string[] | null; registration_url: string | null };

/**
 * Settles one conflict between an activity image and its activity record:
 * use the image's value in the captions, or write it to the activity record
 * first. Once every conflict has a choice, the image is analysed again with
 * the choices pinned, and the caption drafts that were on hold are created.
 * A failed record update saves nothing and runs nothing.
 */
export async function resolveImageConflict(attachmentId: string, activityId: string, field: string, choice: "image" | "update_record"): Promise<ImageAnalysisResult> {
  try {
    const organizationId = await requireOrganizationId();
    const input = resolveSchema.safeParse({ attachmentId, activityId, field, choice });
    if (!input.success) return { ok: false, error: "Choose a valid conflict to resolve." };
    const supabase = await createClient();
    const [{ data: row, error: rowError }, { data: activity, error: activityError }] = await Promise.all([
      supabase.from("activity_media_analyses").select("id,status,analysis,updated_at").eq("organization_id", organizationId).eq("activity_id", activityId).eq("attachment_id", attachmentId).maybeSingle<{ id: string; status: string; analysis: Record<string, unknown>; updated_at: string }>(),
      supabase.from("activities").select("id,title,description,event_date,speakers,partners,registration_url").eq("organization_id", organizationId).eq("id", activityId).maybeSingle<ConflictActivity>(),
    ]);
    if (rowError || activityError) throw new Error((rowError ?? activityError)!.message);
    if (!row || !activity) return { ok: false, error: "Image analysis or activity not found in this workspace." };
    if (row.status === "processing") return { ok: false, error: "Captions are already being regenerated for this image. Refresh this page in a moment." };
    const saved = row.status === "completed" ? readSavedImageAnalysis(row.analysis) : null;
    if (saved?.version !== 2) return { ok: false, error: "Analyse this image again before resolving its conflicts." };
    const conflict = openConflicts(saved.data).find((item) => item.field === input.data.field);
    if (!conflict) return { ok: false, error: "This conflict has already been resolved. Refresh this page." };
    if (!conflict.onImage.trim() || isUnclear(conflict.onImage)) return { ok: false, error: "The image's text isn't clear enough to use. Correct the activity record, then analyse the image again." };

    let record = activity;
    let value = conflict.onImage.trim();
    if (input.data.choice === "update_record") {
      const update = recordUpdateFor(conflict);
      if (!update) return { ok: false, error: "The activity record has no field this value can go in. Use the image's value instead." };
      const { data: updated, error } = await supabase.from("activities").update({ [update.column]: update.value }).eq("organization_id", organizationId).eq("id", activityId).select("id").maybeSingle<{ id: string }>();
      if (error || !updated) return { ok: false, error: `Could not update the activity record: ${error?.message ?? "the activity wasn't found"}. Nothing was changed.` };
      record = { ...activity, [update.column]: update.value };
      value = update.value;
      revalidatePath("/activities");
      revalidatePath("/calendar");
    }

    // A record this action just changed still matches the earlier choices, so they stay pinned.
    const recordKey = activityRecordKey(record);
    const resolution: ConflictResolution = {
      field: conflict.field, key: conflictFieldKey(conflict.field), value, recordValue: conflict.activityRecord,
      choice: input.data.choice === "image" ? "image" : "record_updated", recordKey,
    };
    const resolutions = [
      ...saved.data.resolutions.map((item) => (input.data.choice === "update_record" ? { ...item, recordKey } : item)),
      resolution,
    ];
    // Compare-and-swap on updated_at: a second click on the same analysis is refused here.
    const { data: claimed, error: saveError } = await supabase.from("activity_media_analyses").update({ analysis: { ...row.analysis, resolutions } }).eq("organization_id", organizationId).eq("id", row.id).eq("status", "completed").eq("updated_at", row.updated_at).select("id").maybeSingle();
    if (saveError) throw new Error(saveError.message);
    if (!claimed) return { ok: false, error: "Another request is already handling this image. Refresh this page in a moment." };

    const remaining = openConflicts({ ...saved.data, resolutions }).length;
    revalidatePath(`/activities/${activityId}`);
    if (remaining) return { ok: true, message: `Choice saved. Choose for the ${remaining === 1 ? "other conflict" : `other ${remaining} conflicts`} to create the caption drafts.` };
    return await analyzeActivityImage(attachmentId, activityId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not resolve the conflict." };
  }
}
