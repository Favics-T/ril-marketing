/** RIL number formatting — adapted from @efferd/formater patterns, no copy.
 *  Single locale for dashboard numbers (counts, compact, percent).
 *  Real data only; no synthetic benchmarks.
 */

import { formatInZone } from "@/lib/time";

export const RIL_LOCALE = "en-US";

export function formatInteger(value: number): string {
  return new Intl.NumberFormat(RIL_LOCALE, { maximumFractionDigits: 0 }).format(value);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(RIL_LOCALE, {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function formatPercentDelta(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** Sequential record labels used by dashboard lists. */
export function wireLabel(index: number): string {
  return `Item ${String(index + 1).padStart(2, "0")}`;
}

/** Dateline date for list rows, in the workspace zone: "12 Sep 2026". */
export function formatDay(value: string | null | undefined): string {
  return formatInZone(value, "date");
}

/** Date and time for event rows, in the workspace zone: "12 Sep 2026, 14:05 WAT". */
export function formatDayTime(value: string | null | undefined): string {
  return formatInZone(value, "dateTime");
}

/** Today's dateline header in the workspace zone, shared by every dashboard surface. */
export function todayDateline(): string {
  return formatInZone(new Date(), "dateline");
}
