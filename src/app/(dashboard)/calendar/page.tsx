import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listScheduled, type ContentAssetRow } from "@/lib/content/assets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { CalendarGenerator } from "@/components/content/calendar-generator";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { calendarAt, calendarFlag } from "@/lib/content/calendar";
import {
  formatInZone,
  formatZonedKey,
  shiftDayKey,
  shiftMonthKey,
  WORKSPACE_TIME_ZONE_LABEL,
  zonedDayKey,
  zonedMonthKey,
  zonedMonthRange,
  zonedWeekRange,
} from "@/lib/time";

export const metadata: Metadata = { title: "Content Calendar" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type View = "month" | "week";

/** The week holding a day key, or this week in WAT when the key isn't a real day. */
function weekOf(key: string | undefined, today: string) {
  try {
    return zonedWeekRange(key ?? today);
  } catch {
    return zonedWeekRange(today);
  }
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; view?: string; w?: string }>;
}) {
  const sp = await searchParams;
  const view: View = sp.view === "week" ? "week" : "month";
  const now = new Date();
  const today = zonedDayKey(now);
  const thisMonth = zonedMonthKey(now);

  // The month and week run from midnight WAT, not midnight UTC.
  let range: { from: string; to: string };
  let days: string[] | null = null;
  let label: string;
  let prevHref: string;
  let nextHref: string;
  let monthHref: string;
  let weekHref: string;
  if (view === "week") {
    const week = weekOf(sp.w, today);
    range = week;
    days = Array.from({ length: 7 }, (_, i) => shiftDayKey(week.start, i));
    label = `${formatZonedKey(week.start, "date")} – ${formatZonedKey(days[6], "date")}`;
    prevHref = `/calendar?view=week&w=${shiftDayKey(week.start, -7)}`;
    nextHref = `/calendar?view=week&w=${shiftDayKey(week.start, 7)}`;
    monthHref = `/calendar?m=${week.start.slice(0, 7)}`;
    weekHref = `/calendar?view=week&w=${week.start}`;
  } else {
    const month = sp.m && MONTH_RE.test(sp.m) ? sp.m : thisMonth;
    range = zonedMonthRange(month);
    label = formatZonedKey(month, "month");
    prevHref = `/calendar?m=${shiftMonthKey(month, -1)}`;
    nextHref = `/calendar?m=${shiftMonthKey(month, 1)}`;
    monthHref = `/calendar?m=${month}`;
    weekHref = `/calendar?view=week&w=${month === thisMonth ? today : `${month}-01`}`;
  }
  const unit = view === "week" ? "week" : "month";

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1>
            Content Calendar
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Approved, scheduled and published assets, in the order they go out. Times are in {WORKSPACE_TIME_ZONE_LABEL}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
        <CalendarGenerator />
        <nav aria-label="Calendar view" className="flex items-center gap-1">
          <Button variant={view === "month" ? "default" : "outline"} size="sm" asChild>
            <Link href={monthHref} aria-current={view === "month" ? "page" : undefined}>
              Month
            </Link>
          </Button>
          <Button variant={view === "week" ? "default" : "outline"} size="sm" asChild>
            <Link href={weekHref} aria-current={view === "week" ? "page" : undefined}>
              Week
            </Link>
          </Button>
        </nav>
        <nav aria-label={view === "week" ? "Week" : "Month"} className="flex items-center gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={prevHref} aria-label={`Previous ${unit}`}>
              ←
            </Link>
          </Button>
          <span className="min-w-[10ch] px-2 text-center text-[13px] font-bold tracking-[-0.01em] tabular-nums">
            {label}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref} aria-label={`Next ${unit}`}>
              →
            </Link>
          </Button>
        </nav>
        </div>
      </div>

      {/* Keyed so moving between weeks or months shows the skeleton again, not the old list. */}
      <Suspense key={`${view}:${range.from}`} fallback={<CalendarSkeleton />}>
        <CalendarEntries from={range.from} to={range.to} days={days} unit={unit} today={today} />
      </Suspense>
    </div>
  );
}

async function CalendarEntries({
  from,
  to,
  days,
  unit,
  today,
}: {
  from: string;
  to: string;
  /** The week's seven day keys, shown even when empty; null in month view. */
  days: string[] | null;
  unit: "week" | "month";
  today: string;
}) {
  const orgId = await getCallerOrganizationId();
  const rows = orgId
    ? await listScheduled(orgId, from, to)
    : [];

  // Group by calendar day in WAT, so 00:30 WAT lands on its own day, not the UTC day before.
  const byDay = new Map<string, ContentAssetRow[]>();
  for (const row of rows) {
    const at = calendarAt(row);
    if (!at) continue;
    const day = zonedDayKey(new Date(at));
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }

  if (byDay.size === 0) {
    return (
      <EmptyState
        title={`Nothing on the calendar this ${unit}`}
        description="Approved assets with a publish date, and anything published, land here. Give an asset a date from the library to see it on the calendar."
        action={{ label: "Open content library", href: "/library" }}
      />
    );
  }

  const now = new Date();
  const shownDays = days ?? [...byDay.keys()].sort();

  return (
    <div className="flex flex-col gap-4">
      {shownDays.map((day) => {
        const items = byDay.get(day) ?? [];
        const dayLabel = formatZonedKey(day, "dayHeading");
        return (
          <section key={day} aria-label={dayLabel}>
            <p className="dateline mb-2">
              {dayLabel}
              {day === today ? <span className="text-primary"> · Today</span> : null}
            </p>
            <ul className="ledger slip overflow-hidden">
              {items.length === 0 ? (
                <li className="px-5 py-3.5 text-sm text-muted-foreground sm:px-6">Nothing planned</li>
              ) : (
                items.map((a) => <CalendarItem key={a.id} asset={a} now={now} />)
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CalendarItem({ asset: a, now }: { asset: ContentAssetRow; now: Date }) {
  return (
    <li className="flex items-start justify-between gap-4 px-5 py-3.5 sm:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusStamp status={a.status} />
          <ReminderFlag state={calendarFlag(a, now)} />
          <span className="dateline">
            {[a.channel, a.platform].filter(Boolean).join(" · ") ||
              "No channel"}
          </span>
        </div>
        <Link
          href={`/library/${a.id}`}
          className="-my-1.5 mt-1 inline-block max-w-full truncate rounded py-1.5 text-sm font-semibold tracking-[-0.01em] text-foreground outline-none hover:text-primary hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {a.title}
        </Link>
      </div>
      <div className="shrink-0 text-right">
        <p className="dateline tabular-nums">{formatInZone(calendarAt(a), "time")}</p>
        {/* Published without a date: the time is when it went out, not a plan. */}
        {!a.scheduled_for && a.published_at ? <p className="dateline mt-1">Went out</p> : null}
      </div>
    </li>
  );
}

function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Loading calendar" aria-busy="true" className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true">
          <div className="skeleton-sweep mb-2 h-4 w-40 rounded-lg" />
          <div className="skeleton-sweep h-14 rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Loading calendar…</span>
    </div>
  );
}
