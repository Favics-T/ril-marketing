import type {
  AiProvider,
  DraftSpec,
  GenerationContext,
  GenerationOutcome,
  RepurposeKind,
} from "@/lib/ai/types";

/**
 * Deterministic grounded generator. Uses ONLY GenerationContext facts plus
 * approved-insight preferences; interpretation is explicitly labelled as
 * suggestion (PRD §6.4: source facts vs AI interpretation stay distinct).
 * This is the fallback when no LLM is configured — and the offline-safe
 * default. Pure — unit tested.
 */
export class TemplateProvider implements AiProvider {
  readonly modelLabel = "template-v1";

  async generate(kind: RepurposeKind, ctx: GenerationContext): Promise<GenerationOutcome> {
    return { drafts: this.draftsFor(kind, ctx), warnings: [] };
  }

  private draftsFor(kind: RepurposeKind, ctx: GenerationContext): DraftSpec[] {
    switch (kind) {
      case "blog":
        return [blogDraft(ctx)];
      case "newsletter":
        return [newsletterDraft(ctx)];
      case "social_pack":
        return socialPack(ctx);
      case "short_form":
        return shortFormBriefs(ctx);
    }
  }
}

function facts(ctx: GenerationContext): string {
  const lines = [`Source: ${ctx.activityTitle}`];
  if (ctx.eventDate) lines.push(`Date: ${ctx.eventDate}`);
  if (ctx.activityDescription) lines.push(`About: ${ctx.activityDescription}`);
  if (ctx.outcomes) lines.push(`Outcomes: ${ctx.outcomes}`);
  if (ctx.speakers.length > 0) lines.push(`Speakers: ${ctx.speakers.join(", ")}`);
  if (ctx.partners.length > 0) lines.push(`Partners: ${ctx.partners.join(", ")}`);
  return lines.join("\n");
}

function audienceLine(ctx: GenerationContext): string {
  const bits: string[] = [];
  if (ctx.segmentName) bits.push(`Audience: ${ctx.segmentName}`);
  if (ctx.audienceNeeds?.length) bits.push(`Needs: ${ctx.audienceNeeds.slice(0, 3).join(", ")}`);
  if (ctx.topics.length > 0) bits.push(`Proven topics: ${ctx.topics.slice(0, 3).join(", ")}`);
  if (ctx.formats.length > 0) bits.push(`Formats: ${ctx.formats.slice(0, 3).join(", ")}`);
  if (ctx.platforms.length > 0) bits.push(`Priority platforms: ${ctx.platforms.slice(0, 3).join(", ")}`);
  return bits.join(" · ");
}

function blogDraft(ctx: GenerationContext): DraftSpec {
  const topic = ctx.topics[0] ?? ctx.activityTitle;
  return {
    kind: "blog",
    channel: "website",
    title: `${ctx.activityTitle}: what happened and what it means`,
    topic,
    format: "blog",
    platform: null,
    hook: ctx.hooks[0] ?? null,
    cta: ctx.ctas[0] ?? null,
    body: [
      `# ${ctx.activityTitle}`,
      "",
      "## From the source",
      facts(ctx),
      "",
      "## Suggested angle (draft — verify before publishing)",
      audienceLine(ctx) || "General RIL audience.",
      `Lead with the "${topic}" angle and close${ctx.ctas[0] ? ` with "${ctx.ctas[0]}"` : ""}.`,
      "",
      "> Status: AI-generated draft. A human must edit and approve this before publishing.",
    ].join("\n"),
    metadata: { generator: "template-v1", kind: "blog" },
  };
}

function newsletterDraft(ctx: GenerationContext): DraftSpec {
  return {
    kind: "newsletter",
    channel: "email",
    title: `Newsletter: ${ctx.activityTitle}`,
    topic: ctx.topics[0] ?? null,
    format: "newsletter",
    platform: null,
    hook: null,
    cta: ctx.ctas[0] ?? null,
    body: [
      `Subject options: "${ctx.activityTitle} — recap & next steps" / "What you missed: ${ctx.activityTitle}"`,
      "",
      "## From the source",
      facts(ctx),
      "",
      "## Suggested send (draft)",
      audienceLine(ctx) || "General RIL audience.",
    ].join("\n"),
    metadata: { generator: "template-v1", kind: "newsletter" },
  };
}

const SOCIAL_CHANNELS = [
  { channel: "linkedin", hook: (h: string) => h, tail: (c: string | null) => (c ? `\n\nCTA: ${c}` : "") },
  { channel: "instagram", hook: (h: string) => `✳ ${h}`, tail: () => "\n\n#RIL #Innovation" },
  { channel: "x", hook: (h: string) => h.slice(0, 120), tail: () => "" },
] as const;

function socialPack(ctx: GenerationContext): DraftSpec[] {
  const hook = ctx.hooks[0] ?? ctx.activityTitle;
  return SOCIAL_CHANNELS.filter(
    (s) => ctx.platforms.length === 0 || ctx.platforms.includes(s.channel)
  ).map((s) => ({
    kind: "social" as const,
    channel: s.channel,
    title: `${s.channel} post: ${ctx.activityTitle}`,
    topic: ctx.topics[0] ?? null,
    format: "social post",
    platform: s.channel,
    hook: ctx.hooks[0] ?? null,
    cta: ctx.ctas[0] ?? null,
    body: `${s.hook(hook)}\n\n${ctx.activityDescription ?? ctx.activityTitle}\nSource: ${ctx.activityTitle}${s.tail(ctx.ctas[0] ?? null)}\n\n[DRAFT — edit and approve before scheduling]`,
    metadata: { generator: "template-v1", kind: "social_pack" },
  }));
}

function shortFormBriefs(ctx: GenerationContext): DraftSpec[] {
  const hooks = ctx.hooks.length > 0 ? ctx.hooks.slice(0, 3) : [ctx.activityTitle];
  return hooks.map((hook, i) => ({
    kind: "short_clip" as const,
    channel: ctx.platforms[0] ?? "instagram",
    title: `Clip ${i + 1}: ${hook}`,
    topic: ctx.topics[0] ?? null,
    format: "short-form video",
    platform: ctx.platforms[0] ?? "instagram",
    hook,
    cta: ctx.ctas[0] ?? null,
    body: [
      `Hook: ${hook}`,
      `Source: ${ctx.activityTitle}`,
      "Timestamps: not set — add start/end after reviewing the footage.",
      `Suggested caption: ${hook} — ${ctx.activityDescription ?? ctx.activityTitle}`,
      "",
      "[DRAFT BRIEF — Marketing sets clip boundaries and approves before scheduling]",
    ].join("\n"),
    metadata: { generator: "template-v1", kind: "short_form", needsTranscript: true },
  }));
}
