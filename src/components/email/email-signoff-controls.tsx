"use client";

import { useActionState } from "react";
import { approveSensitiveEmail, setEmailSensitivity, type EmailActionResult } from "@/actions/email";
import { Button } from "@/components/ui/button";

type Props = { emailId: string; isSensitive: boolean; canFlag: boolean; canApprove: boolean };

/** Flag/unflag and senior sign-off, shown only to people allowed to use them. */
export function EmailSignoffControls({ emailId, isSensitive, canFlag, canApprove }: Props) {
  const [flagState, flagAction, flagPending] = useActionState<EmailActionResult | null, FormData>(setEmailSensitivity, null);
  const [approveState, approveAction, approvePending] = useActionState<EmailActionResult | null, FormData>(approveSensitiveEmail, null);
  if (!canFlag && !canApprove) return null;
  const error = flagState?.error ?? approveState?.error;
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap gap-2">
      {canApprove ? <form action={approveAction}><input type="hidden" name="id" value={emailId} /><Button type="submit" size="sm" disabled={approvePending}>{approvePending ? "Signing off…" : "Give senior sign-off"}</Button></form> : null}
      {canFlag ? <form action={flagAction}>
        <input type="hidden" name="id" value={emailId} /><input type="hidden" name="sensitive" value={isSensitive ? "false" : "true"} />
        <Button type="submit" size="sm" variant="outline" disabled={flagPending}>{isSensitive ? "Remove sensitive flag" : "Flag as sensitive"}</Button>
      </form> : null}
    </div>
    {error ? <p role="alert" className="max-w-[48ch] text-xs text-destructive">{error}</p> : null}
  </div>;
}
