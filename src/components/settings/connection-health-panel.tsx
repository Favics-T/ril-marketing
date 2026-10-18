"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleHelp, RefreshCw, TriangleAlert } from "lucide-react";
import { checkProviderConnections } from "@/actions/provider-health";
import { Button } from "@/components/ui/button";
import { formatInZone } from "@/lib/time";

const STATES = {
  ready: {label: "Verified", Icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-400"},
  needs_setup: {label: "Needs setup", Icon: CircleHelp, tone: "text-muted-foreground"},
  needs_attention: {label: "Needs attention", Icon: TriangleAlert, tone: "text-destructive"},
};

export function ConnectionHealthPanel({canManage}: {canManage: boolean}) {
  const [state, action, pending] = useActionState<Awaited<ReturnType<typeof checkProviderConnections>> | null, FormData>(async () => checkProviderConnections(), null);
  return <section className="slip px-5 py-5 sm:px-6" aria-labelledby="connection-health-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="connection-health-title" className="text-base font-bold">Check your connections</h2><p className="mt-1 max-w-[64ch] text-sm leading-6 text-muted-foreground">Confirm your saved keys, accounts and permissions. This check does not generate content, publish posts or send email.</p></div>{canManage ? <form action={action}><Button type="submit" variant="outline" disabled={pending}><RefreshCw aria-hidden="true" className={pending ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"}/>{pending ? "Checking providers…" : "Check connections"}</Button></form> : <p className="text-sm text-muted-foreground">A workspace manager can run these checks.</p>}</div>
    {pending ? <p role="status" className="mt-3 text-sm text-muted-foreground">Checking each service. Some providers may take a few moments to respond.</p> : null}
    {state?.error ? <p role="alert" className="mt-3 text-sm text-destructive">{state.error}</p> : null}
    {state?.connections ? <><p role="status" className="mt-4 text-xs text-muted-foreground">Checked {formatInZone(state.checkedAt, "dateTime")} · {state.connections.filter(item => item.state === "ready").length} of {state.connections.length} verified</p><ul className="mt-3 divide-y divide-border">{state.connections.map(item => {const {Icon, label, tone} = STATES[item.state]; return <li key={item.key} className="flex items-start gap-3 py-3"><Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="text-sm font-semibold">{item.name}</h3><span className={`text-xs font-semibold ${tone}`}>{label}</span></div><p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{item.message}</p></div>{item.state !== "ready" ? <Link href={item.href} className="inline-flex min-h-9 shrink-0 items-center rounded px-1 text-sm font-semibold text-primary underline underline-offset-4">Set up</Link> : null}</li>;})}</ul></> : null}
  </section>;
}
