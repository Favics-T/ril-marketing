import { shiftDayKey, WORKSPACE_TIME_ZONE, zonedDayKey, zonedWallTimeToDate } from "@/lib/time";
import { reminderState, type ReminderState } from "@/lib/content/reminders";

export const CALENDAR_STATUSES = ["approved", "scheduled", "published"] as const;

interface CalendarAsset {
  status: string;
  channel: string | null;
  platform: string | null;
  format: string | null;
  scheduled_for: string | null;
  published_at: string | null;
}

export function calendarAt(asset: Pick<CalendarAsset, "scheduled_for" | "published_at">): string | null {
  return asset.scheduled_for ?? asset.published_at;
}

export function calendarFlag(asset: CalendarAsset, now: Date = new Date(), timeZone: string = WORKSPACE_TIME_ZONE): ReminderState | null {
  const reminder = reminderState(asset, now, timeZone);
  if (reminder) return reminder;
  if (!["approved", "scheduled"].includes(asset.status) || !asset.scheduled_for) return null;
  const due = Date.parse(asset.scheduled_for);
  return Number.isFinite(due) && due < now.getTime() ? "overdue" : null;
}

export type CalendarView = "day" | "week" | "month";
export function shiftDay(day: string, amount: number) {
  return shiftDayKey(day, amount);
}
export function calendarDays(day: string, view: CalendarView): string[] {
  if (view === "day") return [day];
  const first = view === "month" ? `${day.slice(0, 7)}-01` : day;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = shiftDay(first, -weekday);
  if (view === "week") return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const end = new Date(`${first}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const count = Math.ceil((weekday + end.getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => shiftDay(start, i));
}
export function candidatePublishingTimes(history: Array<{ published_at?: string | null; scheduled_for?: string | null }>, now: Date) {
  const occupied = history.flatMap(row => row.scheduled_for ? [Date.parse(row.scheduled_for)] : []);
  const hours = new Map<number, number>();
  for (const row of history) {
    if (!row.published_at) continue;
    const hour = (new Date(row.published_at).getUTCHours() + 1) % 24;
    if (hour >= 8 && hour <= 18) hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  const preferred = [...hours].sort((a, b) => b[1] - a[1]).map(([hour]) => hour);
  const slots: Array<{ at: string; reason: string }> = [];
  for (let offset = 0; offset < 8 && slots.length < 12; offset++) {
    const day = shiftDay(zonedDayKey(now), offset);
    for (const hour of [...new Set([...preferred.slice(0, 2), 9, 12, 15])]) {
      const at = zonedWallTimeToDate(`${day}T${String(hour).padStart(2, "0")}:00`)!;
      if (at.getTime() <= now.getTime() + 60 * 60 * 1000 || occupied.some(time => Math.abs(time - at.getTime()) < 60 * 60 * 1000)) continue;
      slots.push({ at: at.toISOString(), reason: hours.has(hour) ? "An available slot at a time used for previous posts." : "An available daytime slot in WAT." });
    }
  }
  return slots;
}
