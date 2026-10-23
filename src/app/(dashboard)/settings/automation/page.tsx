import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { Metadata } from "next";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveAutomationSettings, retryAutomationEvent } from "@/actions/automation";
import { StatusStamp } from "@/components/ui/status-stamp";
import { todayDateline } from "@/lib/format";
import { formatAutomationResult } from "@/lib/automation/result-summary";
import Link from "next/link";

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
    <header><p className="dateline">{todayDateline()}</p><h1>Automation</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Prepare campaign drafts when an activity is saved. Your team still edits, approves and publishes every public item.</p></header>
    <section className="slip p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="dateline">Activity created → campaign drafts</p><h2 className="mt-1 text-lg font-bold">Activity-to-drafts automation</h2><p className="mt-1 max-w-[68ch] text-sm leading-6 text-muted-foreground">For new activities, create a draft campaign, audience-grounded social and newsletter assets, an email draft and a landing-page draft. Nothing is sent, published, or approved automatically.</p></div><StatusStamp status={enabled ? "active" : "paused"}>{enabled ? "ENABLED" : "DISABLED"}</StatusStamp></div>
      <form action={saveAutomationSettings} className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/80 pt-4"><input type="hidden" name="activity_to_drafts_enabled" value={enabled ? "false" : "true"} /><FormSubmitButton variant={enabled ? "outline" : "default"} className="min-h-10 rounded-lg font-semibold">{enabled ? "Disable for future activities" : "Enable for future activities"}</FormSubmitButton><span className="text-xs leading-5 text-muted-foreground">Only owner, admin and marketing manager roles can change this setting. Existing activities are not retroactively processed.</span></form>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Draft preparation runs in the background and may wait until the next daily run. Check the history below for progress. Follow-up email enrolment is managed separately in <Link href="/nurture" className="text-primary underline">Nurture</Link>.</p>
    </section>
    <section className="flex flex-col gap-3"><div><p className="dateline">Queue history · {items.length} recent jobs</p><h2 className="mt-1 text-lg font-bold">Automation events</h2></div>
      {items.length === 0 ? <div className="slip p-5 text-sm leading-6 text-muted-foreground">{enabled ? <>No jobs yet. <Link href="/activities/new" className="font-semibold text-primary underline">Log a new activity</Link> to prepare its drafts.</> : "No jobs yet. Enable automatic drafts above when you want new activities to create content in the background."}</div> : <ul className="ledger border-y border-border/80">{items.map((item)=><li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusStamp status={item.status} /><span className="text-sm font-semibold tracking-[-0.01em]">{item.event_type.replaceAll("_", " ")}</span><span className="dateline">{new Date(item.created_at).toLocaleString("en-GB")}</span></div>{item.error ? <p className="mt-1 text-sm text-destructive">{item.error}</p> : null}{item.status === "completed" || item.status === "deferred" ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{formatAutomationResult(item.result)}</p> : null}</div>{item.status === "failed" ? <form action={retryAutomationEvent}><input type="hidden" name="id" value={item.id} /><FormSubmitButton size="sm" variant="outline" className="min-h-9 rounded-lg font-semibold">Retry</FormSubmitButton></form> : null}</li>)}</ul>}
    </section>
  </div>;
}
