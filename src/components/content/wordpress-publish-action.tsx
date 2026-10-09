"use client";

import { useActionState } from "react";
import { publishApprovedBlog } from "@/actions/wordpress";
import { Button } from "@/components/ui/button";

type Result = { ok: boolean; message?: string; warning?: string; error?: string; url?: string };

export function WordPressPublishAction({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState<Result | null, FormData>(async () => publishApprovedBlog(assetId), null);
  return <div className="flex flex-col gap-2">
    <p className="dateline">WordPress</p>
    <p className="text-sm leading-5 text-muted-foreground">This approved article will be published immediately to the connected site.</p>
    <form action={action}><Button type="submit" size="sm" disabled={pending}>{pending ? "Publishing…" : "Publish now to WordPress"}</Button></form>
    {state?.message ? <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{state.message}</p> : null}
    {state?.warning ? <p role="status" className="text-sm text-amber-700 dark:text-amber-400">{state.warning}</p> : null}
    {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {state?.url ? <a href={state.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-2">Open WordPress article</a> : null}
  </div>;
}
