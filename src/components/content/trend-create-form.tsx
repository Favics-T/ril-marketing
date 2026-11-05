"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Card as ShadcnCard } from "@/components/ui/card";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState } from "react";
import { createTrend, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function TrendCreateForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_state, form) => createTrend(form), null);
  return <ShadcnCard asChild><Disclosure className="slip p-4 sm:p-5" title={<>Log a trend or source manually</>} summaryClassName="cursor-pointer text-sm font-semibold"><ShadcnFieldGroup asChild><form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Opportunity title<ShadcnInput name="title" required minLength={3} maxLength={200} className="" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Publisher or source<ShadcnInput name="source" maxLength={200} className="" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Source URL<ShadcnInput name="source_url" type="url" maxLength={500} placeholder="https://…" className="" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Why it matters<Textarea name="relevance" maxLength={2000} rows={3} className="" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Suggested RIL angle<Textarea name="angle" maxLength={2000} rows={3} className="" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Risk or fact-check note<Textarea name="risk" maxLength={1000} rows={2} /></ShadcnFieldLabel></ShadcnField>
    {state?.ok === false ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p></ShadcnAlert> : state?.ok ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm text-muted-foreground sm:col-span-2">Opportunity logged for review.</p></ShadcnAlert> : null}
    <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Log opportunity"}</Button></div>
  </form></ShadcnFieldGroup></Disclosure></ShadcnCard>;
}
