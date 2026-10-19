import { checkChannelLimits } from "@/lib/content/channels";
import { isSocialAsset } from "@/lib/content/manual-posting";
import { socialPost, socialPostSchema } from "@/lib/content/social-media";

export type SocialCopy = { body: string | null; channel: string | null; platform: string | null; format: string | null; metadata?: Record<string, unknown> | null };
export type SocialChannel = { id: string; service: string; isDisconnected: boolean; isLocked: boolean; isQueuePaused: boolean };
const TEXT_SERVICES = new Set(["linkedin", "x", "facebook", "threads", "bluesky", "mastodon"]);
export const socialService = (value: string | null) => (value ?? "").trim().toLowerCase().replace(/^twitter$/, "x");

export function bufferPostProblem(asset: SocialCopy, channel: SocialChannel): string | null {
  if (channel.isDisconnected) return "Reconnect this channel in Buffer.";
  if (channel.isLocked) return "This channel is locked in Buffer.";
  if (channel.isQueuePaused) return "Resume this channel’s queue in Buffer.";
  if (!isSocialAsset(asset.channel, asset.platform) || asset.format === "short-form video") return "A production script cannot be published as a finished video. Create a post with the final media file.";
  if (!asset.body?.trim()) return "Add and approve the post copy first.";
  const service = socialService(channel.service);
  const platform = socialService(asset.platform || asset.channel);
  if (!TEXT_SERVICES.has(service) && !["instagram","youtube"].includes(service)) return "This channel is not supported for automatic publishing yet. Use manual posting.";
  if (!socialPostSchema.safeParse(asset.metadata?.social_post ?? {}).success) return "Return this post to Editing and correct its media settings.";
  const post = socialPost(asset.metadata);
  if (post.postType !== "post" && !["instagram","facebook"].includes(service)) return "Reels and stories are supported for Instagram and Facebook. Choose Post for this account.";
  const video = post.media.some(media => media.type === "video");
  if (video && (post.media.length !== 1 || post.media[0].type !== "video")) return "Publish one video at a time; do not mix videos and images.";
  if (service === "instagram" && !post.media.length) return "Instagram needs an approved image or video. Add media in the draft editor.";
  if (service === "youtube" && (!video || !post.videoTitle)) return "YouTube needs one approved video and a video title.";
  if ((post.postType === "reel" || post.postType === "story") && post.media.length !== 1) return "A reel or story needs exactly one media file.";
  if (post.postType === "reel" && !video) return "A reel needs a video file.";
  if (["threads","bluesky","mastodon"].includes(service) && post.media.length) return "Use manual posting for media on this platform; text is supported here.";
  if (platform !== "social" && platform !== service) return "Choose a channel matching this post’s platform.";
  if (service === "x" && asset.body.includes("— Optional thread (post each separately) —")) return "This draft includes a separate X thread. Post each part manually, or approve a single post before using Buffer.";
  // These networks aren't part of the editorial channel catalogue yet.
  const extraLimit = ({ threads: 500, bluesky: 300, mastodon: 500 } as Record<string, number>)[service];
  if (extraLimit && Array.from(asset.body).length > extraLimit) return `This copy exceeds the supported ${extraLimit}-character limit for ${service}.`;
  return checkChannelLimits(service, asset.body, asset.format).problems.join(" ") || null;
}
