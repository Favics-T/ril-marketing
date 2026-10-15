import { z } from "zod";

export const IMAGE_PLATFORMS = ["linkedin", "instagram", "facebook", "x", "youtube", "tiktok"] as const;
export type ImagePlatform = (typeof IMAGE_PLATFORMS)[number];

export const MAX_HASHTAGS = 10;
const MAX_HASHTAG_LENGTH = 50;

/** Hashtag counts asked of the model; cleaning still caps every caption at MAX_HASHTAGS. */
const HASHTAG_COUNTS: Record<ImagePlatform, string> = {
  linkedin: "3-5", instagram: "5-10", facebook: "3-5", x: "0-2", youtube: "3-5", tiktok: "3-6",
};

/**
 * Turns whatever the model returned for hashtags into usable tags: adds the
 * "#", removes spaces and punctuation, drops tags that are empty, numeric or
 * too long, dedupes case-insensitively and caps the count. Never throws, so
 * bad hashtags can't fail the rest of the analysis.
 */
export function cleanHashtags(input: unknown): string[] {
  // One string means the model packed several tags together, so spaces split
  // it too; inside an array item, spaces are part of one tag ("#Pitch Day").
  const pieces = typeof input === "string"
    ? input.split(/[\s,;#]+/)
    : Array.isArray(input)
      ? input.filter((item): item is string => typeof item === "string").flatMap((item) => item.split(/[,;\n#]+/))
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const piece of pieces) {
    const body = piece.normalize("NFC").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!body || body.length > MAX_HASHTAG_LENGTH || /^\p{N}+$/u.test(body)) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(`#${body}`);
    if (tags.length === MAX_HASHTAGS) break;
  }
  return tags;
}

const platformSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const key = value.trim().toLowerCase();
  return key === "twitter" ? "x" : key;
}, z.enum(IMAGE_PLATFORMS));

export const imageAnalysisSchema = z.object({
  sceneSummary: z.string().trim().min(10).max(1600),
  altText: z.string().trim().min(5).max(500),
  qualityNotes: z.array(z.string().trim().min(2).max(300)).max(8).default([]),
  captions: z.array(z.object({
    platform: platformSchema,
    caption: z.string().trim().min(10).max(2000),
    hashtags: z.unknown().transform(cleanHashtags).default([]),
    rationale: z.string().trim().min(4).max(500),
  })).min(1).max(4).refine((items) => new Set(items.map((item) => item.platform)).size === items.length, "Caption platforms must be unique."),
});
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

/** Output rules for the image analysis prompt, with hashtag counts for the requested platforms. */
export function imageAnalysisInstructions(platforms: ImagePlatform[]): string {
  const counts = platforms.map((platform) => `${platform} ${HASHTAG_COUNTS[platform]}`).join(", ");
  return `Return only a JSON object with this shape: {"sceneSummary":"visual description, max 1600 characters","altText":"max 500 characters","qualityNotes":["possible visual concerns; empty array if none"],"captions":[{"platform":"one of ${platforms.join("|")}","caption":"caption text without hashtags","hashtags":["#OneWord","#CamelCaseTag"],"rationale":"brief content angle"}]}. Write one caption per requested platform.
Hashtag rules: "hashtags" is a JSON array with one tag per string. Every tag starts with a single "#" followed only by letters, digits or underscores: no spaces, hyphens, punctuation or emoji. Join several words in CamelCase (#PitchDay, not "Pitch Day"). No duplicates, and do not repeat the hashtags inside "caption". Hashtags per platform: ${counts}.`;
}

export const MAX_FAILED_RESPONSE_LENGTH = 2000;
const SECRET_PATTERNS = [
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

/**
 * A copy of a model response that failed parsing, safe to store for
 * diagnosis: anything shaped like an API key or token is redacted, then the
 * text is truncated.
 */
export function failedResponseSnapshot(text: string): string {
  const redacted = SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[redacted]"), text);
  return redacted.slice(0, MAX_FAILED_RESPONSE_LENGTH);
}

/** Parses and validates the model's image analysis text, with a readable error on failure. */
export function parseImageAnalysis(text: string): ImageAnalysis {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Media analysis did not return the required structured result.");
  let json: unknown;
  try { json = JSON.parse(text.slice(start, end + 1)); }
  catch (error) { throw new Error(`Could not validate the image analysis: ${error instanceof Error ? error.message : "invalid JSON."}`); }
  const parsed = imageAnalysisSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.map(String).join(".");
    throw new Error(`Could not validate the image analysis: ${path ? `${path}: ` : ""}${issue?.message ?? "invalid response."}`);
  }
  return parsed.data;
}
