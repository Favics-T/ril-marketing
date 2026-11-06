"use client";

import { createClient } from "@/lib/supabase/client";
import { registerLibraryFile } from "@/actions/library-attachments";
import { cleanLibraryFileName, libraryFileMime, libraryFileProblem, LIBRARY_FILE_BUCKET } from "./library-files";

export type QueuedLibraryFile = { id: string; file: File; path?: string };
export async function uploadLibraryFile(org: string, assetId: string, item: QueuedLibraryFile): Promise<{ ok: boolean; path?: string; error?: string }> {
  let path = item.path;
  try {
    const problem = libraryFileProblem(item.file);
    if (problem) return { ok: false, error: problem };
    if (!path) {
      path = `${org}/library/${assetId}/${item.id}/${cleanLibraryFileName(item.file.name)}`;
      const { error } = await createClient().storage.from(LIBRARY_FILE_BUCKET).upload(path, item.file, { contentType: libraryFileMime(item.file), upsert: false });
      if (error) return { ok: false, error: "Upload failed. Check your connection and try again." };
    }
    const result = await registerLibraryFile(assetId, path);
    return { ...result, path };
  } catch { return { ok: false, path, error: "Could not finish attaching this file. Try again; your draft is saved." }; }
}
