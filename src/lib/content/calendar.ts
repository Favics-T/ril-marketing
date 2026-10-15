import { reminderState, type ReminderState } from "@/lib/content/reminders";
import { WORKSPACE_TIME_ZONE } from "@/lib/time";

/**
 * Where an asset sits on the content calendar. Pure — unit tested.
 */

interface CalendarAsset {
  status: string;
  channel: string | null;
  platform: string | null;
  format: string | null;
  scheduled_for: string | null;
  published_at: string | null;
}

/** Statuses the calendar shows. */
export const CALENDAR_STATUSES = ["approved", "scheduled", "published"] as const;

/** Statuses that are still waiting to go out, so can be overdue. */
const PENDING_STATUSES = new Set(["approved", "scheduled"]);

/**
 * The instant an asset sits at: its planned time, or, for one published
 * without a date, when it went out. Null when it has neither.
 */
export function calendarAt(asset: Pick<CalendarAsset, "scheduled_for" | "published_at">): string | null {
  return asset.scheduled_for ?? asset.published_at;
}

/**
 * The calendar's flag for an asset. Social posts keep their reminder ("due
 * today" or "overdue"); any other dated asset still waiting to go out is
 * "overdue" once its time has passed.
 */
export function calendarFlag(
  asset: CalendarAsset,
  now: Date = new Date(),
  timeZone: string = WORKSPACE_TIME_ZONE
): ReminderState | null {
  const reminder = reminderState(asset, now, timeZone);
  if (reminder) return reminder;
  if (!PENDING_STATUSES.has(asset.status) || !asset.scheduled_for) return null;
  const due = new Date(asset.scheduled_for).getTime();
  return !Number.isNaN(due) && due < now.getTime() ? "overdue" : null;
}
