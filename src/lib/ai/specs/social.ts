import { z } from "zod";
import type { ContentLength, DraftSpec, GenerationContext, SocialPlatform } from "@/lib/ai/types";
import {
  NOTES_SHAPE,
  draftMetadata,
  lengthFlag,
  normalizeHashtags,
  notesFields,
  rangeFlag,
  unverifiedUrlFlags,
  wordCount,
  xLength,
  type GenerationSpec,
  type QualityFlag,
  type ResolvedOptions,
} from "@/lib/ai/specs/shared";

/** Platform hard limits (characters) used for pre-approval flags (PRD §13). */
export const PLATFORM_LIMITS = {
  linkedin: 3000,
  instagram: 2200,
  instagramHashtags: 30,
  x: 280,
  youtubeTitle: 100,
  youtubeDescription: 5000,
  youtubeTags: 500,
  facebook: 63206,
  tiktokCaption: 4000,
} as const;

export const LINKEDIN_WORDS: Record<ContentLength, { min: number; max: number }> = {
  short: { min: 100, max: 150 },
  standard: { min: 150, max: 300 },
  long: { min: 300, max: 450 },
};
export const INSTAGRAM_WORDS: Record<ContentLength, { min: number; max: number }> = {
  short: { min: 60, max: 100 },
  standard: { min: 100, max: 200 },
  long: { min: 200, max: 300 },
};
export const YOUTUBE_WORDS: Record<ContentLength, { min: number; max: number }> = {
  short: { min: 100, max: 150 },
  standard: { min: 150, max: 250 },
  long: { min: 250, max: 400 },
};

const SOCIAL_BASE = `Write ONE complete, ready-to-post draft for {platform} (PRD 6.8). It must read as native to {platform} — not a resized version of a post written for another network. Develop the source: a specific detail, why it matters to {audience}, and a clear takeaway. Call to action built around: "{cta}".`;

function base(platform: string, opts: ResolvedOptions): string {
  return SOCIAL_BASE.replace(/\{platform\}/g, platform).replace("{audience}", opts.audience).replace("{cta}", opts.cta);
}

function socialDraft(
  key: string,
  platform: SocialPlatform,
  fields: Pick<DraftSpec, "title" | "body" | "topic" | "hook" | "cta">,
  value: { interpretationNotes: string[]; missingInformation: string[] },
  ctx: GenerationContext,
  opts: ResolvedOptions,
  flags: QualityFlag[]
): DraftSpec {
  return {
    kind: "social",
    channel: platform,
    platform,
    format: "social post",
    ...fields,
    metadata: draftMetadata({ key, kind: "social_pack", platform }, opts, ctx, value, value, [
      ...flags,
      ...unverifiedUrlFlags(fields.body, ctx),
    ]),
  };
}

// ---------------------------------------------------------------- LinkedIn
const linkedinSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().min(5).max(300),
  post: z.string().trim().min(80).max(5000),
  takeaway: z.string().trim().min(5).max(500),
  cta: z.string().trim().min(2).max(300),
  hashtags: z.array(z.string()).max(10).default([]),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});
export type LinkedinDraft = z.infer<typeof linkedinSchema>;

export const linkedinSpec: GenerationSpec<LinkedinDraft> = {
  key: "social:linkedin",
  label: "LinkedIn post",
  kind: "social_pack",
  platform: "linkedin",
  instructions(opts) {
    const words = LINKEDIN_WORDS[opts.length];
    return `${base("LinkedIn", opts)}
Format: a thought-leadership post of ${words.min}–${words.max} words in "post".
- The first line is the hook: specific and curiosity-earning, under 150 characters, because LinkedIn truncates after it.
- Short paragraphs of 1–3 sentences separated by blank lines. No walls of text, no emoji bullets in every line.
- Build to a clear takeaway (also returned in "takeaway"), then the CTA as the final line.
- "hashtags": 3–5 relevant hashtags, returned separately — not inside "post".`;
  },
  shape: `{
  "title": "internal title for the asset",
  "hook": "the first line of the post",
  "post": "the full post text, starting with the hook, ending with the CTA",
  "takeaway": "the one idea readers should leave with",
  "cta": "string",
  "hashtags": ["3-5 hashtags"],
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Strong LinkedIn opening (fictional "Lagos Solar Hack" — do not reuse its facts or wording):
"The best idea at our hackathon wasn't the flashiest one.

It was a fridge that sends a text.

Here's why the judges couldn't stop talking about it 👇"`,
  schema: linkedinSchema,
  maxTokens: () => 3000,
  timeoutMs: 90_000,
  build(value, ctx, opts) {
    const hashtags = normalizeHashtags(value.hashtags);
    const body = hashtags.length ? `${value.post}\n\n${hashtags.join(" ")}` : value.post;
    const flags = [
      ...lengthFlag("LinkedIn post", wordCount(value.post), LINKEDIN_WORDS[opts.length].min, "words"),
      ...(body.length > PLATFORM_LIMITS.linkedin
        ? [{ code: "over_platform_limit" as const, message: `LinkedIn post is ${body.length} characters; the limit is ${PLATFORM_LIMITS.linkedin}.` }]
        : []),
      ...rangeFlag("LinkedIn hashtags", hashtags.length, 3, 5),
    ];
    return {
      warnings: [],
      drafts: [socialDraft(linkedinSpec.key, "linkedin", { title: value.title, body, topic: value.topic, hook: value.hook, cta: value.cta }, value, ctx, opts, flags)],
    };
  },
};

// ---------------------------------------------------------------- Instagram
const instagramSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().min(5).max(300),
  caption: z.string().trim().min(60).max(4000),
  cta: z.string().trim().min(2).max(300),
  hashtags: z.array(z.string()).max(40).default([]),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});
export type InstagramDraft = z.infer<typeof instagramSchema>;

export const instagramSpec: GenerationSpec<InstagramDraft> = {
  key: "social:instagram",
  label: "Instagram caption",
  kind: "social_pack",
  platform: "instagram",
  instructions(opts) {
    const words = INSTAGRAM_WORDS[opts.length];
    return `${base("Instagram", opts)}
Format: a caption of ${words.min}–${words.max} words in "caption".
- The first line is the hook (Instagram shows ~125 characters before "more"). Make it stop the scroll.
- Use line breaks between short beats; a few well-placed emoji are fine, not one per line.
- Warm, visual and human — write as if describing the moment the photo or reel captures.
- End with the CTA. "hashtags": 5–10 relevant hashtags returned separately, not inside "caption".`;
  },
  shape: `{
  "title": "internal title for the asset",
  "hook": "the caption's first line",
  "caption": "the full caption text, starting with the hook, ending with the CTA",
  "cta": "string",
  "hashtags": ["5-10 hashtags"],
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Strong Instagram opening (fictional "Lagos Solar Hack" — do not reuse its facts or wording):
"48 hours. 12 teams. 1 fridge that refuses to let a vaccine go to waste. ❄️

Swipe to meet the team who built it…"`,
  schema: instagramSchema,
  maxTokens: () => 2500,
  timeoutMs: 90_000,
  build(value, ctx, opts) {
    const hashtags = normalizeHashtags(value.hashtags);
    const body = hashtags.length ? `${value.caption}\n\n${hashtags.join(" ")}` : value.caption;
    const flags = [
      ...lengthFlag("Instagram caption", wordCount(value.caption), INSTAGRAM_WORDS[opts.length].min, "words"),
      ...(body.length > PLATFORM_LIMITS.instagram
        ? [{ code: "over_platform_limit" as const, message: `Instagram caption is ${body.length} characters; the limit is ${PLATFORM_LIMITS.instagram}.` }]
        : []),
      ...(hashtags.length > PLATFORM_LIMITS.instagramHashtags
        ? [{ code: "over_platform_limit" as const, message: `Instagram allows ${PLATFORM_LIMITS.instagramHashtags} hashtags; this has ${hashtags.length}.` }]
        : rangeFlag("Instagram hashtags", hashtags.length, 5, 10)),
    ];
    return {
      warnings: [],
      drafts: [socialDraft(instagramSpec.key, "instagram", { title: value.title, body, topic: value.topic, hook: value.hook, cta: value.cta }, value, ctx, opts, flags)],
    };
  },
};

// ---------------------------------------------------------------- X
const xSchema = z.object({
  title: z.string().trim().min(1).max(200),
  post: z.string().trim().min(20).max(1000),
  thread: z.array(z.string().trim().min(5).max(1000)).max(8).default([]),
  cta: z.string().trim().max(300).nullable().default(null),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});
export type XDraft = z.infer<typeof xSchema>;

export function xQuality(value: XDraft): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const postLength = xLength(value.post);
  if (postLength > PLATFORM_LIMITS.x) {
    flags.push({ code: "over_platform_limit", message: `X post is ${postLength} characters; the limit is ${PLATFORM_LIMITS.x}.` });
  }
  value.thread.forEach((item, index) => {
    const length = xLength(item);
    if (length > PLATFORM_LIMITS.x) {
      flags.push({ code: "over_platform_limit", message: `Thread post ${index + 1} is ${length} characters; the limit is ${PLATFORM_LIMITS.x}.` });
    }
  });
  if (value.thread.length > 0) flags.push(...rangeFlag("Thread posts", value.thread.length, 4, 6));
  return flags;
}

export const xSpec: GenerationSpec<XDraft> = {
  key: "social:x",
  label: "X post",
  kind: "social_pack",
  platform: "x",
  instructions(opts) {
    return `${base("X", opts)}
Format:
- "post": a standalone post of at most 280 characters (links count as 23). Punchy, one idea, specific detail, 0–2 hashtags inside the text.
- "thread": an optional thread of 4–6 posts (each ≤ 280 characters) that goes deeper — only if the source has enough substance; otherwise return []. The first thread post may repeat the main post's idea in a new way; number them "1/", "2/"… inside the text.`;
  },
  shape: `{
  "title": "internal title for the asset",
  "post": "single post, <= 280 characters",
  "thread": ["4-6 posts, each <= 280 characters, or empty"],
  "cta": "string or null",
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Strong X post (fictional "Lagos Solar Hack" — do not reuse its facts or wording):
"The winning hack this weekend wasn't an app. It was a fridge that texts a nurse when a vaccine gets warm. Simple beats shiny. 🧊📱"`,
  schema: xSchema,
  maxTokens: () => 2500,
  timeoutMs: 90_000,
  build(value, ctx, opts) {
    const body = value.thread.length
      ? `${value.post}\n\n— Optional thread (post each separately) —\n\n${value.thread.join("\n\n")}`
      : value.post;
    return {
      warnings: [],
      drafts: [
        socialDraft(xSpec.key, "x", { title: value.title, body, topic: value.topic, hook: value.post.split("\n")[0].slice(0, 300), cta: value.cta }, value, ctx, opts, xQuality(value)),
      ],
    };
  },
};

// ---------------------------------------------------------------- YouTube
const youtubeSchema = z.object({
  videoTitle: z.string().trim().min(5).max(200),
  description: z.string().trim().min(80).max(8000),
  chapters: z.array(z.object({ time: z.string().trim().min(3).max(12), label: z.string().trim().min(2).max(120) })).max(30).default([]),
  tags: z.array(z.string().trim().min(1).max(100)).max(40).default([]),
  cta: z.string().trim().min(2).max(300),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});
export type YoutubeDraft = z.infer<typeof youtubeSchema>;

export const youtubeSpec: GenerationSpec<YoutubeDraft> = {
  key: "social:youtube",
  label: "YouTube metadata",
  kind: "social_pack",
  platform: "youtube",
  instructions(opts) {
    const words = YOUTUBE_WORDS[opts.length];
    return `${base("YouTube", opts)}
Format (title, description, chapters and tags for a video about this activity):
- "videoTitle": ≤ 100 characters (aim for ~60), specific and searchable, no clickbait.
- "description": ${words.min}–${words.max} words. The first two lines summarise the video and its value (they show above "more"); then what viewers will learn, who appears (only as named in the source), and the CTA. Plain text, no Markdown headings.
- "chapters": ${opts.hasTimestamps ? 'use ONLY timestamps that appear in the source material, as "MM:SS" or "HH:MM:SS", first chapter at 00:00, at least 3 chapters.' : "the source has no timestamps, so return [] — never guess times."}
- "tags": 8–15 search tags grounded in the source.`;
  },
  shape: `{
  "videoTitle": "string, <= 100 characters",
  "description": "plain-text description",
  "chapters": [{ "time": "00:00", "label": "string" }],
  "tags": ["8-15 tags"],
  "cta": "string",
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Strong YouTube description opening (fictional "Lagos Solar Hack" — do not reuse its facts or wording):
"Twelve teams had 48 hours to keep vaccines cold without the grid. Here's how the winners did it — and what it means for clinics across Northern Nigeria."`,
  schema: youtubeSchema,
  maxTokens: () => 3500,
  timeoutMs: 90_000,
  build(value, ctx, opts) {
    const flags: QualityFlag[] = [
      ...lengthFlag("YouTube description", wordCount(value.description), YOUTUBE_WORDS[opts.length].min, "words"),
      ...(value.videoTitle.length > PLATFORM_LIMITS.youtubeTitle
        ? [{ code: "over_platform_limit" as const, message: `YouTube title is ${value.videoTitle.length} characters; the limit is ${PLATFORM_LIMITS.youtubeTitle}.` }]
        : []),
      ...(value.tags.join(",").length > PLATFORM_LIMITS.youtubeTags
        ? [{ code: "over_platform_limit" as const, message: `YouTube tags total ${value.tags.join(",").length} characters; the limit is ${PLATFORM_LIMITS.youtubeTags}.` }]
        : []),
    ];
    let chapters = value.chapters;
    if (!opts.hasTimestamps && chapters.length) {
      chapters = [];
      flags.push({ code: "timestamps_unavailable", message: "Removed chapters: the source has no timestamps, so chapter times would be guesses." });
    } else if (chapters.length && (chapters.length < 3 || !/^0{1,2}:?0{2}(:00)?$/.test(chapters[0].time))) {
      flags.push({ code: "off_spec", message: "YouTube chapters need at least 3 entries starting at 00:00." });
    }
    const sections = [value.description];
    if (chapters.length) sections.push(`Chapters:\n${chapters.map((c) => `${c.time} ${c.label}`).join("\n")}`);
    if (value.tags.length) sections.push(`Tags: ${value.tags.join(", ")}`);
    const body = sections.join("\n\n");
    if (value.description.length > PLATFORM_LIMITS.youtubeDescription) {
      flags.push({ code: "over_platform_limit", message: `YouTube description is ${value.description.length} characters; the limit is ${PLATFORM_LIMITS.youtubeDescription}.` });
    }
    return {
      warnings: [],
      drafts: [
        socialDraft(youtubeSpec.key, "youtube", { title: value.videoTitle, body, topic: value.topic, hook: value.description.split("\n")[0].slice(0, 300), cta: value.cta }, { ...value, chapters } as YoutubeDraft, ctx, opts, flags),
      ],
    };
  },
};

// ---------------------------------------------------------------- TikTok
const tiktokSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().min(5).max(300),
  caption: z.string().trim().min(10).max(2200),
  onScreenText: z.array(z.string().trim().min(1).max(150)).min(1).max(10),
  cta: z.string().trim().min(2).max(300),
  hashtags: z.array(z.string()).max(10).default([]),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});
export type TiktokDraft = z.infer<typeof tiktokSchema>;

export const tiktokSpec: GenerationSpec<TiktokDraft> = {
  key: "social:tiktok",
  label: "TikTok post",
  kind: "social_pack",
  platform: "tiktok",
  instructions(opts) {
    return `${base("TikTok", opts)}
Format (for a short vertical video about this activity):
- "hook": the spoken or on-screen line for the first 2 seconds — it must earn the next 10 seconds.
- "caption": 1–3 short sentences (≤ 300 characters) that add context, conversational and playful, ending with the CTA.
- "onScreenText": 3–6 short text overlays in viewing order (≤ 8 words each) that tell the story beat by beat.
- "hashtags": 3–6, returned separately.`;
  },
  shape: `{
  "title": "internal title for the asset",
  "hook": "first-2-seconds line",
  "caption": "string",
  "onScreenText": ["3-6 overlays"],
  "cta": "string",
  "hashtags": ["3-6 hashtags"],
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Strong TikTok hook and overlays (fictional "Lagos Solar Hack" — do not reuse its facts or wording):
hook: "POV: your vaccine fridge just texted you 📱"
onScreenText: ["48 hours, no grid", "12 teams", "1 very smart fridge"]`,
  schema: tiktokSchema,
  maxTokens: () => 2000,
  timeoutMs: 90_000,
  build(value, ctx, opts) {
    const hashtags = normalizeHashtags(value.hashtags);
    const body = [
      `Hook (first 2 seconds): ${value.hook}`,
      `Caption:\n${value.caption}${hashtags.length ? `\n\n${hashtags.join(" ")}` : ""}`,
      `On-screen text:\n${value.onScreenText.map((line) => `- ${line}`).join("\n")}`,
    ].join("\n\n");
    const flags = [...rangeFlag("TikTok on-screen text", value.onScreenText.length, 3, 6), ...rangeFlag("TikTok hashtags", hashtags.length, 3, 6)];
    return {
      warnings: [],
      drafts: [socialDraft(tiktokSpec.key, "tiktok", { title: value.title, body, topic: value.topic, hook: value.hook, cta: value.cta }, value, ctx, opts, flags)],
    };
  },
};

export const SOCIAL_SPECS = {
  linkedin: linkedinSpec,
  instagram: instagramSpec,
  x: xSpec,
  youtube: youtubeSpec,
  tiktok: tiktokSpec,
};
