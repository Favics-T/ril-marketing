import "server-only";
import { createClient } from "@/lib/supabase/server";
import { libraryFiles, LIBRARY_FILE_BUCKET, type LibraryFileView } from "./library-files";

export async function signedLibraryFiles(org: string, assetId: string, metadata: Record<string, unknown>): Promise<LibraryFileView[]> {
  const files = libraryFiles(metadata, org, assetId, true);
  const active = files.filter(file => !file.removedAt);
  if (!active.length) return files.map(file => ({ ...file, signedUrl: null }));
  const client = await createClient();
  const { data } = await client.storage.from(LIBRARY_FILE_BUCKET).createSignedUrls(active.map(file => file.path), 3600);
  const urls = new Map(active.map((file, index) => [file.id, data?.[index]?.signedUrl ?? null]));
  return files.map(file => ({ ...file, signedUrl: urls.get(file.id) ?? null }));
}

export async function activityLibraryItems(org: string, activityId: string) {
  const client = await createClient();
  const columns = "id,title,status,channel,source_activity_id";
  const [original, linked, recent] = await Promise.all([
    client.from("content_assets").select(columns).eq("organization_id", org).eq("source_activity_id", activityId).order("created_at", { ascending: false }).limit(200),
    client.from("content_assets").select(columns).eq("organization_id", org).contains("metadata", { linked_activity_ids: [activityId] }).order("created_at", { ascending: false }).limit(200),
    client.from("content_assets").select(columns).eq("organization_id", org).order("created_at", { ascending: false }).limit(30),
  ]);
  if (original.error || linked.error || recent.error) throw new Error("Could not load linked library content. Refresh to try again.");
  return { linked: [...new Map([...(original.data ?? []), ...(linked.data ?? [])].map(item => [item.id, item])).values()], recent: recent.data ?? [] };
}
