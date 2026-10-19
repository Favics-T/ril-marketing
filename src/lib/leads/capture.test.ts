import { describe, expect, it } from "vitest";
import { fillEmptyLeadFields, type CapturedLead, type CaptureSubmission } from "@/lib/leads/capture";

const emptyLead: CapturedLead = {
  name: null, phone: null, organisation: null, interest: null, audience_segment_id: null,
  source_platform: null, source_content_asset_id: null, campaign_id: null, landing_page_id: null, registration_token: null,
};
const submission: CaptureSubmission = {
  name: "Ada", phone: "+234 801 234 5678", organisation: "RIL", interest: "Founders",
  segmentId: "segment", platform: "linkedin", assetId: "asset", campaignId: "campaign", landingPageId: "page", registrationToken: "ril_abcDEF123456",
};

describe("fillEmptyLeadFields", () => {
  it("fills every field of a lead that has none", () => {
    expect(fillEmptyLeadFields(emptyLead, submission)).toEqual({
      name: "Ada", phone: "+234 801 234 5678", organisation: "RIL", interest: "Founders",
      audience_segment_id: "segment", campaign_id: "campaign", landing_page_id: "page",
      source_platform: "linkedin", source_content_asset_id: "asset", registration_token: "ril_abcDEF123456",
    });
  });

  it("never overwrites a field the lead already has", () => {
    const lead = { ...emptyLead, name: "Ada Lovelace", campaign_id: "first-campaign" };
    const patch = fillEmptyLeadFields(lead, submission);
    expect(patch).not.toHaveProperty("name");
    expect(patch).not.toHaveProperty("campaign_id");
    expect(patch.phone).toBe("+234 801 234 5678");
  });

  it("treats blank strings on the lead as empty", () => {
    expect(fillEmptyLeadFields({ ...emptyLead, phone: "  " }, submission).phone).toBe("+234 801 234 5678");
  });

  it("does not fill with blank submitted values", () => {
    const blank: CaptureSubmission = { ...submission, name: "", phone: "", organisation: "", interest: "", registrationToken: null, assetId: null, platform: null };
    expect(fillEmptyLeadFields(emptyLead, blank)).toEqual({ audience_segment_id: "segment", campaign_id: "campaign", landing_page_id: "page" });
  });

  it("keeps the first-touch source together", () => {
    for (const existing of [{ source_platform: "instagram" }, { source_content_asset_id: "old-asset" }, { registration_token: "ril_oldTOKEN12345" }]) {
      const patch = fillEmptyLeadFields({ ...emptyLead, ...existing }, submission);
      expect(patch).not.toHaveProperty("source_platform");
      expect(patch).not.toHaveProperty("source_content_asset_id");
      expect(patch).not.toHaveProperty("registration_token");
    }
  });

  it("returns nothing when the lead is complete", () => {
    const full: CapturedLead = {
      name: "a", phone: "b", organisation: "c", interest: "d", audience_segment_id: "e",
      source_platform: "f", source_content_asset_id: "g", campaign_id: "h", landing_page_id: "i", registration_token: "j",
    };
    expect(fillEmptyLeadFields(full, submission)).toEqual({});
  });
});
