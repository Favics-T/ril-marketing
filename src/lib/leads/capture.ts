/** Columns of an existing lead that a repeat form submission may fill. */
export const CAPTURE_FILLABLE_COLUMNS = "id, name, phone, organisation, interest, audience_segment_id, source_platform, source_content_asset_id, campaign_id, landing_page_id, registration_token";

export type CapturedLead = {
  name: string | null; phone: string | null; organisation: string | null; interest: string | null;
  audience_segment_id: string | null; source_platform: string | null; source_content_asset_id: string | null;
  campaign_id: string | null; landing_page_id: string | null; registration_token: string | null;
};

export type CaptureSubmission = {
  name: string; phone: string; organisation: string; interest: string;
  segmentId: string | null; platform: string | null; assetId: string | null;
  campaignId: string | null; landingPageId: string | null; registrationToken: string | null;
};

const isEmpty = (value: string | null | undefined) => value === null || value === undefined || value.trim() === "";

/**
 * What a repeat submission adds to an existing lead (REN-417): only fields the
 * lead doesn't have yet, so a visitor who knows someone's email can't change
 * their details. The original source (platform, content asset and token) is
 * kept together as the first touch, and is only filled when all of it is missing.
 */
export function fillEmptyLeadFields(existing: CapturedLead, submission: CaptureSubmission): Partial<CapturedLead> {
  const patch: Partial<CapturedLead> = {};
  const fill = <K extends keyof CapturedLead>(key: K, value: string | null) => {
    if (isEmpty(existing[key]) && !isEmpty(value)) patch[key] = value as CapturedLead[K];
  };
  fill("name", submission.name);
  fill("phone", submission.phone);
  fill("organisation", submission.organisation);
  fill("interest", submission.interest);
  fill("audience_segment_id", submission.segmentId);
  fill("campaign_id", submission.campaignId);
  fill("landing_page_id", submission.landingPageId);
  if (isEmpty(existing.source_platform) && isEmpty(existing.source_content_asset_id) && isEmpty(existing.registration_token)) {
    fill("source_platform", submission.platform);
    fill("source_content_asset_id", submission.assetId);
    fill("registration_token", submission.registrationToken);
  }
  return patch;
}
