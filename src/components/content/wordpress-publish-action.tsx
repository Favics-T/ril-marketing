"use client";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState, useState } from "react";
import { publishApprovedBlog, scheduleApprovedBlog } from "@/actions/wordpress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localSchedule } from "@/lib/content/scheduling";

type Result = { ok: boolean; message?: string; warning?: string; error?: string; url?: string };

export function WordPressPublishAction({ assetId }: { assetId: string }) {
  const [mode, setMode] = useState("now");
  const [state, action, pending] = useActionState<Result | null, FormData>(async (_previous, fd) => {
    try { return mode === "schedule" ? await scheduleApprovedBlog(assetId, localSchedule(String(fd.get("scheduled_for") ?? ""))) : await publishApprovedBlog(assetId); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Choose a valid time." }; }
  }, null);
  return <div className="flex flex-col gap-2">
    <p className="dateline">WordPress</p>
    <p className="text-sm leading-5 text-muted-foreground">Publish the approved article now or let WordPress deliver it at your chosen time.</p>
    <ShadcnFieldGroup asChild><form action={action} className="flex flex-col gap-3">
      <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">Delivery<ShadcnNativeSelect value={mode} onChange={e => setMode(e.target.value)} disabled={pending} className=""><ShadcnNativeSelectOption value="now">Publish now</ShadcnNativeSelectOption><ShadcnNativeSelectOption value="schedule">Schedule a post</ShadcnNativeSelectOption></ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
      {mode === "schedule" ? <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">Publishing time (WAT)<Input name="scheduled_for" type="datetime-local" required disabled={pending} /></ShadcnFieldLabel></ShadcnField> : null}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Submitting…" : mode === "schedule" ? "Schedule on WordPress" : "Publish now to WordPress"}</Button>
    </form></ShadcnFieldGroup>
    {state?.message ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm font-semibold text-emerald-700 ">{state.message}</p></ShadcnAlert> : null}
    {state?.warning ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm text-amber-700 ">{state.warning}</p></ShadcnAlert> : null}
    {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
    {state?.url ? <a href={state.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-2">Open WordPress article</a> : null}
  </div>;
}
