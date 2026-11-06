"use client";
import { Card as ShadcnCard } from "@/components/ui/card";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";

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
    <ShadcnCard asChild><section className="slip flex flex-col gap-3 p-5 sm:p-6">
      <h2 className="text-base font-semibold">Repeat this content</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Prepare a new draft for each occurrence. Repeats never bypass human
        approval or send a post automatically.
      </p>
      <ShadcnFieldGroup asChild><form action={action} className="flex flex-col gap-3">
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
          Repeat
          <ShadcnNativeSelect
            name="cadence"
            className=""
          >
            <ShadcnNativeSelectOption value="weekly">Weekly</ShadcnNativeSelectOption>
            <ShadcnNativeSelectOption value="monthly">Monthly</ShadcnNativeSelectOption>
            <ShadcnNativeSelectOption value="daily">Daily</ShadcnNativeSelectOption>
          </ShadcnNativeSelect>
        </ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
          First proposed time (WAT)
          <Input name="next_due" type="datetime-local" required />
        </ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
          Number of occurrences
          <Input
            name="count"
            type="number"
            min={1}
            max={52}
            defaultValue={4}
            required
          />
        </ShadcnFieldLabel></ShadcnField>
        {state?.error ? (
          <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
            {state.error}
          </p></ShadcnAlert>
        ) : null}
        {state?.ok ? (
          <ShadcnAlert asChild role="status"><p role="status" className="text-sm">
            {state.message}
          </p></ShadcnAlert>
        ) : null}
        <Button type="submit" disabled={pending || state?.ok}>
          {pending ? "Saving…" : "Create repeating plan"}
        </Button>
      </form></ShadcnFieldGroup>
    </section></ShadcnCard>
  );
}
