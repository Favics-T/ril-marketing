"use client";

import { useActionState } from "react";
import { createEmailFromNewsletter, type EmailDraftActionResult } from "@/actions/email-from-newsletter";
import { Button } from "@/components/ui/button";

export function CreateEmailFromNewsletter({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState<EmailDraftActionResult | null, FormData>(async () => createEmailFromNewsletter(assetId), null);
  return <div className="flex flex-col gap-2">
    <p className="text-sm leading-5 text-muted-foreground">Creates a draft email with this newsletter&apos;s subject options, preview text and copy. You choose the subject and audience next. Nothing is sent; the email still needs review, approval and queuing.</p>
    <form action={action}><Button type="submit" size="sm" disabled={pending}>{pending ? "Creating…" : "Create email campaign"}</Button></form>
    {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
  </div>;
}
