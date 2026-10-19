"use client";

import { useActionState, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { recordManualPost, type ManualPostResult } from "@/actions/manual-posting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ManualPostAction({ assetId, body, status, liveUrl, recordedAt }: { assetId: string; body: string | null; status: string; liveUrl: string | null; recordedAt: string | null }) {
  const [copyState, setCopyState] = useState("");
  const [state, action, pending] = useActionState<ManualPostResult | null, FormData>(async (_previous, formData) => recordManualPost(assetId, formData), null);
  const ready = ["approved", "scheduled"].includes(status) && Boolean(body?.trim());
  async function copyText() {
    try { await navigator.clipboard.writeText(body ?? ""); setCopyState("Copied. Paste this text into your social channel."); }
    catch { setCopyState("Could not copy automatically. Select and copy the text shown on this page."); }
  }
  return <section className="slip flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="manual-post-heading">
    <div><p className="dateline">Social publishing</p><h2 id="manual-post-heading" className="mt-1 text-base font-bold">Post manually</h2></div>
    {["published", "analysing"].includes(status) ? <><p className="text-sm text-muted-foreground">This asset is marked as published.</p>{liveUrl ? <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ExternalLink className="size-4"/>View live post</a> : <p className="text-xs text-muted-foreground">No manual post link was recorded.</p>}{recordedAt && <p className="text-xs text-muted-foreground">Recorded <time dateTime={recordedAt}>{new Date(recordedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} WAT</time></p>}</> : <>
      <p className="text-sm leading-6 text-muted-foreground">Copy the approved text and post it on your social channel. Then paste the live post link here to record it.</p>
      <Button type="button" variant="outline" onClick={copyText} disabled={!ready}><Copy data-icon="inline-start" aria-hidden="true" />Copy post text</Button>
      <p role="status" className="text-xs leading-5 text-muted-foreground">{copyState || (!ready ? "Complete approval before posting this content." : "Copying does not change the asset’s status.")}</p>
      {ready && <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Live post link</span><Input name="live_url" type="url" placeholder="https://…/your-post" required maxLength={2000} disabled={pending}/></label>
        <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" name="confirm_posted" required disabled={pending} className="mt-1 size-4 shrink-0"/>I have posted this content and this link opens the live post.</label>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>{pending ? "Saving post record…" : "Mark as posted"}</Button>
      </form>}
    </>}
    {state?.warning && <p role="status" className="text-xs text-muted-foreground">{state.warning}</p>}
  </section>;
}
