import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { listSegments } from "@/lib/audience/segments";
import { createNurtureSequence, transitionNurtureSequence, addNurtureStep, removeNurtureStep, saveNurtureSettings } from "@/actions/nurture";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { Input } from "@/components/ui/input";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Lead Nurture" };

type SequenceRow = { id:string; name:string; status:string; trigger:string; audience_segment_id:string|null; created_at:string };
type StepRow = { id:string; sequence_id:string; step_order:number; delay_hours:number; email_subject:string };

const triggerLabel = (trigger: string) => trigger === "manual" ? "Manual enrolment only" : "New lead captured";
const delayLabel = (hours: number) => hours <= 0 ? "immediately" : hours % 24 === 0 ? `after ${hours / 24}d` : `after ${hours}h`;

export default async function NurturePage() {
  const organizationId = await getCallerOrganizationId();
  const supabase = await createClient();
  const [{ data: setting }, sequencesResult, segments] = organizationId ? await Promise.all([
    supabase.from("nurture_settings").select("lead_capture_enabled").eq("organization_id", organizationId).maybeSingle<{lead_capture_enabled:boolean}>(),
    supabase.from("nurture_sequences").select("id,name,status,trigger,audience_segment_id,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    listSegments(organizationId),
  ]) : [{ data: null }, { data: [] }, []];
  const sequences = (sequencesResult.data ?? []) as SequenceRow[];
  const sequenceIds = sequences.map((sequence) => sequence.id);
  const [stepsResult, enrollmentsResult] = organizationId && sequenceIds.length ? await Promise.all([
    supabase.from("nurture_steps").select("id,sequence_id,step_order,delay_hours,email_subject").eq("organization_id", organizationId).in("sequence_id", sequenceIds).order("step_order", { ascending: true }),
    supabase.from("nurture_enrollments").select("sequence_id,status").eq("organization_id", organizationId).in("sequence_id", sequenceIds).limit(20000),
  ]) : [{ data: [] }, { data: [] }];
  const stepsBySequence = new Map<string, StepRow[]>();
  for (const step of (stepsResult.data ?? []) as StepRow[]) stepsBySequence.set(step.sequence_id, [...(stepsBySequence.get(step.sequence_id) ?? []), step]);
  const activeBySequence = new Map<string, number>();
  for (const enrollment of (enrollmentsResult.data ?? []) as Array<{sequence_id:string;status:string}>) {
    if (enrollment.status === "active") activeBySequence.set(enrollment.sequence_id, (activeBySequence.get(enrollment.sequence_id) ?? 0) + 1);
  }
  const segmentNames = new Map(segments.map((segment) => [segment.id, segment.name]));
  const enabled = setting?.lead_capture_enabled ?? false;

  return <div className="workspace-page workflow-page">
    <header><p className="dateline">{todayDateline()} · consent-gated email</p><h1>Lead Nurture</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Build email sequences for newly captured leads. Consent is checked before each message. Sending requires an active sequence and a connected sender.</p></header>
    <section className="slip p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4"><div><p className="dateline">New lead captured → enrol</p><h2 className="mt-1 text-lg font-bold">Automatic enrolment</h2><p className="mt-1 max-w-[68ch] text-sm leading-6 text-muted-foreground">When enabled, a newly captured lead with active marketing consent is enrolled into every active sequence whose trigger is “new lead captured” and whose audience matches. The first step sends after its configured delay. Enrolment never overrides consent or suppression.</p></div><StatusStamp status={enabled ? "active" : "paused"}>{enabled ? "ENABLED" : "DISABLED"}</StatusStamp></div>
      <form action={saveNurtureSettings} className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/80 pt-4"><input type="hidden" name="lead_capture_enabled" value={enabled ? "false" : "true"} /><Button type="submit" variant={enabled ? "outline" : "default"} className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">{enabled ? "Disable for future leads" : "Enable for future leads"}</Button><span className="text-[13px] leading-5 text-muted-foreground">Only owner, admin and marketing manager roles can change this. Existing leads are not retroactively enrolled.</span></form>
    </section>
    <details className="slip p-5 sm:p-6" open={sequences.length === 0}><DisclosureSummary>Create a sequence</DisclosureSummary><div><div className="mb-4"><p className="dateline">Compose</p><h2 className="mt-1 text-lg font-bold">Create a sequence</h2><p className="mt-1 text-sm text-muted-foreground">Draft a sequence, add its steps, then a second workspace reviewer activates it.</p></div>
      <form action={createNurtureSequence} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className="dateline">Internal name</span><Input name="name" required minLength={3} maxLength={160} placeholder="Founder welcome drip" /></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Trigger</span><select name="trigger" defaultValue="lead_captured" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="lead_captured">New lead captured</option><option value="manual">Manual enrolment only</option></select></label>
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Audience</span><select name="audience_segment_id" defaultValue="" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All opted-in contacts</option>{segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select></label>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[65ch] text-[13px] leading-5 text-muted-foreground">The audience filter only narrows automatic enrolment; manual enrolment from a lead’s profile always respects consent but ignores the segment.</p><Button type="submit" className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">Save draft sequence</Button></div>
      </form>
    </div></details>
    <section className="flex flex-col gap-3"><div><p className="dateline">Workflow · {sequences.length} sequences</p><h2 className="mt-1 text-lg font-bold">Nurture sequences</h2></div>
      {sequences.length === 0 ? <EmptyState title="No sequences yet" description="Create a sequence above, add its steps, then have a second reviewer activate it." /> : <ul className="flex flex-col gap-3">{sequences.map((sequence) => { const steps = stepsBySequence.get(sequence.id) ?? []; const activeCount = activeBySequence.get(sequence.id) ?? 0; return <li key={sequence.id} className="slip flex flex-col gap-3 p-5 sm:p-5">
        <div className="flex flex-wrap items-center gap-2"><StatusStamp status={sequence.status} /><span className="dateline">{steps.length} steps · {activeCount} active enrolments</span><span className="ml-auto text-[13px] leading-5 text-muted-foreground">{triggerLabel(sequence.trigger)}</span></div>
        <div><h3 className="font-bold">{sequence.name}</h3><p className="mt-0.5 dateline">Audience · {sequence.audience_segment_id ? segmentNames.get(sequence.audience_segment_id) ?? "Segment" : "All opted-in contacts"}</p></div>
        {steps.length ? <ol className="ledger border-y border-border/80">{steps.map((step) => <li key={step.id} className="flex flex-wrap items-center gap-2 py-2.5"><span className="font-mono text-xs text-muted-foreground">{String(step.step_order).padStart(2, "0")}</span><span className="text-sm font-semibold tracking-[-0.01em]">{step.email_subject}</span><span className="dateline">sends {delayLabel(step.delay_hours)}</span>{sequence.status !== "active" ? <form action={removeNurtureStep} className="ml-auto"><input type="hidden" name="id" value={step.id} /><Button type="submit" size="sm" variant="ghost">Remove</Button></form> : null}</li>)}</ol> : <p className="text-sm text-muted-foreground">No steps yet. Add the first email below.</p>}
        {sequence.status !== "active" && sequence.status !== "archived" ? <details className="rounded-lg border border-border/80 bg-muted/30 p-3"><DisclosureSummary className="cursor-pointer text-sm font-semibold">Add a step</DisclosureSummary>
          <form action={addNurtureStep} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="sequence_id" value={sequence.id} />
            <label className="flex flex-col gap-1.5"><span className="dateline">Wait before sending (hours)</span><Input name="delay_hours" type="number" min={0} max={8760} defaultValue={steps.length ? 24 : 0} required /></label>
            <label className="flex flex-col gap-1.5"><span className="dateline">Subject line</span><Input name="email_subject" required minLength={2} maxLength={200} placeholder="Welcome to Renaissance Innovation Labs" /></label>
            <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Email copy</span><textarea name="email_body" required minLength={10} maxLength={12000} rows={5} placeholder="Write the message and call to action…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-1 focus-visible:ring-ring" /></label>
            <div className="sm:col-span-2 flex justify-end"><Button type="submit" size="sm">Add step</Button></div>
          </form></details> : null}
        <div className="flex flex-wrap gap-2 border-t border-border/80 pt-3">
          {sequence.status === "draft" ? <form action={transitionNurtureSequence}><input type="hidden" name="id" value={sequence.id} /><input type="hidden" name="to" value="active" /><Button type="submit" size="sm" variant="outline">Activate</Button></form> : null}
          {sequence.status === "active" ? <form action={transitionNurtureSequence}><input type="hidden" name="id" value={sequence.id} /><input type="hidden" name="to" value="paused" /><Button type="submit" size="sm" variant="outline">Pause</Button></form> : null}
          {sequence.status === "paused" ? <form action={transitionNurtureSequence}><input type="hidden" name="id" value={sequence.id} /><input type="hidden" name="to" value="active" /><Button type="submit" size="sm" variant="outline">Resume</Button></form> : null}
          {sequence.status !== "archived" ? <form action={transitionNurtureSequence}><input type="hidden" name="id" value={sequence.id} /><input type="hidden" name="to" value="archived" /><Button type="submit" size="sm" variant="ghost">Archive</Button></form> : null}
          <Link href={`/leads`} className="ml-auto inline-flex min-h-9 items-center gap-2 self-center rounded-md py-2 text-[13px] text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">Enrol a lead manually<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </li>})}</ul>}
    </section>
  </div>;
}
