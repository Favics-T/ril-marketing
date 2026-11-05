import { describe, expect, it } from "vitest";
import { analyticsCsv, analyticsPeriod, buildMarketingAnalytics, counter, metricChange, type AnalyticsAsset, type AnalyticsLead, type AnalyticsVisit } from "./marketing";

const now = new Date("2026-10-26T12:00:00Z");
const range = analyticsPeriod({ period: "7" }, now);
const source = <T>(data: T[] = [], count = data.length) => ({ data, count, error: null });
const lead = (created_at: string, extra: Partial<AnalyticsLead> = {}): AnalyticsLead => ({ created_at, is_qualified: false, is_converted: false, source_platform: null, audience_segment_id: null, campaign_id: null, marketing_consent: false, ...extra });
const asset = (extra: Partial<AnalyticsAsset> = {}): AnalyticsAsset => ({ id: "asset", title: "An authored draft", created_at: "2026-10-22T10:00:00Z", status: "published", channel: "social", platform: "linkedin", format: "post", views: 10, clicks: 2, comments: 3, shares: 1, saves: 4, registrations: 1, ...extra });
const visit = (date: string, path: string, visitor = "browser-1"): AnalyticsVisit => ({ created_at: date, metadata: { path, visitor_id: visitor } });
const build = (data: Partial<Parameters<typeof buildMarketingAnalytics>[1]> = {}) => buildMarketingAnalytics(range, { leads: source<AnalyticsLead>(), assets: source<AnalyticsAsset>(), visits: source<AnalyticsVisit>(), emails: source(), ...data });

describe("analytics reporting windows", () => {
  it("uses inclusive UTC days and an adjacent equal-length previous period", () => {
    expect(range).toMatchObject({ start: "2026-10-20", end: "2026-10-26", days: 7, to: "2026-10-27T00:00:00.000Z", previousStart: "2026-10-13", previousEnd: "2026-10-19" });
    expect(analyticsPeriod({}, now).days).toBe(28);
    expect(analyticsPeriod({ period: "90" }, now).days).toBe(90);
  });
  it("accepts leap-day and single-day custom windows", () => {
    expect(analyticsPeriod({ period: "custom", from: "2024-02-29", to: "2024-02-29" }, now)).toMatchObject({ days: 1, start: "2024-02-29", previousStart: "2024-02-28", preset: "custom" });
  });
  it.each([
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-26", to: "2026-10-20" },
    { from: "2026-10-26", to: "2026-10-27" },
    { from: "2025-01-01", to: "2026-01-01" },
    { from: "", to: "2026-10-26" },
  ])("bounds invalid or excessive custom ranges %o", input => {
    expect(analyticsPeriod({ period: "custom", ...input }, now)).toMatchObject({ days: 28, preset: "28", warning: expect.stringContaining("valid date range") });
  });
});

describe("honest marketing aggregation", () => {
  it("aligns daily cohorts, includes the last day and excludes later records", () => {
    const data = build({ leads: source([lead("2026-10-13T00:00:00Z"), lead("2026-10-20T00:00:00Z", { is_qualified: true }), lead("2026-10-26T23:59:59Z", { is_converted: true }), lead("2026-10-27T00:00:00Z")]) });
    expect(data.totals).toMatchObject({ leads: 2, qualified: 1, converted: 1 });
    expect(data.previous.leads).toBe(1);
    expect(data.timeline).toHaveLength(7);
    expect(data.timeline[0]).toMatchObject({ date: "2026-10-20", previousDate: "2026-10-13", leads: 1, previousLeads: 1, qualified: 1 });
    expect(data.timeline.at(-1)?.converted).toBe(1);
  });
  it("counts only public traffic and distinct browser IDs, keeping internal paths out", () => {
    const data = build({ visits: source([visit("2026-10-22", "/"), visit("2026-10-22", "/p/real-programme"), visit("2026-10-23", "/p/real-programme", "browser-2"), visit("2026-10-23", "/dashboard"), visit("2026-10-23", "/sign-in"), visit("2026-10-23", "/p/unsafe?email=private@example.com")]) });
    expect(data.totals.visits).toBe(3);
    expect(data.uniqueVisitors).toBe(2);
    expect(data.topPages).toEqual([{ path: "/p/real-programme", count: 2 }, { path: "/", count: 1 }]);
  });
  it("normalises channel aliases, resolves segments and keeps consent separate from qualification", () => {
    const data = build({ leads: source([
      lead("2026-10-22", { source_platform: "twitter", audience_segment_id: "segment", campaign_id: "campaign", is_qualified: true }),
      lead("2026-10-22", { source_platform: " X ", marketing_consent: true, is_converted: true }),
      lead("2026-10-22"),
    ]), segments: [{ id: "segment", name: "Founders" }], campaigns: [{ id: "campaign", name: "Programme launch" }] });
    expect(data.sources[0]).toMatchObject({ key: "x", label: "X", count: 2, qualified: 1, converted: 1 });
    expect(data.segments.find(row => row.key === "segment")).toMatchObject({ label: "Founders", href: "/audience/segments/segment" });
    expect(data.campaigns.find(row => row.key === "campaign")?.label).toBe("Programme launch");
    expect(data.consented).toBe(1);
  });
  it("ranks lifetime counters for the current content cohort without turning them into dated events", () => {
    const data = build({ assets: source([asset(), asset({ id: "older", created_at: "2026-09-01", views: 100000 }), asset({ id: "most-clicked", title: "Another draft", views: 2, clicks: 100 })]) });
    expect(data.content.total).toBe(2);
    expect(data.content.views).toBe(12);
    expect(data.content.rankings.views[0].id).toBe("asset");
    expect(data.content.rankings.interactions[0].id).toBe("most-clicked");
    expect(data.timeline.every(row => row.visits === 0)).toBe(true);
  });
  it("labels unavailable datasets and truncated samples instead of treating errors as a successful zero", () => {
    const data = build({ leads: { data: null, error: { message: "Unavailable" } }, assets: source([asset()], 6000), visits: source([], 30000) });
    expect(data.unavailable.leads).toBe(true);
    expect(data.sampled).toMatchObject({ content: true, visits: true });
    expect(data.sources).toEqual([]);
  });
  it("keeps missing email metrics distinct from recorded provider events", () => {
    expect(buildMarketingAnalytics(range, { leads: source(), assets: source(), visits: source() }).unavailable.email).toBe(true);
    const data = build({ emails: source([{ occurred_at: "2026-10-22", event_type: "email.opened" }, { occurred_at: "2026-10-22", event_type: "email.opened" }, { occurred_at: "2026-10-22", event_type: "email.delivered" }, { occurred_at: "2026-09-20", event_type: "email.failed" }]) });
    expect(data.email).toEqual({ sent: 0, delivered: 1, opened: 2, clicked: 0, failed: 0 });
    expect(data.unavailable.email).toBe(false);
  });
  it("caps rankings at 50 while retaining whole-cohort totals", () => {
    const data = build({ assets: source(Array.from({ length: 70 }, (_, i) => asset({ id: String(i), views: i }))) });
    expect(data.content.total).toBe(70);
    expect(data.content.rankings.views).toHaveLength(50);
    expect(data.content.rankings.views[0].views).toBe(69);
  });
  it("does not manufacture growth percentages without a baseline", () => {
    expect(metricChange(5, 0)).toMatchObject({ label: "No previous baseline", direction: "flat" });
    expect(metricChange(6, 4)).toEqual({ label: "50% more", direction: "up" });
    expect(metricChange(0, 4)).toEqual({ label: "100% less", direction: "down" });
    expect(metricChange(0, 0)).toMatchObject({ label: "No change" });
    expect(counter("NaN")).toBe(0); expect(counter(-1)).toBe(0);
  });
});

describe("analytics CSV export", () => {
  it("escapes cells, line breaks and spreadsheet-formula prefixes", () => {
    const csv = analyticsCsv([["Title", "Value"], ['A "quoted", title', 10], ["=HYPERLINK(\"bad\")", "\t+1"], ["Line\nbreak", "@formula"]]);
    expect(csv).toContain('"A ""quoted"", title","10"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\'\t+1"');
    expect(csv).toContain('"Line\nbreak","\'@formula"');
  });
});
