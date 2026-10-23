import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Plus, CheckCheck, AlertCircle, ClipboardCheck, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusStamp } from "@/components/ui/status-stamp";
import { ContentMixChart } from "@/components/dashboard-charts";
import { CommandGoals } from "@/components/dashboard/command-goals";
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
import { ChannelIdentity } from "@/components/channel-identity";
import "./command-centre.css";

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
  const reviewUnavailable = errors.some(name => ["Insights", "Reviews"].includes(name));
  const metrics = [
    {label:"Awaiting review",value:reviewUnavailable?"—":pending,detail:"Content & insights",href:"/approvals"},
    {label:"Scheduled",value:errors.includes("Schedule")?"—":upcoming.length,detail:"Next 30 days",href:"/calendar"},
    {label:"Captured leads",value:errors.includes("Leads")?"—":leads.total,detail:"All lead sources",href:"/leads"},
    {label:"Content assets",value:errors.includes("Content")?"—":assets.total,detail:"Your content library",href:"/library"},
  ];

  return <div className="workspace-page command-workspace">
    <header className="command-page-heading"><div><h1>Command Centre</h1><p>Your next decisions, upcoming work, and recorded progress.</p></div><div className="command-heading-actions"><span className="dateline">{todayDateline()}</span><Button asChild><Link href="/activities/new"><Plus data-icon="inline-start" aria-hidden="true" />Log activity</Link></Button></div></header>
    {errors.length>0&&<div role="alert" className="command-data-alert"><AlertCircle className="size-5 shrink-0" aria-hidden="true"/><p>Some data could not be loaded: {errors.join(", ")}. Refresh to retry. Affected counts are unavailable.</p></div>}
    {!activities.length && !errors.includes("Activities") ? <section aria-labelledby="start-work-heading" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id="start-work-heading" className="text-base font-semibold">What would you like to create?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose the starting point you already have. Every draft is reviewed before it goes live.</p>
      <div className="mt-4 grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">{[
        { title: "Content from an activity", text: "Record an event or programme, add files, then create drafts.", href: "/activities/new" },
        { title: "A draft I can write or paste", text: "Add your copy directly to the Content Library.", href: "/library/new" },
        { title: "New versions of existing material", text: "Reuse a library item, recording, document or text.", href: "/repurpose" },
      ].map(item => <Link key={item.href} href={item.href} className="group flex min-w-0 items-start gap-3 rounded-md px-3 py-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-primary group-hover:underline">{item.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p></div><ArrowRight className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /></Link>)}</div>
    </section> : null}
    <dl className="command-metrics">{metrics.map(metric=><div key={metric.label}><Link href={metric.href}><div className="command-metric-label"><dt>{metric.label}</dt><ArrowUpRight aria-hidden="true" /></div><dd>{metric.value.toLocaleString()}</dd><p>{metric.detail}</p></Link></div>)}</dl>

    {reminders.length > 0 && <section className="workspace-panel" aria-labelledby="reminders-heading"><header className="workspace-panel-heading"><div><h2 id="reminders-heading">Social post reminders</h2><p>Scheduled posts due today or overdue. Record the live link after posting.</p></div><Link href="/calendar" className="text-sm text-primary">Calendar</Link></header><ul>{reminders.slice(0,6).map(({asset,state})=><li key={asset.id}><Link href={`/library/${asset.id}`} className="workspace-row"><div className="min-w-0 flex-1"><p className="workspace-row-meta">{formatReminderTime(asset.scheduled_for!)}</p><p className="workspace-row-title">{asset.title}</p><p className="workspace-row-meta"><ChannelIdentity channel={asset.platform || asset.channel} /></p></div><ReminderFlag state={state}/></Link></li>)}</ul>{reminders.length>6&&<p className="workspace-empty">{reminders.length-6} more posts need attention. Open the scheduled content library to see them all.</p>}</section>}
    <div className="command-layout">
      <div className="command-main">
        <section className="workspace-panel command-review" aria-labelledby="decisions-heading">
          <header className="command-review-heading"><div className="command-review-title"><span className="command-review-icon"><ClipboardCheck aria-hidden="true" /></span><div><h2 id="decisions-heading">Ready for your review</h2><p>{reviewUnavailable?"Some review data is unavailable.":`${pending} ${pending===1?"decision needs":"decisions need"} a human review.`}</p></div></div><Button asChild variant="outline"><Link href="/approvals">Open inbox<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button></header>
          <ul className="command-review-list">{insights.insights.slice(0,2).map(insight=><li key={insight.id}><Link href={`/audience/insights/${insight.id}`} className="command-review-row"><div className="command-review-copy"><div className="command-review-meta"><StatusStamp status={insight.status}/><span>Audience insight · {insight.segment?.name??"Audience learning"}</span></div><h3>{insight.summary}</h3></div><span className="command-review-action">Review<ArrowRight aria-hidden="true" /></span></Link></li>)}{review.assets.slice(0,2).map(asset=><li key={asset.id}><Link href={`/library/${asset.id}`} className="command-review-row"><div className="command-review-copy"><div className="command-review-meta"><StatusStamp status={asset.status}/><span><ChannelIdentity channel={asset.channel} /></span></div><h3>{asset.title}</h3></div><span className="command-review-action">Review<ArrowRight aria-hidden="true" /></span></Link></li>)}</ul>
          {!pending&&!reviewUnavailable&&<div className="command-clear-state"><CheckCheck aria-hidden="true"/><div><h3>No decisions waiting</h3><p>Capture an activity to create your next drafts.</p><Link href="/activities/new" className="command-text-link">Log an activity<ArrowRight aria-hidden="true" /></Link></div></div>}
          {reviewUnavailable&&<p className="workspace-empty">Review data is incomplete. Open the inbox or refresh to retry.</p>}
          <footer className="command-review-footer"><span>AI prepares the draft. Your team decides what goes live.</span><Link href="/library/new" className="command-text-link">Add content<Plus aria-hidden="true" /></Link></footer>
        </section>

        {errors.includes("Goals")?<section className="workspace-panel p-6"><h2>Progress toward your goals</h2><p className="mt-2 text-sm text-muted-foreground">Goal data is unavailable. Refresh to retry.</p></section>:<CommandGoals kpis={kpis}/>}

        <section className="workspace-panel command-activities" aria-labelledby="activities-heading"><header className="workspace-panel-heading"><div><h2 id="activities-heading">Recent activities</h2><p>The source behind your content</p></div><Link href="/activities" className="command-text-link">View all<ArrowUpRight aria-hidden="true"/></Link></header><ul>{activities.slice(0,3).map(activity=><li key={activity.id}><Link href={`/activities/${activity.id}`} className="workspace-row"><div className="command-activity-date"><span>{new Date(activity.event_date??activity.created_at).toLocaleString("en-GB",{month:"short",timeZone:"Africa/Lagos"})}</span><strong>{new Date(activity.event_date??activity.created_at).toLocaleString("en-GB",{day:"2-digit",timeZone:"Africa/Lagos"})}</strong></div><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{activity.title}</h3><p className="workspace-row-meta">{activity.segment?.name||"Source activity"}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true"/></Link></li>)}</ul>{!activities.length&&<p className="workspace-empty">{errors.includes("Activities")?"Activities are unavailable. Refresh to retry.":"Log a program, event, or partnership to start creating grounded content."}</p>}</section>

        <section className="workspace-panel command-tasks" aria-labelledby="tasks-heading"><header className="workspace-panel-heading"><div><h2 id="tasks-heading">Tasks needing attention</h2><p>{tasks.length===5?"Showing 5 recent tasks":"Resolve blockers before publishing"}</p></div></header><ul>{tasks.map(task=><li key={task.id}><Link href={task.insight_id?`/audience/insights/${task.insight_id}`:task.type.includes("publish")?"/settings/ai":task.type.includes("asset")?"/library?status=review":"/approvals"} className="workspace-row"><Circle className="command-task-marker" aria-hidden="true"/><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{task.title}</h3><p className="workspace-row-meta">{task.type.replaceAll("_"," ")} · {formatDay(task.created_at)}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true"/></Link></li>)}</ul>{!tasks.length&&<p className="workspace-empty">{errors.includes("Tasks")?"Tasks are unavailable. Refresh to retry.":"No open tasks. Your workspace is up to date."}</p>}</section>
      </div>

      <div className="command-side">
        <section className="workspace-panel command-schedule" aria-labelledby="schedule-heading"><header className="workspace-panel-heading"><div><h2 id="schedule-heading">Next on the calendar</h2><p>Next 30 days · WAT</p></div><Link href="/calendar" aria-label="Open calendar" className="command-icon-link"><CalendarDays aria-hidden="true"/></Link></header><ul>{upcoming.slice(0,3).map(asset=><li key={asset.id}><Link href={`/library/${asset.id}`} className="workspace-row"><div className="min-w-0 flex-1"><p className="workspace-row-meta mb-1">{new Date(asset.scheduled_for!).toLocaleString("en-GB",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Lagos"})}</p><h3 className="workspace-row-title">{asset.title}</h3><p className="workspace-row-meta"><ChannelIdentity channel={asset.platform||asset.channel} /></p></div></Link></li>)}</ul>{!upcoming.length&&<div className="command-calendar-empty"><span className="command-empty-icon"><CalendarDays aria-hidden="true"/></span><h3>{errors.includes("Schedule")?"Schedule unavailable":"Nothing scheduled yet"}</h3><p>{errors.includes("Schedule")?"Refresh to load upcoming content.":"Review your content, then choose when it goes out."}</p><Link href={errors.includes("Schedule")?"/calendar":"/library?status=approved"} className="command-text-link">{errors.includes("Schedule")?"Open calendar":"View approved content"}<ArrowRight aria-hidden="true"/></Link></div>}</section>

        {errors.includes("Channel mix")||errors.includes("Content")?<section className="workspace-panel p-6"><h2>Content mix</h2><p className="mt-2 text-sm text-muted-foreground">Channel data is unavailable. Refresh to retry.</p></section>:<ContentMixChart channels={channels} total={assets.total}/>}

        <section className="workspace-panel command-followups" aria-labelledby="followups-heading"><header className="workspace-panel-heading"><div><h2 id="followups-heading">Leads to follow up</h2><p>{followups.length===4?"4 recent leads":"Recent leads still in the funnel"}</p></div><Link href="/leads" aria-label="Open leads" className="command-icon-link"><ArrowUpRight aria-hidden="true"/></Link></header><ul>{followups.map(lead=><li key={lead.id}><Link href={`/leads/${lead.id}`} className="workspace-row"><span className="command-avatar" aria-hidden="true">{(lead.name||lead.email||"?").charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{lead.name||lead.email||"Unnamed lead"}</h3><p className="workspace-row-meta">{lead.interest || (lead.source_platform ? <ChannelIdentity channel={lead.source_platform} /> : "Needs follow-up")}</p></div><StatusStamp status={lead.score||lead.funnel_stage}/></Link></li>)}</ul>{!followups.length&&<p className="workspace-empty">{errors.includes("Follow-up")?"Follow-up data is unavailable. Refresh to retry.":"No leads waiting for follow-up."}</p>}</section>
      </div>
    </div>
  </div>;
}
