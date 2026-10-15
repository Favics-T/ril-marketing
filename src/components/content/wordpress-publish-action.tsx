"use client";

import { useActionState, useState } from "react";
import { publishApprovedBlog, scheduleApprovedBlog } from "@/actions/wordpress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localSchedule } from "@/lib/content/scheduling";

type Result = { ok: boolean; message?: string; error?: string; url?: string };

export function WordPressPublishAction({ assetId }: { assetId: string }) {
  const [mode, setMode] = useState("now");
  const [state, action, pending] = useActionState<Result | null, FormData>(async (_previous, fd) => {
    try { return mode === "schedule" ? await scheduleApprovedBlog(assetId, localSchedule(String(fd.get("scheduled_for") ?? ""))) : await publishApprovedBlog(assetId); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Choose a valid time." }; }
  }, null);
  return <div className="flex flex-col gap-2">
    <p className="dateline">WordPress</p>
    <p className="text-sm leading-5 text-muted-foreground">Publish the approved article now or let WordPress deliver it at your chosen time.</p>
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">Delivery<select value={mode} onChange={e => setMode(e.target.value)} disabled={pending} className="h-10 rounded-md border border-border bg-card px-3"><option value="now">Publish now</option><option value="schedule">Schedule a post</option></select></label>
      {mode === "schedule" ? <label className="flex flex-col gap-1.5 text-sm">Publishing time (your local timezone)<Input name="scheduled_for" type="datetime-local" required disabled={pending} /></label> : null}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Submitting…" : mode === "schedule" ? "Schedule on WordPress" : "Publish now to WordPress"}</Button>
    </form>
    {state?.message ? <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{state.message}</p> : null}
    {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {state?.url ? <a href={state.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-2">Open WordPress article</a> : null}
  </div>;
}
