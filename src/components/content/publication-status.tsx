"use client";

import { useActionState } from "react";
import { recoverPublishingRequest, refreshPublicationStatus, type IntegrationResult } from "@/actions/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PublicationStatus({ assetId, provider, error, url, missingReceipt = false }: { assetId: string; provider: string; error?: string | null; url?: string | null; missingReceipt?: boolean }) {
  const [state, action, pending] = useActionState<IntegrationResult | null, FormData>(async () => refreshPublicationStatus(assetId), null);
  const [recovery, recover, recovering] = useActionState<IntegrationResult | null, FormData>(async (_previous, fd) => recoverPublishingRequest(assetId, fd), null);
  return <section className="slip flex flex-col gap-3 p-5 sm:p-6">
    <div><p className="dateline">Delivery status</p><h2 className="mt-1 text-base font-bold">Awaiting {provider} confirmation</h2></div>
    <p className="text-sm leading-6 text-muted-foreground">The provider owns this publishing request. Manage the post there, then check its status here before editing this asset.</p>
    {url ? <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-2">Open provider post</a> : null}
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
    <form action={action}><Button type="submit" variant="outline" disabled={pending}>{pending ? "Checking…" : "Check delivery status"}</Button></form>
    {missingReceipt ? <form action={recover} className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">If the provider created this post after a timeout, paste its post ID to recover the receipt. The content is verified before linking.</p><label className="flex flex-col gap-1.5 text-sm">Provider post ID<Input name="external_id" required maxLength={200} disabled={recovering} /></label><Button type="submit" variant="outline" disabled={recovering}>{recovering ? "Verifying receipt…" : "Verify & recover receipt"}</Button></form> : null}
    {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {state?.message ? <p role="status" className="text-sm">{state.message}</p> : null}
    {recovery?.error ? <p role="alert" className="text-sm text-destructive">{recovery.error}</p> : null}
    {recovery?.message ? <p role="status" className="text-sm">{recovery.message}</p> : null}
  </section>;
}
