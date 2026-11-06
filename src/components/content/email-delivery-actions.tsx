"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { queueEmailCampaign, sendEmailCampaignBatch } from "@/actions/email";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function EmailDeliveryActions({ campaignId, status, hasRecipients }: { campaignId: string; status: string; hasRecipients: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  function run(action: "queue" | "send") {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result = action === "queue" ? await queueEmailCampaign(campaignId) : await sendEmailCampaignBatch(campaignId);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Email delivery action failed."); return; }
      setMessage(result.message ?? "Email delivery updated.");
      router.refresh();
    });
  }
  return <div className="flex flex-wrap items-center gap-2">
    {status === "approved" ? <Button type="button" size="sm" variant="outline" disabled={busy || !hasRecipients} onClick={() => run("queue")}>{busy ? "Preparing…" : "Queue approved campaign"}</Button> : null}
    {status === "scheduled" ? <Button type="button" size="sm" disabled={busy} onClick={() => setConfirmSend(true)}>{busy ? "Sending…" : "Send next batch now · up to 20"}</Button> : null}
    <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Send the next email batch?</AlertDialogTitle><AlertDialogDescription>This sends up to 20 campaign emails to opted-in recipients now. Consent and suppression are checked again before delivery.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => run("send")}>Send batch</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {message ? <p role={error ? "alert" : "status"} className={error ? "basis-full text-xs text-destructive" : "basis-full text-xs text-muted-foreground"}>{message}</p> : null}
  </div>;
}
