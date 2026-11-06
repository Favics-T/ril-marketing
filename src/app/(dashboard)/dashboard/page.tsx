import { Card as ShadcnCard } from "@/components/ui/card";
import { WorkspaceSection } from "@/components/workspace-section";
import { Alert as ShadcnAlert } from "@/components/ui/alert";
import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Plus, Circle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentMixChart } from "@/components/dashboard-charts";
import { CommandGoals } from "@/components/dashboard/command-goals";
import { DecisionQueue, type DecisionItem } from "@/components/dashboard/decision-queue";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { listInsights } from "@/lib/audience/insights";
import { listAssets, listScheduled, listSocialReminders, listNeedsAttention } from "@/lib/content/assets";
import { NeedsAttentionPanel } from "@/components/content/needs-attention";
import { formatReminderTime } from "@/lib/content/reminders";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { listActivities } from "@/lib/content/activities";
import { listLeads, listLeadsNeedingFollowUp } from "@/lib/leads/leads";
import { listOpenTasks } from "@/lib/audience/tasks";
import { getKpiProgress } from "@/lib/audience/kpis";
import { formatDay, todayDateline } from "@/lib/format";
import { ChannelIdentity } from "@/components/channel-identity";
import { StatusStamp } from "@/components/ui/status-stamp";
import "./command-centre.css";

export const metadata: Metadata = { title: "Command Centre" };

export default async function CommandCentrePage() {
  const org = await getCallerOrganizationId();
  if (!org) return <ShadcnCard asChild><section className="workspace-panel p-8"><h1>Set up your workspace</h1><p className="mt-3 text-muted-foreground">Create an organization to start capturing activities and content.</p><Button asChild className="mt-6"><Link href="/onboarding">Set up workspace</Link></Button></section></ShadcnCard>;
  const errors: string[] = [];
  async function load<T>(name: string, task: Promise<T>, fallback: T) { try { return await task; } catch { errors.push(name); return fallback; } }
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 86400000).toISOString();
  const [insights, review, assets, leads, scheduled, tasks, followups, kpis, activities, allReminders, attention] = await Promise.all([
    load("Insights", listInsights(org, { status: "PENDING_REVIEW", pageSize: 3 }), { insights: [], total: 0, page: 1, pageSize: 3, totalPages: 1 }),
    load("Reviews", listAssets(org, { status: "review" }), { assets: [], total: 0 }),
    load("Content", listAssets(org, {}), { assets: [], total: 0 }),
    load("Leads", listLeads(org, {}), { leads: [], total: 0 }),
    load("Schedule", listScheduled(org, now.toISOString(), end), []),
    load("Tasks", listOpenTasks(org, 5), []),
    load("Follow-up", listLeadsNeedingFollowUp(org, 4), []),
    load("Goals", getKpiProgress(org), []),
    load("Activities", listActivities(org), []),
    load("Reminders", listSocialReminders(org, now), []),
    listNeedsAttention(org, now).catch(() => null),
  ]);
  const reminders = allReminders.filter(reminder => reminder.state === "due_today");
  const supabase = await createClient();
  const mixResult = await supabase.from("content_assets").select("channel").eq("organization_id", org).limit(5000);
  if (mixResult.error) errors.push("Channel mix");
  const counts = new Map<string, number>();
  for (const item of mixResult.data ?? []) { const key = item.channel || "Unassigned"; counts.set(key, (counts.get(key) ?? 0) + 1); }
  const channels = [...counts].map(([channel, count]) => ({ channel, count }));
  const upcoming = scheduled.filter(item => item.status === "scheduled" && item.scheduled_for && item.scheduled_for >= now.toISOString()).sort((a, b) => (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""));
  const reviewUnavailable = errors.some(name => ["Insights", "Reviews"].includes(name));
  const decisions: DecisionItem[] = [
    ...review.assets.slice(0, 3).map(asset => ({ id: asset.id, title: asset.title, kind: "content" as const, detail: (asset.channel || "Content draft").replaceAll("_", " "), status: asset.status, href: `/library/${asset.id}` })),
    ...insights.insights.slice(0, 2).map(insight => ({ id: insight.id, title: insight.summary, kind: "insight" as const, detail: insight.segment?.name || "Audience learning", status: insight.status, href: `/audience/insights/${insight.id}` })),
  ];
  const summary = [
    { label: "Awaiting review", value: reviewUnavailable ? "Unavailable" : insights.total + review.total, href: "/approvals" },
    { label: "Scheduled in the next 30 days", value: errors.includes("Schedule") ? "Unavailable" : upcoming.length, href: "/calendar" },
    { label: "Content in your library", value: errors.includes("Content") ? "Unavailable" : assets.total, href: "/library" },
    { label: "Captured leads", value: errors.includes("Leads") ? "Unavailable" : leads.total, href: "/leads" },
  ];

  return <div className="workspace-page command-workspace">
    <WorkspacePageHeader title="Command Centre" eyebrow={todayDateline()} description="Your decisions, publishing plans, and next conversations." actions={<><Button asChild variant="outline"><Link href="/repurpose">Repurpose content</Link></Button><Button asChild><Link href="/activities/new"><Plus data-icon="inline-start" aria-hidden="true" />Log activity</Link></Button></>} />
    <ShadcnCard asChild><section className="command-evidence" aria-labelledby="workspace-snapshot">
      <header><h2 id="workspace-snapshot">Workspace snapshot</h2><Button asChild variant="ghost" size="sm"><Link href="/reports">View reports<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button></header>
      <dl className="command-summary" aria-label="Workspace totals">{summary.map(item => <div key={item.label}><Link href={item.href}><dt>{item.label}</dt><dd>{item.value.toLocaleString()}</dd><ArrowUpRight aria-hidden="true" /></Link></div>)}</dl>
    </section></ShadcnCard>
    {errors.length ? <ShadcnAlert asChild variant="destructive"><div role="alert" className="command-data-alert"><AlertCircle aria-hidden="true" /><p>Some information could not be loaded: {errors.join(", ")}. Refresh to try again. Affected totals are unavailable.</p></div></ShadcnAlert> : null}
    {!activities.length && !errors.includes("Activities") ? <section className="command-start" aria-labelledby="start-heading"><div><h2 id="start-heading">Start with a source</h2><p>Capture the activity, write a draft, or give existing material a new format.</p></div><div className="command-start-options"><Link href="/activities/new">Log an activity<ArrowUpRight aria-hidden="true" /></Link><Link href="/library/new">Write a draft<ArrowUpRight aria-hidden="true" /></Link><Link href="/repurpose">Repurpose material<ArrowUpRight aria-hidden="true" /></Link></div></section> : null}
    <NeedsAttentionPanel attention={attention} />
    {reminders.length ? <WorkspaceSection id="reminders-heading" className="command-reminders" title="Posts due today" description="Add the live link after posting. Overdue posts appear in Needs attention." action={<Link href="/calendar" className="ril-inline-action">View calendar<ArrowRight aria-hidden="true" /></Link>}>
      <ul>{reminders.slice(0,4).map(({asset,state}) => <li key={asset.id}><Link href={"/library/" + asset.id} className="workspace-row"><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{asset.title}</h3><p className="workspace-row-meta">{formatReminderTime(asset.scheduled_for!)}</p></div><ReminderFlag state={state} /></Link></li>)}</ul>
    </WorkspaceSection> : null}
    <div className="command-layout command-desk glass-review-desk">
      <DecisionQueue items={decisions} contentCount={review.total} insightCount={insights.total} unavailable={reviewUnavailable} />
      <WorkspaceSection id="schedule-heading" className="command-schedule" title="Publishing agenda" description="Next 30 days. All times in WAT." action={<Link href="/calendar" aria-label="Open content calendar" className="command-icon-link"><CalendarDays aria-hidden="true" /></Link>}>
        <ul>{upcoming.slice(0,4).map(asset => <li key={asset.id}><Link href={"/library/" + asset.id} className="workspace-row"><div className="min-w-0 flex-1"><p className="command-schedule-time">{new Date(asset.scheduled_for!).toLocaleString("en-GB", {weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Lagos"})}</p><h3 className="workspace-row-title">{asset.title}</h3><p className="workspace-row-meta"><ChannelIdentity channel={asset.platform || asset.channel} /></p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link></li>)}</ul>
        {!upcoming.length ? <div className="command-side-empty"><h3>{errors.includes("Schedule") ? "Schedule unavailable" : "Nothing scheduled yet"}</h3><p>{errors.includes("Schedule") ? "Refresh to load the schedule." : "Choose a publishing time for approved content."}</p><Link href={errors.includes("Schedule") ? "/calendar" : "/library?status=approved"} className="ril-inline-action">{errors.includes("Schedule") ? "Open calendar" : "View approved content"}<ArrowRight aria-hidden="true" /></Link></div> : null}
      </WorkspaceSection>
    </div>
    <div className="command-secondary glass-follow-through" aria-label="Activities, follow-ups, and tasks">
      <WorkspaceSection id="activities-heading" className="command-activities" title="Recent activities" description="Source material for what comes next." footer={<Link href="/activities" className="ril-inline-action">All activities<ArrowRight aria-hidden="true" /></Link>}>
        <ul>{activities.slice(0,3).map(activity => <li key={activity.id}><Link href={"/activities/" + activity.id} className="workspace-row"><div className="command-activity-date"><span>{new Date(activity.event_date ?? activity.created_at).toLocaleString("en-GB", {month:"short",timeZone:"Africa/Lagos"})}</span><strong>{new Date(activity.event_date ?? activity.created_at).toLocaleString("en-GB", {day:"2-digit",timeZone:"Africa/Lagos"})}</strong></div><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{activity.title}</h3><p className="workspace-row-meta">{activity.segment?.name || "Source activity"}</p></div></Link></li>)}</ul>
        {!activities.length ? <p className="workspace-empty">{errors.includes("Activities") ? "Activities are unavailable. Refresh to try again." : "Your recorded programmes, events, and partnerships will appear here."}</p> : null}
      </WorkspaceSection>
      <WorkspaceSection id="followups-heading" className="command-followups" title="Lead follow-ups" description="Keep the next conversation moving." footer={<Link href="/leads" className="ril-inline-action">All leads<ArrowRight aria-hidden="true" /></Link>}>
        <ul>{followups.map(lead => <li key={lead.id}><Link href={"/leads/" + lead.id} className="workspace-row"><span className="command-avatar" aria-hidden="true">{(lead.name || lead.email || "?").charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{lead.name || lead.email || "Unnamed lead"}</h3><p className="workspace-row-meta">{lead.interest || "Needs follow-up"}</p><StatusStamp status={lead.score || lead.funnel_stage} /></div></Link></li>)}</ul>
        {!followups.length ? <p className="workspace-empty">{errors.includes("Follow-up") ? "Follow-up data is unavailable. Refresh to try again." : "No leads are waiting for follow-up."}</p> : null}
      </WorkspaceSection>
      <WorkspaceSection id="tasks-heading" className="command-tasks" title="Open tasks" description={tasks.length === 5 ? "Five recent tasks across your workspace." : "Other work to move forward."}>
        <ul>{tasks.map(task => <li key={task.id}><Link href={task.insight_id ? "/audience/insights/" + task.insight_id : task.type.includes("publish") ? "/settings/ai" : task.type.includes("asset") ? "/library?status=review" : "/approvals"} className="workspace-row"><Circle className="size-4 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1"><h3 className="workspace-row-title">{task.title}</h3><p className="workspace-row-meta">{task.type.replaceAll("_", " ")} · {formatDay(task.created_at)}</p></div></Link></li>)}</ul>
        {!tasks.length ? <p className="workspace-empty">{errors.includes("Tasks") ? "Tasks are unavailable. Refresh to try again." : "No open tasks. You are up to date."}</p> : null}
      </WorkspaceSection>
    </div>
    <section className="command-performance" aria-labelledby="performance-heading">
      <h2 id="performance-heading">Goals and channel mix</h2>
      <div className="command-reporting">
      {errors.includes("Goals") ? <WorkspaceSection id="goals-heading" title="Progress toward your goals"><p className="workspace-empty">Goal data is unavailable. Refresh to try again.</p></WorkspaceSection> : <CommandGoals kpis={kpis} />}
      {errors.includes("Channel mix") || errors.includes("Content") ? <WorkspaceSection id="mix-heading" title="Content mix"><p className="workspace-empty">Channel data is unavailable. Refresh to try again.</p></WorkspaceSection> : <ContentMixChart channels={channels} total={assets.total} />}
      </div>
    </section>
  </div>;
}
