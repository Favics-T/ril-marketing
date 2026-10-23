import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/actions/content", () => ({ transitionAsset: vi.fn() }));
import { AssetTransition } from "./asset-transition";
describe("current content status control", () => {
  it("starts at the actual status and requires a deliberate change before saving", () => {
    const html = renderToStaticMarkup(<AssetTransition assetId="asset" status="approved" />);
    expect(html).toContain("Approved · current");
    expect(html).toContain("Save status");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save status/);
    expect(html).not.toContain('name="scheduled_for"');
    expect(html).not.toContain("Apply transition");
  });
  it("keeps a terminal status visible without offering a spurious next action", () => {
    const html = renderToStaticMarkup(<AssetTransition assetId="asset" status="analysing" />);
    expect(html).toContain("Analysing · current");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save status/);
  });
});
