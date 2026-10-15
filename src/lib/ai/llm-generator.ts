import type {
  AiProvider,
  DraftSpec,
  GenerationContext,
  GenerationOutcome,
  LlmClient,
  LlmMessage,
  RepurposeKind,
} from "@/lib/ai/types";
import { SYSTEM_PROMPT, buildPrompt } from "@/lib/ai/prompt";
import { resolveOptions, specsForKind, type RunnableSpec } from "@/lib/ai/specs";

const MAX_TOKENS_CEILING = 16_000;
/** How much of an invalid reply to echo back on retry. */
const ECHO_LIMIT = 12_000;

/** Run at most `limit` tasks at once, so a pack of calls doesn't trip rate limits. */
export function createLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      next();
    }
  };
}

/**
 * The one LLM generation path, shared by every vendor. Builds the prompt
 * from the format spec, validates the reply against that spec's schema,
 * retries once with the validation error, then maps the result onto assets
 * with quality flags. Vendors differ only in their `LlmClient` transport.
 */
export class LlmGenerator implements AiProvider {
  readonly modelLabel: string;
  private readonly limit: ReturnType<typeof createLimiter>;
  private readonly now: () => Date;
  private readonly temperature: number;

  constructor(
    private readonly client: LlmClient,
    options: { concurrency?: number; now?: () => Date; temperature?: number } = {}
  ) {
    this.modelLabel = client.model;
    this.limit = createLimiter(options.concurrency ?? 4);
    this.now = options.now ?? (() => new Date());
    this.temperature = options.temperature ?? 0.7;
  }

  async generate(kind: RepurposeKind, ctx: GenerationContext): Promise<GenerationOutcome> {
    const specs = specsForKind(kind);
    const results = await Promise.allSettled(specs.map((spec) => this.limit(() => this.runSpec(spec, ctx))));
    const drafts: DraftSpec[] = [];
    const warnings: string[] = [];
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        drafts.push(...result.value.drafts);
        warnings.push(...result.value.warnings);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failures.push(`${specs[index].label}: ${reason}`);
      }
    });
    // A whole-kind failure is thrown so the caller can decide what to do;
    // a partial social pack keeps the platforms that worked.
    if (!drafts.length && failures.length && !warnings.length) throw new Error(failures.join(" · "));
    warnings.push(...failures.map((failure) => `${failure} — not generated.`));
    return { drafts, warnings };
  }

  private async runSpec(spec: RunnableSpec, ctx: GenerationContext): Promise<GenerationOutcome> {
    const opts = resolveOptions(ctx, this.now());
    const prompt = buildPrompt(spec.kind, ctx, spec.platform, this.now());
    let maxTokens = spec.maxTokens(opts);
    const messages: LlmMessage[] = [{ role: "user", content: prompt }];

    for (let attempt = 1; attempt <= 2; attempt++) {
      const reply = await this.client.complete({
        system: SYSTEM_PROMPT,
        messages,
        maxTokens,
        temperature: this.temperature,
        timeoutMs: spec.timeoutMs,
        json: true,
      });
      const parsed = spec.parseAndBuild(reply.text, ctx, opts);
      if (parsed.ok) {
        return {
          warnings: parsed.value.warnings,
          drafts: parsed.value.drafts.map((draft) => ({
            ...draft,
            metadata: { ...draft.metadata, generator: this.client.model, attempts: attempt },
          })),
        };
      }
      if (attempt === 2) throw new Error(parsed.error);
      const problem = reply.truncated
        ? `Your reply was cut off before the JSON was complete (${parsed.error}). Return the complete JSON object again; keep every field but stay within the requested lengths.`
        : `Your reply could not be used: ${parsed.error} Return only the corrected JSON object with exactly the requested shape.`;
      if (reply.truncated) maxTokens = Math.min(Math.ceil(maxTokens * 1.5), MAX_TOKENS_CEILING);
      messages.push({ role: "assistant", content: reply.text.slice(0, ECHO_LIMIT) }, { role: "user", content: problem });
    }
    throw new Error("Unreachable");
  }
}
