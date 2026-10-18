"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Send, RefreshCw } from "lucide-react";
import { publishAssetViaBuffer, refreshBufferChannels, type BufferChannel, type IntegrationResult } from "@/actions/integrations";
import { localSchedule } from "@/lib/content/scheduling";
import { bufferPostProblem, socialService, type SocialCopy } from "@/lib/content/social-publishing";
import { checkChannelLimits } from "@/lib/content/channels";
import { formatDayTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function SocialPublishAction({ assetId, connected, channels: initialChannels, copy, updatedAt }: { assetId: string; connected: boolean; channels: BufferChannel[]; copy: SocialCopy; updatedAt: string }) {
  const [channels, setChannels] = useState(initialChannels);
  const [channelId, setChannelId] = useState("");
  const [mode, setMode] = useState("now");
  const [time, setTime] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [timeError, setTimeError] = useState("");
  const [scheduledIso, setScheduledIso] = useState<string | undefined>();
  const [refreshState, refresh, refreshing] = useActionState<IntegrationResult | null, FormData>(async () => {
    const result = await refreshBufferChannels();
    if (result.channels) { setChannels(result.channels); setChannelId(""); }
    return result;
  }, null);
  const [state, action, pending] = useActionState<IntegrationResult | null, FormData>(async () => {
    try { return await publishAssetViaBuffer(assetId, channelId, scheduledIso, updatedAt); }
    catch { return { ok: false, error: "Could not submit this post. Check delivery before retrying." }; }
  }, null);
  const platform = socialService(copy.platform || copy.channel);
  const matching = channels.filter(channel => platform === "social" || socialService(channel.service) === platform);
  const selected = matching.find(channel => channel.id === channelId);
  const problem = selected ? bufferPostProblem(copy, selected) : null;
  const length = checkChannelLimits(selected?.service || platform, copy.body, copy.format);
  function review() {
    setTimeError("");
    try {
      const at = mode === "schedule" ? localSchedule(time) : undefined;
      if (at && Date.parse(at) < Date.now() + 60000) throw new Error("Choose a publishing time at least one minute from now.");
      setScheduledIso(at); setReviewOpen(true);
    } catch (error) { setTimeError(error instanceof Error ? error.message : "Choose a valid publishing time."); }
  }
  return <section className="slip flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="buffer-publish-heading">
    <div><p className="dateline">Social publishing</p><h2 id="buffer-publish-heading" className="mt-1 text-base font-bold">Send through Buffer</h2></div>
    {!connected ? <><p className="text-sm leading-6 text-muted-foreground">Connect Buffer to publish approved text or schedule its delivery. Manual posting is available now.</p><Link href="/settings/ai#connection-buffer" className="text-sm font-semibold text-primary underline underline-offset-4">Connect Buffer</Link></> : <>
      <form action={refresh}><Button type="submit" variant="outline" size="sm" disabled={refreshing || pending}><RefreshCw data-icon="inline-start" aria-hidden="true" />{refreshing ? "Loading channels…" : "Refresh channels"}</Button></form>
      {matching.length ? <>
        <div className="flex flex-col gap-2"><Label htmlFor="buffer-channel">Destination</Label><Select value={channelId} onValueChange={setChannelId} disabled={pending || refreshing}><SelectTrigger id="buffer-channel"><SelectValue placeholder="Choose an account" /></SelectTrigger><SelectContent>{matching.map(channel => {
          const issue = bufferPostProblem(copy, channel);
          return <SelectItem key={channel.id} value={channel.id} disabled={Boolean(issue)}>{channel.displayName || channel.name} · {channel.descriptor}{issue ? ` · ${issue}` : ""}</SelectItem>;
        })}</SelectContent></Select></div>
        {!matching.some(channel => !bufferPostProblem(copy, channel)) ? <p className="text-sm leading-6 text-muted-foreground">No saved account can publish this copy. Refresh channels, resolve any restrictions in Buffer, or use manual posting.</p> : null}
        <div className="flex flex-col gap-2"><Label htmlFor="buffer-delivery">Delivery</Label><Select value={mode} disabled={pending} onValueChange={setMode}><SelectTrigger id="buffer-delivery"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Publish now</SelectItem><SelectItem value="schedule">Schedule a post</SelectItem></SelectContent></Select></div>
        {mode === "schedule" ? <div className="flex flex-col gap-2"><Label htmlFor="buffer-time">Publishing time (WAT)</Label><Input id="buffer-time" type="datetime-local" value={time} onChange={event => setTime(event.target.value)} required disabled={pending} /></div> : null}
        <p className="text-xs leading-5 text-muted-foreground">{length.length}{length.limit ? ` / ${length.limit}` : ""} characters. Sends text only; photos, videos and separate thread parts use manual posting.</p>
        {problem || timeError ? <p role="alert" className="text-sm text-destructive">{problem || timeError}</p> : null}
        <Button type="button" onClick={review} disabled={pending || refreshing || !selected || Boolean(problem)}>Review {mode === "schedule" ? "scheduled post" : "post"}</Button>
      </> : <p className="text-sm leading-6 text-muted-foreground">No saved Buffer accounts match this post’s platform. Connect the matching account in Buffer, then refresh channels here.</p>}
      <p className="text-xs leading-5 text-muted-foreground">Buffer acceptance is recorded separately from confirmed publication.</p>
    </>}
    {refreshState?.error || state?.error ? <p role="alert" className="text-sm text-destructive">{state?.error || refreshState?.error}</p> : null}
    {state?.message ? <p role="status" className="text-sm">{state.message}</p> : null}
    <Dialog open={reviewOpen} onOpenChange={open => { if (!pending) setReviewOpen(open); }}><DialogContent onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogTitle>{mode === "schedule" ? "Confirm scheduled post" : "Confirm publication"}</DialogTitle>
      <DialogDescription>{selected?.displayName || selected?.name} · {scheduledIso ? formatDayTime(scheduledIso) : "Publishes as soon as Buffer processes it."} Approval and account availability are checked again when you confirm.</DialogDescription>
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-4 text-sm leading-6" aria-label="Approved post preview">{copy.body}</div>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <form action={action}><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setReviewOpen(false)}>Back</Button><Button type="submit" disabled={pending || Boolean(state?.publicationId)}><Send data-icon="inline-start" aria-hidden="true" />{pending ? "Submitting…" : scheduledIso ? "Confirm schedule" : "Publish now"}</Button></DialogFooter></form>
    </DialogContent></Dialog>
  </section>;
}
