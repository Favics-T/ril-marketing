import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getAsset, listAssetApprovals, listAssetPublications } from "@/lib/content/assets";
import { AssetTransition } from "@/components/content/asset-transition";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay } from "@/lib/format";
import { DraftEditor } from "@/components/content/draft-editor";
import { WordPressPublishAction } from "@/components/content/wordpress-publish-action";
import { StrapiPublishAction } from "@/components/content/strapi-publish-action";
import { PublishHistory } from "@/components/content/publish-history";
import { createClient } from "@/lib/supabase/server";
import { formatReminderTime, reminderState } from "@/lib/content/reminders";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { MarkPosted } from "@/components/content/mark-posted";

export const metadata: Metadata = { title: "Content asset" };

const statusLabel = (s: string) =>
	s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function AssetDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const orgId = await getCallerOrganizationId();
	if (!orgId) notFound();

	const asset = await getAsset(orgId, id);
	if (!asset) notFound();
	const [approvals, publications] = await Promise.all([
		listAssetApprovals(orgId, id),
		listAssetPublications(orgId, id),
	]);
	const reminder = reminderState(asset);
	const isCalendarProposal = asset.metadata?.calendar_generator === true;
	const recommendationReason = typeof asset.metadata?.recommendation_reason === "string" ? asset.metadata.recommendation_reason : null;
	const suggestedAt = typeof asset.metadata?.suggested_publish_at === "string" ? asset.metadata.suggested_publish_at : null;
	const seo = asset.metadata?.seo && typeof asset.metadata.seo === "object" ? asset.metadata.seo as { title?: string; description?: string; keywords?: string[]; internalLinks?: string[] } : null;
	const cmsEligible = asset.status === "approved" && (asset.format === "blog" || asset.channel === "website");
	const [wpResult, strapiResult] = cmsEligible
		? await createClient().then((client) =>
				Promise.all([
					client.from("integrations").select("status").eq("organization_id", orgId).eq("key", "cms_wordpress").maybeSingle<{ status: string }>(),
					client.from("integrations").select("status").eq("organization_id", orgId).eq("key", "cms_strapi").maybeSingle<{ status: string }>(),
				]),
			)
		: [{ data: null }, { data: null }];
	const wordpress = wpResult.data;
	const strapi = strapiResult.data;

	const meta: Array<{ label: string; value: string | null }> = [
		{ label: "Channel", value: asset.channel },
		{ label: "Format", value: asset.format },
		{ label: "Platform", value: asset.platform },
		{ label: "Topic", value: asset.topic },
		{ label: "Hook", value: asset.hook },
		{ label: "CTA", value: asset.cta },
		{ label: "Scheduled", value: asset.scheduled_for ? formatReminderTime(asset.scheduled_for) : null },
		{ label: "Published", value: asset.published_at ? formatDay(asset.published_at) : null },
	].filter((m) => m.value);

	return (
		<div className="workspace-page flex flex-col gap-4 md:gap-6">
			<header>
				<Link
					href="/library"
					className="group inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Content library
				</Link>
				<div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
					<h1>
						{asset.title}
					</h1>
					<StatusStamp status={asset.status} />
				</div>
			</header>

			<div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
				<section className="slip flex flex-col lg:col-span-2">
					<div className="px-5 py-5 sm:px-6">
						{asset.body ? (
							<p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
								{asset.body}
							</p>
						) : (
							<p className="text-sm italic text-muted-foreground">
								This asset is still a brief. Add body copy before review.
							</p>
						)}
					</div>
					{meta.length ? (
						<div className="ledger flex flex-col border-t border-border/80">
							{meta.map((m) => (
								<div
									key={m.label}
									className="flex items-baseline justify-between gap-4 px-5 py-3 sm:px-6"
								>
									<span className="dateline">{m.label}</span>
									<span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
										{m.value}
									</span>
								</div>
							))}
						</div>
					) : null}
					{seo && (seo.title || seo.description || seo.keywords?.length || seo.internalLinks?.length) ? <section className="border-t border-border/80 px-5 py-4 sm:px-6"><p className="dateline">SEO preparation</p>{seo.title ? <p className="mt-2 text-[13px] font-bold tracking-[-0.01em]">{seo.title}</p> : null}{seo.description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{seo.description}</p> : null}{seo.keywords?.length ? <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Target terms · {seo.keywords.join(", ")}</p> : null}{seo.internalLinks?.length ? <ul className="mt-2 flex flex-col gap-1 text-xs text-primary">{seo.internalLinks.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{url}</a></li>)}</ul> : null}<p className="mt-2 text-[13px] leading-5 text-muted-foreground">Editorial search metadata only. Search performance is not verified until analytics data is connected.</p></section> : null}
					{["idea", "ai_generated", "editing"].includes(asset.status) ? <DraftEditor asset={asset} /> : null}
					</section>

				<div className="flex flex-col gap-4 lg:gap-6">
					{reminder && asset.scheduled_for ? (
						<section
							aria-labelledby="reminder-heading"
							className={`slip flex h-fit flex-col gap-3 border-l-4 p-5 sm:p-6 ${reminder === "overdue" ? "border-l-destructive" : "border-l-flag"}`}
						>
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="dateline">Posting reminder</p>
									<h2 id="reminder-heading" className="mt-1 text-base font-bold">
										{reminder === "overdue" ? "This post is overdue" : "Post this today"}
									</h2>
								</div>
								<ReminderFlag state={reminder} />
							</div>
							<p className="text-sm leading-6 text-muted-foreground">
								{reminder === "overdue"
									? `It was due ${formatReminderTime(asset.scheduled_for)}. Post it now, or move it back to Approved to pick a new time.`
									: `Due ${formatReminderTime(asset.scheduled_for)}. Once it's live on ${asset.platform || asset.channel || "the channel"}, mark it as posted.`}
							</p>
							<MarkPosted assetId={asset.id} />
						</section>
					) : null}
					{isCalendarProposal ? (
						<section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">
							<div><p className="dateline">Calendar proposal</p><h2 className="mt-1 text-base font-bold">Recommendation</h2></div>
							{suggestedAt ? <p className="text-sm"><span className="text-muted-foreground">Suggested timing: </span>{new Date(suggestedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p> : null}
							{typeof asset.metadata?.objective === "string" ? <p className="text-sm"><span className="text-muted-foreground">Objective: </span>{asset.metadata.objective}</p> : null}
							{typeof asset.metadata?.funnel_stage === "string" ? <p className="text-sm"><span className="text-muted-foreground">Funnel stage: </span>{asset.metadata.funnel_stage}</p> : null}
							{recommendationReason ? <p className="text-sm leading-6 text-muted-foreground">{recommendationReason}</p> : null}
						</section>
					) : null}
					<section className="slip flex h-fit flex-col gap-4 p-5 sm:p-6">
						<div>
							<p className="dateline">Approval pipeline</p>
							<h2 className="mt-1 text-base font-bold">Move this asset</h2>
						</div>
						<AssetTransition assetId={asset.id} status={asset.status} />
					</section>
					{cmsEligible ? <section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">{wordpress?.status === "connected" ? <WordPressPublishAction assetId={asset.id} /> : <><p className="dateline">WordPress publishing</p><p className="text-sm leading-5 text-muted-foreground">Connect WordPress in AI Settings to publish this approved article.</p><Link href="/settings/ai" className="text-sm font-medium text-primary underline underline-offset-2">Open AI Settings</Link></>}</section> : null}
					{cmsEligible ? <section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">{strapi?.status === "connected" ? <StrapiPublishAction assetId={asset.id} /> : <><p className="dateline">Strapi publishing</p><p className="text-sm leading-5 text-muted-foreground">Connect Strapi in AI Settings to publish this approved article.</p><Link href="/settings/ai" className="text-sm font-medium text-primary underline underline-offset-2">Open AI Settings</Link></>}</section> : null}

					<PublishHistory publications={publications} assetStatus={asset.status} />

					<section className="slip flex h-fit flex-col p-5 sm:p-6">
						<p className="dateline">History</p>
						{approvals.length ? (
							<ol className="ledger mt-2 flex flex-col">
								{approvals.map((a) => (
									<li key={a.id} className="flex flex-col gap-0.5 py-2.5">
										<span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
											{statusLabel(a.from_status)} → {statusLabel(a.to_status)}
										</span>
										<span className="dateline">{formatDay(a.created_at)}</span>
										{a.note ? (
											<span className="mt-0.5 text-sm text-muted-foreground">
												{a.note}
											</span>
										) : null}
									</li>
								))}
							</ol>
						) : (
							<p className="mt-2 text-sm text-muted-foreground">
								No transitions recorded yet.
							</p>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
