import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { analyticsPeriod, buildMarketingAnalytics } from "@/lib/analytics/marketing";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { MarketingAnalyticsWorkspace } from "./marketing-analytics";
const period = analyticsPeriod({ period: "7" }, new Date("2026-10-26"));
const dataset = { data: [], count: 0, error: null };
const data = buildMarketingAnalytics(period, { leads: dataset, assets: dataset, visits: dataset, emails: dataset });
describe("marketing analytics states", () => {
  it("shows useful empty guidance without manufacturing chart points or reach metrics", () => {
    const html = renderToStaticMarkup(<MarketingAnalyticsWorkspace data={data} initialView="overview" goals={<p>No goals configured.</p>} referencesUnavailable={false} />);
    expect(html).toContain("No captured leads recorded yet");
    expect(html).toContain("Open Leads");
    expect(html).toContain("Public homepage and campaign pages");
    expect(html).toContain("Social followers, watch time and paid-media ROI are not collected here");
    expect(html).not.toContain("recharts-area");
  });
  it("distinguishes unavailable lead metrics from zero in the visible summary", () => {
    const missing = buildMarketingAnalytics(period, { leads: { data: null, error: "Unavailable" }, assets: dataset, visits: dataset, emails: dataset });
    const html = renderToStaticMarkup(<MarketingAnalyticsWorkspace data={missing} initialView="overview" goals={null} referencesUnavailable={false} />);
    expect(html).toContain("Some data could not be loaded: leads");
    expect(html).toContain("This metric is unavailable");
    expect(html).not.toContain("No captured leads recorded yet");
  });
  it("states lifetime measurement scope in the Content view", () => {
    const html = renderToStaticMarkup(<MarketingAnalyticsWorkspace data={data} initialView="content" goals={null} referencesUnavailable={false} />);
    expect(html).toContain("Lifetime counters for content created");
    expect(html).toContain("These are not engagement events dated to this period");
    expect(html).toContain("Export top 50");
  });
  it("keeps consent separate and explains overlapping audience outcomes", () => {
    const html = renderToStaticMarkup(<MarketingAnalyticsWorkspace data={data} initialView="audience" goals={null} referencesUnavailable={false} />);
    expect(html).toContain("Email opt-in is separate from an enquiry");
    expect(html).toContain("No contacts captured in this period");
    expect(html).toContain("Audience segments");
  });
});
