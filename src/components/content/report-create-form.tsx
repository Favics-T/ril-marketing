"use client";

import { useActionState, useState } from "react";
import { createReportDraft } from "@/actions/reports";
import { completedReportPeriod } from "@/lib/reports/period";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportCreateForm({ today }: { today: string }) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [range, setRange] = useState(completedReportPeriod(today, "weekly"));
  const [state, action, pending] = useActionState(createReportDraft, null);
  function changePeriod(value: typeof period) {
    setPeriod(value);
    if (value !== "custom") setRange(completedReportPeriod(today, value));
  }
  return <form action={action} className="flex flex-col gap-3">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-medium">Period<select name="period_type" value={period} onChange={event => changePeriod(event.target.value as typeof period)} disabled={pending} className="h-11 rounded-lg border border-input bg-card px-3 text-sm"><option value="weekly">Last complete week</option><option value="monthly">Last complete month</option><option value="custom">Choose dates</option></select></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">From<Input type="date" name="period_start" required value={range.start} onInput={event => { setRange({ ...range, start: event.currentTarget.value }); setPeriod("custom"); }} disabled={pending} /></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">To<Input type="date" name="period_end" required min={range.start} value={range.end} onInput={event => { setRange({ ...range, end: event.currentTarget.value }); setPeriod("custom"); }} disabled={pending} /></label>
      <Button type="submit" disabled={pending || !range.start || !range.end || range.end < range.start}>{pending ? "Creating report…" : "Create report draft"}</Button>
    </div>
    <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">{period === "weekly" ? "Monday–Sunday of the previous week." : period === "monthly" ? "The previous calendar month." : "Your selected date range."} Dates use UTC. The report is saved below for review; no email is sent.</p>
    {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {state?.ok ? <p role="status" className="text-sm text-primary">Report saved. Review the new report in Generated reports below.</p> : null}
  </form>;
}
