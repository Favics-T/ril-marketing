"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { Alert as ShadcnAlert } from "@/components/ui/alert";
import { FieldLabel as ShadcnFieldLabel, Field as ShadcnField, FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";


import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Download, Info, Minus, ArrowRight } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelIdentity } from "@/components/channel-identity";
import { StatusStamp } from "@/components/ui/status-stamp";
import { analyticsCsv, analyticsPeriod, metricChange, type AnalyticsView, type Breakdown, type ContentMetric, type MarketingAnalytics, type TrendMetric } from "@/lib/analytics/marketing";
import { channelLabel } from "@/lib/channels";
import { cn } from "@/lib/utils";
import { socialChannelKey } from "@/components/settings/channel-icons";

const metrics: Array<{ key: TrendMetric; label: string; description: string }> = [
  { key: "leads", label: "Captured leads", description: "New contacts recorded in your workspace" },
  { key: "visits", label: "Website visits", description: "Public homepage and campaign pages" },
  { key: "qualified", label: "Qualified leads", description: "Currently qualified, captured in this period" },
  { key: "converted", label: "Converted leads", description: "Currently converted, captured in this period" },
];
const count = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const day = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const previousKey: Record<TrendMetric, string> = { leads: "previousLeads", visits: "previousVisits", qualified: "previousQualified", converted: "previousConverted" };

export function MarketingAnalyticsWorkspace({ data, initialView, goals, referencesUnavailable }: {
  data: MarketingAnalytics; initialView: AnalyticsView; goals: ReactNode; referencesUnavailable: boolean;
}) {
  const [view, setActiveView] = useState<AnalyticsView>(initialView);
  const [metric, setMetric] = useState<TrendMetric>(() => data.totals.leads > 0 || data.totals.visits === 0 ? "leads" : "visits");
  const [compare, setCompare] = useState(true);
  const [ranking, setRanking] = useState<ContentMetric>("views");
  const [exportError, setExportError] = useState("");
  const active = metrics.find(item => item.key === metric)!;
  const missing = (key: TrendMetric) => key === "visits" ? data.unavailable.visits : data.unavailable.leads;
  const sampled = (key: TrendMetric) => key === "visits" ? data.sampled.visits : data.sampled.leads;
  const compareAllowed = !missing(metric) && !sampled(metric);
  const emptyTrend = data.totals[metric] === 0 && (!compare || data.previous[metric] === 0);
  useEffect(() => {
    const restoreView = () => {
      const value = new URLSearchParams(window.location.search).get("view");
      setActiveView(value === "content" || value === "audience" ? value : "overview");
    };
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);
  function changeView(next: AnalyticsView) {
    setActiveView(next);
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }

  function exportView() {
    setExportError("");
    try {
      let rows: Array<Array<string | number>>;
      if (view === "content") rows = [["Content", "Channel", "Status", "Lifetime views", "Lifetime interactions", "Lifetime registrations"], ...data.content.rankings[ranking].map(row => [row.title, channelLabel(row.channel), row.status, row.views, row.interactions, row.registrations])];
      else if (view === "audience") rows = [["Breakdown", "Group", "Captured", "Qualified", "Converted"], ...data.sources.map(row => ["Source", row.label, row.count, row.qualified, row.converted]), ...data.segments.map(row => ["Segment", row.label, row.count, row.qualified, row.converted]), ...data.campaigns.map(row => ["Campaign", row.label, row.count, row.qualified, row.converted])];
      else rows = [["Date (UTC)", "Captured leads", "Public website visits", "Qualified capture cohort", "Converted capture cohort", "Previous date (UTC)", "Previous leads", "Previous visits", "Previous qualified", "Previous converted"], ...data.timeline.map(row => [row.date, data.unavailable.leads ? "Unavailable" : row.leads, data.unavailable.visits ? "Unavailable" : row.visits, data.unavailable.leads ? "Unavailable" : row.qualified, data.unavailable.leads ? "Unavailable" : row.converted, row.previousDate, data.unavailable.leads ? "Unavailable" : row.previousLeads, data.unavailable.visits ? "Unavailable" : row.previousVisits, data.unavailable.leads ? "Unavailable" : row.previousQualified, data.unavailable.leads ? "Unavailable" : row.previousConverted])];
      const url = URL.createObjectURL(new Blob(["\uFEFF", analyticsCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `ril-${view}${view === "content" ? "-top-50" : ""}-${data.period.start}-${data.period.end}${Object.values(data.sampled).some(Boolean) ? "-sample" : ""}.csv`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError("The export could not be created. Try again in this browser."); }
  }

  return <Tabs value={view} onValueChange={value => { if (value === "overview" || value === "content" || value === "audience") changeView(value); }} className="workspace-page analytics-workspace">
    <WorkspacePageHeader title="Marketing Analytics" description="See what gets noticed, what connects, and what brings people closer." actions={<div className="analytics-header-actions"><Button type="button" variant="outline" onClick={exportView} disabled={view === "content" ? data.unavailable.content : view === "audience" ? data.unavailable.leads : data.unavailable.leads && data.unavailable.visits}><Download data-icon="inline-start" />{view === "content" ? "Export top 50" : "Export CSV"}</Button><Button asChild><Link href="/reports">Create a report<ArrowUpRight data-icon="inline-end" /></Link></Button></div>} />
    <div className="analytics-toolbar"><TabsList aria-label="Analytics sections" className="analytics-tabs">{(["overview", "content", "audience"] as const).map(item => <TabsTrigger key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</TabsTrigger>)}</TabsList><PeriodFilter key={`${data.period.from}:${data.period.to}`} data={data} view={view} /></div>
    <div className="analytics-period-summary"><span>{day(data.period.start)} – {day(data.period.end)}</span><span>Compared with {day(data.period.previousStart)} – {day(data.period.previousEnd)} · UTC</span></div>
    {exportError ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="analytics-warning">{exportError}</p></ShadcnAlert> : null}
    {data.period.warning ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="analytics-warning">{data.period.warning}</p></ShadcnAlert> : null}
    {Object.values(data.unavailable).some(Boolean) ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="analytics-warning">Some data could not be loaded: {Object.entries(data.unavailable).filter(([, value]) => value).map(([name]) => name).join(", ")}. Available sections remain usable. <Button variant="ghost" type="button" onClick={() => window.location.reload()}>Refresh to retry</Button>.</p></ShadcnAlert> : null}
    {Object.values(data.sampled).some(Boolean) ? <ShadcnAlert asChild role="status"><p role="status" className="analytics-warning">This range exceeds a dataset’s display limit. Counts, rankings and exports use the loaded sample; period comparisons are disabled for sampled data. Try a shorter date range.</p></ShadcnAlert> : null}
    <TabsContent value={view} className="analytics-view mt-0" key={view}>
    {view === "overview" ? <>
      <div className="analytics-overview-grid">
        <Card asChild><section className="analytics-panel analytics-performance" aria-labelledby="analytics-performance-heading">
          <div className="analytics-metric-strip" role="group" aria-label="Choose a trend metric">{metrics.map(item => {
            const change = metricChange(data.totals[item.key], data.previous[item.key]);
            const ChangeIcon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : Minus;
            return <Button variant="ghost" type="button" key={item.key} aria-pressed={metric === item.key} className={cn("analytics-metric", metric === item.key && "is-active")} onClick={() => setMetric(item.key)} title={item.description}><span>{item.label}</span><strong>{missing(item.key) ? "—" : count(data.totals[item.key])}</strong><span className="analytics-change">{missing(item.key) ? "Unavailable" : sampled(item.key) ? "Sampled data" : <><ChangeIcon aria-hidden="true" />{change.label}</>}</span></Button>;
          })}</div>
          <div className="analytics-chart-heading"><div><h2 id="analytics-performance-heading">{active.label} over time</h2><p>{metric === "visits" ? "Visits to public pages. Internal workspace traffic is excluded." : "Grouped by capture date. Qualification and conversion reflect current status."}</p></div><ShadcnField asChild orientation="horizontal"><ShadcnFieldLabel className="analytics-compare"><ShadcnCheckbox  checked={compare} disabled={!compareAllowed} onCheckedChange={checked => setCompare(checked === true)} />Compare periods</ShadcnFieldLabel></ShadcnField></div>
          {missing(metric) ? <EmptyChart title="This metric is unavailable" description="Refresh the page to retry. The other analytics sections are still available." /> : emptyTrend ? <EmptyChart title={`No ${active.label.toLowerCase()} recorded yet`} description={metric === "visits" ? "Publish a campaign page and share its public link to start recording visits." : "Share your campaign’s registration link to start recording leads and their outcomes."} href={metric === "visits" ? "/audience/landing-pages" : "/leads"} action={metric === "visits" ? "Open Landing Pages" : "Open Leads"} /> : <>
            <ChartContainer config={{ current: { label: active.label, color: "var(--ril-blue-accessible)" }, previous: { label: "Previous period", color: "var(--muted-foreground)" } }} className="analytics-trend-chart">
              <ComposedChart data={data.timeline} accessibilityLayer margin={{ left: 0, right: 14, top: 16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--ril-line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={36} tickMargin={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={42} />
                <ChartTooltip content={({ active: hovered, payload }) => {
                  if (!hovered || !payload?.length) return null;
                  const point = payload[0].payload as MarketingAnalytics["timeline"][number];
                  return <div className="analytics-chart-tooltip"><strong>{day(point.date)}</strong><span>{active.label}: {count(point[metric])}</span>{compare && compareAllowed ? <span>{day(point.previousDate)}: {count(Number(point[previousKey[metric] as keyof typeof point]))}</span> : null}</div>;
                }} />
                <Area type="monotone" dataKey={metric} stroke="var(--app-chart-1)" fill="var(--app-info-bg)" strokeWidth={2.5} isAnimationActive={false} />
                {compare && compareAllowed ? <Line type="monotone" dataKey={previousKey[metric]} stroke="var(--ril-copy-muted)" strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} /> : null}
              </ComposedChart>
            </ChartContainer>
            <div className="analytics-chart-legend"><span><i />Selected period</span>{compare && compareAllowed ? <span><i className="is-previous" />Previous period</span> : null}</div>
          </>}
          {!missing(metric) ? <Disclosure className="analytics-data-table" title={<>View daily data</>}><Table><TableHeader><TableRow><TableHead>Date (UTC)</TableHead><TableHead>{active.label}</TableHead><TableHead>Previous date</TableHead><TableHead>Previous value</TableHead></TableRow></TableHeader><TableBody>{data.timeline.map(row => <TableRow key={row.date}><TableCell>{day(row.date)}</TableCell><TableCell>{count(row[metric])}</TableCell><TableCell>{day(row.previousDate)}</TableCell><TableCell>{count(Number(row[previousKey[metric] as keyof typeof row]))}</TableCell></TableRow>)}</TableBody></Table></Disclosure> : null}
        </section></Card>
        <Card asChild><section className="analytics-panel analytics-source-panel"><div className="analytics-section-heading"><h2>Where leads come from</h2><p>Source attribution for this period’s contacts.</p></div><BreakdownList rows={data.sources.slice(0, 5)} total={data.totals.leads} unavailable={data.unavailable.leads} />{data.sources.length ? <Button type="button" variant="ghost" onClick={() => changeView("audience")}>Explore your audience<ArrowRight data-icon="inline-end" /></Button> : null}<div className="analytics-source-footer"><span>Public website visitors</span><strong>{data.unavailable.visits ? "Unavailable" : `${data.sampled.visits ? "~" : ""}${count(data.uniqueVisitors)}`}</strong><p>Distinct first-party browser IDs, not individual people.</p></div></section></Card>
      </div>
      <div className="analytics-detail-grid"><TopContent data={data} ranking="views" compact /><Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Most visited pages</h2><p>Public pages in the selected period.</p></div>{data.unavailable.visits ? <p className="analytics-empty">Page visits are unavailable. Refresh to retry.</p> : data.topPages.length ? <ol className="analytics-ranked-pages">{data.topPages.map((page, index) => <li key={page.path}><span className="analytics-rank">{index + 1}</span><span className="min-w-0 flex-1 break-all">{page.path === "/" ? "Homepage" : page.path}</span><strong>{count(page.count)}</strong></li>)}</ol> : <p className="analytics-empty">No public page visits recorded in this period. Share a published landing page to get started.</p>}<Link href="/audience/landing-pages" className="analytics-text-link">Manage campaign pages<ArrowRight aria-hidden="true" /></Link></section></Card></div>
      <Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Email activity</h2><p>Recorded provider events in this date range.</p></div>{data.unavailable.email ? <p className="analytics-empty">Email events could not be loaded. <Link href="/email">Open Email</Link> to check delivery setup.</p> : <><dl className="analytics-total-strip">{[["Sent events", data.email.sent], ["Delivery events", data.email.delivered], ["Open events", data.email.opened], ["Click events", data.email.clicked]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{count(Number(value))}</dd></div>)}</dl><p className="analytics-caption">Events appear after your email provider and signed webhook record activity. Opens and clicks can include repeat activity; these are not unique recipient counts.{data.email.failed ? ` ${count(data.email.failed)} failure events were recorded.` : ""}</p></>}<Link href="/email" className="analytics-text-link">Manage email campaigns<ArrowRight aria-hidden="true" /></Link></section></Card>
      {goals}
    </> : null}
    {view === "content" ? <>
      <div className="analytics-content-summary"><h2>Content performance</h2><p>Lifetime counters for content created {day(data.period.start)} – {day(data.period.end)}. These are not engagement events dated to this period.</p><dl className="analytics-total-strip">{[["Content assets", data.content.total], ["Recorded views", data.content.views], ["Interactions", data.content.interactions], ["Registrations", data.content.registrations]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{data.unavailable.content ? "—" : count(Number(value))}</dd></div>)}</dl></div>
      <Card asChild><section className="analytics-panel"><div className="analytics-section-heading analytics-heading-with-control"><div><h2>What your audience responds to</h2><p>Ranked content · up to 50 assets · select a title to open it.</p></div><div className="analytics-ranking-select"><ShadcnField asChild><ShadcnFieldLabel htmlFor="content-ranking">Rank by</ShadcnFieldLabel></ShadcnField><Select value={ranking} onValueChange={value => setRanking(value as ContentMetric)}><SelectTrigger id="content-ranking"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="views">Views</SelectItem><SelectItem value="interactions">Interactions</SelectItem><SelectItem value="registrations">Registrations</SelectItem></SelectGroup></SelectContent></Select></div></div><ContentTable data={data} ranking={ranking} /></section></Card>
      <Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Content by channel</h2><p>Distribution of assets created in the selected period.</p></div>{data.unavailable.content ? <p className="analytics-empty">Content metrics are unavailable.</p> : data.content.channels.length ? <ul className="analytics-channel-list">{data.content.channels.map(row => <li key={row.channel}><span className="analytics-channel"><ChannelIdentity channel={row.channel} /></span><span>{count(row.count)} assets</span><span className="analytics-share-track"><i style={{ width: `${row.count / data.content.total * 100}%` }} /></span><strong>{count(row.views)} views</strong></li>)}</ul> : <p className="analytics-empty">Create content to see how it is distributed across channels.</p>}</section></Card>
    </> : null}
    {view === "audience" ? <>
      <Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>From interest to action</h2><p>Current outcomes for contacts captured in the selected period.</p></div><dl className="analytics-total-strip">{[["Captured", data.totals.leads], ["Qualified", data.totals.qualified], ["Converted", data.totals.converted], ["Email opted in", data.consented]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{data.unavailable.leads ? "—" : count(Number(value))}</dd></div>)}</dl><p className="analytics-caption">{data.unavailable.leads ? "Lead outcomes are unavailable." : data.totals.leads ? `${(data.totals.converted / data.totals.leads * 100).toFixed(1)}% of captured contacts are marked converted. Qualification, conversion and email opt-in can overlap.` : "No contacts captured in this period. Existing contacts outside this range are not included."} Email opt-in is separate from an enquiry.</p></section></Card>
      <div className="analytics-detail-grid"><Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Lead sources</h2><p>Recorded channels, rather than estimated reach.</p></div><BreakdownList rows={data.sources} total={data.totals.leads} unavailable={data.unavailable.leads} /></section></Card><Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Audience segments</h2><p>Understand which groups are responding.</p></div><BreakdownList rows={data.segments} total={data.totals.leads} unavailable={data.unavailable.leads} /></section></Card></div>
      <Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Campaign contribution</h2><p>Captured contacts and their current qualification and conversion status.</p></div>{data.unavailable.leads || !data.campaigns.length ? <p className="analytics-empty">{data.unavailable.leads ? "Campaign outcomes are unavailable." : "No campaign-attributed contacts in this date range."}</p> : <Table><TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Captured</TableHead><TableHead>Qualified</TableHead><TableHead>Converted</TableHead></TableRow></TableHeader><TableBody>{data.campaigns.map(row => <TableRow key={row.key}><TableCell>{row.href ? <Link href={row.href} className="font-semibold text-primary hover:underline">{row.label}</Link> : row.label}</TableCell><TableCell>{count(row.count)}</TableCell><TableCell>{count(row.qualified)}</TableCell><TableCell>{count(row.converted)}</TableCell></TableRow>)}</TableBody></Table>}{referencesUnavailable ? <p className="analytics-caption">Some campaign or segment names could not be loaded. Counts still use their recorded attribution.</p> : null}</section></Card>
    </> : null}
    </TabsContent>
    <aside className="analytics-scope-note"><Info aria-hidden="true" /><div><h2>Know what you’re measuring</h2><p>Website visits come from first-party public-page tracking and may miss blocked browsers. Content interactions combine clicks, comments, shares and saves. Social followers, watch time and paid-media ROI are not collected here. Google Analytics and Search Console results remain available in generated reports when configured.</p><div className="flex flex-wrap gap-5"><Link href="/settings/ai">Manage connections</Link><Link href="/reports">Open reports</Link></div></div></aside>
  </Tabs>;
}

function PeriodFilter({ data, view }: { data: MarketingAnalytics; view: AnalyticsView }) {
  const router = useRouter();
  const [preset, setPreset] = useState(data.period.preset);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function navigate(value: string, dates?: { from: string; to: string }) {
    const params = new URLSearchParams({ period: value, view });
    if (dates) { params.set("from", dates.from); params.set("to", dates.to); }
    startTransition(() => router.push(`/analytics?${params}`, { scroll: false }));
  }
  return <ShadcnFieldGroup asChild><form className="analytics-date-controls" onSubmit={event => {
    event.preventDefault(); setError("");
    const fields = new FormData(event.currentTarget);
    const dates = { from: String(fields.get("from") ?? ""), to: String(fields.get("to") ?? "") };
    if (preset === "custom" && analyticsPeriod({ period: "custom", ...dates }).warning) { setError("Choose a valid range of up to 180 days, ending today or earlier."); return; }
    navigate(preset, preset === "custom" ? dates : undefined);
  }} aria-label="Analytics date range">
    <div className="analytics-period-select"><ShadcnField asChild><ShadcnFieldLabel htmlFor="analytics-period">Date range</ShadcnFieldLabel></ShadcnField><Select value={preset} disabled={pending} onValueChange={value => { setPreset(value); if (value !== "custom") navigate(value); }}><SelectTrigger id="analytics-period" aria-busy={pending}><SelectValue>{preset === "custom" ? "Custom dates" : `Last ${preset} days`}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="28">Last 28 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="custom">Custom dates</SelectItem></SelectGroup></SelectContent></Select></div>
    {preset === "custom" ? <><ShadcnField asChild><ShadcnFieldLabel>From<Input name="from" type="date" defaultValue={data.period.start} max={new Date().toISOString().slice(0, 10)} required /></ShadcnFieldLabel></ShadcnField><ShadcnField asChild><ShadcnFieldLabel>To<Input name="to" type="date" defaultValue={data.period.end} max={new Date().toISOString().slice(0, 10)} required /></ShadcnFieldLabel></ShadcnField><Button type="submit" variant="outline" disabled={pending}>{pending ? "Updating…" : "Apply dates"}</Button></> : pending ? <span role="status" className="text-xs text-muted-foreground">Updating…</span> : null}
    {error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="analytics-date-error">{error}</p></ShadcnAlert> : null}
  </form></ShadcnFieldGroup>;
}

function EmptyChart({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="analytics-chart-empty"><div className="analytics-empty-grid" aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p>{href ? <Link href={href}>{action}<ArrowRight aria-hidden="true" /></Link> : null}</div></div>;
}

function BreakdownList({ rows, total, unavailable }: { rows: Breakdown[]; total: number; unavailable: boolean }) {
  if (unavailable) return <p className="analytics-empty">This breakdown is unavailable. Refresh to retry.</p>;
  if (!rows.length) return <p className="analytics-empty">No contacts recorded in this period. Share a tracked registration link to start learning where interest comes from.</p>;
  return <ul className="analytics-breakdown">{rows.map(row => <li key={row.key}><div><span>{row.href ? <Link href={row.href}>{row.label}</Link> : socialChannelKey(row.key) ? <ChannelIdentity channel={row.key} /> : row.label}</span><strong>{count(row.count)}<small>{total ? Math.round(row.count / total * 100) : 0}%</small></strong></div><div className="analytics-share-track"><i style={{ width: `${total ? row.count / total * 100 : 0}%` }} /></div></li>)}</ul>;
}

function TopContent({ data, ranking, compact }: { data: MarketingAnalytics; ranking: ContentMetric; compact?: boolean }) {
  return <Card asChild><section className="analytics-panel"><div className="analytics-section-heading"><h2>Top content</h2><p>Lifetime views · content created in this period.</p></div><ContentTable data={data} ranking={ranking} compact={compact} /><Link href="/library" className="analytics-text-link">Open Content Library<ArrowRight aria-hidden="true" /></Link></section></Card>;
}

function ContentTable({ data, ranking, compact }: { data: MarketingAnalytics; ranking: ContentMetric; compact?: boolean }) {
  if (data.unavailable.content) return <p className="analytics-empty">Content performance is unavailable. Refresh to retry.</p>;
  const rows = compact ? data.content.rankings[ranking].slice(0, 5) : data.content.rankings[ranking];
  if (!rows.length) return <p className="analytics-empty">No content was created in this period. Try a wider range or <Link href="/library/new">add content</Link>.</p>;
  return <Table className="analytics-content-table"><TableHeader><TableRow><TableHead>Content</TableHead><TableHead>Views</TableHead>{!compact ? <><TableHead>Interactions</TableHead><TableHead>Registrations</TableHead></> : null}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={row.id}><TableCell><div className="analytics-content-name"><span className="analytics-rank">{index + 1}</span><div className="min-w-0"><Link href={`/library/${row.id}`} className="analytics-content-title">{row.title}</Link><div className="analytics-content-meta"><ChannelIdentity channel={row.channel} /><span>{row.format}</span>{!compact ? <StatusStamp status={row.status} /> : null}</div></div></div></TableCell><TableCell>{count(row.views)}</TableCell>{!compact ? <><TableCell>{count(row.interactions)}</TableCell><TableCell>{count(row.registrations)}</TableCell></> : null}</TableRow>)}</TableBody></Table>;
}
