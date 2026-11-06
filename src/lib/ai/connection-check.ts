import { getProvider, isProviderKey, isSupportedModel } from "@/lib/ai/providers";

export async function checkProviderModel(provider: string, model: string, apiKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!isProviderKey(provider) || !isSupportedModel(provider, model)) return { ok: false, error: "Choose a supported provider and model." };
  const def = getProvider(provider);
  const modelId = encodeURIComponent(model);
  const url = provider === "gemini"
    ? `https://generativelanguage.googleapis.com/v1beta/models/${modelId}`
    : `${def.baseUrl}/models/${modelId}`;
  const headers: Record<string, string> = provider === "anthropic"
    ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    : provider === "gemini" ? { "x-goog-api-key": apiKey } : { Authorization: `Bearer ${apiKey}` };
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000), cache: "no-store", redirect: "error" });
    if (response.status === 401 || response.status === 403) return { ok: false, error: "Key rejected or access denied. Check your provider permissions." };
    if (response.status === 404) return { ok: false, error: `${def.label} does not offer this model to your account. Choose another model.` };
    if (response.status === 429) return { ok: false, error: "The provider is rate limiting requests. Wait a moment and try again." };
    if (!response.ok) return { ok: false, error: `${def.label} returned HTTP ${response.status}. Try again in a moment.` };
    const result = await response.json() as { id?: string; name?: string; supportedGenerationMethods?: string[] };
    if (!result.id && !result.name) return { ok: false, error: "The provider returned an invalid model response. Nothing was saved." };
    if (provider === "gemini" && !result.supportedGenerationMethods?.includes("generateContent")) return { ok: false, error: "This Gemini model does not support content generation." };
    return { ok: true };
  } catch {
    return { ok: false, error: `Could not reach ${def.label}. Check your connection and try again.` };
  }
}
