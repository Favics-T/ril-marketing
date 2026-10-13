import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listScheduled } from "@/lib/content/assets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { CalendarGenerator } from "@/components/content/calendar-generator";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { reminderState } from "@/lib/content/reminders";
import { formatInZone, formatZonedKey, shiftMonthKey, WORKSPACE_TIME_ZONE_LABEL, zonedDayKey, zonedMonthKey, zonedMonthRange } from "@/lib/time";

export const metadata: Metadata = { title: "Content Calendar" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.m && MONTH_RE.test(sp.m) ? sp.m : zonedMonthKey(new Date());
  // The month runs from midnight WAT on the 1st, not midnight UTC.
  const { from, to } = zonedMonthRange(month);

  const orgId = await getCallerOrganizationId();
  const rows = orgId
    ? await listScheduled(orgId, from, to)
    : [];

  // Group by calendar day in WAT, so 00:30 WAT lands on its own day, not the UTC day before.
  const byDay = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.scheduled_for) continue;
    const day = zonedDayKey(new Date(row.scheduled_for));
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const now = new Date();
  const prev = shiftMonthKey(month, -1);
  const next = shiftMonthKey(month, 1);
  const dayLabel = (day: string) => formatZonedKey(day, "dayHeading");

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1>
            Content Calendar
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Every approved asset with a date, in the order it goes out. Times are in {WORKSPACE_TIME_ZONE_LABEL}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
        <CalendarGenerator />
        <nav aria-label="Month" className="flex items-center gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendar?m=${prev}`} aria-label="Previous month">
              ←
            </Link>
          </Button>
          <span className="min-w-[10ch] px-2 text-center text-[13px] font-bold tracking-[-0.01em] tabular-nums">
            {formatZonedKey(month, "month")}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendar?m=${next}`} aria-label="Next month">
              →
            </Link>
          </Button>
        </nav>
        </div>
      </div>

      {days.length === 0 ? (
        <EmptyState
          title="Nothing scheduled this month"
          description="Approved assets with a publish date land here. Move an asset to Scheduled from the library to see it on the calendar."
          action={{ label: "Open content library", href: "/library" }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(([day, items]) => (
            <section key={day} aria-label={dayLabel(day)}>
              <p className="dateline mb-2">{dayLabel(day)}</p>
              <ul className="ledger slip overflow-hidden">
                {items.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-4 px-5 py-3.5 sm:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusStamp status={a.status} />
                        <ReminderFlag state={reminderState(a, now)} />
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
                    <span className="dateline shrink-0 tabular-nums">
                      {a.scheduled_for ? formatInZone(a.scheduled_for, "time") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
