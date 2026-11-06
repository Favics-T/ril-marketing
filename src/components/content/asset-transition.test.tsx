import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/actions/content", () => ({ transitionAsset: vi.fn() }));
import { AssetTransition } from "./asset-transition";
describe("current content status control", () => {
  it("starts at the actual status and requires a deliberate change before saving", () => {
    const html = renderToStaticMarkup(<AssetTransition assetId="asset" status="approved" actorId="reviewer" actorRole="owner" />);
    expect(html).toContain("Approved · current");
    expect(html).toContain("Save status");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save status/);
    expect(html).not.toContain('name="scheduled_for"');
    expect(html).not.toContain("Apply transition");
  });
  it("keeps a terminal status visible without offering a spurious next action", () => {
    const html = renderToStaticMarkup(<AssetTransition assetId="asset" status="analysing" actorId="reviewer" actorRole="owner" />);
    expect(html).toContain("Analysing · current");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save status/);
  });
  it("explains self-approval before the author attempts to save", () => {
    const html = renderToStaticMarkup(<AssetTransition assetId="asset" status="review" actorId="author" actorRole="owner" authorId="author" />);
    expect(html).toContain("You created this content. Ask another reviewer to approve it.");
    expect(html).toMatch(/aria-describedby="[^"]+-restriction"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save status/);
  });
});
