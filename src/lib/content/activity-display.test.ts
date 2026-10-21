import { afterAll, describe, expect, it } from "vitest";
import { campaignAnchor, campaignFact, isPreviewableImage, lastUpdatedLabel } from "@/lib/content/activity-display";

const CAMPAIGN_ID = "41600000-0000-4000-8000-0000000000d1";

describe("campaignFact", () => {
  it("shows the campaign name, linking to its entry on the campaigns list", () => {
    expect(campaignFact({ id: CAMPAIGN_ID, name: "Founders Week" })).toEqual({
      value: "Founders Week",
      href: `/audience/campaigns#campaign-${CAMPAIGN_ID}`,
    });
  });

  it("links to the same id the campaigns list puts on each entry", () => {
    expect(campaignFact({ id: CAMPAIGN_ID, name: "Founders Week" }).href).toBe(`/audience/campaigns#${campaignAnchor(CAMPAIGN_ID)}`);
  });

  it('shows "No campaign" without a link when there is none', () => {
    expect(campaignFact(null)).toEqual({ value: "No campaign", href: null });
    expect(campaignFact(undefined)).toEqual({ value: "No campaign", href: null });
  });

  it("still links when the name is blank", () => {
    expect(campaignFact({ id: CAMPAIGN_ID, name: "  " })).toEqual({ value: "Untitled campaign", href: `/audience/campaigns#campaign-${CAMPAIGN_ID}` });
    expect(campaignFact({ id: CAMPAIGN_ID, name: null }).value).toBe("Untitled campaign");
  });
});

describe("lastUpdatedLabel", () => {
  const originalTz = process.env.TZ;
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(["UTC", "America/New_York", "Asia/Tokyo"])("shows updated_at in WAT when the server runs in %s", (zone) => {
    process.env.TZ = zone;
    expect(lastUpdatedLabel({ updated_at: "2026-10-12T08:05:00Z", created_at: "2026-10-01T10:00:00Z" })).toBe("12 Oct 2026, 09:05 WAT");
  });

  it("uses the WAT date when the UTC date is a day behind", () => {
    expect(lastUpdatedLabel({ updated_at: "2026-10-11T23:30:00Z" })).toBe("12 Oct 2026, 00:30 WAT");
  });

  it("falls back to created_at before the updated_at migration is applied", () => {
    expect(lastUpdatedLabel({ created_at: "2026-10-01T10:00:00Z" })).toBe("1 Oct 2026, 11:00 WAT");
    expect(lastUpdatedLabel({ updated_at: null, created_at: "2026-10-01T10:00:00Z" })).toBe("1 Oct 2026, 11:00 WAT");
  });

  it('shows "—" when there is no usable time', () => {
    expect(lastUpdatedLabel({})).toBe("—");
    expect(lastUpdatedLabel({ updated_at: "not a date" })).toBe("—");
  });
});

describe("isPreviewableImage", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/avif", "IMAGE/PNG"])("previews %s", (type) => {
    expect(isPreviewableImage(type)).toBe(true);
  });

  it.each(["image/heic", "image/svg+xml", "video/mp4", "audio/mpeg", "application/pdf", "text/plain", ""])("keeps %s as a link", (type) => {
    expect(isPreviewableImage(type)).toBe(false);
  });
});
