/**
 * Supported AI providers. The user picks a name, pastes a key, picks a
 * model — everything else (endpoints, headers, test strategy) lives here.
 * Model IDs are curated and validated server-side; update them here as
 * vendors release new models. Generation always falls back to the grounded
 * template generator, so a stale ID degrades gracefully instead of failing.
 *
 * This file is also the single source of the words a user reads on
 * Settings → AI. Keep `tagline`, `keyHelp` and each model `hint` in plain
 * language: no endpoint names, no wire formats, no vendor jargon.
 *
 * Model lists last checked against vendor documentation on 2026-09-23:
 *  - OpenAI   developers.openai.com/api/docs/models  (GPT-6 Astra / Sol / Luna)
 *  - Anthropic platform.claude.com/docs/en/models/overview
 *  - Gemini   ai.google.dev/gemini-api/docs/models
 * Retired or limited-access models are deliberately excluded — Gemini 2.5 is
 * now restricted to existing users, and OpenAI's o4-mini is deprecated.
 */

export type ProviderKey = "openai" | "anthropic" | "gemini";

export interface ProviderModel {
  id: string;
  /** Model name as the vendor writes it. */
  label: string;
  /** One plain sentence: who should pick this one. */
  hint: string;
}

export interface ProviderDef {
  key: ProviderKey;
  label: string;
  /** One-line description shown on the provider tile. */
  tagline: string;
  keyPlaceholder: string;
  keyHelp: string;
  /** Where the user creates a key. Shown as "Where do I find this?". */
  keyUrl: string;
  baseUrl: string;
  defaultModel: string;
  models: ProviderModel[];
}

export const PROVIDERS: Record<ProviderKey, ProviderDef> = {
  openai: {
    key: "openai",
    label: "OpenAI",
    tagline: "The models behind ChatGPT. A safe default with the widest choice.",
    keyPlaceholder: "Paste your key — it starts with sk-",
    keyHelp: "Paste the key exactly as it appears. Keys are hidden after saving.",
    keyUrl: "https://platform.openai.com/api-keys",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-6-luna",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "Fastest and cheapest of the current generation — a good default." },
      { id: "gpt-6-sol", label: "GPT-6 Sol", hint: "Better writing for longer drafts. Costs more per draft." },
      { id: "gpt-6-astra", label: "GPT-6 Astra", hint: "Most capable and most expensive. Use for flagship articles." },
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", hint: "Previous-generation flagship, still available." },
    ],
  },
  anthropic: {
    key: "anthropic",
    label: "Claude",
    tagline: "Anthropic's Claude. Strong at long drafts and holding a tone of voice.",
    keyPlaceholder: "Paste your key — it starts with sk-ant-",
    keyHelp: "Paste the key exactly as it appears. Keys are hidden after saving.",
    keyUrl: "https://console.anthropic.com/settings/keys",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-5",
    models: [
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "Fastest and cheapest. Good for short social posts." },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "Best mix of speed and quality — recommended." },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "Most capable for long-running work. Costs more." },
      { id: "claude-fable-5-1", label: "Claude Fable 5.1", hint: "Anthropic's top model for demanding reasoning." },
    ],
  },
  gemini: {
    key: "gemini",
    label: "Gemini",
    tagline: "Google's Gemini. Supports image, audio and video analysis.",
    keyPlaceholder: "Paste your key — it starts with AIza",
    keyHelp: "Paste the key exactly as it appears. Keys are hidden after saving.",
    keyUrl: "https://aistudio.google.com/apikey",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3.8-flash",
    models: [
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", hint: "Fastest and cheapest." },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", hint: "Google's recommended model for new projects — recommended." },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", hint: "Previous-generation Flash, still stable." },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", hint: "Most capable, preview release." },
    ],
  },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as ProviderKey[];

export function getProvider(key: string | null | undefined): ProviderDef {
  if (key === "anthropic" || key === "gemini" || key === "openai") {
    return PROVIDERS[key];
  }
  return PROVIDERS.openai;
}

export function isProviderKey(value: string | null | undefined): value is ProviderKey {
  return value === "openai" || value === "anthropic" || value === "gemini";
}

/** Server-side allowlist: only curated models can be saved or used. */
export function isSupportedModel(provider: ProviderKey, model: string): boolean {
  return PROVIDERS[provider].models.some((m) => m.id === model);
}

export function defaultModel(provider: ProviderKey): string {
  return PROVIDERS[provider].defaultModel;
}

/** The curated entry for a stored model ID, or the ID itself when unknown. */
export function getModel(provider: ProviderKey, model: string): ProviderModel {
  return (
    PROVIDERS[provider].models.find((m) => m.id === model) ?? {
      id: model,
      label: model,
      hint: "",
    }
  );
}

/** Friendly name for a stored model, e.g. "GPT-6 Luna" instead of "gpt-6-luna". */
export function modelLabel(provider: ProviderKey, model: string): string {
  return getModel(provider, model).label;
}
