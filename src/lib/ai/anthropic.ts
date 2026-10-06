import type { LlmClient, LlmRequest, LlmResponse } from "@/lib/ai/types";

/**
 * Claude transport (Anthropic Messages API). Moves text only — prompts,
 * parsing and validation are shared in llm-generator.ts, so output quality
 * guarantees can't drift per provider.
 */
export class AnthropicClient implements LlmClient {
  readonly model: string;
  private readonly apiKey: string;

  constructor(args: { apiKey: string; model: string }) {
    this.apiKey = args.apiKey;
    this.model = args.model;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 60_000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens,
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          system: request.system,
          messages: request.messages,
        }),
      });
      if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
      const json = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string;
      };
      const text = (json.content ?? [])
        .filter((block) => typeof block.text === "string")
        .map((block) => block.text)
        .join("");
      if (!text.trim()) throw new Error("Empty Claude response");
      return { text, truncated: json.stop_reason === "max_tokens" };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Claude request timed out");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
