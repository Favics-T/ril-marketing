import { z } from "zod";
import type {
  ContentLength,
  DraftSpec,
  GenerationContext,
  NewsletterStyle,
  RepurposeKind,
  SocialPlatform,
} from "@/lib/ai/types";

/** Options after defaults are applied — what the prompt actually states. */
export interface ResolvedOptions {
  tone: string;
  length: ContentLength;
  audience: string;
  objective: string;
  cta: string;
  seoFocusKeyword: string | null;
  newsletterStyle: NewsletterStyle;
  /** True when any source material carries real timestamps. */
  hasTimestamps: boolean;
}

export function resolveOptions(ctx: GenerationContext, now: Date = new Date()): ResolvedOptions {
  const o = ctx.options ?? {};
  const today = now.toISOString().slice(0, 10);
  const upcoming = Boolean(ctx.eventDate && ctx.eventDate >= today);
  return {
    tone: o.tone?.trim() || "RIL brand voice",
    length: o.length ?? "standard",
    audience: o.audience?.trim() || ctx.campaignAudience?.trim() || ctx.segmentName || "the RIL community",
    objective:
      o.objective?.trim() ||
      ctx.campaignObjective?.trim() ||
      (upcoming && ctx.registrationUrl
        ? "drive registrations for the upcoming activity"
        : upcoming
          ? "build interest in the upcoming activity"
          : "share what happened and why it matters, and keep the audience engaged with RIL"),
    cta: o.cta?.trim() || ctx.ctas[0] || (ctx.registrationUrl ? "Register now" : "Follow RIL for what comes next"),
    seoFocusKeyword: o.seoFocusKeyword?.trim() || null,
    newsletterStyle: o.newsletterStyle ?? (upcoming ? "program_promotion" : "event_recap"),
    hasTimestamps: (ctx.sourceMaterial ?? []).some((m) => m.timestamped),
  };
}

export interface QualityFlag {
  code:
    | "under_length"
    | "over_platform_limit"
    | "off_spec"
    | "quote_not_in_source"
    | "unverified_link"
    | "timestamps_unavailable";
  message: string;
}

/** Fields every structured response carries (PRD §6.4 source vs interpretation). */
export const notesFields = {
  interpretationNotes: z.array(z.string().trim().max(600)).max(20).default([]),
  missingInformation: z.array(z.string().trim().max(600)).max(20).default([]),
};

export const NOTES_SHAPE = `"interpretationNotes": ["each statement in the draft that is your interpretation, inference or suggestion rather than a fact from the input"],
  "missingInformation": ["facts that would strengthen the draft but are not in the input — never invent them"]`;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * X's weighted length, approximated: every URL counts as 23 characters and
 * text is counted in code points, so emoji count once.
 */
export function xLength(text: string): number {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "x".repeat(23));
  return Array.from(withoutUrls).length;
}

export function normalizeHashtags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().replace(/\s+/g, ""))
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    ),
  ];
}

export const URL_PATTERN = /https?:\/\/[^\s)\]>"']+/g;

/** URLs the input actually contains — the only ones drafts may use. */
export function allowedUrls(ctx: GenerationContext): Set<string> {
  const urls = new Set<string>();
  if (ctx.registrationUrl) urls.add(stripTrailing(ctx.registrationUrl));
  for (const material of ctx.sourceMaterial ?? []) {
    for (const url of material.text.match(URL_PATTERN) ?? []) urls.add(stripTrailing(url));
  }
  return urls;
}

function stripTrailing(url: string): string {
  return url.replace(/[.,;:!?]+$/, "").replace(/\/$/, "");
}

export function isAllowedUrl(url: string, allowed: Set<string>): boolean {
  return allowed.has(stripTrailing(url));
}

export function unverifiedUrlFlags(text: string, ctx: GenerationContext): QualityFlag[] {
  const allowed = allowedUrls(ctx);
  const unknown = [...new Set((text.match(URL_PATTERN) ?? []).filter((url) => !isAllowedUrl(url, allowed)))];
  return unknown.map((url) => ({
    code: "unverified_link" as const,
    message: `Link not found in the source or activity record — verify before publishing: ${url}`,
  }));
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every text the model was given as fact, for quote verification. */
export function sourceCorpus(ctx: GenerationContext): string {
  return normalizeForMatch(
    [ctx.activityDescription, ctx.outcomes, ...(ctx.sourceMaterial ?? []).map((m) => m.text)]
      .filter(Boolean)
      .join("\n")
  );
}

export function quoteAppearsInSource(quote: string, corpus: string): boolean {
  const needle = normalizeForMatch(quote);
  return needle.length > 0 && corpus.includes(needle);
}

export function lengthFlag(label: string, actual: number, min: number, unit: string): QualityFlag[] {
  return actual < min
    ? [{ code: "under_length", message: `${label} is ${actual} ${unit}; the spec minimum is ${min}.` }]
    : [];
}

export function rangeFlag(label: string, actual: number, min: number, max: number): QualityFlag[] {
  return actual < min || actual > max
    ? [{ code: "off_spec", message: `${label}: ${actual}, expected ${min}–${max}.` }]
    : [];
}

export interface BuildResult {
  drafts: DraftSpec[];
  warnings: string[];
}

/**
 * One generation unit: a kind, or one platform of the social pack. Specs
 * hold everything tunable about a format — instructions, example, output
 * shape, validation, token budget and how the result maps onto assets.
 */
export interface GenerationSpec<T> {
  key: string;
  label: string;
  kind: RepurposeKind;
  platform?: SocialPlatform;
  instructions(opts: ResolvedOptions, ctx: GenerationContext): string;
  /** JSON shape shown to the model, with field descriptions. */
  shape: string;
  /** Short quality anchor from a fictional event. Not to be copied. */
  example: string;
  schema: z.ZodType<T>;
  maxTokens(opts: ResolvedOptions): number;
  timeoutMs: number;
  build(value: T, ctx: GenerationContext, opts: ResolvedOptions): BuildResult;
}

export function draftMetadata(
  spec: { key: string; kind: RepurposeKind; platform?: SocialPlatform },
  opts: ResolvedOptions,
  ctx: GenerationContext,
  structured: unknown,
  notes: { interpretationNotes: string[]; missingInformation: string[] },
  flags: QualityFlag[]
): Record<string, unknown> {
  return {
    kind: spec.kind,
    spec: spec.key,
    ai_generated: true,
    structured,
    interpretation_notes: notes.interpretationNotes,
    missing_information: notes.missingInformation,
    quality_flags: flags,
    generation_options: opts,
    source_material: (ctx.sourceMaterial ?? []).map((m) => ({ kind: m.kind, label: m.label, condensed: Boolean(m.condensed) })),
  };
}
