import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentMixChart, KpiProgressChart } from "./dashboard-charts";
import type { KpiProgress } from "@/lib/audience/kpis";

describe("dashboard library charts", () => {
  it("keeps long channel lists grouped without losing their counts", () => {
    const html = renderToStaticMarkup(<ContentMixChart channels={[{ channel: "x", count: 9 }, { channel: "website", count: 6 }, { channel: "linkedin", count: 3 }, { channel: "email", count: 2 }, { channel: "youtube", count: 1 }]} total={21} />);
    expect(html).toContain("Content mix, 21 assets:");
    expect(html).toContain("Other: 6 assets.");
    expect(html).toContain("X: 9 assets.");
    expect(html).toContain("Website: 6 assets.");
  });
  it("labels incomplete channel coverage as sampled", () => {
    expect(renderToStaticMarkup(<ContentMixChart channels={[{ channel: "website", count: 2 }]} total={9} />)).toContain("2 sampled assets of 9");
  });
  it("shows useful empty guidance instead of a fabricated chart", () => {
    const html = renderToStaticMarkup(<ContentMixChart channels={[]} total={0} />);
    expect(html).toContain("Add content to see how it is distributed");
    expect(html).not.toContain("data-chart=");
  });
  it("never turns a missing goal measurement into zero progress", () => {
    const goal = { id: "goal-1", name: "Registrations", target_value: 10, unit: "people", current: null, fraction: null } as KpiProgress;
    const html = renderToStaticMarkup(<KpiProgressChart kpis={[goal]} />);
    expect(html).toContain("Not measured");
    expect(html).toContain("Awaiting measurement");
    expect(html).not.toContain('role="progressbar"');
  });
});
