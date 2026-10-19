"use client";
import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { runPublishingChecks } from "@/actions/social-operations";
import { Button } from "@/components/ui/button";

export function PublishingCheck() {
  const [state, action, pending] = useActionState(runPublishingChecks, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" disabled={pending}>
        <RefreshCw aria-hidden="true" data-icon="inline-start" />
        {pending ? "Checking…" : "Update publishing status"}
      </Button>
      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className="max-w-prose text-sm text-muted-foreground"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
