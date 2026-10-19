"use client";

import { useActionState, useState } from "react";
import { MegaphoneIcon } from "lucide-react";
import {
  disconnectBufferAction,
  refreshBufferChannels,
  saveBufferApiKey,
  type BufferChannel,
  type IntegrationResult,
} from "@/actions/integrations";
import { ConnectorCard } from "@/components/settings/connector-card";
import { ChannelMark } from "@/components/settings/channel-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BufferConnector({
  connected,
  envConfigured,
  channels,
  organizationName,
}: {
  connected: boolean;
  /** Publishing is only offered once the workspace has a registered Buffer app. */
  envConfigured: boolean;
  channels: BufferChannel[];
  organizationName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [refresh, refreshAction, refreshing] = useActionState<
    IntegrationResult | null,
    FormData
  >(async () => refreshBufferChannels(), null);
  const [disconnect, disconnectAction, disconnecting] = useActionState<
    IntegrationResult | null,
    FormData
  >(async () => disconnectBufferAction(), null);
  const [connection, connectAction, connecting] = useActionState<IntegrationResult | null, FormData>(async (_previous, fd) => saveBufferApiKey(fd), null);

  const isConnected = connected;
  const channelList = channels;

  // A paused queue silently stops scheduled posts from going out, and a
  // disconnected channel accepts a post then drops it. Both are worth surfacing.
  const needsAttention = channelList.filter(
    (channel) => channel.isQueuePaused || channel.isDisconnected || channel.isLocked
  );

  return (
    <ConnectorCard
      id="connection-buffer"
      icon={<MegaphoneIcon />}
      title="Buffer"
      blurb="Schedule approved posts to the social accounts you link in Buffer."
      connected={isConnected}
      badge={
        isConnected
          ? [
              organizationName,
              `${channelList.length} ${channelList.length === 1 ? "channel" : "channels"}`,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >
      {isConnected ? (
        <div className="flex flex-col gap-3">
          {channelList.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {channelList.map((channel) => (
                <li
                  key={channel.id}
                  title={channel.descriptor}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-2 pr-2.5 text-xs text-muted-foreground"
                >
                  <ChannelMark
                    service={channel.service}
                    descriptor={channel.descriptor}
                    className="size-3.5 shrink-0 text-foreground"
                  />
                  <span className="min-w-0">
                    <span className="sr-only">{channel.descriptor}: </span>
                    <span className="font-medium text-foreground">{channel.name || "Connected account"}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-5 text-muted-foreground">
              No channels linked yet. Connect your social accounts inside
              Buffer, then refresh.
            </p>
          )}

          {needsAttention.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-[13px] leading-5 text-amber-700 dark:text-amber-400">
              {needsAttention.map((channel) => (
                <li key={channel.id} className="flex items-start gap-1.5">
                  <ChannelMark
                    service={channel.service}
                    descriptor={channel.descriptor}
                    className="mt-[0.2rem] size-3.5 shrink-0"
                  />
                  <span className="min-w-0">
                    {channel.descriptor}
                    {channel.isDisconnected
                      ? " is disconnected — reconnect it in Buffer."
                      : channel.isLocked
                        ? " is locked by your Buffer plan."
                        : " has a paused queue, so scheduled posts will not go out."}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <form action={refreshAction}><Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={refreshing || disconnecting}
            >
              {refreshing ? "Refreshing…" : "Refresh channels"}
            </Button></form>
            <form action={disconnectAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={refreshing || disconnecting}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form>
          </div>
        </div>
      ) : open ? (
        <div className="flex flex-col gap-3">
          <p className="max-w-[60ch] text-[13px] leading-5 text-muted-foreground"><a href="https://publish.buffer.com/settings/api" target="_blank" rel="noreferrer noopener" className="font-semibold text-primary underline underline-offset-4">Get a Buffer API key</a> with publishing access, then paste it below. If someone manages Buffer for your team, ask them for this key.</p>
          <form action={connectAction} className="flex max-w-lg flex-col gap-2">
            <label className="flex flex-col gap-1.5 text-sm">Your Buffer connection key<Input name="api_key" type="password" autoComplete="off" required minLength={8} maxLength={2000} disabled={connecting} placeholder="Paste your key here" /></label>
            <div className="flex gap-2"><Button type="submit" size="sm" className="w-fit" disabled={connecting}>{connecting ? "Checking connection…" : "Connect Buffer"}</Button><Button type="button" variant="ghost" size="sm" disabled={connecting} onClick={() => setOpen(false)}>Cancel</Button></div>
          </form>
          {envConfigured ? <Button asChild variant="outline" size="sm" className="w-fit"><a href="/api/integrations/buffer/connect">Sign in with Buffer instead</a></Button> : null}
        </div>
      ) : <Button type="button" variant="outline" className="w-fit" onClick={() => setOpen(true)}>Connect Buffer</Button>}

      {connection?.error ? <p role="alert" className="mt-2 text-sm text-destructive">{connection.error}</p> : null}
      {connection?.message ? <p role="status" className="mt-2 text-sm">{connection.message}</p> : null}

      {refresh?.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {refresh.error}
        </p>
      ) : null}
      {disconnect?.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {disconnect.error}
        </p>
      ) : null}
    </ConnectorCard>
  );
}
