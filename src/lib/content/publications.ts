/** Publication rows (§7 Publication): one per publish attempt on an asset. */

export type PublicationStatus = "queued" | "published" | "failed";

export interface PublicationRow {
  id: string;
  content_asset_id: string;
  channel: string;
  external_id: string | null;
  url: string | null;
  status: PublicationStatus;
  scheduled_for: string | null;
  published_at: string | null;
  error: string | null;
  actor_id: string | null;
  created_at: string;
}

const DESTINATIONS: Record<string, string> = {
  wordpress: "WordPress",
  strapi: "Strapi",
  buffer: "Buffer",
};

/** Human name for the destination a publication went to. */
export function publicationDestination(channel: string): string {
  return DESTINATIONS[channel.toLowerCase()] ?? channel.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** When the attempt happened: the publish time if it went out, otherwise when it was recorded. */
export function publicationTime(row: Pick<PublicationRow, "published_at" | "created_at">): string {
  return row.published_at ?? row.created_at;
}

/** Only link to http(s) URLs returned by a destination; anything else is dropped. */
export function safePublicationUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
