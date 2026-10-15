import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getActivity } from "@/lib/content/activities";
import { GenerateFromActivity } from "@/components/content/generate-from-activity";
import { formatDay } from "@/lib/format";
import { listActivityAttachments } from "@/lib/content/attachments";
import { ActivityAttachments } from "@/components/content/activity-attachments";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const orgId = await getCallerOrganizationId();
	if (!orgId) notFound();

	const activity = await getActivity(orgId, id);
	if (!activity) notFound();
	const attachments = await listActivityAttachments(orgId, id);

	const facts: Array<{ label: string; value: string }> = [
		{ label: "Event date", value: formatDay(activity.event_date) },
		{ label: "Segment", value: activity.segment?.name ?? "Untagged" },
		{
			label: "Speakers",
			value: activity.speakers.length ? activity.speakers.join(", ") : "None listed",
		},
		{
			label: "Partners",
			value: activity.partners.length ? activity.partners.join(", ") : "None listed",
		},
	];

	return (
		<div className="workspace-page flex flex-col gap-4 md:gap-6">
			<header>
				<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div>
				<Link
					href="/activities"
					className="group inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
					All activities
				</Link>
				<h1>
					{activity.title}
				</h1>
				{activity.description ? (
					<p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
						{activity.description}
					</p>
				) : null}
				</div>
				<Button asChild variant="outline" className="min-h-10 rounded-lg px-4 text-[13px] font-semibold"><Link href={`/activities/${activity.id}/edit`}>Edit activity</Link></Button>
				</div>
			</header>

			<div className="record-layout grid gap-6 lg:grid-cols-3">
				<section className="slip flex flex-col gap-0 lg:col-span-2">
					<div className="ledger flex flex-col">
						{facts.map((f) => (
							<div
								key={f.label}
								className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6"
							>
								<span className="dateline">{f.label}</span>
								<span className="text-sm font-medium text-foreground">
									{f.value}
								</span>
							</div>
						))}
						{activity.registration_url ? (
							<div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
								<span className="dateline">Registration</span>
								<a
									href={activity.registration_url}
									target="_blank"
									rel="noreferrer"
									className="-my-1.5 inline-block max-w-[60%] truncate py-1.5 text-sm font-medium text-primary hover:underline"
								>
									{activity.registration_url}
								</a>
							</div>
						) : null}
					</div>
					{activity.outcomes ? (
						<div className="border-t border-border/80 px-5 py-4 sm:px-6">
							<p className="dateline">Key outcomes</p>
							<p className="mt-1.5 text-sm leading-6 text-foreground">
								{activity.outcomes}
							</p>
						</div>
					) : null}
				</section>

				<section className="slip flex h-fit flex-col gap-4 p-5 sm:p-6">
					<div>
						<p className="dateline">Repurpose</p>
						<h2 className="mt-1 text-base font-bold">One activity, many drafts</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							AI recommends. You approve. Nothing publishes unstamped.
						</p>
					</div>
					<GenerateFromActivity activityId={activity.id} />
				</section>
			</div>
			<ActivityAttachments organizationId={orgId} activityId={activity.id} attachments={attachments} />
		</div>
	);
}
