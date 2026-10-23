"use client";

import { useActionState } from "react";
import { createLeadFollowUp, completeLeadFollowUp, type ActionResult } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FollowUp = { id: string; title: string; due_at: string | null; outcome: string | null; completed_at: string | null; created_at: string };
const empty: ActionResult | null = null;

export function LeadFollowUps({ leadId, items }: { leadId: string; items: FollowUp[] }) {
  const [createState, createAction, creating] = useActionState<ActionResult | null, FormData>(async (_state, form) => createLeadFollowUp(leadId, form), empty);
  const [completeState, completeAction, completing] = useActionState<ActionResult | null, FormData>(async (_state, form) => completeLeadFollowUp(leadId, String(form.get("id")), form.get("complete") === "true"), empty);
  return (
    <section className="slip flex flex-col gap-4 p-5 sm:p-6">
      <div><p className="dateline">Human-led nurture</p><h2 className="mt-1 text-base font-bold">Follow-up plan</h2><p className="mt-1 text-sm text-muted-foreground">Track a relevant next step. Tasks do not send messages or change the lead’s consent.</p></div>
      <form action={createAction} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_auto]">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="follow-up-title">Next step<input id="follow-up-title" name="title" required minLength={2} maxLength={180} placeholder="e.g. Share the next programme briefing" className="h-11 rounded-md border border-border bg-card px-3 text-sm" /></label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="follow-up-due">Due date (optional)<Input id="follow-up-due" name="due_at" type="date" className="h-11 rounded-md border border-border bg-card px-3 text-sm" /></label>
        <Button type="submit" variant="outline" disabled={creating}>{creating ? "Saving…" : "Add follow-up"}</Button>
      </form>
      {createState?.ok === false ? <p role="alert" className="text-sm text-destructive">{createState.error}</p> : null}
      {completeState?.ok === false ? <p role="alert" className="text-sm text-destructive">{completeState.error}</p> : null}
      {items.length ? <ul className="ledger">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className={`text-sm font-medium ${item.completed_at ? "text-muted-foreground line-through" : ""}`}>{item.title}</p><p className="dateline mt-1">{item.completed_at ? `Completed ${new Date(item.completed_at).toLocaleDateString("en-GB")}` : item.due_at ? `Due ${new Date(`${item.due_at}T00:00:00`).toLocaleDateString("en-GB")}` : "No due date"}</p></div><form action={completeAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="complete" value={item.completed_at ? "false" : "true"} /><Button type="submit" size="sm" variant="ghost" disabled={completing}>{item.completed_at ? "Reopen" : "Complete"}</Button></form></li>)}</ul> : <p className="text-sm text-muted-foreground">No follow-up actions recorded yet.</p>}
    </section>
  );
}
