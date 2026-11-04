import { calendarFlag } from "@/lib/content/calendar";
import { publicationDestination } from "@/lib/content/publications";

/**
 * "Needs attention" on the Command Centre (REN-421): failed publishes and
 * overdue posts, so nobody has to search for them. Pure — unit tested.
 *
 * Failed: an asset + channel pair whose newest attempt is a failed or missed
 * Publication, with no newer published Publication on that same channel. A
 * blog that went out on Strapi but failed on WordPress stays failed for
 * WordPress. It clears when a retry on that channel succeeds, or when the
 * asset goes back into drafting (idea through review).
 *
 * Overdue: an approved or scheduled asset whose scheduled time has passed,
 * any content type; the same rule the calendar uses (calendarFlag).
 *
 * An asset that is both is listed once per failed channel, marked failed.
 */

/** Asset statuses where a failed publish still needs someone to act. */
const FAILURE_VISIBLE_STATUSES = new Set(["approved", "scheduled", "published", "analysing"]);

/** Publication statuses that count as a failure. */
export const FAILED_PUBLICATION_STATUSES = ["failed", "missed"] as const;

export const NEEDS_ATTENTION_LIMIT = 10;

export interface AttentionAsset {
  id: string;
  organization_id: string;
  title: string;
  channel: string | null;
  platform: string | null;
  format: string | null;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
}

export interface FailedPublicationRow {
  id: string;
  organization_id: string;
  content_asset_id: string;
  channel: string;
  status: string;
  error: string | null;
  created_at: string;
  asset: AttentionAsset | null;
}

export interface PublishedPublicationRow {
  organization_id: string;
  content_asset_id: string;
  channel: string;
  created_at: string;
}

export interface AttentionItem {
  /** Stable React key: one per asset + channel for failures, one per asset for overdue. */
  key: string;
  kind: "failed" | "overdue";
  assetId: string;
  title: string;
  /** The asset's own platform or channel, e.g. "linkedin" or "website". */
  channel: string | null;
  /** Where the failed attempt went, e.g. "WordPress". Failures only. */
  destination: string | null;
  /** When it failed (failures) or was due (overdue). */
  at: string;
  /** The scheduled time when a failed item is also overdue. */
  dueAt: string | null;
  /** Short readable reason. Failures only. */
  error: string | null;
}

export interface NeedsAttention {
  /** Failed first (newest failure first), then overdue (longest overdue first), capped. */
  items: AttentionItem[];
  /** Everything that needs attention, before the cap. */
  total: number;
}

const FALLBACK_ERROR = "The publish attempt failed.";
const RAW_RESPONSE_ERROR = "The destination returned an error.";
const MAX_ERROR_LENGTH = 160;

/**
 * A one-line reason for the dashboard. Stored errors are already written for
 * people, but some carry the destination's own message; anything that looks
 * like a raw response body is replaced rather than shown.
 */
export function readablePublishError(error: string | null | undefined): string {
  const text = (error ?? "").replace(/\s+/g, " ").trim();
  if (!text) return FALLBACK_ERROR;
  if (/^[{[<]/.test(text) || /<\/?[a-z][^>]*>/i.test(text)) return RAW_RESPONSE_ERROR;
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1).trimEnd()}…` : text;
}

const pairKey = (assetId: string, channel: string) => `${assetId}:${channel.trim().toLowerCase()}`;

function isOverdue(asset: AttentionAsset, now: Date): boolean {
  return calendarFlag(asset, now) === "overdue";
}

export function selectNeedsAttention(
  input: {
    failures: FailedPublicationRow[];
    published: PublishedPublicationRow[];
    overdue: AttentionAsset[];
    /** Exact overdue count when the overdue list was capped by the query. */
    overdueCount?: number | null;
  },
  options: { organizationId: string; now?: Date; limit?: number }
): NeedsAttention {
  const { organizationId, now = new Date(), limit = NEEDS_ATTENTION_LIMIT } = options;

  // Newest successful publish per asset + channel.
  const latestPublished = new Map<string, string>();
  for (const row of input.published) {
    if (row.organization_id !== organizationId) continue;
    const key = pairKey(row.content_asset_id, row.channel);
    const current = latestPublished.get(key);
    if (!current || row.created_at > current) latestPublished.set(key, row.created_at);
  }

  // Newest failure per asset + channel, unless a later publish on that channel succeeded.
  const failedByPair = new Map<string, FailedPublicationRow>();
  for (const row of input.failures) {
    const asset = row.asset;
    if (row.organization_id !== organizationId || !asset || asset.organization_id !== organizationId) continue;
    if (!FAILURE_VISIBLE_STATUSES.has(asset.status)) continue;
    const key = pairKey(row.content_asset_id, row.channel);
    const current = failedByPair.get(key);
    if (current && current.created_at >= row.created_at) continue;
    failedByPair.set(key, row);
  }
  const failed: AttentionItem[] = [];
  for (const [key, row] of failedByPair) {
    const publishedAt = latestPublished.get(key);
    if (publishedAt && publishedAt > row.created_at) continue;
    const asset = row.asset!;
    failed.push({
      key: `failed:${key}`,
      kind: "failed",
      assetId: asset.id,
      title: asset.title,
      channel: asset.platform || asset.channel,
      destination: publicationDestination(row.channel),
      at: row.created_at,
      dueAt: isOverdue(asset, now) ? asset.scheduled_for : null,
      error: readablePublishError(row.error),
    });
  }
  failed.sort((a, b) => b.at.localeCompare(a.at));

  const failedAssets = new Set(failed.map((item) => item.assetId));
  const overdueAssets = input.overdue.filter((asset) => asset.organization_id === organizationId && isOverdue(asset, now));
  const overdue: AttentionItem[] = overdueAssets
    .filter((asset) => !failedAssets.has(asset.id))
    .map((asset) => ({
      key: `overdue:${asset.id}`,
      kind: "overdue" as const,
      assetId: asset.id,
      title: asset.title,
      channel: asset.platform || asset.channel,
      destination: null,
      at: asset.scheduled_for!,
      dueAt: asset.scheduled_for,
      error: null,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  // Overdue assets beyond what the query returned can't be checked against
  // the failures, so they count as overdue only.
  const unseenOverdue = Math.max(0, (input.overdueCount ?? input.overdue.length) - input.overdue.length);
  return {
    items: [...failed, ...overdue].slice(0, Math.max(0, limit)),
    total: failed.length + overdue.length + unseenOverdue,
  };
}
