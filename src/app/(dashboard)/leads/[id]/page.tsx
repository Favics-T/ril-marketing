import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getLead } from "@/lib/leads/leads";
import { scoreLabel } from "@/lib/leads/scoring";
import { LeadActions } from "@/components/leads/lead-actions";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { LeadFollowUps } from "@/components/leads/lead-follow-ups";
import { LeadNurture } from "@/components/leads/lead-nurture";
import { hasActiveConsent } from "@/lib/email/consent";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const orgId = await getCallerOrganizationId();
	if (!orgId) notFound();

	const lead = await getLead(orgId, id);
	if (!lead) notFound();
	const supabase = await createClient();
	const [{ data: followUps }, { data: sequenceRows }, { data: enrollmentRows }, { data: consentRow }] = await Promise.all([
		supabase.from("lead_follow_ups").select("id,title,due_at,outcome,completed_at,created_at").eq("organization_id", orgId).eq("lead_id", id).order("completed_at", { ascending: true, nullsFirst: true }).order("due_at", { ascending: true, nullsFirst: false }).limit(30),
		supabase.from("nurture_sequences").select("id,name,status").eq("organization_id", orgId).order("name", { ascending: true }).limit(200),
		supabase.from("nurture_enrollments").select("id,sequence_id,status,current_step,next_run_at").eq("organization_id", orgId).eq("lead_id", id).order("enrolled_at", { ascending: false }).limit(50),
		supabase.from("leads").select("email,marketing_consent,email_unsubscribed_at,email_suppressed_at").eq("organization_id", orgId).eq("id", id).maybeSingle<{ email:string|null; marketing_consent:boolean; email_unsubscribed_at:string|null; email_suppressed_at:string|null }>(),
	]);
	const allSequences = (sequenceRows ?? []) as Array<{ id:string; name:string; status:string }>;
	const sequenceName = new Map(allSequences.map((sequence) => [sequence.id, sequence.name]));
	const activeSequences = allSequences.filter((sequence) => sequence.status === "active").map((sequence) => ({ id: sequence.id, name: sequence.name }));
	const enrollments = ((enrollmentRows ?? []) as Array<{ id:string; sequence_id:string; status:string; current_step:number; next_run_at:string|null }>).map((enrollment) => ({ id: enrollment.id, sequence_name: sequenceName.get(enrollment.sequence_id) ?? "Sequence", status: enrollment.status, current_step: enrollment.current_step, next_run_at: enrollment.next_run_at }));
	const hasConsent = consentRow ? hasActiveConsent(consentRow) : false;

	const facts: Array<{ label: string; value: string }> = [
		{ label: "Email", value: lead.email ?? "Not provided" },
		{ label: "Phone", value: lead.phone ?? "Not provided" },
		{ label: "Organisation", value: lead.organisation ?? "Not provided" },
		{ label: "Interest", value: lead.interest ?? "Not provided" },
		{ label: "Segment", value: lead.segment?.name ?? "Untagged" },
		{ label: "Source", value: lead.source_platform ?? "Not recorded" },
		{ label: "Marketing updates", value: lead.marketing_consent ? "Opted in" : "Not opted in" },
		{ label: "Campaign", value: lead.campaign_id ? "Linked to campaign" : "Not linked" },
		{ label: "Captured", value: formatDay(lead.created_at) },
	];

	return (
		<div className="workspace-page flex flex-col gap-4 md:gap-6">
			<header>
				<Link
					href="/leads"
					className="group inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
                    <ArrowLeft aria-hidden="true" className="size-4" /> All leads
				</Link>
				<div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
					<h1>
						{lead.name || lead.email || "Lead"}
					</h1>
					{lead.score ? (
						<StatusStamp status={lead.score}>{scoreLabel(lead.score)}</StatusStamp>
					) : null}
					{!lead.score && lead.is_qualified ? <StatusStamp status="qualified" /> : null}
					{!lead.score && lead.is_converted ? <StatusStamp status="approved">Converted</StatusStamp> : null}
				</div>
			</header>

			<div className="record-layout grid gap-6 lg:grid-cols-3">
				<section className="slip flex flex-col lg:col-span-2">
					<div className="ledger flex flex-col">
						{facts.map((f) => (
							<div
								key={f.label}
								className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6"
							>
								<span className="dateline">{f.label}</span>
								<span className="max-w-[60%] truncate text-sm font-medium text-foreground">
									{f.value}
								</span>
							</div>
						))}
					</div>
					{lead.score_reason ? (
						<div className="border-t border-border/80 px-5 py-4 sm:px-6">
							<p className="dateline">Why this score</p>
							<p className="mt-1.5 text-sm leading-6 text-foreground">
								{lead.score_reason}
							</p>
						</div>
					) : null}
				</section>

				<section className="slip flex h-fit flex-col gap-4 p-5 sm:p-6">
					<div>
						<p className="dateline">Follow-up</p>
						<h2 className="mt-1 text-base font-bold">Work this lead</h2>
					</div>
					<LeadActions
						leadId={lead.id}
						stage={lead.funnel_stage}
						isQualified={lead.is_qualified}
						notes={lead.notes}
						hasOwner={Boolean(lead.owner_id)}
					/>
				</section>
			</div>
			<LeadFollowUps leadId={lead.id} items={followUps ?? []} />
			<LeadNurture leadId={lead.id} hasConsent={hasConsent} sequences={activeSequences} enrollments={enrollments} />
		</div>
	);
}
