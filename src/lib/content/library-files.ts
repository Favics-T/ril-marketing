import { z } from "zod";

export const LIBRARY_FILE_BUCKET = "ril-activity-media";
export const LIBRARY_FILE_LIMIT = 100 * 1024 * 1024;
export const LIBRARY_FILE_COUNT = 20;
export const LIBRARY_FILE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/heic",
  "video/mp4", "video/quicktime", "video/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
  "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown",
] as const;
export const LIBRARY_FILE_ACCEPT = [...LIBRARY_FILE_TYPES, ".md", ".txt", ".docx"].join(",");
const schema = z.object({
  id: z.uuid(), path: z.string().max(600), name: z.string().min(1).max(180),
  mime: z.enum(LIBRARY_FILE_TYPES), size: z.number().int().positive().max(LIBRARY_FILE_LIMIT),
  createdAt: z.string().datetime(), removedAt: z.string().datetime().optional(),
});
export type LibraryFile = z.infer<typeof schema>;
export type LibraryFileView = LibraryFile & { signedUrl: string | null };

export function cleanLibraryFileName(name: string) {
  return name.replace(/[\\/\u0000-\u001f]/g, "_").replace(/\.{2,}/g, "_").slice(0, 180) || "file";
}
export function libraryFileMime(file: { type: string; name: string }) {
  if (file.type) return file.type.split(";")[0].toLowerCase();
  return ({ md: "text/markdown", txt: "text/plain", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as Record<string, string>)[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}
export function libraryFileProblem(file: { type: string; name: string; size: number }) {
  if (!(LIBRARY_FILE_TYPES as readonly string[]).includes(libraryFileMime(file))) return "Choose an image, recording, PDF, Word, text or Markdown file.";
  if (file.size <= 0 || file.size > LIBRARY_FILE_LIMIT) return "Choose a non-empty file of 100 MB or smaller.";
  return null;
}
export function libraryPathMatches(path: string, org: string, asset: string) {
  const parts = path.split("/");
  return parts.length === 5 && parts[0] === org && parts[1] === "library" && parts[2] === asset && z.uuid().safeParse(parts[3]).success && parts[4] === cleanLibraryFileName(parts[4]) && !path.includes("..");
}
export function libraryFiles(metadata: Record<string, unknown> | null | undefined, org: string, asset: string, includeRemoved = false): LibraryFile[] {
  if (!Array.isArray(metadata?.library_files)) return [];
  return metadata.library_files.flatMap(value => {
    const result = schema.safeParse(value);
    return result.success && libraryPathMatches(result.data.path, org, asset) && result.data.id === result.data.path.split("/")[3] && (includeRemoved || !result.data.removedAt) ? [result.data] : [];
  });
}
export function linkedActivityIds(metadata: Record<string, unknown> | null | undefined): string[] {
  return Array.isArray(metadata?.linked_activity_ids) ? [...new Set(metadata.linked_activity_ids.filter((id): id is string => z.uuid().safeParse(id).success))] : [];
}
