import { checkChannelLimits } from "@/lib/content/channels";
import { isSocialAsset } from "@/lib/content/manual-posting";

export type SocialCopy = { body: string | null; channel: string | null; platform: string | null; format: string | null };
export type SocialChannel = { id: string; service: string; isDisconnected: boolean; isLocked: boolean; isQueuePaused: boolean };
const TEXT_SERVICES = new Set(["linkedin", "x", "facebook", "threads", "bluesky", "mastodon"]);
export const socialService = (value: string | null) => (value ?? "").trim().toLowerCase().replace(/^twitter$/, "x");

export function bufferPostProblem(asset: SocialCopy, channel: SocialChannel): string | null {
  if (channel.isDisconnected) return "Reconnect this channel in Buffer.";
  if (channel.isLocked) return "This channel is locked in Buffer.";
  if (channel.isQueuePaused) return "Resume this channel’s queue in Buffer.";
  if (!isSocialAsset(asset.channel, asset.platform) || asset.format === "short-form video") return "Use manual posting for video files and production scripts.";
  if (!asset.body?.trim()) return "Add and approve the post copy first.";
  const service = socialService(channel.service);
  const platform = socialService(asset.platform || asset.channel);
  if (!TEXT_SERVICES.has(service)) return "This channel needs media. Use manual posting.";
  if (platform !== "social" && platform !== service) return "Choose a channel matching this post’s platform.";
  if (service === "x" && asset.body.includes("— Optional thread (post each separately) —")) return "This draft includes a separate X thread. Post each part manually, or approve a single post before using Buffer.";
  // These networks aren't part of the editorial channel catalogue yet.
  const extraLimit = ({ threads: 500, bluesky: 300, mastodon: 500 } as Record<string, number>)[service];
  if (extraLimit && Array.from(asset.body).length > extraLimit) return `This copy exceeds the supported ${extraLimit}-character limit for ${service}.`;
  return checkChannelLimits(service, asset.body, asset.format).problems.join(" ") || null;
}
