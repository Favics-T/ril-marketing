"use client";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState } from "react";
import { publishApprovedToStrapi } from "@/actions/strapi";
import { Button } from "@/components/ui/button";

type Result = { ok: boolean; message?: string; warning?: string; error?: string; url?: string };

export function StrapiPublishAction({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState<Result | null, FormData>(async () => publishApprovedToStrapi(assetId), null);
  return <div className="flex flex-col gap-2">
    <p className="dateline">Strapi</p>
    <p className="text-sm leading-5 text-muted-foreground">This approved article will be published immediately to the connected Strapi collection.</p>
    <ShadcnFieldGroup asChild><form action={action}><Button type="submit" size="sm" disabled={pending}>{pending ? "Publishing…" : "Publish now to Strapi"}</Button></form></ShadcnFieldGroup>
    {state?.message ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm font-semibold text-emerald-700 ">{state.message}</p></ShadcnAlert> : null}
    {state?.warning ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm text-amber-700 ">{state.warning}</p></ShadcnAlert> : null}
    {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
    {state?.url ? <a href={state.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-2">Open Strapi entry</a> : null}
  </div>;
}
