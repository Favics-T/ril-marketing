import { formatDayTime } from "@/lib/format";

/** The activity's campaign as shown on its page, linking to its entry on the campaigns list. */
export function campaignFact(campaign: { id: string; name: string | null } | null | undefined): { value: string; href: string | null } {
  if (!campaign?.id) return { value: "No campaign", href: null };
  return {
    value: campaign.name?.trim() || "Untitled campaign",
    href: `/audience/campaigns#${campaignAnchor(campaign.id)}`,
  };
}

/** Element id of a campaign's entry on the campaigns list. */
export function campaignAnchor(campaignId: string): string {
  return `campaign-${campaignId}`;
}

/**
 * When the activity was last changed, in WAT. Falls back to created_at while
 * the updated_at migration isn't applied; the migration backfills it from
 * created_at, so the value shown doesn't change once it is.
 */
export function lastUpdatedLabel(activity: { updated_at?: string | null; created_at?: string | null }): string {
  return formatDayTime(activity.updated_at || activity.created_at);
}

/** Image types browsers can show inline. HEIC is accepted for upload but most browsers can't display it. */
const PREVIEWABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function isPreviewableImage(mimeType: string): boolean {
  return PREVIEWABLE_IMAGE_TYPES.has(mimeType.toLowerCase());
}
