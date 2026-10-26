import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listActivities } from "@/lib/content/activities";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ActivitySearch } from "@/components/content/activity-search";
import { formatDay, todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Activities" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const orgId = await getCallerOrganizationId();
  const activities = orgId ? await listActivities(orgId, search) : [];
  return <div className="workspace-page activity-directory">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1>Activities</h1><p className="mt-3 text-muted-foreground">One clear source for the programmes, events, and partnerships behind your marketing.</p><p className="dateline">{todayDateline()}</p></div><Button asChild><Link href="/activities/new">Log activity</Link></Button></header>
    <div className="activity-search-row"><ActivitySearch initialQuery={search} /><p><strong>{activities.length.toLocaleString()}</strong> {search ? "matching" : "recorded"} {activities.length === 1 ? "activity" : "activities"}</p></div>
    {!activities.length ? <EmptyState title={search ? "No matching activities" : "Start with the source"} description={search ? `Nothing matches “${search}”. Try another word or clear the search.` : "Log a programme, event, workshop, or partnership. Add its source material, then create drafts grounded in what happened."} action={search ? { label: "Clear search", href: "/activities" } : { label: "Log an activity", href: "/activities/new" }} /> : <section className="directory-records" aria-label="Recorded activities"><div className="workspace-list-heading"><span>Source activity</span><span>Open and create</span></div><ul>{activities.map(activity => <li key={activity.id}><Link href={`/activities/${activity.id}`} className="activity-source-row"><time dateTime={activity.event_date ?? activity.created_at} className="activity-source-date"><span>{new Date(activity.event_date ?? activity.created_at).toLocaleString("en-GB", { month: "short", timeZone: "Africa/Lagos" })}</span><strong>{new Date(activity.event_date ?? activity.created_at).toLocaleString("en-GB", { day: "2-digit", timeZone: "Africa/Lagos" })}</strong></time><div className="activity-source-copy"><h2>{activity.title}</h2><p>{activity.segment?.name || "Source activity"}</p>{activity.speakers?.length || activity.partners?.length ? <p>{[activity.speakers?.length ? `${activity.speakers.length} speaker${activity.speakers.length === 1 ? "" : "s"}` : "", activity.partners?.length ? `${activity.partners.length} partner${activity.partners.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}</p> : null}</div><span className="activity-source-open"><span className="dateline">{formatDay(activity.event_date ?? activity.created_at)}</span><span>Open activity<ArrowRight aria-hidden="true" /></span></span></Link></li>)}</ul></section>}
  </div>;
}
