import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NeedsAttentionPanel } from "./needs-attention";

describe("Command Centre attention panel", () => {
  it("distinguishes a failed query from an empty queue", () => {
    const unavailable = renderToStaticMarkup(<NeedsAttentionPanel attention={null} />);
    expect(unavailable).toContain('role="alert"');
    expect(unavailable).toContain("Refresh to retry");
    expect(unavailable).not.toContain("Nothing needs attention");

    const empty = renderToStaticMarkup(<NeedsAttentionPanel attention={{ total: 0, items: [] }} />);
    expect(empty).toContain("Nothing needs attention");
    expect(empty).not.toContain('role="alert"');
  });

  it("links failures to their content while preserving destination and channel identity", () => {
    const html = renderToStaticMarkup(<NeedsAttentionPanel attention={{ total: 2, items: [{
      key: "failed:asset-1:buffer", kind: "failed", assetId: "asset-1", title: "Programme launch",
      channel: "linkedin", destination: "Buffer", at: "2026-11-04T08:00:00Z", dueAt: null,
      error: "Reconnect the publishing account.",
    }] }} />);
    expect(html).toContain('href="/library/asset-1"');
    expect(html).toContain("Programme launch");
    expect(html).toContain("on Buffer");
    expect(html).toContain("Reconnect the publishing account.");
    expect(html).toContain("LinkedIn");
    expect(html).toContain('href="/calendar"');
  });
});
