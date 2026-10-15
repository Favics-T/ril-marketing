import { z } from "zod";
import type { DraftSpec } from "@/lib/ai/types";
import {
  NOTES_SHAPE,
  draftMetadata,
  notesFields,
  type GenerationSpec,
  type QualityFlag,
} from "@/lib/ai/specs/shared";

const CLIP_PLATFORMS = ["instagram", "tiktok", "youtube", "linkedin", "x"] as const;
const TIME = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

const clipSchema = z.object({
  title: z.string().trim().min(3).max(150),
  start: z.string().trim().max(12).nullable().default(null),
  end: z.string().trim().max(12).nullable().default(null),
  hook: z.string().trim().min(5).max(300),
  caption: z.string().trim().min(10).max(2200),
  cta: z.string().trim().min(2).max(300),
  platform: z.enum(CLIP_PLATFORMS),
  objective: z.string().trim().min(3).max(300),
  reason: z.string().trim().min(10).max(600),
});

const shortFormSchema = z.object({
  clips: z.array(clipSchema).max(5),
  noStrongClipReason: z.string().trim().max(600).nullable().default(null),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});

export type ShortFormDraft = z.infer<typeof shortFormSchema>;
type Clip = z.infer<typeof clipSchema>;

export function toSeconds(time: string): number {
  return time.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
}

/** Validate clip ranges; never keep a guessed range when there are no timestamps. */
export function clipQuality(clip: Clip, hasTimestamps: boolean): { clip: Clip; flags: QualityFlag[] } {
  if (!hasTimestamps) {
    return clip.start || clip.end
      ? { clip: { ...clip, start: null, end: null }, flags: [{ code: "timestamps_unavailable", message: "Removed clip times: the source has no timestamps. Set start and end after reviewing the footage." }] }
      : { clip, flags: [] };
  }
  if (!clip.start || !clip.end) {
    return { clip, flags: [{ code: "off_spec", message: "Clip is missing a start or end time." }] };
  }
  if (!TIME.test(clip.start) || !TIME.test(clip.end) || toSeconds(clip.start) >= toSeconds(clip.end)) {
    return { clip, flags: [{ code: "off_spec", message: `Clip range ${clip.start}–${clip.end} is not a valid start/end pair.` }] };
  }
  return { clip, flags: [] };
}

export const shortFormSpec: GenerationSpec<ShortFormDraft> = {
  key: "short_form",
  label: "Short-form clips",
  kind: "short_form",
  instructions(opts) {
    return `Recommend 3–5 short-form video clips (15–60 seconds each) from this source (PRD 6.6).

For each clip:
- "start"/"end": ${opts.hasTimestamps ? 'use ONLY timestamps that appear in the source material ("MM:SS" or "HH:MM:SS"); the clip must sit inside a moment the source describes.' : "the source has no timestamps, so set both to null — never guess times."}
- "hook": the opening line or moment that stops the scroll.
- "caption": a ready-to-post caption for the suggested platform, ending with a CTA built around "${opts.cta}".
- "platform": the best fit of instagram, tiktok, youtube, linkedin or x.
- "objective": what the clip is for (e.g. awareness, registrations, credibility).
- "reason": why this moment works as a clip, citing what in the source makes it strong.
Quality over quantity: only recommend moments with a genuine hook, a strong statement or a useful insight in the source. If fewer than 3 qualify, return fewer. If none qualify, return "clips": [] and explain in "noStrongClipReason". Never force a weak clip.`;
  },
  shape: `{
  "clips": [{ "title": "string", "start": "MM:SS or null", "end": "MM:SS or null", "hook": "string", "caption": "string", "cta": "string", "platform": "instagram|tiktok|youtube|linkedin|x", "objective": "string", "reason": "string" }],
  "noStrongClipReason": "string or null",
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Strong clip recommendation (fictional "Lagos Solar Hack" — do not reuse its facts or wording):
hook: "'We stopped trying to keep the fridge cold. We started trying to know when it wasn't.'"
reason: "A counter-intuitive one-line insight from the winning pitch — self-contained and quotable without context."`,
  schema: shortFormSchema,
  maxTokens: () => 4000,
  timeoutMs: 120_000,
  build(value, ctx, opts) {
    if (value.clips.length === 0) {
      return {
        drafts: [],
        warnings: [`No strong short-form clip found${value.noStrongClipReason ? `: ${value.noStrongClipReason}` : "."} Select moments manually.`],
      };
    }
    const drafts: DraftSpec[] = value.clips.map((raw) => {
      const { clip, flags } = clipQuality(raw, opts.hasTimestamps);
      const range = clip.start && clip.end ? `${clip.start}–${clip.end}` : "Not set — no timestamps in the source. Set after reviewing the footage.";
      return {
        kind: "short_clip",
        channel: clip.platform,
        platform: clip.platform,
        format: "short-form video",
        title: clip.title,
        topic: value.topic,
        hook: clip.hook,
        cta: clip.cta,
        body: [
          `Clip: ${range}`,
          `Hook: ${clip.hook}`,
          `Caption:\n${clip.caption}`,
          `Objective: ${clip.objective}`,
          `Why this clip: ${clip.reason}`,
        ].join("\n\n"),
        metadata: { ...draftMetadata(shortFormSpec, opts, ctx, clip, value, flags), clip },
      };
    });
    return { drafts, warnings: [] };
  },
};
