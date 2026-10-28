/**
 * Conflicts between an activity image and its activity record (REN-410).
 * Pure and client-safe: the analysis panel uses it to decide which actions to
 * offer, and the server uses it to hold, pin and apply the user's choices.
 */
import { z } from "zod";
import { shiftDayKey } from "@/lib/time";

export const CONFLICT_FIELDS = ["eventName", "date", "venue", "registration", "speakers", "partners", "other"] as const;
export type ConflictField = (typeof CONFLICT_FIELDS)[number];
export type ImageConflict = { field: string; onImage: string; activityRecord: string };

export const CONFLICT_FIELD_LABELS: Record<Exclude<ConflictField, "other">, string> = {
  eventName: "Event name", date: "Date", venue: "Venue", registration: "Registration link", speakers: "Speakers", partners: "Partners",
};

const FIELD_SYNONYMS: Record<string, ConflictField> = {
  eventname: "eventName", name: "eventName", title: "eventName", eventtitle: "eventName",
  date: "date", eventdate: "date", time: "date", datetime: "date",
  venue: "venue", location: "venue", place: "venue",
  registration: "registration", registrationlink: "registration", registrationurl: "registration", link: "registration", url: "registration", calltoaction: "registration", cta: "registration",
  speakers: "speakers", speaker: "speakers",
  partners: "partners", partner: "partners", partnernames: "partners", sponsor: "partners", sponsors: "partners",
};

/** The model's free-text field name ("Event name", "eventName", "title") as one fixed key. */
export function conflictFieldKey(field: string): ConflictField {
  return FIELD_SYNONYMS[field.toLowerCase().replace(/[^a-z]/g, "")] ?? "other";
}

/** "Event name", or the model's own label for a field outside the fixed list. */
export function conflictFieldLabel(field: string): string {
  const key = conflictFieldKey(field);
  return key === "other" ? field : CONFLICT_FIELD_LABELS[key];
}

/** Text the model couldn't read in full is never written to the record or captions. */
export const isUnclear = (value: string) => /\[unclear\]/i.test(value);

// ============ RESOLUTIONS ============

/**
 * A user's choice for one conflict. `recordKey` fingerprints the activity
 * record when the choice was made: a choice is only pinned while the record
 * is unchanged, so editing the record later reopens the question.
 */
export const conflictResolutionSchema = z.object({
  field: z.string().trim().min(1).max(80),
  key: z.enum(CONFLICT_FIELDS),
  value: z.string().trim().min(1).max(300),
  recordValue: z.string().trim().max(300),
  choice: z.enum(["image", "record_updated"]),
  recordKey: z.string().min(1).max(40),
});
export type ConflictResolution = z.infer<typeof conflictResolutionSchema>;

/** Whether a choice settles a conflict: the same field, or the same label for a field outside the fixed list. */
export function resolutionMatches(resolution: Pick<ConflictResolution, "field" | "key">, conflict: Pick<ImageConflict, "field">): boolean {
  const key = conflictFieldKey(conflict.field);
  return key === resolution.key && (key !== "other" || conflict.field.trim().toLowerCase() === resolution.field.trim().toLowerCase());
}

/** Conflicts the user hasn't chosen for yet. Any of these holds the caption drafts. */
export function openConflicts(analysis: { onImageText: { conflicts: ImageConflict[] }; resolutions?: ConflictResolution[] }): ImageConflict[] {
  const resolutions = analysis.resolutions ?? [];
  return analysis.onImageText.conflicts.filter((conflict) => !resolutions.some((resolution) => resolutionMatches(resolution, conflict)));
}

/** Saved choices that still apply to the activity record as it is now. */
export function pinnedResolutions(value: unknown, recordKey: string): ConflictResolution[] {
  const parsed = z.array(conflictResolutionSchema).safeParse(value);
  return parsed.success ? parsed.data.filter((resolution) => resolution.recordKey === recordKey) : [];
}

/** Fingerprint of the activity fields a conflict can be about. */
export function activityRecordKey(activity: { title: string; event_date: string | null; description: string | null; speakers: string[] | null; partners: string[] | null; registration_url: string | null }): string {
  const text = JSON.stringify([activity.title, activity.event_date?.slice(0, 10) ?? null, activity.description, activity.speakers ?? [], activity.partners ?? [], activity.registration_url]);
  // FNV-1a: a change detector, not a security boundary.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length.toString(36)}-${hash.toString(36)}`;
}

// ============ RECORD UPDATES ============

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A full calendar date written on an image ("Sat 24th October 2026",
 * "October 24, 2026", "2026-10-24") as a day key. A date without a year, or a
 * numeric one like 10/11/2026 that could be read two ways, is not a date to
 * write to the record.
 */
export function parseImageDate(text: string): string | null {
  const value = text.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  let key: string | null = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  if (!key) {
    const month = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
    const dayFirst = value.match(new RegExp(`\\b(\\d{1,2})\\s+${month},?\\s+(\\d{4})\\b`));
    const monthFirst = value.match(new RegExp(`\\b${month}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`));
    const [day, name, year] = dayFirst ? [dayFirst[1], dayFirst[2], dayFirst[3]] : monthFirst ? [monthFirst[2], monthFirst[1], monthFirst[3]] : [];
    if (day && name && year) key = `${year}-${String(MONTHS.indexOf(name) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return key && shiftDayKey(key, 0) === key ? key : null;
}

export type RecordUpdate = { column: "title" | "event_date" | "registration_url"; value: string };

/**
 * The activity record change "Update activity record" makes for a conflict,
 * or null when the record has no matching field or the image value doesn't
 * fit it: only the event name, a full date and a web link are written.
 */
export function recordUpdateFor(conflict: ImageConflict): RecordUpdate | null {
  const value = conflict.onImage.trim();
  if (!value || isUnclear(value)) return null;
  switch (conflictFieldKey(conflict.field)) {
    case "eventName":
      return value.length >= 2 && value.length <= 200 ? { column: "title", value } : null;
    case "date": {
      const key = parseImageDate(value);
      return key ? { column: "event_date", value: key } : null;
    }
    case "registration": {
      try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return url.hostname.includes(".") && !/\s/.test(value) && value.length <= 500 ? { column: "registration_url", value: url.toString() } : null;
      } catch { return null; }
    }
    default:
      return null;
  }
}
