"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";
import { Card as ShadcnCard } from "@/components/ui/card";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createActivity, updateActivity, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const selectClass =
	"h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type SegmentOption = { id: string; name: string };
export type CampaignOption = { id: string; name: string };
export type ActivityFormData = {
	id: string;
	title: string;
	event_date: string | null;
	description: string | null;
	speakers: string[];
	partners: string[];
	outcomes: string | null;
	registration_url: string | null;
	audience_segment_id: string | null;
	campaign_id: string | null;
};

/** Log an activity — the source record everything downstream is built from. */
export function ActivityForm({
	segments,
	campaigns = [],
	activity,
}: {
	segments: SegmentOption[];
	campaigns?: CampaignOption[];
	activity?: ActivityFormData;
}) {
	const router = useRouter();
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (prev, fd) => activity ? updateActivity(activity.id, prev, fd) : createActivity(fd),
		null
	);

	useEffect(() => {
		if (state?.ok && state.id) router.push(`/activities/${state.id}`);
	}, [state, router]);

	return (
		<ShadcnFieldGroup asChild><ShadcnCard asChild><form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
			<p className="text-sm text-muted-foreground">Start with a name and what happened. Only the activity name is required; you can add files after saving.</p>
			<div className="grid gap-5 sm:grid-cols-2">
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Label htmlFor="title">Activity name</Label>
					<Input
						id="title"
						name="title"
						required
						minLength={2}
						defaultValue={activity?.title ?? ""}
						placeholder="e.g. Founder Demo Day — June cohort"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="event_date">Event date</Label>
					<Input id="event_date" name="event_date" type="date" defaultValue={activity?.event_date ?? ""} />
				</div>
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Label htmlFor="description">What happened or is planned?</Label>
					<Textarea id="description" name="description" rows={4} defaultValue={activity?.description ?? ""} placeholder="Describe the activity, key facts and who it is for." />
				</div>
			</div>
			<Disclosure initiallyOpen={Boolean(activity?.registration_url || activity?.audience_segment_id || activity?.campaign_id || activity?.outcomes || activity?.speakers.length || activity?.partners.length)} className="border-t pt-4" title={<>People, campaign &amp; registration (optional)</>}>
				
				<div className="mt-4 grid gap-5 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor="registration_url">Registration link</Label>
					<Input
						id="registration_url"
						name="registration_url"
						type="url"
						placeholder="https://…"
						defaultValue={activity?.registration_url ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="audience_segment_id">Audience segment</Label>
					<ShadcnNativeSelect
						id="audience_segment_id"
						name="audience_segment_id"
						defaultValue={activity?.audience_segment_id ?? ""}
						className={selectClass}
					>
						<ShadcnNativeSelectOption value="">Untagged</ShadcnNativeSelectOption>
						{segments.map((s) => (
							<ShadcnNativeSelectOption key={s.id} value={s.id}>
								{s.name}
							</ShadcnNativeSelectOption>
						))}
					</ShadcnNativeSelect>
				</div>
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Label htmlFor="campaign_id">Campaign</Label>
					<ShadcnNativeSelect id="campaign_id" name="campaign_id" defaultValue={activity?.campaign_id ?? ""} className={selectClass}>
						<ShadcnNativeSelectOption value="">No campaign</ShadcnNativeSelectOption>
						{campaigns.map((campaign) => <ShadcnNativeSelectOption key={campaign.id} value={campaign.id}>{campaign.name}</ShadcnNativeSelectOption>)}
					</ShadcnNativeSelect>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="speakers">Speakers (one per line)</Label>
					<Textarea id="speakers" name="speakers" rows={4} defaultValue={activity?.speakers.join("\n") ?? ""} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="partners">Partners (one per line)</Label>
					<Textarea id="partners" name="partners" rows={4} defaultValue={activity?.partners.join("\n") ?? ""} />
				</div>
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Label htmlFor="outcomes">Key outcomes</Label>
					<Textarea
						id="outcomes"
						name="outcomes"
						rows={3}
						defaultValue={activity?.outcomes ?? ""}
						placeholder="Attendance, winners, announcements, quotes…"
					/>
				</div>
			</div>
			</Disclosure>
			{state?.ok === false ? (
				<ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
					{state.error}
				</p></ShadcnAlert>
			) : null}
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={pending}>
					{pending ? "Saving…" : activity ? "Save changes" : "Log activity"}
				</Button>
				<Button asChild variant="ghost">
					<Link href="/activities">Cancel</Link>
				</Button>
			</div>
		</form></ShadcnCard></ShadcnFieldGroup>
	);
}
