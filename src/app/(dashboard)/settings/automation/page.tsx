import type { Metadata } from "next";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveAutomationSettings, retryAutomationEvent } from "@/actions/automation";
import { Button } from "@/components/ui/button";
import { StatusStamp } from "@/components/ui/status-stamp";
import { todayDateline } from "@/lib/format";
import { formatAutomationResult } from "@/lib/automation/result-summary";

export const metadata: Metadata = { title: "Marketing Automation" };
type QueueEvent = { id:string; event_type:string; record_id:string; status:string; attempts:number; result:Record<string, unknown>; error:string|null; created_at:string; processed_at:string|null };

export default async function AutomationPage() {
  const organizationId = await getCallerOrganizationId();
  const supabase = await createClient();
  const [{ data: setting }, { data: events }] = organizationId ? await Promise.all([
    supabase.from("automation_settings").select("activity_to_drafts_enabled,updated_at").eq("organization_id", organizationId).maybeSingle<{activity_to_drafts_enabled:boolean;updated_at:string}>(),
    supabase.from("automation_events").select("id,event_type,record_id,status,attempts,result,error,created_at,processed_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
  ]) : [{ data: null }, { data: [] }];
  const enabled = setting?.activity_to_drafts_enabled ?? false;
  const items = (events ?? []) as QueueEvent[];
  return <div className="workspace-page settings-page">
    <header><p className="dateline">{todayDateline()} · human-gated orchestration</p><h1>Automation</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Choose which event chain can run and review each job’s result. Generated public content stays in Draft or AI Generated status for human approval.</p></header>
    <section className="slip p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="dateline">Activity created → campaign drafts</p><h2 className="mt-1 text-lg font-bold">Activity-to-drafts automation</h2><p className="mt-1 max-w-[68ch] text-sm leading-6 text-muted-foreground">For new activities, create a draft campaign, audience-grounded social and newsletter assets, an email draft and a landing-page draft. Nothing is sent, published, or approved automatically.</p></div><StatusStamp status={enabled ? "active" : "paused"}>{enabled ? "ENABLED" : "DISABLED"}</StatusStamp></div>
      <form action={saveAutomationSettings} className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/80 pt-4"><input type="hidden" name="activity_to_drafts_enabled" value={enabled ? "false" : "true"} /><Button type="submit" variant={enabled ? "outline" : "default"} className="min-h-10 rounded-lg font-semibold">{enabled ? "Disable for future activities" : "Enable for future activities"}</Button><span className="text-xs leading-5 text-muted-foreground">Only owner, admin and marketing manager roles can change this setting. Existing activities are not retroactively processed.</span></form>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">The protected worker handles up to two queued events per run. With the included daily schedule, newly queued work may wait until the next run. Lead events enrol matching contacts into active nurture sequences when lead nurture is enabled in the Nurture workspace; otherwise they are recorded and deferred.</p>
    </section>
    <section className="flex flex-col gap-3"><div><p className="dateline">Queue history · {items.length} recent jobs</p><h2 className="mt-1 text-lg font-bold">Automation events</h2></div>
      {items.length === 0 ? <div className="slip p-5 text-sm text-muted-foreground">No events queued. Enable activity automation, then add a new activity to start the chain.</div> : <ul className="ledger border-y border-border/80">{items.map((item)=><li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusStamp status={item.status} /><span className="text-sm font-semibold tracking-[-0.01em]">{item.event_type.replaceAll("_", " ")}</span><span className="dateline">{new Date(item.created_at).toLocaleString("en-GB")}</span></div>{item.error ? <p className="mt-1 text-sm text-destructive">{item.error}</p> : null}{item.status === "completed" || item.status === "deferred" ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{formatAutomationResult(item.result)}</p> : null}</div>{item.status === "failed" ? <form action={retryAutomationEvent}><input type="hidden" name="id" value={item.id} /><Button size="sm" variant="outline" type="submit" className="min-h-9 rounded-lg font-semibold">Retry</Button></form> : null}</li>)}</ul>}
    </section>
  </div>;
}
