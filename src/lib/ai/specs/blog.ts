import { z } from "zod";
import type { ContentLength } from "@/lib/ai/types";
import {
  NOTES_SHAPE,
  draftMetadata,
  lengthFlag,
  notesFields,
  rangeFlag,
  unverifiedUrlFlags,
  wordCount,
  type GenerationSpec,
  type QualityFlag,
} from "@/lib/ai/specs/shared";

/** Target article length in words, by the length option. */
export const BLOG_WORDS: Record<ContentLength, { min: number; max: number }> = {
  short: { min: 500, max: 700 },
  standard: { min: 800, max: 1200 },
  long: { min: 1500, max: 2000 },
};

const INTERNAL_PATH = /^\/(?!\/)[^\s]*$/;

const blogSchema = z.object({
  title: z.string().trim().min(3).max(200),
  seoTitle: z.string().trim().min(10).max(120),
  metaDescription: z.string().trim().min(40).max(400),
  keywords: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  outline: z.array(z.string().trim().min(2).max(200)).min(2).max(15),
  hook: z.string().trim().min(10).max(400),
  body: z.string().trim().min(200).max(20000),
  cta: z.string().trim().min(2).max(300),
  topic: z.string().trim().max(200).nullable().default(null),
  internalLinkSuggestions: z
    .array(
      z.object({
        anchorText: z.string().trim().min(2).max(120),
        suggestedPath: z.string().trim().min(1).max(200),
        reason: z.string().trim().max(300).default(""),
      })
    )
    .max(8)
    .default([]),
  ...notesFields,
});

export type BlogDraft = z.infer<typeof blogSchema>;

export function blogQuality(value: BlogDraft, length: ContentLength): QualityFlag[] {
  const target = BLOG_WORDS[length];
  const headings = (value.body.match(/^#{2,3}\s+\S/gm) ?? []).length;
  return [
    ...lengthFlag("Article", wordCount(value.body), target.min, "words"),
    ...(value.seoTitle.length > 60 ? [{ code: "off_spec" as const, message: `SEO title is ${value.seoTitle.length} characters; aim for 60 or fewer.` }] : []),
    ...(value.metaDescription.length > 160
      ? [{ code: "over_platform_limit" as const, message: `Meta description is ${value.metaDescription.length} characters; search results show about 160.` }]
      : []),
    ...rangeFlag("Keyword suggestions", value.keywords.length, 5, 8),
    ...(headings < 2 ? [{ code: "off_spec" as const, message: "Article needs at least two H2/H3 section headings." }] : []),
  ];
}

export const blogSpec: GenerationSpec<BlogDraft> = {
  key: "blog",
  label: "Blog post",
  kind: "blog",
  instructions(opts) {
    const words = BLOG_WORDS[opts.length];
    return `Write ONE complete, publish-ready blog article for RIL's website (PRD 6.4).

Length: ${words.min}–${words.max} words in "body". Reach the range by developing the source, not by repeating it.
Structure of "body" (Markdown):
- Do NOT repeat the title as a heading; the page renders it separately.
- Intro (1–2 paragraphs): open with the hook — a vivid, specific first line drawn from the source — then say what the reader will get.
- 3–5 sections, each with a "## " heading (use "### " for sub-points). Each section develops one key point from the source: what happened or was said, the context behind it, why it matters to ${opts.audience}, and a concrete takeaway.
- Conclusion: draw the threads together and end on a high note.
- Close with a call-to-action paragraph built around: "${opts.cta}".
SEO:
- "seoTitle": ≤ 60 characters${opts.seoFocusKeyword ? `, containing the focus keyword "${opts.seoFocusKeyword}"` : ""}.
- "metaDescription": 120–160 characters, accurate, no clickbait.
- "keywords": 5–8 phrases grounded in the source${opts.seoFocusKeyword ? `, led by "${opts.seoFocusKeyword}"` : ""}. Use them naturally in headings and body.
- "outline": the section headings in order.
- "internalLinkSuggestions": 2–4 places to link to other RIL pages. "suggestedPath" is a placeholder site path beginning with "/" and no spaces (e.g. "/programs/program-name"); an editor will confirm it.
Keep facts from the source clearly factual; phrase interpretation as such ("This suggests…", "For founders, that means…") and list it in interpretationNotes.`;
  },
  shape: `{
  "title": "headline for the article (not repeated in body)",
  "seoTitle": "string, <= 60 chars",
  "metaDescription": "string, 120-160 chars",
  "keywords": ["5-8 strings"],
  "outline": ["section heading", "..."],
  "hook": "the article's opening line",
  "body": "full Markdown article: intro, ## sections, conclusion, CTA paragraph",
  "cta": "the call to action in one line",
  "topic": "main topic in a few words",
  "internalLinkSuggestions": [{ "anchorText": "string", "suggestedPath": "/placeholder-path", "reason": "string" }],
  ${NOTES_SHAPE}
}`,
  example: `Opening of a strong article (fictional "Lagos Solar Hack" — do not reuse any of its facts or wording):
"Forty-eight hours, twelve teams and one stubborn question: why do clinics in Kano still lose vaccines when the grid drops? ..."
## What the winning team got right
"The judges kept coming back to one detail: the prototype logged every temperature spike. That matters because..."`,
  schema: blogSchema,
  maxTokens: (opts) => ({ short: 5000, standard: 7000, long: 10000 })[opts.length],
  timeoutMs: 150_000,
  build(value, ctx, opts) {
    const flags = [...blogQuality(value, opts.length), ...unverifiedUrlFlags(value.body, ctx)];
    const internalLinks = value.internalLinkSuggestions
      .map((link) => link.suggestedPath)
      .filter((path) => INTERNAL_PATH.test(path));
    const metadata = draftMetadata(blogSpec, opts, ctx, value, value, flags);
    return {
      warnings: [],
      drafts: [
        {
          kind: "blog",
          channel: "website",
          title: value.title,
          body: value.body,
          topic: value.topic,
          format: "blog",
          platform: null,
          hook: value.hook,
          cta: value.cta,
          metadata: {
            ...metadata,
            // Same shape the draft editor and SEO workspace already read.
            seo: {
              title: value.seoTitle.slice(0, 70),
              description: value.metaDescription.slice(0, 320),
              keywords: value.keywords.slice(0, 20),
              internalLinks: internalLinks.slice(0, 20),
              audit: null,
              appliedAt: null,
            },
          },
        },
      ],
    };
  },
};
