import { z } from "zod";

export const audioVideoSchema = z.object({
  transcript: z.string().max(50000),
  summary: z.string().trim().min(10).max(2400),
  language: z.string().trim().max(80).default("Not identified"),
  keyMoments: z.array(z.object({ time: z.string().trim().min(1).max(30), note: z.string().trim().min(4).max(400) })).max(20).default([]),
  suggestedClips: z.array(z.object({ start: z.string().trim().min(1).max(30), end: z.string().trim().min(1).max(30), title: z.string().trim().min(3).max(120), reason: z.string().trim().min(8).max(400) })).max(10).default([]),
  drafts: z.array(z.object({
    title: z.string().trim().min(3).max(180), body: z.string().trim().min(80).max(10000),
    format: z.enum(["blog", "newsletter", "social post", "short-form video"]),
    platform: z.enum(["website", "email", "linkedin", "youtube"]),
    topic: z.string().trim().max(200).nullable().default(null), hook: z.string().trim().max(300).nullable().default(null), cta: z.string().trim().max(500).nullable().default(null),
  })).length(4).refine(drafts => {
    const formats = new Set(drafts.map(draft => `${draft.format}:${draft.platform}`));
    return ["blog:website", "newsletter:email", "social post:linkedin", "short-form video:youtube"].every(format => formats.has(format));
  }, "Return a website blog, email newsletter, LinkedIn post and YouTube short-form script."),
});
