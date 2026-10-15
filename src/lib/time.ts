/**
 * Workspace time. Every date the app shows or takes in is in the workspace's
 * zone (WAT), never the server's (UTC on Vercel) or the browser's. Pure and
 * safe on both server and client — unit tested under several process zones.
 */

export const WORKSPACE_TIME_ZONE = "Africa/Lagos";
/** Short name shown next to times in the workspace zone. */
export const WORKSPACE_TIME_ZONE_LABEL = "WAT";

export type DateStyle =
  /** "12 Oct 2026" */
  | "date"
  /** "12 Oct 2026, 09:05 WAT" */
  | "dateTime"
  /** "Mon 12 Oct, 09:05 WAT" */
  | "shortDateTime"
  /** "09:05" */
  | "time"
  /** "Monday 12 October" */
  | "dayHeading"
  /** "Monday 12 October 2026" */
  | "dateline"
  /** "October 2026" */
  | "month";

const STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "short", year: "numeric" },
  dateTime: { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" },
  shortDateTime: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  dayHeading: { weekday: "long", day: "numeric", month: "long" },
  dateline: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  month: { month: "long", year: "numeric" },
};

/** Styles that show a time of day, and so name the zone. */
const TIMED_STYLES = new Set<DateStyle>(["dateTime", "shortDateTime"]);

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The one date formatter. Always formats in a named zone (the workspace's by
 * default), so the result doesn't depend on where the code runs. "—" for a
 * missing or invalid value.
 */
export function formatInZone(value: string | number | Date | null | undefined, style: DateStyle, timeZone: string = WORKSPACE_TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return "—";
  const text = new Intl.DateTimeFormat("en-GB", { ...STYLE_OPTIONS[style], timeZone }).format(date);
  return TIMED_STYLES.has(style) && timeZone === WORKSPACE_TIME_ZONE ? `${text} ${WORKSPACE_TIME_ZONE_LABEL}` : text;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(date: Date, timeZone: string): Parts {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date)) parts[part.type] = part.value;
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
}

/** Zone offset from UTC, in ms, at an instant (positive east of UTC). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(new Date(instant), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar day ("2026-10-09") of an instant in the given zone. */
export function zonedDayKey(date: Date, timeZone: string = WORKSPACE_TIME_ZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Calendar month ("2026-10") of an instant in the given zone. */
export function zonedMonthKey(date: Date, timeZone: string = WORKSPACE_TIME_ZONE): string {
  return zonedDayKey(date, timeZone).slice(0, 7);
}

/** Month key moved by `delta` months: shiftMonthKey("2026-12", 1) is "2027-01". */
export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

const WALL_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * The instant a wall-clock time ("2026-10-12T09:00", as a datetime-local input
 * gives it) names in the given zone. Null when the value isn't a real time.
 */
export function zonedWallTimeToDate(value: string, timeZone: string = WORKSPACE_TIME_ZONE): Date | null {
  const match = WALL_TIME_RE.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second = 0] = match.slice(1).map((part) => (part === undefined ? 0 : Number(part)));
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(guess);
  // Reject values Date.UTC would roll over, such as 31 November or 24:00.
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  // Read the offset at the guess, then again at the result, so a DST change between the two is respected.
  let instant = guess - zoneOffsetMs(guess, timeZone);
  const corrected = guess - zoneOffsetMs(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** A datetime-local value ("2026-10-12T09:00") showing an instant in the given zone, for pre-filling inputs. */
export function dateToZonedInput(value: string | Date | null | undefined, timeZone: string = WORKSPACE_TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return "";
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Bounds of a month ("2026-10") in the given zone, as ISO instants: `from` is
 * the first moment of the month and `to` the last millisecond, for gte/lte queries.
 */
export function zonedMonthRange(key: string, timeZone: string = WORKSPACE_TIME_ZONE): { from: string; to: string } {
  const start = zonedWallTimeToDate(`${key}-01T00:00`, timeZone);
  const next = zonedWallTimeToDate(`${shiftMonthKey(key, 1)}-01T00:00`, timeZone);
  if (!start || !next) throw new Error(`Invalid month key: ${key}`);
  return { from: start.toISOString(), to: new Date(next.getTime() - 1).toISOString() };
}

/**
 * Format a calendar day or month key ("2026-10-12" or "2026-10") that is
 * already in the workspace zone. Formats midday UTC of that day, which falls on
 * the same date in every zone within ±12h.
 */
export function formatZonedKey(key: string, style: "dayHeading" | "month", timeZone: string = WORKSPACE_TIME_ZONE): string {
  const [year, month, day = 1] = key.split("-").map(Number);
  return formatInZone(new Date(Date.UTC(year, month - 1, day, 12)), style, timeZone);
}
