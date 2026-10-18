export const SOCIAL_PLATFORMS = ["linkedin", "instagram", "facebook", "x", "twitter", "youtube", "tiktok", "threads", "bluesky", "pinterest", "mastodon", "social"] as const;
const socialChannels = new Set<string>(SOCIAL_PLATFORMS);

export function isSocialAsset(channel: string | null, platform: string | null) {
  return socialChannels.has((channel ?? "").trim().toLowerCase()) || socialChannels.has((platform ?? "").trim().toLowerCase());
}

export function parseLivePostUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname.endsWith(".localhost") || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(":")) return null;
    if (url.pathname === "/" && !url.search) return null;
    return url.href;
  } catch { return null; }
}
