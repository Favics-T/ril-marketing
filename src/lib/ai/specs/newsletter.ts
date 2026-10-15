import { z } from "zod";
import type { ContentLength, NewsletterStyle } from "@/lib/ai/types";
import {
  NOTES_SHAPE,
  allowedUrls,
  draftMetadata,
  isAllowedUrl,
  lengthFlag,
  notesFields,
  quoteAppearsInSource,
  rangeFlag,
  sourceCorpus,
  unverifiedUrlFlags,
  wordCount,
  type GenerationSpec,
  type QualityFlag,
} from "@/lib/ai/specs/shared";

/** Target words for the assembled email body, by the length option. */
export const NEWSLETTER_WORDS: Record<ContentLength, { min: number; max: number }> = {
  short: { min: 250, max: 400 },
  standard: { min: 400, max: 700 },
  long: { min: 700, max: 1000 },
};

/** PRD §6.5 styles — how each one shapes the structure. */
export const NEWSLETTER_STYLE_GUIDE: Record<NewsletterStyle, string> = {
  weekly_update: "Weekly update: a warm intro, then highlights ordered by importance, each with what's next.",
  event_recap: "Event recap: set the scene, then the moments that mattered, what was learned, and what comes next.",
  program_promotion: "Program promotion: who it's for, what participants gain, key details from the source, and a clear route to register.",
  thought_leadership: "Thought leadership: one central idea from the source, developed across the highlights with RIL's point of view.",
  industry_insight: "Industry insight: what is changing, the evidence in the source, and what it means for readers.",
  partnership_announcement: "Partnership announcement: who is partnering (as named in the source), why, and what it unlocks for the community.",
  community_update: "Community update: people and progress from the source, celebrated, with ways readers can get involved.",
};

const newsletterSchema = z.object({
  subjectLines: z.array(z.string().trim().min(3).max(150)).min(1).max(5),
  previewText: z.string().trim().min(10).max(250),
  intro: z.string().trim().min(40).max(3000),
  highlights: z
    .array(z.object({ heading: z.string().trim().min(2).max(150), paragraph: z.string().trim().min(40).max(3000) }))
    .min(1)
    .max(8),
  quotes: z
    .array(z.object({ text: z.string().trim().min(3).max(600), speaker: z.string().trim().max(150).nullable().default(null) }))
    .max(5)
    .default([]),
  links: z.array(z.object({ label: z.string().trim().min(2).max(150), url: z.string().trim().max(500) })).max(6).default([]),
  cta: z.string().trim().min(2).max(300),
  closing: z.string().trim().max(1000).default(""),
  topic: z.string().trim().max(200).nullable().default(null),
  ...notesFields,
});

export type NewsletterDraft = z.infer<typeof newsletterSchema>;

export function composeNewsletterBody(value: NewsletterDraft, links: NewsletterDraft["links"]): string {
  const parts = [value.intro];
  for (const highlight of value.highlights) parts.push(`## ${highlight.heading}\n\n${highlight.paragraph}`);
  for (const quote of value.quotes) parts.push(`> "${quote.text}"${quote.speaker ? ` — ${quote.speaker}` : ""}`);
  if (links.length) parts.push(links.map((link) => `- [${link.label}](${link.url})`).join("\n"));
  parts.push(`**${value.cta}**`);
  if (value.closing) parts.push(value.closing);
  return parts.join("\n\n");
}

export const newsletterSpec: GenerationSpec<NewsletterDraft> = {
  key: "newsletter",
  label: "Newsletter",
  kind: "newsletter",
  instructions(opts) {
    const words = NEWSLETTER_WORDS[opts.length];
    return `Write ONE complete, ready-to-send email newsletter (PRD 6.5).

Style: ${NEWSLETTER_STYLE_GUIDE[opts.newsletterStyle]}
Length: intro + highlights + closing together ${words.min}–${words.max} words.
- "subjectLines": exactly 3 distinct options (≤ 60 characters each): one curiosity-led, one benefit-led, one direct.
- "previewText": 40–140 characters that complement (not repeat) the subject line.
- "intro": 1–2 short paragraphs that greet ${opts.audience} and say why this email is worth reading.
- "highlights": 3–5 items. Each has a short heading and a paragraph of 60–120 words that develops one point from the source — what happened, the context, why it matters.
- "quotes": only sentences that appear word-for-word in the source material, with the speaker as the source names them. If there are none, return [].
- "links": only URLs supplied in the input (e.g. the registration link). Never invent a URL. Return [] if none.
- "cta": one line built around "${opts.cta}". "closing": a one-to-two-sentence sign-off that ends on a high note.`;
  },
  shape: `{
  "subjectLines": ["3 strings"],
  "previewText": "string",
  "intro": "string",
  "highlights": [{ "heading": "string", "paragraph": "string" }],
  "quotes": [{ "text": "verbatim from source", "speaker": "string or null" }],
  "links": [{ "label": "string", "url": "URL from the input" }],
  "cta": "string",
  "closing": "string",
  "topic": "string",
  ${NOTES_SHAPE}
}`,
  example: `Highlight from a strong newsletter (fictional "Lagos Solar Hack" — do not reuse any of its facts or wording):
## The fridge that texts you
"Team Kelvin's prototype does one unglamorous thing brilliantly: it sends a text the moment a vaccine fridge warms up. For a rural clinic, that's the difference between a ruined batch and a saved one — and it's why the judges..."`,
  schema: newsletterSchema,
  maxTokens: (opts) => ({ short: 4000, standard: 5000, long: 7000 })[opts.length],
  timeoutMs: 120_000,
  build(value, ctx, opts) {
    const allowed = allowedUrls(ctx);
    const keptLinks = value.links.filter((link) => isAllowedUrl(link.url, allowed));
    const corpus = sourceCorpus(ctx);
    const body = composeNewsletterBody(value, keptLinks);
    const words = NEWSLETTER_WORDS[opts.length];
    const flags: QualityFlag[] = [
      ...lengthFlag(
        "Newsletter",
        wordCount([value.intro, ...value.highlights.map((h) => h.paragraph), value.closing].join(" ")),
        words.min,
        "words"
      ),
      ...rangeFlag("Subject lines", value.subjectLines.length, 3, 3),
      ...rangeFlag("Highlights", value.highlights.length, 3, 5),
      ...value.quotes
        .filter((quote) => !quoteAppearsInSource(quote.text, corpus))
        .map((quote) => ({ code: "quote_not_in_source" as const, message: `Quote not found word-for-word in the source — verify or remove: "${quote.text.slice(0, 120)}"` })),
      ...value.links
        .filter((link) => !keptLinks.includes(link))
        .map((link) => ({ code: "unverified_link" as const, message: `Removed a link that is not in the input: ${link.url}` })),
      ...unverifiedUrlFlags([value.intro, ...value.highlights.map((h) => h.paragraph)].join("\n"), ctx),
    ];
    return {
      warnings: [],
      drafts: [
        {
          kind: "newsletter",
          channel: "email",
          // The first subject line doubles as the asset title and email subject.
          title: value.subjectLines[0],
          body,
          topic: value.topic,
          format: "newsletter",
          platform: null,
          hook: null,
          cta: value.cta,
          metadata: {
            ...draftMetadata(newsletterSpec, opts, ctx, value, value, flags),
            subject_lines: value.subjectLines,
            preview_text: value.previewText,
            newsletter_style: opts.newsletterStyle,
          },
        },
      ],
    };
  },
};
