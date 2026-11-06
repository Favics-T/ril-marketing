"use client";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


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
  return <ShadcnFieldGroup asChild><form action={action} className="flex flex-col gap-3">
    <div className="report-range-fields grid gap-4 sm:grid-cols-2">
      <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-medium">Period<ShadcnNativeSelect name="period_type" value={period} onChange={event => changePeriod(event.target.value as typeof period)} disabled={pending} className=""><ShadcnNativeSelectOption value="weekly">Last complete week</ShadcnNativeSelectOption><ShadcnNativeSelectOption value="monthly">Last complete month</ShadcnNativeSelectOption><ShadcnNativeSelectOption value="custom">Choose dates</ShadcnNativeSelectOption></ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
      <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-medium">From<Input type="date" name="period_start" required value={range.start} onInput={event => { setRange({ ...range, start: event.currentTarget.value }); setPeriod("custom"); }} disabled={pending} /></ShadcnFieldLabel></ShadcnField>
      <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-medium">To<Input type="date" name="period_end" required min={range.start} value={range.end} onInput={event => { setRange({ ...range, end: event.currentTarget.value }); setPeriod("custom"); }} disabled={pending} /></ShadcnFieldLabel></ShadcnField>
      <Button type="submit" className="self-end" disabled={pending || !range.start || !range.end || range.end < range.start}>{pending ? "Creating report…" : "Create report draft"}</Button>
    </div>
    <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">{period === "weekly" ? "Monday–Sunday of the previous week." : period === "monthly" ? "The previous calendar month." : "Your selected date range."} Dates use UTC. The report is saved below for review; no email is sent.</p>
    {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
    {state?.ok ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm text-primary">Report saved. Review the new report in Generated reports below.</p></ShadcnAlert> : null}
  </form></ShadcnFieldGroup>;
}
