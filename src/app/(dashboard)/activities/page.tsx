import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listActivities } from "@/lib/content/activities";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ActivitySearch } from "@/components/content/activity-search";
import { formatDay, todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Activities" };

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const orgId = await getCallerOrganizationId();
  const activities = orgId
    ? await listActivities(orgId, search)
    : [];

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="dateline">
            {todayDateline()} · {activities.length} {search ? "found" : "logged"}
          </p>
          <h1>
            Activities
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Record the events and partnerships that inform content, campaigns,
            and lead follow-up.
          </p>
        </div>
        <Button asChild className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">
          <Link href="/activities/new">Log activity</Link>
        </Button>
      </div>

      <ActivitySearch initialQuery={search} />

      {activities.length === 0 && search ? (
        <EmptyState
          title="No matching activities"
          description={`Nothing matches “${search}”. Try a different word, or clear the search.`}
          action={{ label: "Clear search", href: "/activities" }}
        />
      ) : activities.length === 0 ? (
        <EmptyState
          title="No activities yet"
          description="Log your first program, event, workshop, or partnership so AI can start turning it into marketing content."
          action={{ label: "Log an activity", href: "/activities/new" }}
        />
      ) : (
        <section className="slip overflow-hidden" aria-label="Logged activities"><div className="workspace-list-heading"><span>Activity and audience</span><span>Activity date</span></div><ul className="ledger divide-y divide-border/80">
          {activities.map((a) => (
            <li key={a.id}>
              <Link
                href={`/activities/${a.id}`}
                className="flex items-start justify-between gap-4 rounded-lg px-5 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
              >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {a.segment ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                      {a.segment.name}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1.5 text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {a.title}
                </h2>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                  {a.description || "No description yet."}
                </p>
                {(a.speakers?.length > 0 || a.partners?.length > 0) && (
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    {[
                      a.speakers?.length
                        ? `${a.speakers.length} speaker${a.speakers.length === 1 ? "" : "s"}`
                        : "",
                      a.partners?.length
                        ? `${a.partners.length} partner${a.partners.length === 1 ? "" : "s"}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <span className="dateline shrink-0 tabular-nums">
                {formatDay(a.event_date ?? a.created_at)}
              </span>
              </Link>
            </li>
          ))}
        </ul></section>
      )}
    </div>
  );
}
