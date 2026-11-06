"use client";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  approveInsight,
  suppressInsight,
  type ReviewResult,
} from "@/actions/audience/insights";

/**
 * The human gate on pending insights: Approve, or Suppress with a required
 * reason. Both are role-gated and audit-trailed server-side.
 */
export function InsightActions({ insightId }: { insightId: string }) {
  const [showSuppress, setShowSuppress] = useState(false);

  const [approveState, approveAction, approvePending] = useActionState<
    ReviewResult | null,
    FormData
  >(async () => approveInsight(insightId), null);
  const [suppressState, suppressAction, suppressPending] = useActionState<
    ReviewResult | null,
    FormData
  >(
    async (_prev, fd) =>
      suppressInsight(insightId, String(fd.get("reason") ?? "")),
    null
  );

  const busy = approvePending || suppressPending;
  const error = approveState?.ok === false ? approveState.error : suppressState?.ok === false ? suppressState.error : null;
  const done = approveState?.ok || suppressState?.ok;

  if (done) {
    return (
      <p className="text-xs font-semibold text-emerald-700 ">
        Recorded. The queue has been updated.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ShadcnFieldGroup asChild><form action={approveAction}>
          <Button type="submit" size="sm" disabled={busy}>
            {approvePending ? "Approving…" : "Approve"}
          </Button>
        </form></ShadcnFieldGroup>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setShowSuppress((v) => !v)}
          aria-expanded={showSuppress}
        >
          Suppress…
        </Button>
      </div>
      {showSuppress ? (
        <ShadcnFieldGroup asChild><form action={suppressAction} className="flex flex-col gap-2">
          <ShadcnField asChild><ShadcnFieldLabel className="text-xs font-medium text-muted-foreground">
            Suppression reason (required)
            <ShadcnInput
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              placeholder="Why should this never be recommended?"
              className="mt-1 w-full"
            />
          </ShadcnFieldLabel></ShadcnField>
          <Button type="submit" size="sm" variant="destructive" disabled={busy}>
            {suppressPending ? "Suppressing…" : "Suppress insight"}
          </Button>
        </form></ShadcnFieldGroup>
      ) : null}
      {error ? (
        <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-xs text-destructive">
          {error}
        </p></ShadcnAlert>
      ) : null}
    </div>
  );
}
