import { PLATFORM_LIMITS } from "@/lib/ai/specs/social";
import { xLength } from "@/lib/ai/specs/shared";

/**
 * The fixed list of channels an asset can target, with each one's hard
 * limits. The draft editor, the review/approval gate and the AI quality
 * checks all read limits from PLATFORM_LIMITS, so they can't disagree.
 */
export const CHANNELS = [
  { value: "linkedin", label: "LinkedIn", limit: PLATFORM_LIMITS.linkedin },
  { value: "instagram", label: "Instagram", limit: PLATFORM_LIMITS.instagram, hashtagLimit: PLATFORM_LIMITS.instagramHashtags },
  { value: "x", label: "X", limit: PLATFORM_LIMITS.x, perPost: true },
  { value: "facebook", label: "Facebook", limit: PLATFORM_LIMITS.facebook },
  { value: "youtube", label: "YouTube", limit: PLATFORM_LIMITS.youtubeDescription },
  { value: "tiktok", label: "TikTok", limit: PLATFORM_LIMITS.tiktokCaption },
  { value: "website", label: "Website / blog" },
  { value: "email", label: "Email / newsletter" },
  { value: "other", label: "Other" },
] as const satisfies ReadonlyArray<{ value: string; label: string; limit?: number; hashtagLimit?: number; perPost?: boolean }>;

export type Channel = (typeof CHANNELS)[number]["value"];
type ChannelRule = { value: Channel; label: string; limit?: number; hashtagLimit?: number; perPost?: boolean };

const ALIASES: Record<string, Channel> = {
  twitter: "x",
  "x (twitter)": "x",
  "x/twitter": "x",
  ig: "instagram",
  fb: "facebook",
  yt: "youtube",
  youtube_shorts: "youtube",
  "youtube shorts": "youtube",
  blog: "website",
  web: "website",
  site: "website",
  newsletter: "email",
  "e-mail": "email",
};

/** Map a stored, possibly free-typed channel onto the fixed list. Empty stays null. */
export function normalizeChannel(raw: string | null | undefined): Channel | null {
  const key = raw?.trim().toLowerCase();
  if (!key) return null;
  const direct = CHANNELS.find((c) => c.value === key || c.label.toLowerCase() === key);
  return direct?.value ?? ALIASES[key] ?? "other";
}

export function channelRule(channel: string | null | undefined): ChannelRule | null {
  const value = normalizeChannel(channel);
  return (CHANNELS as ReadonlyArray<ChannelRule>).find((c) => c.value === value) ?? null;
}

/** AI X drafts put an optional thread after this line; each part is its own post. */
const X_THREAD_SEPARATOR = /\n+— Optional thread \(post each separately\) —\n+/;

export interface LengthCheck {
  /** Characters used, as the platform counts them (the longest post for X threads). */
  length: number;
  limit: number | null;
  hashtags: number;
  hashtagLimit: number | null;
  /** Plain-language reasons the copy can't go to review; empty when it fits. */
  problems: string[];
}

/**
 * Check copy against its channel's hard limits. Short-form clip briefs are
 * production notes rather than post copy, so they are never blocked.
 */
export function checkChannelLimits(
  channel: string | null | undefined,
  body: string | null | undefined,
  format?: string | null
): LengthCheck {
  const rule = channelRule(channel);
  const text = body ?? "";
  const hashtags = text.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  const result: LengthCheck = {
    length: Array.from(text).length,
    limit: rule?.limit ?? null,
    hashtags,
    hashtagLimit: rule?.hashtagLimit ?? null,
    problems: [],
  };
  if (!rule?.limit || format === "short-form video") return result;

  if (rule.perPost) {
    const [post, thread] = text.split(X_THREAD_SEPARATOR);
    const posts = [post, ...(thread ? thread.split(/\n{2,}/) : [])].map((p) => p.trim()).filter(Boolean);
    const lengths = posts.map(xLength);
    result.length = Math.max(0, ...lengths);
    lengths.forEach((length, index) => {
      if (length > rule.limit!) {
        const which = index === 0 ? "The post" : `Thread post ${index}`;
        result.problems.push(`${which} is ${length} characters; ${rule.label} allows ${rule.limit}.`);
      }
    });
  } else if (result.length > rule.limit) {
    result.problems.push(`${rule.label} copy is ${result.length} characters; the limit is ${rule.limit}.`);
  }
  if (rule.hashtagLimit && hashtags > rule.hashtagLimit) {
    result.problems.push(`${rule.label} allows ${rule.hashtagLimit} hashtags; this has ${hashtags}.`);
  }
  return result;
}
