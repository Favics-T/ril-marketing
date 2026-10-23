"use client";

import { useActionState } from "react";
import { transitionEmailCampaign, type EmailActionResult } from "@/actions/email";
import { Button } from "@/components/ui/button";

export function EmailTransitionButton({ emailId, to, label }: { emailId: string; to: "review" | "approved" | "paused" | "scheduled"; label: string }) {
  const [state, action, pending] = useActionState<EmailActionResult | null, FormData>(transitionEmailCampaign, null);
  return <form action={action} className="flex flex-col gap-1">
    <input type="hidden" name="id" value={emailId} /><input type="hidden" name="to" value={to} />
    <Button type="submit" size="sm" variant="outline" disabled={pending}>{label}</Button>
    {state?.error ? <p role="alert" className="max-w-[40ch] text-xs text-destructive">{state.error}</p> : null}
  </form>;
}
