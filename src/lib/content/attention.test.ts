import { describe, expect, it } from "vitest";
import {
  readablePublishError,
  selectNeedsAttention,
  type AttentionAsset,
  type FailedPublicationRow,
  type PublishedPublicationRow,
} from "@/lib/content/attention";

const ORG = "org-a";
const OTHER = "org-b";
const now = new Date("2026-11-04T09:00:00Z");
const PAST = "2026-11-03T08:00:00Z";
const FUTURE = "2026-11-10T08:00:00Z";

const asset = (id: string, overrides: Partial<AttentionAsset> = {}): AttentionAsset => ({
  id, organization_id: ORG, title: `Asset ${id}`, channel: "website", platform: null, format: "blog",
  status: "approved", scheduled_for: null, published_at: null, ...overrides,
});
const failure = (id: string, target: AttentionAsset, overrides: Partial<FailedPublicationRow> = {}): FailedPublicationRow => ({
  id, organization_id: target.organization_id, content_asset_id: target.id, channel: "wordpress", status: "failed",
  error: "WordPress request failed: Sorry, you are not allowed to create posts.", created_at: "2026-11-04T08:00:00Z", asset: target, ...overrides,
});
const published = (target: AttentionAsset, channel: string, created_at: string, organization_id = target.organization_id): PublishedPublicationRow => ({
  organization_id, content_asset_id: target.id, channel, created_at,
});
const select = (input: { failures?: FailedPublicationRow[]; published?: PublishedPublicationRow[]; overdue?: AttentionAsset[]; overdueCount?: number | null }, limit?: number) =>
  selectNeedsAttention({ failures: [], published: [], overdue: [], ...input }, { organizationId: ORG, now, limit });

describe("selectNeedsAttention (REN-421)", () => {
  it("lists a failed publish with its destination and a short reason", () => {
    const blog = asset("a1");
    const { items, total } = select({ failures: [failure("p1", blog)] });
    expect(total).toBe(1);
    expect(items).toEqual([expect.objectContaining({
      kind: "failed", assetId: "a1", title: "Asset a1", channel: "website", destination: "WordPress",
      at: "2026-11-04T08:00:00Z", dueAt: null, error: "WordPress request failed: Sorry, you are not allowed to create posts.",
    })]);
  });

  it("lists overdue posts of any content type, longest overdue first", () => {
    const newsletter = asset("n1", { channel: "email", format: "newsletter", status: "scheduled", scheduled_for: PAST });
    const social = asset("s1", { channel: "linkedin", format: "social post", status: "scheduled", scheduled_for: "2026-11-01T08:00:00Z" });
    const approvedBlog = asset("b1", { status: "approved", scheduled_for: "2026-11-02T08:00:00Z" });
    const { items } = select({ overdue: [newsletter, social, approvedBlog] });
    expect(items.map((item) => [item.kind, item.assetId])).toEqual([["overdue", "s1"], ["overdue", "b1"], ["overdue", "n1"]]);
    expect(items[0]).toMatchObject({ at: "2026-11-01T08:00:00Z", error: null, destination: null });
  });

  it("lists an asset that is failed and overdue once, as failed, keeping when it was due", () => {
    const late = asset("a1", { status: "scheduled", scheduled_for: PAST });
    const { items, total } = select({ failures: [failure("p1", late)], overdue: [late] });
    expect(total).toBe(1);
    expect(items).toEqual([expect.objectContaining({ kind: "failed", assetId: "a1", dueAt: PAST })]);
  });

  it("lists nothing when no publish failed and nothing is overdue", () => {
    const upcoming = asset("u1", { status: "scheduled", scheduled_for: FUTURE });
    const draft = asset("d1", { status: "editing", scheduled_for: PAST });
    const done = asset("x1", { status: "published", scheduled_for: PAST, published_at: PAST });
    expect(select({ overdue: [upcoming, draft, done] })).toEqual({ items: [], total: 0 });
  });

  it("leaves out another workspace's failures, overdue posts and publishes", () => {
    const theirs = asset("t1", { organization_id: OTHER, status: "scheduled", scheduled_for: PAST });
    const mine = asset("m1");
    const result = select({
      failures: [failure("p1", theirs), failure("p2", mine, { organization_id: OTHER }), failure("p3", { ...mine, id: "m2" }, { content_asset_id: "m2", asset: { ...mine, id: "m2", organization_id: OTHER } })],
      overdue: [theirs],
    });
    expect(result).toEqual({ items: [], total: 0 });
    // A successful publish recorded under another workspace doesn't clear this one's failure.
    const kept = select({ failures: [failure("p4", mine)], published: [published(mine, "wordpress", "2026-11-04T08:30:00Z", OTHER)] });
    expect(kept.items.map((item) => item.assetId)).toEqual(["m1"]);
  });

  it("keeps a WordPress failure when the same blog published on Strapi", () => {
    const blog = asset("a1", { status: "published", published_at: "2026-11-04T08:30:00Z" });
    const { items } = select({ failures: [failure("p1", blog)], published: [published(blog, "strapi", "2026-11-04T08:30:00Z")] });
    expect(items).toEqual([expect.objectContaining({ kind: "failed", assetId: "a1", destination: "WordPress" })]);
  });

  it("clears a failure once a later publish on the same channel succeeds", () => {
    const blog = asset("a1", { status: "published" });
    expect(select({ failures: [failure("p1", blog)], published: [published(blog, "WordPress", "2026-11-04T08:30:00Z")] }).items).toEqual([]);
    // An older success doesn't clear a newer failure.
    expect(select({ failures: [failure("p1", blog)], published: [published(blog, "wordpress", "2026-11-04T07:00:00Z")] }).items).toHaveLength(1);
  });

  it("treats each channel of an asset as its own failure, keeping the newest attempt", () => {
    const blog = asset("a1");
    const { items } = select({ failures: [
      failure("p1", blog, { created_at: "2026-11-04T08:00:00Z", error: "Second try" }),
      failure("p2", blog, { created_at: "2026-11-04T07:00:00Z", error: "First try" }),
      failure("p3", blog, { channel: "strapi", created_at: "2026-11-04T06:00:00Z", error: "Strapi request failed: HTTP 500" }),
    ] });
    expect(items.map((item) => [item.destination, item.error])).toEqual([["WordPress", "Second try"], ["Strapi", "Strapi request failed: HTTP 500"]]);
  });

  it("clears a failure when the asset goes back into drafting", () => {
    expect(select({ failures: [failure("p1", asset("a1", { status: "editing" }))] }).items).toEqual([]);
    expect(select({ failures: [failure("p1", asset("a1", { status: "review" }))] }).items).toEqual([]);
  });

  it("shows at most 10 rows, failed first, and counts everything", () => {
    const failures = Array.from({ length: 4 }, (_, i) => failure(`p${i}`, asset(`f${i}`), { created_at: `2026-11-04T0${i}:00:00Z` }));
    const overdue = Array.from({ length: 10 }, (_, i) => asset(`o${i}`, { status: "scheduled", scheduled_for: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z` }));
    const { items, total } = select({ failures, overdue });
    expect(total).toBe(14);
    expect(items).toHaveLength(10);
    expect(items.slice(0, 4).map((item) => item.kind)).toEqual(["failed", "failed", "failed", "failed"]);
    expect(items.slice(0, 4).map((item) => item.assetId)).toEqual(["f3", "f2", "f1", "f0"]);
    expect(items.slice(4).map((item) => item.assetId)).toEqual(["o0", "o1", "o2", "o3", "o4", "o5"]);
  });

  it("counts overdue posts the query didn't return", () => {
    const shown = asset("o1", { status: "scheduled", scheduled_for: PAST });
    expect(select({ overdue: [shown], overdueCount: 600 }).total).toBe(600);
  });
});

describe("readablePublishError", () => {
  it("keeps short readable messages", () => {
    expect(readablePublishError("Buffer is rate limiting this account. Try again shortly.")).toBe("Buffer is rate limiting this account. Try again shortly.");
  });
  it("collapses whitespace and cuts long messages to one line", () => {
    const long = `Strapi request failed:\n  ${"x".repeat(300)}`;
    const text = readablePublishError(long);
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text).toMatch(/^Strapi request failed: x+…$/);
  });
  it("replaces anything that looks like a raw response body", () => {
    expect(readablePublishError('{"code":"rest_cannot_create","message":"Sorry"}')).toBe("The destination returned an error.");
    expect(readablePublishError("<html><body>502 Bad Gateway</body></html>")).toBe("The destination returned an error.");
    expect(readablePublishError("Buffer rejected the request: <b>bad</b>")).toBe("The destination returned an error.");
  });
  it("falls back when there is no message", () => {
    expect(readablePublishError(null)).toBe("The publish attempt failed.");
    expect(readablePublishError("   ")).toBe("The publish attempt failed.");
  });
});
