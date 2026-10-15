import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getInsight } from "@/lib/audience/insights";
import { InsightActions } from "@/components/audience/insight-actions";
import { InsightAnnotate } from "@/components/audience/insight-annotate";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Audience insight" };

const humanize = (s: string) =>
	s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function InsightDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const orgId = await getCallerOrganizationId();
	if (!orgId) notFound();

	const insight = await getInsight(orgId, id);
	if (!insight) notFound();

	const dims: Array<{ label: string; value: string | null }> = [
		{ label: "Topic", value: insight.topic },
		{ label: "Format", value: insight.format },
		{ label: "Platform", value: insight.platform },
		{ label: "Hook", value: insight.hook },
		{ label: "CTA", value: insight.cta },
	].filter((d) => d.value);

	const provenance = [
		{ label: "Activities", n: insight.source_event_ids.length },
		{ label: "Content assets", n: insight.source_content_asset_ids.length },
		{ label: "Leads", n: insight.source_lead_ids.length },
	];

	return (
		<div className="workspace-page flex flex-col gap-4 md:gap-6">
			<header>
				<Link
					href="/audience/insights"
					className="group inline-flex min-h-9 items-center gap-1.5 rounded-md py-2 text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring"
				>
                    <ArrowLeft aria-hidden="true" className="size-4" /> Insights
				</Link>
				<div className="mt-1.5 flex flex-wrap items-center gap-3">
					<span className="dateline">{humanize(insight.category)}</span>
					<StatusStamp status={insight.status} />
				</div>
				<h1>
					{insight.summary}
				</h1>
			</header>

			<div className="record-layout grid gap-6 lg:grid-cols-3">
				<div className="flex flex-col gap-4 lg:col-span-2 lg:gap-6">
					<section className="slip p-5 sm:p-6">
						<p className="dateline">Recommendation</p>
						<p className="mt-1.5 text-sm leading-6 text-foreground">
							{insight.recommendation}
						</p>
					</section>

					<section className="slip flex flex-col">
						<div className="ledger flex flex-col">
							<div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
								<span className="dateline">Confidence</span>
								<span className="tnum text-sm font-semibold text-foreground">
									{Math.round(insight.confidence_score * 100)}%
								</span>
							</div>
							<div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
								<span className="dateline">Signal</span>
								<span className="text-sm font-medium text-foreground">
									{humanize(insight.signal_strength)}
								</span>
							</div>
							<div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
								<span className="dateline">Sample size</span>
								<span className="tnum text-sm font-semibold text-foreground">
									{insight.sample_size}
								</span>
							</div>
							{dims.map((d) => (
								<div
									key={d.label}
									className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6"
								>
									<span className="dateline">{d.label}</span>
									<span className="text-sm font-medium text-foreground">
										{d.value}
									</span>
								</div>
							))}
						</div>
						<div className="flex flex-wrap gap-6 border-t border-border/80 px-5 py-4 sm:px-6">
							{provenance.map((p) => (
								<div key={p.label}>
									<p className="tnum text-xl font-bold text-foreground">{p.n}</p>
									<p className="dateline">{p.label}</p>
								</div>
							))}
						</div>
					</section>

					{insight.status === "SUPPRESSED" && insight.suppression_reason ? (
						<section className="slip p-5 sm:p-6">
							<p className="dateline">Suppression reason</p>
							<p className="mt-1.5 text-sm leading-6 text-foreground">
								{insight.suppression_reason}
							</p>
						</section>
					) : null}
				</div>

				<div className="flex flex-col gap-4 lg:gap-6">
					{insight.status === "PENDING_REVIEW" ? (
						<section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">
							<div>
								<p className="dateline">Decision</p>
								<h2 className="mt-1 text-base font-bold">AI recommends. You decide.</h2>
							</div>
							<InsightActions insightId={insight.id} />
						</section>
					) : (
						<section className="slip flex h-fit flex-col p-5 sm:p-6">
							<p className="dateline">Reviewed</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{insight.reviewed_at ? formatDay(insight.reviewed_at) : "—"}
							</p>
						</section>
					)}

					<section className="slip flex h-fit flex-col p-5 sm:p-6">
						<InsightAnnotate insightId={insight.id} note={insight.review_note} />
					</section>
				</div>
			</div>
		</div>
	);
}
