import { channelLabel } from "@/lib/channels";

const DAY = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export type AnalyticsView = "overview" | "content" | "audience";
export type TrendMetric = "leads" | "visits" | "qualified" | "converted";
export type ContentMetric = "views" | "interactions" | "registrations";
export type AnalyticsPeriod = { start: string; end: string; from: string; to: string; previousStart: string; previousEnd: string; previousFrom: string; days: number; preset: string; warning: string | null };

export function analyticsPeriod(params: { period?: string; from?: string; to?: string }, now = new Date()): AnalyticsPeriod {
  const today = new Date(`${iso(now)}T00:00:00Z`);
  let end = today;
  let days = ["7", "28", "90"].includes(params.period ?? "") ? Number(params.period) : 28;
  let start = new Date(end.getTime() - (days - 1) * DAY);
  let preset = String(days);
  let warning: string | null = null;
  if (params.period === "custom") {
    const parse = (value?: string) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && iso(date) === value ? date : null;
    };
    const from = parse(params.from), to = parse(params.to);
    if (from && to && to >= from && to <= today && (to.getTime() - from.getTime()) / DAY < 180) {
      start = from; end = to; days = Math.round((to.getTime() - from.getTime()) / DAY) + 1; preset = "custom";
    } else warning = "Choose a valid date range of up to 180 days, ending today or earlier. Showing the last 28 days.";
  }
  return { start: iso(start), end: iso(end), from: start.toISOString(), to: new Date(end.getTime() + DAY).toISOString(), previousStart: iso(new Date(start.getTime() - days * DAY)), previousEnd: iso(new Date(start.getTime() - DAY)), previousFrom: new Date(start.getTime() - days * DAY).toISOString(), days, preset, warning };
}

export type AnalyticsLead = { created_at: string; is_qualified: boolean; is_converted: boolean; source_platform: string | null; audience_segment_id: string | null; campaign_id: string | null; marketing_consent: boolean };
export type AnalyticsAsset = { id: string; title: string; created_at: string; status: string; channel: string | null; platform: string | null; format: string | null; views: number | string | null; clicks: number | string | null; shares: number | string | null; comments: number | string | null; saves: number | string | null; registrations: number | string | null };
export type AnalyticsVisit = { created_at: string; metadata: Record<string, unknown> | null };
export type AnalyticsEmailEvent = { occurred_at: string; event_type: string };
type Dataset<T> = { data: T[] | null; count?: number | null; error: unknown };
type NamedRecord = { id: string; name: string };
type Totals = Record<TrendMetric, number>;
export type Breakdown = { key: string; label: string; count: number; qualified: number; converted: number; href?: string };
export type RankedContent = { id: string; title: string; channel: string; format: string; status: string; views: number; interactions: number; registrations: number };
export type MarketingAnalytics = {
  period: AnalyticsPeriod;
  totals: Totals; previous: Totals;
  timeline: Array<{ date: string; previousDate: string; label: string } & Totals & { previousLeads: number; previousVisits: number; previousQualified: number; previousConverted: number }>;
  sources: Breakdown[]; segments: Breakdown[]; campaigns: Breakdown[];
  uniqueVisitors: number; consented: number; topPages: Array<{ path: string; count: number }>;
  content: { total: number; views: number; interactions: number; registrations: number; channels: Array<{ channel: string; count: number; views: number }>; rankings: Record<ContentMetric, RankedContent[]> };
  email: { sent: number; delivered: number; opened: number; clicked: number; failed: number };
  unavailable: { leads: boolean; visits: boolean; content: boolean; email: boolean };
  sampled: { leads: boolean; visits: boolean; content: boolean; email: boolean };
};


const emptyTotals = (): Totals => ({ leads: 0, visits: 0, qualified: 0, converted: 0 });
export function counter(value: unknown): number { const number = typeof value === "number" || typeof value === "string" ? Number(value) : 0; return Number.isFinite(number) ? Math.max(0, number) : 0; }
function sourceKey(source: string | null) { const key = source?.trim().toLowerCase() || "unassigned"; return key === "twitter" ? "x" : key; }
export function isPublicVisit(row: AnalyticsVisit) {
  const path = row.metadata?.path;
  return typeof path === "string" && (path === "/" || /^\/p\/[a-z0-9-]+\/?$/.test(path));
}

export function buildMarketingAnalytics(period: AnalyticsPeriod, input: {
  leads: Dataset<AnalyticsLead>; assets: Dataset<AnalyticsAsset>; visits: Dataset<AnalyticsVisit>;
  emails?: Dataset<AnalyticsEmailEvent>;
  segments?: NamedRecord[]; campaigns?: NamedRecord[];
}): MarketingAnalytics {
  const totals = emptyTotals(), previous = emptyTotals();
  const dates = new Map<string, Totals>();
  const bucket = (date: string) => { if (!dates.has(date)) dates.set(date, emptyTotals()); return dates.get(date)!; };
  const current = (date: string) => date >= period.start && date <= period.end;
  const before = (date: string) => date >= period.previousStart && date <= period.previousEnd;
  const rows = input.leads.error ? [] : input.leads.data ?? [];
  const nowLeads: AnalyticsLead[] = [];
  for (const lead of rows) {
    const day = lead.created_at.slice(0, 10);
    if (!current(day) && !before(day)) continue;
    const total = current(day) ? totals : previous;
    const daily = bucket(day);
    total.leads++; daily.leads++;
    if (lead.is_qualified) { total.qualified++; daily.qualified++; }
    if (lead.is_converted) { total.converted++; daily.converted++; }
    if (current(day)) nowLeads.push(lead);
  }
  const visitors = new Set<string>(), pages = new Map<string, number>();
  for (const visit of input.visits.error ? [] : input.visits.data ?? []) {
    const day = visit.created_at.slice(0, 10);
    if (!isPublicVisit(visit) || (!current(day) && !before(day))) continue;
    const total = current(day) ? totals : previous;
    total.visits++; bucket(day).visits++;
    if (current(day)) {
      const visitor = visit.metadata?.visitor_id;
      if (typeof visitor === "string" && visitor) visitors.add(visitor);
      const path = visit.metadata!.path as string;
      pages.set(path, (pages.get(path) ?? 0) + 1);
    }
  }
  function breakdown(keyFor: (lead: AnalyticsLead) => string, nameFor: (key: string) => string, hrefFor?: (key: string) => string | undefined): Breakdown[] {
    const groups = new Map<string, Breakdown>();
    for (const lead of nowLeads) {
      const key = keyFor(lead);
      const row = groups.get(key) ?? { key, label: nameFor(key), count: 0, qualified: 0, converted: 0, href: hrefFor?.(key) };
      row.count++; if (lead.is_qualified) row.qualified++; if (lead.is_converted) row.converted++;
      groups.set(key, row);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
  const segments = new Map(input.segments?.map(row => [row.id, row.name]));
  const campaigns = new Map(input.campaigns?.map(row => [row.id, row.name]));
  const contentRows: RankedContent[] = (input.assets.error ? [] : input.assets.data ?? []).filter(asset => current(asset.created_at.slice(0, 10))).map(asset => ({
    id: asset.id, title: asset.title, channel: sourceKey(asset.platform || asset.channel), format: asset.format || "Content", status: asset.status,
    views: counter(asset.views), interactions: counter(asset.clicks) + counter(asset.comments) + counter(asset.shares) + counter(asset.saves), registrations: counter(asset.registrations),
  }));
  const channels = new Map<string, { channel: string; count: number; views: number }>();
  for (const asset of contentRows) { const row = channels.get(asset.channel) ?? { channel: asset.channel, count: 0, views: 0 }; row.count++; row.views += asset.views; channels.set(asset.channel, row); }
  const ranked = (key: ContentMetric) => [...contentRows].sort((a, b) => b[key] - a[key] || a.title.localeCompare(b.title)).slice(0, 50);
  return {
    period, totals, previous,
    timeline: Array.from({ length: period.days }, (_, index) => {
      const date = iso(new Date(new Date(period.from).getTime() + index * DAY));
      const previousDate = iso(new Date(new Date(period.previousFrom).getTime() + index * DAY));
      const old = dates.get(previousDate) ?? emptyTotals();
      return { date, previousDate, label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), ...(dates.get(date) ?? emptyTotals()), previousLeads: old.leads, previousVisits: old.visits, previousQualified: old.qualified, previousConverted: old.converted };
    }),
    sources: breakdown(lead => sourceKey(lead.source_platform), key => key === "unassigned" ? "Unassigned" : key === "landing_page" ? "Landing pages" : channelLabel(key)),
    segments: breakdown(lead => lead.audience_segment_id || "unassigned", key => key === "unassigned" ? "No segment" : segments.get(key) ?? "Linked segment", key => key === "unassigned" ? undefined : `/audience/segments/${encodeURIComponent(key)}`),
    campaigns: breakdown(lead => lead.campaign_id || "unassigned", key => key === "unassigned" ? "No campaign" : campaigns.get(key) ?? "Linked campaign", key => key === "unassigned" ? undefined : `/audience/campaigns/${encodeURIComponent(key)}`),
    uniqueVisitors: visitors.size, consented: nowLeads.filter(lead => lead.marketing_consent).length,
    topPages: [...pages].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, count]) => ({ path, count })),
    content: { total: contentRows.length, views: contentRows.reduce((n, row) => n + row.views, 0), interactions: contentRows.reduce((n, row) => n + row.interactions, 0), registrations: contentRows.reduce((n, row) => n + row.registrations, 0), channels: [...channels.values()].sort((a, b) => b.count - a.count), rankings: { views: ranked("views"), interactions: ranked("interactions"), registrations: ranked("registrations") } },
    email: Object.fromEntries(["sent", "delivered", "opened", "clicked", "failed"].map(key => [key, input.emails?.error ? 0 : (input.emails?.data ?? []).filter(row => current(row.occurred_at.slice(0, 10)) && row.event_type === `email.${key}`).length])) as MarketingAnalytics["email"],
    unavailable: { leads: Boolean(input.leads.error), visits: Boolean(input.visits.error), content: Boolean(input.assets.error), email: !input.emails || Boolean(input.emails.error) },
    sampled: { leads: (input.leads.count ?? 0) > (input.leads.data?.length ?? 0), visits: (input.visits.count ?? 0) > (input.visits.data?.length ?? 0), content: (input.assets.count ?? 0) > (input.assets.data?.length ?? 0), email: (input.emails?.count ?? 0) > (input.emails?.data?.length ?? 0) },
  };
}

export function metricChange(current: number, previous: number): { label: string; direction: "up" | "down" | "flat" } {
  if (current === previous) return { label: "No change", direction: "flat" };
  if (!previous) return { label: "No previous baseline", direction: "flat" };
  const value = (current - previous) / previous * 100;
  return { label: `${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 1 })}% ${value > 0 ? "more" : "less"}`, direction: value > 0 ? "up" : "down" };
}

/** Escapes cells so spreadsheet programs do not evaluate content titles as formulas. */
export function analyticsCsv(rows: Array<Array<string | number>>) {
  return rows.map(row => row.map(value => {
    const text = String(value);
    return `"${(/^[\s\uFEFF]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
