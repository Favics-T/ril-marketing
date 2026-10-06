import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationId } from "@/lib/supabase/organization";
import type {
  DraftSpec,
  GenerationContext,
  LlmClient,
  RepurposeKind,
  ResolvedAiConfig,
  SourceMaterial,
} from "@/lib/ai/types";
import { REPURPOSE_KINDS } from "@/lib/ai/types";
import { TemplateProvider } from "@/lib/ai/template";
import { OpenAiCompatibleClient } from "@/lib/ai/openai-compatible";
import { AnthropicClient } from "@/lib/ai/anthropic";
import { LlmGenerator } from "@/lib/ai/llm-generator";
import {
  CHUNK_SUMMARY_SYSTEM,
  chunkSummaryPrompt,
  condenseSourceMaterial,
} from "@/lib/ai/source";
import {
  defaultModel,
  getProvider,
  isSupportedModel,
  type ProviderKey,
} from "@/lib/ai/providers";
import { decryptSecret } from "@/lib/crypto/secret-box";

export type { ProviderKey };

export interface ResolvedLlmConfig extends ResolvedAiConfig {
  provider: ProviderKey;
}

export async function resolveAiConfig(
  organizationId: string
): Promise<ResolvedLlmConfig> {
  const envKey = process.env.AI_API_KEY;
  if (envKey) {
    const provider = getProvider(process.env.AI_PROVIDER).key;
    const model = process.env.AI_MODEL ?? defaultModel(provider);
    return {
      mode: "llm",
      provider,
      model: isSupportedModel(provider, model) ? model : defaultModel(provider),
      baseUrl: process.env.AI_API_BASE_URL ?? getProvider(provider).baseUrl,
      apiKey: envKey,
    };
  }
  try {
    // Use the server-only admin client here so protected background jobs can
    // resolve a workspace key without relying on a request cookie session.
    // Callers must first establish the workspace through their own auth/job gate.
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("integrations")
      .select("status, config")
      .eq("organization_id", organizationId)
      .eq("key", "ai")
      .maybeSingle<{ status: string; config: Record<string, string> }>();
    const stored = data?.status === "connected" ? (data?.config?.apiKey ?? "") : "";
    const apiKey = stored ? decryptSecret(stored) || null : null;
    if (apiKey) {
      const def = getProvider(data?.config?.provider);
      const provider = def.key;
      const storedModel = data?.config?.model ?? def.defaultModel;
      return {
        mode: "llm",
        provider,
        model: isSupportedModel(provider, storedModel)
          ? storedModel
          : def.defaultModel,
        baseUrl: data?.config?.baseUrl || def.baseUrl,
        apiKey,
      };
    }
  } catch {
    // fall through to template
  }
  return { mode: "template", provider: "openai", model: "template-v1", baseUrl: null, apiKey: null };
}

function buildClient(config: ResolvedLlmConfig & { apiKey: string }): LlmClient {
  if (config.provider === "anthropic") {
    return new AnthropicClient({ apiKey: config.apiKey, model: config.model });
  }
  // OpenAI and Gemini both speak the OpenAI-compatible wire format; OpenAI's
  // own API takes max_completion_tokens and only the default temperature.
  return new OpenAiCompatibleClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? getProvider(config.provider).baseUrl,
    model: config.model,
    dialect: config.provider === "openai" ? "openai" : "compatible",
  });
}

/**
 * Provider-agnostic, grounded text completion (assistant, comments, reports,
 * trends, documents, SEO). Defaults suit short answers; callers that ask for
 * several long drafts in one reply must raise `maxTokens` and `timeoutMs`.
 */
export async function completeWithConfiguredProvider(
  organizationId: string,
  system: string,
  prompt: string,
  options: { maxTokens?: number; timeoutMs?: number; temperature?: number } = {}
): Promise<{ model: string; text: string } | null> {
  const config = await resolveAiConfig(organizationId);
  if (config.mode !== "llm" || !config.apiKey) return null;
  try {
    const reply = await buildClient({ ...config, apiKey: config.apiKey }).complete({
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.3,
      timeoutMs: options.timeoutMs ?? 30_000,
    });
    return { model: config.model, text: reply.text.trim() };
  } catch (error) {
    if (error instanceof Error && /timed out/.test(error.message)) {
      throw new Error("The AI request timed out. Try again, or with less input.");
    }
    throw error;
  }
}

/**
 * Fit an activity's source material into the generation budget. Long
 * transcripts and documents are summarised chunk by chunk with the workspace
 * model; without one they are shortened with an explicit marker.
 */
export async function prepareSourceMaterial(
  organizationId: string,
  materials: SourceMaterial[]
): Promise<{ materials: SourceMaterial[]; notes: string[] }> {
  const config = await resolveAiConfig(organizationId);
  const summarise = config.mode === "llm" && config.apiKey
    ? async (input: Parameters<typeof chunkSummaryPrompt>[0]) =>
        (await completeWithConfiguredProvider(organizationId, CHUNK_SUMMARY_SYSTEM, chunkSummaryPrompt(input), {
          maxTokens: 1500,
          timeoutMs: 60_000,
          temperature: 0.2,
        }))?.text ?? null
    : null;
  return condenseSourceMaterial(materials, summarise);
}

/** Multimodal image understanding through the configured organization provider. */
export async function analyzeImageWithConfiguredProvider(input: {
  organizationId: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  system: string;
  prompt: string;
}): Promise<{ model: string; text: string } | null> {
  const config = await resolveAiConfig(input.organizationId);
  if (config.mode !== "llm" || !config.apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    let response: Response;
    if (config.provider === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1600,
          temperature: 0.2,
          system: input.system,
          messages: [{ role: "user", content: [
            { type: "text", text: input.prompt },
            { type: "image", source: { type: "base64", media_type: input.mimeType, data: input.base64 } },
          ] }],
        }),
      });
    } else {
      response = await fetch(`${(config.baseUrl ?? getProvider(config.provider).baseUrl).replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 1600,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: [
              { type: "text", text: input.prompt },
              { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.base64}`, detail: "high" } },
            ] },
          ],
        }),
      });
    }
    if (!response.ok) throw new Error(`Configured AI provider returned HTTP ${response.status} while analyzing the image.`);
    const json = await response.json() as {
      content?: Array<{ text?: string }>;
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const raw = config.provider === "anthropic"
      ? json.content?.find((block) => typeof block.text === "string")?.text
      : json.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((part) => part.text ?? "").join("\n") : "";
    if (!text.trim()) throw new Error("Configured AI provider returned no image analysis.");
    return { model: config.model, text: text.trim().slice(0, 12000) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Image analysis timed out. Try again with a smaller image.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Audio/video understanding through the workspace's configured Gemini model. */
export async function analyzeAudioVideoWithConfiguredProvider(input: {
  organizationId: string;
  mimeType: string;
  base64: string;
  prompt: string;
  system: string;
}): Promise<{ model: string; text: string } | null> {
  const config = await resolveAiConfig(input.organizationId);
  if (config.mode !== "llm" || config.provider !== "gemini" || !config.apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }, { inlineData: { mimeType: input.mimeType, data: input.base64 } }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status} while analyzing the media.`);
    const json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
    if (!text) throw new Error("Gemini returned an empty media analysis.");
    return { model: config.model, text: text.slice(0, 60000) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Media analysis took too long. Try a shorter clip.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const kindLabel = (kind: RepurposeKind) => REPURPOSE_KINDS.find((k) => k.kind === kind)?.label ?? kind;

/**
 * Generate repurposing drafts for an activity. Kinds run in parallel on the
 * configured LLM. When a kind fails, a basic template draft is saved in its
 * place — clearly titled and reported in `warnings`, never silently. The
 * returned model label lists every generator that produced a draft.
 */
export async function generateRepurposing(
  organizationId: string,
  kinds: RepurposeKind[],
  ctx: GenerationContext
): Promise<{ model: string; drafts: DraftSpec[]; warnings: string[] }> {
  const config = await resolveAiConfig(organizationId);
  const template = new TemplateProvider();
  if (config.mode === "template" || !config.apiKey) {
    const drafts: DraftSpec[] = [];
    for (const kind of kinds) drafts.push(...(await template.generate(kind, ctx)).drafts);
    return {
      model: template.modelLabel,
      drafts,
      warnings: ["No AI provider is connected, so these are basic template drafts. Connect one in AI & Integrations for full drafts."],
    };
  }

  const llm = new LlmGenerator(buildClient({ ...config, apiKey: config.apiKey }));
  const outcomes = await Promise.all(
    kinds.map(async (kind) => {
      try {
        return { kind, ...(await llm.generate(kind, ctx)), fallback: false };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        console.error(`[ai] ${kind} generation failed for ${organizationId}: ${reason}`);
        const { drafts } = await template.generate(kind, ctx);
        return {
          kind,
          fallback: true,
          drafts: drafts.map((draft) => ({
            ...draft,
            title: `Template draft — ${draft.title}`.slice(0, 200),
            metadata: { ...draft.metadata, fallback_reason: reason.slice(0, 500) },
          })),
          warnings: [`${kindLabel(kind)}: AI generation failed (${reason.slice(0, 200)}). A basic template draft was saved instead — regenerate or rewrite it.`],
        };
      }
    })
  );
  const drafts = outcomes.flatMap((o) => o.drafts);
  const generators = new Set(outcomes.filter((o) => o.drafts.length).map((o) => (o.fallback ? template.modelLabel : llm.modelLabel)));
  return {
    model: [...generators].join(" + ") || llm.modelLabel,
    drafts,
    warnings: outcomes.flatMap((o) => o.warnings),
  };
}

/** Admin read of the AI integration row (server settings page). Never leaks the key. */
export async function getAiIntegration(organizationId: string): Promise<{
  status: string;
  provider: ProviderKey;
  hasKey: boolean;
  last4: string | null;
  updatedAt: string | null;
  model: string;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("status, config, updated_at")
    .eq("organization_id", organizationId)
    .eq("key", "ai")
    .maybeSingle<{
      status: string;
      config: Record<string, string>;
      updated_at: string;
    }>();
  const storedKey = decryptSecret(data?.config?.apiKey ?? "");
  const provider = getProvider(data?.config?.provider);
  return {
    status: data?.status ?? "not_connected",
    provider: provider.key,
    hasKey: storedKey.length > 0,
    last4: storedKey.length >= 4 ? storedKey.slice(-4) : null,
    updatedAt: data?.updated_at ?? null,
    model: isSupportedModel(provider.key, data?.config?.model ?? "")
      ? (data?.config?.model as string)
      : provider.defaultModel,
  };
}

/**
 * Free connectivity check per provider (never spends a generation call).
 * Resolves blanks from the stored/env config so "Test" works without
 * retyping the key.
 */
export async function testAiConnection(input: {
  provider?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ ok: boolean; models?: number; error?: string }> {
  const organizationId = await requireOrganizationId().catch(() => null);
  const provider = getProvider(input.provider);
  let apiKey = input.apiKey?.trim() || "";
  if (!apiKey && organizationId) {
    const stored = await getAiIntegration(organizationId);
    if (stored.provider === provider.key && stored.hasKey) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("integrations")
        .select("config")
        .eq("organization_id", organizationId)
        .eq("key", "ai")
        .maybeSingle<{ config: Record<string, string> }>();
      apiKey = decryptSecret(data?.config?.apiKey ?? "");
    }
  }
  if (!apiKey && provider.key === getProvider(process.env.AI_PROVIDER).key) {
    apiKey = process.env.AI_API_KEY ?? "";
  }
  if (!apiKey) return { ok: false, error: "No API key to test — enter one first." };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const check =
        provider.key === "anthropic"
          ? await fetch("https://api.anthropic.com/v1/models", {
              headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              signal: controller.signal,
            })
          : provider.key === "gemini"
            ? await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
                { signal: controller.signal }
              )
            : await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, {
                headers: { Authorization: `Bearer ${apiKey}` },
                signal: controller.signal,
              });
      if (check.status === 401 || check.status === 403) {
        return { ok: false, error: "Key rejected. Double-check it and try again." };
      }
      if (!check.ok) {
        return { ok: false, error: `No reply from ${provider.label} (HTTP ${check.status}). Try again in a moment.` };
      }
      const json = (await check.json().catch(() => null)) as
        | { data?: unknown[]; models?: unknown[] }
        | null;
      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.models)
          ? json.models
          : undefined;
      return { ok: true, models: list?.length };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, error: `Could not reach ${provider.label}. Check your connection and try again.` };
  }
}
