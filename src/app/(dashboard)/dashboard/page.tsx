import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Plus, CheckCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusStamp } from "@/components/ui/status-stamp";
import { ContentMixChart, KpiProgressChart } from "@/components/dashboard-charts";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { listInsights } from "@/lib/audience/insights";
import { listAssets, listScheduled, listSocialReminders } from "@/lib/content/assets";
import { formatReminderTime } from "@/lib/content/reminders";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { listActivities } from "@/lib/content/activities";
import { listLeads, listLeadsNeedingFollowUp } from "@/lib/leads/leads";
import { listOpenTasks } from "@/lib/audience/tasks";
import { getKpiProgress } from "@/lib/audience/kpis";
import { formatDay, todayDateline } from "@/lib/format";
import { formatInZone } from "@/lib/time";
import { channelLabel } from "@/lib/channels";

export const metadata: Metadata = { title: "Command Centre" };

export default async function CommandCentrePage() {
  const org = await getCallerOrganizationId();
  if (!org) return <div className="workspace-panel p-6"><h1>Set up your workspace</h1><p className="mt-2 text-sm text-muted-foreground">Create an organization before you start capturing activities and content.</p><Button asChild className="mt-4"><Link href="/onboarding">Set up workspace</Link></Button></div>;
  const errors: string[] = [];
  async function load<T>(name: string, task: Promise<T>, fallback: T) { try { return await task; } catch { errors.push(name); return fallback; } }
  const now = new Date();
  const today = now.toISOString();
  const end = new Date(now.getTime()+30*86400000).toISOString();
  const [insights,review,assets,leads,scheduled,tasks,followups,kpis,activities,reminders] = await Promise.all([
    load("Insights",listInsights(org,{status:"PENDING_REVIEW",pageSize:3}),{insights:[],total:0,page:1,pageSize:3,totalPages:1}),
    load("Reviews",listAssets(org,{status:"review"}),{assets:[],total:0}),
    load("Content",listAssets(org,{}),{assets:[],total:0}),
    load("Leads",listLeads(org,{}),{leads:[],total:0}),
    load("Schedule",listScheduled(org,today,end),[]),
    load("Tasks",listOpenTasks(org,5),[]),
    load("Follow-up",listLeadsNeedingFollowUp(org,4),[]),
    load("Goals",getKpiProgress(org),[]),
    load("Activities",listActivities(org),[]),
    load("Reminders",listSocialReminders(org,now),[]),
  ]);
  const supabase = await createClient();
  const mixResult = await supabase.from("content_assets").select("channel").eq("organization_id",org).limit(5000);
  if (mixResult.error) errors.push("Channel mix");
  const counts = new Map<string,number>();
  for (const item of mixResult.data ?? []) { const key=item.channel||"Unassigned";counts.set(key,(counts.get(key)??0)+1); }
  const channels=[...counts].map(([channel,count])=>({channel,count}));
  const upcoming=scheduled.filter(a=>a.status==="scheduled"&&a.scheduled_for&&a.scheduled_for>=now.toISOString()).sort((a,b)=>(a.scheduled_for??"").localeCompare(b.scheduled_for??""));
  const pending=insights.total+review.total;
  const overdue=reminders.filter(r=>r.state==="overdue").length;
  return <div className="workspace-page">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="dateline">{todayDateline()}</p><h1>Command Centre</h1><p className="mt-2 text-sm text-muted-foreground">Your next decisions, upcoming work, and progress in one place.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/calendar"><CalendarDays />Calendar</Link></Button><Button asChild><Link href="/activities/new"><Plus />Log activity</Link></Button></div></header>
    {errors.length>0&&<div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertCircle className="size-5 shrink-0 text-destructive"/><p>Some data could not be loaded: {errors.join(", ")}. Refresh to retry. Affected counts are unavailable.</p></div>}
    <dl className="workspace-metrics">
      {[
        {label:"Awaiting review",value:errors.some(e=>["Insights","Reviews"].includes(e))?"—":pending,detail:"Content and audience insights",href:"/approvals"},
        {label:"Scheduled content",value:errors.includes("Schedule")?"—":upcoming.length,detail:"Next 30 days",href:"/calendar"},
        {label:"Captured leads",value:errors.includes("Leads")?"—":leads.total,detail:"All lead sources",href:"/leads"},
        {label:"Content assets",value:errors.includes("Content")?"—":assets.total,detail:"Drafts through published work",href:"/library"},
      ].map(m=><div key={m.label} className="workspace-metric"><Link href={m.href}><dt>{m.label}</dt><dd>{m.value.toLocaleString()}</dd><p>{m.detail}</p></Link></div>)}
    </dl>
    {reminders.length>0&&<section className="workspace-panel overflow-hidden" aria-labelledby="reminders-heading"><header className="workspace-panel-heading"><div><h2 id="reminders-heading">Social post reminders</h2><p>{overdue?`${overdue} overdue · `:""}{reminders.length-overdue} due today. Post them, then mark each as posted.</p></div><Link href="/calendar" className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">Calendar<ArrowRight className="size-3.5"/></Link></header><ul>{reminders.slice(0,6).map(({asset:a,state})=><li key={a.id}><Link href={`/library/${a.id}`} className="workspace-row"><div className="min-w-0 flex-1"><p className="workspace-row-meta mb-1">{formatReminderTime(a.scheduled_for!)}</p><p className="workspace-row-title">{a.title}</p><p className="workspace-row-meta">{channelLabel(a.platform||a.channel)}</p></div><ReminderFlag state={state}/></Link></li>)}</ul>{reminders.length>6&&<p className="workspace-empty">{reminders.length-6} more not shown. Open the content library and filter by Scheduled to see them all.</p>}</section>}
    <div className="workspace-dashboard-grid">
      <section className="workspace-panel overflow-hidden" aria-labelledby="decisions-heading"><header className="workspace-panel-heading"><div><h2 id="decisions-heading">Ready for your review</h2><p>Every item needs a human decision.</p></div><Link href="/approvals" className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">View inbox<ArrowRight className="size-3.5"/></Link></header>
        {!pending?<div className="workspace-empty flex items-center gap-3"><CheckCheck className="size-5"/>No decisions waiting. Capture an activity to create your next drafts.</div>:<ul>{insights.insights.slice(0,2).map(i=><li key={i.id}><Link href={`/audience/insights/${i.id}`} className="workspace-row"><div className="min-w-0 flex-1"><div className="mb-2 flex gap-2"><StatusStamp status={i.status}/><span className="text-xs text-muted-foreground">Audience insight</span></div><p className="workspace-row-title line-clamp-2">{i.summary}</p><p className="workspace-row-meta">{i.segment?.name??"Audience learning"}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground"/></Link></li>)}{review.assets.slice(0,2).map(a=><li key={a.id}><Link href={`/library/${a.id}`} className="workspace-row"><div className="min-w-0 flex-1"><div className="mb-2 flex gap-2"><StatusStamp status={a.status}/><span className="text-xs text-muted-foreground">{channelLabel(a.channel)}</span></div><p className="workspace-row-title">{a.title}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground"/></Link></li>)}</ul>}
      </section>
      <section className="workspace-panel overflow-hidden" aria-labelledby="schedule-heading"><header className="workspace-panel-heading"><div><h2 id="schedule-heading">Next on the calendar</h2><p>Approved content scheduled to go out.</p></div><CalendarDays className="size-4 text-muted-foreground"/></header><ul>{upcoming.slice(0,4).map(a=><li key={a.id}><Link href={`/library/${a.id}`} className="workspace-row"><div className="min-w-0 flex-1"><p className="workspace-row-meta mb-1">{formatInZone(a.scheduled_for,"shortDateTime")}</p><p className="workspace-row-title">{a.title}</p><p className="workspace-row-meta">{channelLabel(a.platform||a.channel)}</p></div><StatusStamp status="scheduled"/></Link></li>)}</ul>{!upcoming.length&&<p className="workspace-empty">Nothing scheduled in the next 30 days. Review your content before adding it to the calendar.</p>}</section>
    </div>
    <div className="workspace-dashboard-grid"><KpiProgressChart kpis={kpis}/><ContentMixChart channels={channels} total={assets.total}/></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="workspace-panel overflow-hidden"><header className="workspace-panel-heading"><div><h2>Leads to follow up</h2><p>{followups.length===4?"Showing 4 recent leads":"Recent leads still in the funnel"}</p></div><Link href="/leads" className="text-xs text-primary">Open leads</Link></header><ul>{followups.map(l=><li key={l.id}><Link href={`/leads/${l.id}`} className="workspace-row"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground" aria-hidden="true">{(l.name||l.email||"?").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="workspace-row-title">{l.name||l.email||"Unnamed lead"}</p><p className="workspace-row-meta">{l.interest||channelLabel(l.source_platform)||"Needs follow-up"}</p></div><StatusStamp status={l.score||l.funnel_stage}/></Link></li>)}</ul>{!followups.length&&<p className="workspace-empty">No leads waiting for follow-up.</p>}</section>
      <section className="workspace-panel overflow-hidden"><header className="workspace-panel-heading"><div><h2>Tasks needing attention</h2><p>{tasks.length===5?"Showing 5 recent tasks":"Resolve blockers before publishing"}</p></div></header><ul>{tasks.map(t=><li key={t.id}><Link href={t.insight_id?`/audience/insights/${t.insight_id}`:t.type.includes("publish")?"/settings/ai":t.type.includes("asset")?"/library?status=review":"/approvals"} className="workspace-row"><div className="min-w-0 flex-1"><p className="workspace-row-title">{t.title}</p><p className="workspace-row-meta">{t.type.replaceAll("_"," ")} · {formatDay(t.created_at)}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground"/></Link></li>)}</ul>{!tasks.length&&<p className="workspace-empty">No open tasks. Your workspace is up to date.</p>}</section>
    </div>
    <section className="workspace-panel overflow-hidden"><header className="workspace-panel-heading"><div><h2>Recent activities</h2><p>One activity can become content, a campaign, and lead capture.</p></div><Link href="/activities" className="text-xs text-primary">All activities</Link></header><ul>{activities.slice(0,3).map(a=><li key={a.id}><Link href={`/activities/${a.id}`} className="workspace-row"><div className="min-w-0 flex-1"><p className="workspace-row-title">{a.title}</p><p className="workspace-row-meta">{a.segment?.name||"Source activity"}</p></div><span className="shrink-0 text-xs text-muted-foreground">{formatDay(a.event_date??a.created_at)}</span></Link></li>)}</ul>{!activities.length&&<p className="workspace-empty">Log a program, event, or partnership to start creating grounded content.</p>}</section>
  </div>;
}
