"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { cleanLibraryFileName, libraryFiles, libraryFileProblem, libraryPathMatches, linkedActivityIds, LIBRARY_FILE_BUCKET, LIBRARY_FILE_COUNT, type LibraryFile } from "@/lib/content/library-files";

async function context(assetId: string) {
  const org = await requireOrganizationId();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in to attach content.");
  const { data: asset, error } = await client.from("content_assets").select("id,status,metadata,updated_at,source_activity_id").eq("organization_id", org).eq("id", z.uuid().parse(assetId)).maybeSingle();
  if (error || !asset) throw new Error("Content not found in this workspace.");
  return { org, client, asset };
}
function editable(status: string) {
  if (!["idea", "ai_generated", "editing"].includes(status)) throw new Error("Return this content to Editing before changing its files.");
}
function refresh(assetId: string, activities: string[] = []) {
  revalidatePath(`/library/${assetId}`); revalidatePath("/library"); revalidatePath("/repurpose");
  for (const id of activities) revalidatePath(`/activities/${id}`);
}
const failure = (error: unknown) => ({ ok: false as const, error: error instanceof z.ZodError ? "Choose a valid content item or file." : error instanceof Error ? error.message : "Could not save this attachment. Try again." });

export async function registerLibraryFile(assetId: string, path: string) {
  try {
    const { org, client, asset } = await context(assetId);
    editable(asset.status);
    if (!libraryPathMatches(path, org, assetId)) throw new Error("This file does not belong to this content item.");
    const files = libraryFiles(asset.metadata, org, assetId, true);
    if (files.some(file => file.path === path)) return { ok: true as const };
    if (files.length >= LIBRARY_FILE_COUNT) throw new Error(`Each content item supports up to ${LIBRARY_FILE_COUNT} files, including removed files.`);
    const { data: object, error: infoError } = await client.storage.from(LIBRARY_FILE_BUCKET).info(path);
    if (infoError || !object) throw new Error("The uploaded file could not be verified. Try attaching it again.");
    const mime = (object.contentType ?? object.metadata?.mimetype ?? "").split(";")[0].toLowerCase();
    const size = object.size ?? object.metadata?.size ?? 0;
    const name = cleanLibraryFileName(path.split("/").pop()!);
    const problem = libraryFileProblem({ type: mime, name, size });
    if (problem) throw new Error(problem);
    const file: LibraryFile = { id: path.split("/")[3], path, name, mime: mime as LibraryFile["mime"], size, createdAt: new Date().toISOString() };
    const { data: saved, error } = await client.from("content_assets").update({ metadata: { ...asset.metadata, library_files: [...files, file] } }).eq("organization_id", org).eq("id", assetId).eq("updated_at", asset.updated_at).in("status", ["idea", "ai_generated", "editing"]).select("id").maybeSingle();
    if (error || !saved) throw new Error("This content changed during the upload. Refresh before attaching the file again.");
    refresh(assetId, linkedActivityIds(asset.metadata));
    return { ok: true as const };
  } catch (error) { return failure(error); }
}

export async function setLibraryFileRemoved(assetId: string, fileId: string, removed: boolean) {
  try {
    const { org, client, asset } = await context(assetId);
    editable(asset.status);
    const files = libraryFiles(asset.metadata, org, assetId, true);
    if (!files.some(file => file.id === z.uuid().parse(fileId))) throw new Error("File not found on this content item.");
    const next = files.map(file => {
      if (file.id !== fileId) return file;
      const original = { ...file };
      delete original.removedAt;
      return removed ? { ...original, removedAt: new Date().toISOString() } : original;
    });
    const { data, error } = await client.from("content_assets").update({ metadata: { ...asset.metadata, library_files: next } }).eq("organization_id", org).eq("id", assetId).eq("updated_at", asset.updated_at).in("status", ["idea", "ai_generated", "editing"]).select("id").maybeSingle();
    if (error || !data) throw new Error("This content changed. Refresh and try again.");
    refresh(assetId, linkedActivityIds(asset.metadata));
    return { ok: true as const };
  } catch (error) { return failure(error); }
}

export async function setActivityLibraryLink(activityId: string, assetId: string, attached: boolean) {
  try {
    const { org, client, asset } = await context(assetId);
    const { data: activity, error: activityError } = await client.from("activities").select("id").eq("organization_id", org).eq("id", z.uuid().parse(activityId)).maybeSingle();
    if (activityError || !activity) throw new Error("Activity not found in this workspace.");
    if (asset.source_activity_id === activityId) throw new Error("This activity is the original source for this content. Its source link is kept for provenance.");
    const ids = linkedActivityIds(asset.metadata);
    const next = attached ? [...new Set([...ids, activityId])] : ids.filter(id => id !== activityId);
    if (next.length > 50) throw new Error("This content is already linked to 50 activities.");
    const { data, error } = await client.from("content_assets").update({ metadata: { ...asset.metadata, linked_activity_ids: next } }).eq("organization_id", org).eq("id", assetId).eq("updated_at", asset.updated_at).select("id").maybeSingle();
    if (error || !data) throw new Error("This content changed. Refresh and try again.");
    refresh(assetId, [activityId]);
    return { ok: true as const };
  } catch (error) { return failure(error); }
}

export async function findLibraryContent(query: string) {
  try {
    const org = await requireOrganizationId();
    const client = await createClient();
    let request = client.from("content_assets").select("id,title,status,channel,source_activity_id").eq("organization_id", org).order("created_at", { ascending: false }).limit(30);
    const title = z.string().trim().max(200).parse(query);
    if (title) request = request.ilike("title", `%${title.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error } = await request;
    if (error) throw new Error("Could not search the library. Try again.");
    return { ok: true as const, items: data ?? [] };
  } catch (error) { return { ...failure(error), items: [] }; }
}
