"use client";

import { useActionState } from "react";
import { createTrend, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";

export function TrendCreateForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_state, form) => createTrend(form), null);
  return <details className="slip p-4 sm:p-5"><DisclosureSummary className="cursor-pointer text-sm font-semibold">Log a trend or source manually</DisclosureSummary><form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Opportunity title<input name="title" required minLength={3} maxLength={200} className="h-10 rounded-md border border-border bg-card px-3 text-sm font-normal text-foreground" /></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Publisher or source<input name="source" maxLength={200} className="h-10 rounded-md border border-border bg-card px-3 text-sm font-normal text-foreground" /></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Source URL<input name="source_url" type="url" maxLength={500} placeholder="https://…" className="h-10 rounded-md border border-border bg-card px-3 text-sm font-normal text-foreground" /></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Why it matters<textarea name="relevance" maxLength={2000} rows={3} className="rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-foreground" /></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Suggested RIL angle<textarea name="angle" maxLength={2000} rows={3} className="rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-foreground" /></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Risk or fact-check note<Textarea name="risk" maxLength={1000} rows={2} /></label>
    {state?.ok === false ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p> : state?.ok ? <p role="status" className="text-sm text-muted-foreground sm:col-span-2">Opportunity logged for review.</p> : null}
    <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Log opportunity"}</Button></div>
  </form></details>;
}
