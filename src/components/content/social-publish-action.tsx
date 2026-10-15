"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { publishAssetViaBuffer, refreshBufferChannels, type BufferChannel, type IntegrationResult } from "@/actions/integrations";
import { localSchedule } from "@/lib/content/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SocialPublishAction({ assetId, connected, channels: initialChannels }: { assetId: string; connected: boolean; channels: BufferChannel[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [mode, setMode] = useState("now");
  const [refreshState, refresh, refreshing] = useActionState<IntegrationResult | null, FormData>(async () => {
    const result = await refreshBufferChannels();
    if (result.channels) setChannels(result.channels);
    return result;
  }, null);
  const [state, action, pending] = useActionState<IntegrationResult | null, FormData>(async (_previous, fd) => {
    try { return await publishAssetViaBuffer(assetId, String(fd.get("channel") ?? ""), mode === "schedule" ? localSchedule(String(fd.get("scheduled_for") ?? "")) : undefined); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Choose a valid publishing time." }; }
  }, null);
  return <section className="slip flex flex-col gap-3 p-5 sm:p-6">
    <div><p className="dateline">Social publishing</p><h2 className="mt-1 text-base font-bold">Send through Buffer</h2></div>
    {!connected ? <><p className="text-sm text-muted-foreground">Connect Buffer when you are ready to publish. You can still copy and record posts manually.</p><Link href="/settings/ai" className="text-sm text-primary underline underline-offset-2">Open AI & Integrations</Link></> : <>
      <form action={refresh}><Button type="submit" variant="outline" size="sm" disabled={refreshing || pending}>{refreshing ? "Loading channels…" : "Refresh channels"}</Button></form>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">Buffer channel<select name="channel" required disabled={pending} defaultValue="" className="h-10 min-w-0 rounded-md border border-border bg-card px-3"><option value="" disabled>Choose a channel</option>{channels.map(channel => <option key={channel.id} value={channel.id} disabled={channel.isDisconnected || channel.isLocked || channel.isQueuePaused}>{channel.displayName || channel.name} · {channel.descriptor}</option>)}</select></label>
        <label className="flex flex-col gap-1.5 text-sm">Delivery<select value={mode} disabled={pending} onChange={e => setMode(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3"><option value="now">Publish now</option><option value="schedule">Schedule a post</option></select></label>
        {mode === "schedule" ? <label className="flex flex-col gap-1.5 text-sm">Publishing time (WAT)<Input name="scheduled_for" type="datetime-local" required disabled={pending} /></label> : null}
        <p className="text-sm leading-5 text-muted-foreground">Sends the approved text. Channels requiring a photo or video use manual posting. Delivery is confirmed separately.</p>
        <Button type="submit" disabled={pending || !channels.length}>{pending ? "Submitting…" : mode === "schedule" ? "Schedule through Buffer" : "Publish through Buffer"}</Button>
      </form>
    </>}
    {refreshState?.error || state?.error ? <p role="alert" className="text-sm text-destructive">{state?.error || refreshState?.error}</p> : null}
    {state?.message ? <p role="status" className="text-sm">{state.message}</p> : null}
  </section>;
}
