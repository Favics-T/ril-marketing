import { SOCIAL_PLATFORMS, type GenerationContext, type RepurposeKind, type SocialPlatform } from "@/lib/ai/types";
import { parseStructured, type ParseResult } from "@/lib/ai/parse";
import { blogSpec } from "@/lib/ai/specs/blog";
import { newsletterSpec } from "@/lib/ai/specs/newsletter";
import { SOCIAL_SPECS } from "@/lib/ai/specs/social";
import { shortFormSpec } from "@/lib/ai/specs/short-form";
import type { BuildResult, GenerationSpec, ResolvedOptions } from "@/lib/ai/specs/shared";

export { resolveOptions, type ResolvedOptions, type QualityFlag } from "@/lib/ai/specs/shared";

/** A spec with its output type erased, so specs of every kind share one runner. */
export interface RunnableSpec extends Omit<GenerationSpec<unknown>, "schema" | "build"> {
  parseAndBuild(text: string, ctx: GenerationContext, opts: ResolvedOptions): ParseResult<BuildResult>;
}

function runnable<T>(spec: GenerationSpec<T>): RunnableSpec {
  const { schema, build, ...rest } = spec;
  return {
    ...rest,
    parseAndBuild(text, ctx, opts) {
      const parsed = parseStructured(schema, text);
      return parsed.ok ? { ok: true, value: build(parsed.value, ctx, opts) } : parsed;
    },
  };
}

const BY_KEY: Record<string, RunnableSpec> = {
  blog: runnable(blogSpec),
  newsletter: runnable(newsletterSpec),
  short_form: runnable(shortFormSpec),
  "social:linkedin": runnable(SOCIAL_SPECS.linkedin),
  "social:instagram": runnable(SOCIAL_SPECS.instagram),
  "social:x": runnable(SOCIAL_SPECS.x),
  "social:youtube": runnable(SOCIAL_SPECS.youtube),
  "social:tiktok": runnable(SOCIAL_SPECS.tiktok),
};

export function specFor(kind: RepurposeKind, platform?: SocialPlatform): RunnableSpec {
  if (kind === "social_pack") return BY_KEY[`social:${platform ?? "linkedin"}`];
  return BY_KEY[kind];
}

/** The generation units for a kind: one per platform for the social pack. */
export function specsForKind(kind: RepurposeKind): RunnableSpec[] {
  return kind === "social_pack" ? SOCIAL_PLATFORMS.map((platform) => specFor(kind, platform)) : [specFor(kind)];
}
