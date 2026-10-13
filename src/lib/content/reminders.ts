import { normalizeChannel } from "@/lib/content/channels";
import { formatInZone, WORKSPACE_TIME_ZONE, zonedDayKey } from "@/lib/time";

export { WORKSPACE_TIME_ZONE, zonedDayKey };

/**
 * Social posts are published by hand, so a scheduled social asset acts as a
 * reminder: it is "due today" until its time passes and "overdue" once it
 * has passed without being marked as posted. Pure — unit tested.
 */

const SOCIAL_CHANNELS = new Set(["linkedin", "instagram", "x", "facebook", "youtube", "tiktok"]);
const SOCIAL_FORMATS = new Set(["social post", "short-form video"]);

export type ReminderState = "overdue" | "due_today";

interface ReminderAsset {
  status: string;
  channel: string | null;
  platform: string | null;
  format: string | null;
  scheduled_for: string | null;
}

export function isSocialAsset(asset: Pick<ReminderAsset, "channel" | "platform" | "format">): boolean {
  if (asset.format && SOCIAL_FORMATS.has(asset.format.toLowerCase())) return true;
  return [asset.platform, asset.channel].some((value) => {
    const channel = normalizeChannel(value);
    return channel !== null && SOCIAL_CHANNELS.has(channel);
  });
}

/** Null when the asset isn't a scheduled social post needing action today or earlier. */
export function reminderState(
  asset: ReminderAsset,
  now: Date = new Date(),
  timeZone: string = WORKSPACE_TIME_ZONE
): ReminderState | null {
  if (asset.status !== "scheduled" || !asset.scheduled_for || !isSocialAsset(asset)) return null;
  const due = new Date(asset.scheduled_for);
  if (Number.isNaN(due.getTime())) return null;
  if (due.getTime() < now.getTime()) return "overdue";
  return zonedDayKey(due, timeZone) === zonedDayKey(now, timeZone) ? "due_today" : null;
}

export const REMINDER_LABEL: Record<ReminderState, string> = {
  overdue: "Overdue",
  due_today: "Due today",
};

/** "Thu 9 Oct, 09:00 WAT" in the workspace zone. */
export function formatReminderTime(value: string, timeZone: string = WORKSPACE_TIME_ZONE): string {
  return formatInZone(value, "shortDateTime", timeZone);
}
