import type { LlmClient, LlmRequest, LlmResponse } from "@/lib/ai/types";

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /**
   * OpenAI's current models take `max_completion_tokens` and only their
   * default temperature; other OpenAI-compatible servers (Gemini, Azure,
   * Ollama, vLLM) take `max_tokens` and a custom temperature.
   */
  dialect?: "openai" | "compatible";
}

/**
 * OpenAI-compatible chat-completions transport (OpenAI, Gemini, Azure,
 * OpenRouter, Ollama, vLLM, …). Moves text only — prompts, parsing and
 * validation are shared in llm-generator.ts.
 */
export class OpenAiCompatibleClient implements LlmClient {
  readonly model: string;
  private readonly config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
    this.model = config.model;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 60_000);
    const openai = this.config.dialect === "openai";
    try {
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          ...(openai
            ? { max_completion_tokens: request.maxTokens }
            : { max_tokens: request.maxTokens }),
          ...(openai || request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.json ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "system", content: request.system }, ...request.messages],
        }),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
      };
      const choice = json.choices?.[0];
      const text = choice?.message?.content ?? "";
      if (!text.trim()) throw new Error("Empty LLM response");
      return { text, truncated: choice?.finish_reason === "length" };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("LLM request timed out");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
