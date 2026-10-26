import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getSegment, listPrograms } from "@/lib/audience/segments";
import { listSegmentInsights } from "@/lib/audience/insights";
import { SegmentForm } from "@/components/audience/segment-form";
import { SegmentDelete } from "@/components/audience/segment-delete";
import { StatusStamp } from "@/components/ui/status-stamp";

export const metadata: Metadata = { title: "Audience segment" };

export default async function SegmentDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const orgId = await getCallerOrganizationId();
	if (!orgId) notFound();

	const segment = await getSegment(orgId, id);
	if (!segment) notFound();

	const [programs, insights] = await Promise.all([
		listPrograms(orgId),
		listSegmentInsights(orgId, id),
	]);

	return (
		<div className="workspace-page segment-workspace flex flex-col gap-4 md:gap-6">
			<header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div>
					<Link
						href="/audience/segments"
						className="group inline-flex min-h-9 items-center gap-1.5 rounded-md py-2 text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring"
					>
                        <ArrowLeft aria-hidden="true" className="size-4" /> Segments
					</Link>
					<h1>
						{segment.name}
					</h1>
				</div>
				<SegmentDelete segmentId={segment.id} />
			</header>

			<p className="ril-record-intro">Keep the audience profile alongside its evidence. Only approved insights inform new content recommendations.</p>
			<div className="record-layout grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<SegmentForm
						programs={programs.map((p) => ({ id: p.id, name: p.name }))}
						segment={{
							id: segment.id,
							name: segment.name,
							description: segment.description,
							needs_motivations: segment.needs_motivations,
							preferred_formats: segment.preferred_formats,
							preferred_platforms: segment.preferred_platforms,
							preferred_hooks: segment.preferred_hooks,
							programIds: segment.programs.map((p) => p.id),
						}}
					/>
				</div>

				<section className="slip flex h-fit flex-col p-5 sm:p-6">
					<h2 className="ril-record-aside-title">Audience evidence</h2>
					<p className="dateline mt-2">{insights.length} insights for this segment</p>
					{insights.length ? (
						<ul className="ledger mt-2 flex flex-col">
							{insights.map((ins) => (
								<li key={ins.id} className="py-2.5">
									<Link
										href={`/audience/insights/${ins.id}`}
										className="group flex flex-col gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									>
										<span className="text-sm font-semibold leading-snug tracking-[-0.01em] text-foreground group-hover:text-primary">
											{ins.summary}
										</span>
										<StatusStamp status={ins.status} />
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-sm text-muted-foreground">
							No insights yet. They arrive after the next analysis pass.
						</p>
					)}
				</section>
			</div>
		</div>
	);
}
