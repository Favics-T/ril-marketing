"use client";
import { useActionState } from "react";
import { createRecurringContent } from "@/actions/social-operations";
import { localSchedule } from "@/lib/content/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RecurringContent({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(
    async (previous: unknown, form: FormData) => {
      try {
        form.set("next_due", localSchedule(String(form.get("next_due") || "")));
        return await createRecurringContent(assetId, previous, form);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Choose a valid WAT time.",
        };
      }
    },
    null,
  );
  return (
    <section className="slip flex flex-col gap-3 p-5 sm:p-6">
      <h2 className="text-base font-semibold">Repeat this content</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Prepare a new draft for each occurrence. Repeats never bypass human
        approval or send a post automatically.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          Repeat
          <select
            name="cadence"
            className="h-11 rounded-md border border-input bg-card px-3"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          First proposed time (WAT)
          <Input name="next_due" type="datetime-local" required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Number of occurrences
          <Input
            name="count"
            type="number"
            min={1}
            max={52}
            defaultValue={4}
            required
          />
        </label>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-sm">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || state?.ok}>
          {pending ? "Saving…" : "Create repeating plan"}
        </Button>
      </form>
    </section>
  );
}
