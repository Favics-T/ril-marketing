import { ChannelMark, socialChannelKey } from "@/components/settings/channel-icons";
import { channelLabel } from "@/lib/channels";
import { cn } from "@/lib/utils";

export function ChannelIdentity({ channel, className }: { channel: string | null | undefined; className?: string }) {
  if (!channel) return null;
  const name = channelLabel(channel);
  if (!socialChannelKey(channel)) return <span className={className}>{name}</span>;
  return <span role="img" aria-label={name} title={name} className={cn("inline-flex shrink-0 items-center align-middle", className)}><ChannelMark service={channel} className="size-4 shrink-0" /></span>;
}

export function ContentChannels({ channel, platform, format }: { channel: string | null; platform?: string | null; format?: string | null }) {
  const channels = [channel, platform].filter((value): value is string => Boolean(value));
  const unique = channels.filter((value, index) => channels.findIndex(other => (socialChannelKey(other) ?? other.toLowerCase()) === (socialChannelKey(value) ?? value.toLowerCase())) === index);
  return <span className="inline-flex max-w-full items-center gap-2 align-middle">{unique.map((value, index) => <span key={value} className="inline-flex items-center gap-2">{index > 0 ? <span aria-hidden="true">·</span> : null}<ChannelIdentity channel={value} /></span>)}{format ? <>{unique.length ? <span aria-hidden="true">·</span> : null}<span className="truncate">{format}</span></> : null}{!unique.length && !format ? "No channel set" : null}</span>;
}
