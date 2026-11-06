import { z } from "zod";

/** Public media is loaded by the visitor's browser, never with workspace credentials. */
export function publicMediaUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") ||
      host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":")) return null;
    if ([...url.searchParams.keys()].some(key => /^(?:token|access_token|api_?key|key|secret|password|signature|authorization|credential|x-amz-.+|x-goog-.+)$/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}

export function videoEmbedUrl(value: string): string | null {
  const safe = publicMediaUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname)) {
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
    const id = url.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}?dnt=1` : null;
  }
  return null;
}

const text = (max: number) => z.string().trim().min(1, "Complete each added section, or remove the sections you do not need.").max(max);
const mediaUrl = z.string().trim().max(1000).refine(v => !v || Boolean(publicMediaUrl(v)), "Use a public HTTPS media link without credentials, private access tokens or a port.");
export const landingPageContentSchema = z.object({
  version: z.literal(1).default(1),
  description: z.string().trim().max(600).default(""),
  benefits: z.array(text(240)).max(8).default([]),
  programme: z.array(z.object({ label: text(80), detail: text(300) })).max(8).default([]),
  image: z.object({ url: mediaUrl.default(""), alt: z.string().trim().max(200).default("") })
    .refine(v => !v.url || Boolean(v.alt), "Describe the image so everyone can understand it.")
    .default({ url: "", alt: "" }),
  video: z.object({ url: z.string().trim().max(1000).refine(v => !v || Boolean(videoEmbedUrl(v)), "Use a YouTube or Vimeo video link."), title: z.string().trim().max(160) }).default({ url: "", title: "" }),
  testimonials: z.array(z.object({ quote: text(1000), name: text(120), role: z.string().trim().max(160).default("") })).max(6).default([]),
  faqs: z.array(z.object({ question: text(200), answer: text(1500) })).max(10).default([]),
});
export type LandingPageContent = z.infer<typeof landingPageContentSchema>;
export const EMPTY_PAGE_CONTENT: LandingPageContent = landingPageContentSchema.parse({});

export function pageContent(metadata: Record<string, unknown> | null | undefined): LandingPageContent {
  const result = landingPageContentSchema.safeParse(metadata?.builder);
  return result.success ? result.data : landingPageContentSchema.parse({});
}

export const copyVariationsSchema = z.object({ variations: z.array(z.object({
  headline: text(200).min(5), description: text(600), cta_label: text(60).min(2),
})).length(3) });
export type CopyVariation = z.infer<typeof copyVariationsSchema>["variations"][number];
export type PageCopySuggestions = { variations: CopyVariation[]; model: string; generatedAt: string; brandSources: string[] };

export function pageCopySuggestions(metadata: Record<string, unknown> | null | undefined): PageCopySuggestions | null {
  const raw = metadata?.copy_suggestions;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as PageCopySuggestions;
  const parsed = copyVariationsSchema.safeParse(value);
  return parsed.success && typeof value.model === "string" && typeof value.generatedAt === "string"
    ? { ...parsed.data, model: value.model, generatedAt: value.generatedAt, brandSources: Array.isArray(value.brandSources) ? value.brandSources.filter(s => typeof s === "string") : [] } : null;
}
