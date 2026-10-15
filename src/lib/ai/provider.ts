import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationId } from "@/lib/supabase/organization";
import type {
  AiProvider,
  DraftSpec,
  GenerationContext,
  RepurposeKind,
  ResolvedAiConfig,
} from "@/lib/ai/types";
import { TemplateProvider } from "@/lib/ai/template";
import { OpenAiCompatibleProvider } from "@/lib/ai/openai-compatible";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import {
  defaultModel,
  getProvider,
  isSupportedModel,
  type ProviderKey,
} from "@/lib/ai/providers";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { checkProviderModel } from "@/lib/ai/connection-check";

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

function buildLlm(config: ResolvedLlmConfig & { apiKey: string }): AiProvider {
  if (config.provider === "anthropic") {
    return new AnthropicProvider({ apiKey: config.apiKey, model: config.model });
  }
  // OpenAI and Gemini both speak the OpenAI-compatible wire format.
  return new OpenAiCompatibleProvider({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? getProvider(config.provider).baseUrl,
    model: config.model,
  });
}

/** Provider-agnostic, grounded text completion used by the marketing assistant. */
export async function completeWithConfiguredProvider(
  organizationId: string,
  system: string,
  prompt: string
): Promise<{ model: string; text: string } | null> {
  const config = await resolveAiConfig(organizationId);
  if (config.mode !== "llm" || !config.apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    if (config.provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1200,
          temperature: 0.3,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) throw new Error(`Assistant provider returned HTTP ${response.status}.`);
      const json = await response.json() as { content?: Array<{ text?: string }> };
      const text = json.content?.find((block) => typeof block.text === "string")?.text?.trim();
      if (!text) throw new Error("Assistant returned an empty response.");
      return { model: config.model, text: text.slice(0, 12000) };
    }
    const response = await fetch(`${(config.baseUrl ?? getProvider(config.provider).baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        max_tokens: 1200,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Assistant provider returned HTTP ${response.status}.`);
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Assistant returned an empty response.");
    return { model: config.model, text: text.slice(0, 12000) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Assistant request timed out. Try a shorter question.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

/**
 * Generate repurposing drafts for an activity. Tries the configured LLM per
 * kind; any failure falls back to the grounded template generator so the
 * flow always produces reviewable drafts. Returns the model label for the
 * ai_generations traceability row.
 */
export async function generateRepurposing(
  organizationId: string,
  kinds: RepurposeKind[],
  ctx: GenerationContext
): Promise<{ model: string; drafts: DraftSpec[] }> {
  const config = await resolveAiConfig(organizationId);
  if (config.mode === "template" || !config.apiKey) {
    const provider = new TemplateProvider();
    const drafts: DraftSpec[] = [];
    for (const kind of kinds) drafts.push(...(await provider.generate(kind, ctx)));
    return { model: provider.modelLabel, drafts };
  }

  const llm = buildLlm({ ...config, apiKey: config.apiKey });
  const template = new TemplateProvider();
  const drafts: DraftSpec[] = [];
  let usedLlm = false;
  for (const kind of kinds) {
    try {
      drafts.push(...(await llm.generate(kind, ctx)));
      usedLlm = true;
    } catch {
      drafts.push(...(await template.generate(kind, ctx)));
    }
  }
  return { model: usedLlm ? llm.modelLabel : template.modelLabel, drafts };
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
    hasKey: data?.status === "connected" && storedKey.length > 0,
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
  if (!organizationId) return { ok: false, error: "Sign in to test your workspace connection." };
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
  if (input.model) return checkProviderModel(provider.key, input.model, apiKey);
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
