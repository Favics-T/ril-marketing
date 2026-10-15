import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listScheduled } from "@/lib/content/assets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { CalendarGenerator } from "@/components/content/calendar-generator";

export const metadata: Metadata = { title: "Content Calendar" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.m && MONTH_RE.test(sp.m) ? sp.m : monthKey(new Date());

  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1).toISOString();
  const to = new Date(y, m, 0, 23, 59, 59, 999).toISOString();

  const orgId = await getCallerOrganizationId();
  const rows = orgId
    ? await listScheduled(orgId, from, to)
    : [];

  // Group by calendar day, day-first.
  const byDay = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.scheduled_for) continue;
    const day = row.scheduled_for.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  const dayLabel = (isoDay: string) => {
    const d = new Date(`${isoDay}T00:00:00`);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1>
            Content Calendar
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Every approved asset with a date, in the order it goes out.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
        <CalendarGenerator />
        <nav aria-label="Month" className="flex items-center gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendar?m=${prev}`} aria-label="Previous month">
              <ChevronLeft data-icon="inline-start" aria-hidden="true" />
            </Link>
          </Button>
          <span className="min-w-[10ch] px-2 text-center text-[13px] font-bold tracking-[-0.01em] tabular-nums">
            {monthLabel(month)}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendar?m=${next}`} aria-label="Next month">
              <ChevronRight data-icon="inline-end" aria-hidden="true" />
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
            <section key={day} aria-label={dayLabel(day)} className="workspace-calendar-day">
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
                      {a.scheduled_for ? formatTime(a.scheduled_for) : "—"}
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
