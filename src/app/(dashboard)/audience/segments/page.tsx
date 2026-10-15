import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listSegments } from "@/lib/audience/segments";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { Button } from "@/components/ui/button";
import { todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Audience Segments" };

export default async function SegmentsPage() {
  const orgId = await getCallerOrganizationId();
  const segments = orgId
    ? await listSegments(orgId)
    : [];

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="dateline">
            {todayDateline()} · {segments.length} segments
          </p>
          <h1>
            Audience Segments
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Define audience needs, motivations, and preferred formats to ground
            recommendations.
          </p>
        </div>
        <Button asChild className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">
          <Link href="/audience/segments/new">New segment</Link>
        </Button>
      </div>

      {segments.length === 0 ? (
        <EmptyState
          title="No segments yet"
          description="Create your first audience segment to start grounding content recommendations in who you are trying to reach."
          action={{ label: "Create segment", href: "/audience/segments/new" }}
        />
      ) : (
        <div className="segment-directory grid gap-5 lg:grid-cols-2">
          {segments.map((s) => (
            <Link
              key={s.id}
              href={`/audience/segments/${s.id}`}
              className="slip flex flex-col gap-3 px-5 py-4 outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring sm:px-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                {s.pending_insights_count > 0 ? (
                  <StatusStamp status="PENDING_REVIEW" />
                ) : null}
                <span className="dateline ml-auto tabular-nums">
                  {s.insights_count} insight{s.insights_count === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">{s.name}</h2>
                {s.description ? (
                  <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {s.description}
                  </p>
                ) : null}
              </div>
              {s.needs_motivations.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {s.needs_motivations.slice(0, 4).map((n) => (
                    <li
                      key={n}
                      className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {n}
                    </li>
                  ))}
                  {s.needs_motivations.length > 4 ? (
                    <li className="px-1 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      +{s.needs_motivations.length - 4}
                    </li>
                  ) : null}
                </ul>
              ) : null}
              {s.programs.length > 0 ? (
                <p className="mt-auto pt-1 text-[13px] leading-5 text-muted-foreground">
                  Programs: {s.programs.map((p) => p.name).join(", ")}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
