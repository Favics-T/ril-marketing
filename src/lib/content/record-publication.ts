import "server-only";
import type { PublicationStatus } from "@/lib/content/publications";

export interface PublicationInsert {
  organization_id: string;
  content_asset_id: string;
  channel: string;
  status: PublicationStatus;
  external_id?: string | null;
  url?: string | null;
  published_at?: string | null;
  error?: string | null;
  actor_id?: string | null;
}

/** The slice of the Supabase client this needs, so tests can pass a fake. */
interface PublicationsClient {
  from(table: "publications"): {
    insert(row: PublicationInsert): {
      select(columns: "id"): {
        single<T>(): PromiseLike<{ data: T | null; error: { message: string } | null }>;
      };
    };
  };
}

export const PUBLICATION_NOT_RECORDED =
  "This attempt could not be added to the publish history. Tell an admin so the record can be fixed.";

/**
 * Record a publish attempt. Never throws: the publish itself already happened
 * (or failed) at the destination, so a failed insert is logged and returned as
 * a warning for the caller to show, instead of passing silently.
 */
export async function recordPublication(
  client: PublicationsClient,
  row: PublicationInsert
): Promise<{ id: string | null; warning?: string }> {
  try {
    const { data, error } = await client.from("publications").insert(row).select("id").single<{ id: string }>();
    if (!error && data?.id) return { id: data.id };
    console.error(`[publications] insert failed for asset ${row.content_asset_id} (${row.channel}, ${row.status}): ${error?.message ?? "no row returned"}`);
  } catch (err) {
    console.error(`[publications] insert threw for asset ${row.content_asset_id} (${row.channel}, ${row.status}): ${err instanceof Error ? err.message : String(err)}`);
  }
  return { id: null, warning: PUBLICATION_NOT_RECORDED };
}

/** Join optional warnings into one message, or undefined when there are none. */
export function joinWarnings(...warnings: Array<string | undefined>): string | undefined {
  const present = warnings.filter((w): w is string => Boolean(w));
  return present.length ? present.join(" ") : undefined;
}
