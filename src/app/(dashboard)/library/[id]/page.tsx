import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getAsset, listAssetApprovals, listAssetPublications } from "@/lib/content/assets";
import { needsSecondApproval, type ContentSignoff, type ContentReviewer } from "@/lib/content/workflow";
import { AssetTransition } from "@/components/content/asset-transition";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay, formatDayTime } from "@/lib/format";
import { DraftEditor } from "@/components/content/draft-editor";
import { WordPressPublishAction } from "@/components/content/wordpress-publish-action";
import { StrapiPublishAction } from "@/components/content/strapi-publish-action";
import { PublishHistory } from "@/components/content/publish-history";
import { createClient } from "@/lib/supabase/server";
import { ManualPostAction } from "@/components/content/manual-post-action";
import { isSocialAsset, parseLivePostUrl } from "@/lib/content/manual-posting";
import { SocialPublishAction } from "@/components/content/social-publish-action";
import { PublicationStatus } from "@/components/content/publication-status";
import { getBufferStatus } from "@/lib/integrations/buffer";
import { getWordPressConfig } from "@/lib/integrations/wordpress";
import { ContentDetails } from "@/components/content/content-details";
import { GeneratedDetails } from "@/components/content/generated-details";
import { RecurringContent } from "@/components/content/recurring-content";
import { RichText } from "@/components/ui/rich-text";
import { getUserRole, isReviewerRole } from "@/lib/audience/access";
import { formatReminderTime, reminderState } from "@/lib/content/reminders";
import { ReminderFlag } from "@/components/content/reminder-flag";

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
	const socialAsset = isSocialAsset(asset.channel, asset.platform);
	const manualPost = asset.metadata?.manual_post as { url?: string; recorded_at?: string } | undefined;
	const liveUrl = typeof manualPost?.url === "string" ? parseLivePostUrl(manualPost.url) : null;
	const [approvals, publications] = await Promise.all([listAssetApprovals(orgId, id), listAssetPublications(orgId, id)]);
	const workflowClient = await createClient();
 const canPublish=isReviewerRole(await getUserRole(orgId));
 const [signoffs, reviewers] = await Promise.all([
   workflowClient.from("content_signoffs").select("*").eq("organization_id", orgId).eq("content_asset_id", id).eq("approval_revision", asset.approval_revision ?? 1).order("tier"),
   workflowClient.rpc("content_reviewers", {p_org: orgId}),
 ]);
 if (signoffs.error || reviewers.error) throw new Error("Could not load recorded approvals. Refresh before taking action.");
 const releaseReady = (signoffs.data?.length ?? 0) >= (needsSecondApproval(asset.approval_category ?? "standard", asset.sensitivity) ? 2 : 1);
	const reminder = reminderState(asset);
	const isCalendarProposal = asset.metadata?.calendar_generator === true;
	const recommendationReason = typeof asset.metadata?.recommendation_reason === "string" ? asset.metadata.recommendation_reason : null;
	const suggestedAt = typeof asset.metadata?.suggested_publish_at === "string" ? asset.metadata.suggested_publish_at : null;
	const seo = asset.metadata?.seo && typeof asset.metadata.seo === "object" ? asset.metadata.seo as { title?: string; description?: string; keywords?: string[]; internalLinks?: string[] } : null;
	const cmsEligible = releaseReady && asset.status === "approved" && (asset.format === "blog" || asset.channel === "website");
	const [wpResult, strapiResult] = cmsEligible
		? await createClient().then((client) =>
				Promise.all([
					client.from("integrations").select("status").eq("organization_id", orgId).eq("key", "cms_wordpress").maybeSingle<{ status: string }>(),
					client.from("integrations").select("status").eq("organization_id", orgId).eq("key", "cms_strapi").maybeSingle<{ status: string }>(),
				]),
			)
		: [{ data: null }, { data: null }];
	const wordpress = wpResult.data?.status === "connected" && await getWordPressConfig(orgId) ? wpResult.data : null;
	const strapi = strapiResult.data;
	const buffer = releaseReady && socialAsset && asset.status === "approved" ? await getBufferStatus(orgId) : null;
	const publishingRecord = asset.metadata?.publishing as { provider?: string; state?: string } | undefined;
	const publishing = publishingRecord?.state === "failed" ? undefined : publishingRecord;
	const delivery = publishing && asset.status === "scheduled" ? await createClient().then(client => client.from("publications").select("error,external_id").eq("organization_id", orgId).eq("content_asset_id", id).in("status", ["queued", "scheduled", "missed"]).order("created_at", { ascending: false }).limit(1).maybeSingle()) : null;
	const providerUrl = typeof asset.metadata?.published_url === "string" ? parseLivePostUrl(asset.metadata.published_url) : null;

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
                    <ArrowLeft aria-hidden="true" className="size-4" /> Content library
				</Link>
				<div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
					<h1>
						{asset.title}
					</h1>
					<StatusStamp status={asset.status} />
				</div>
			</header>

			<div className="record-layout grid gap-6 lg:grid-cols-3">
				<section className="slip flex flex-col lg:col-span-2">
					<div className="px-5 py-5 sm:px-6">
						{asset.body ? (
							<RichText>{asset.body}</RichText>
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
					<GeneratedDetails metadata={asset.metadata} />
					{["idea", "ai_generated", "editing"].includes(asset.status) ? <DraftEditor key={asset.updated_at} asset={asset} /> : null}
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
								{!releaseReady ? "Check delivery first, then remove this reservation and request recorded approval before publishing again." : reminder === "overdue"
									? `It was due ${formatReminderTime(asset.scheduled_for)}. Post it now, or move it back to Approved to pick a new time.`
									: `Due ${formatReminderTime(asset.scheduled_for)}. Once it's live on ${asset.platform || asset.channel || "the channel"}, mark it as posted.`}
							</p>
							{releaseReady ? <a href="#manual-post-heading" className="text-sm font-semibold text-primary underline underline-offset-4">Record the live post link</a> : null}
						</section>
					) : null}
					{isCalendarProposal ? (
						<section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">
							<div><p className="dateline">Calendar proposal</p><h2 className="mt-1 text-base font-bold">Recommendation</h2></div>
							{suggestedAt ? <p className="text-sm"><span className="text-muted-foreground">Suggested timing: </span>{formatDayTime(suggestedAt)}</p> : null}
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
						{publishing && asset.status === "scheduled" ? <p className="text-sm text-muted-foreground">A provider is handling delivery. Check its status below, or change the schedule in the calendar.</p> : <AssetTransition key={asset.updated_at} assetId={asset.id} status={asset.status} manualSocialPosting={socialAsset} scheduledFor={asset.scheduled_for} expectedUpdatedAt={asset.updated_at} category={asset.approval_category} sensitivity={asset.sensitivity} signoffs={(signoffs.data ?? []) as ContentSignoff[]} reviewers={(reviewers.data ?? []) as ContentReviewer[]} authorId={asset.created_by} secondReviewerId={asset.second_reviewer_id} />}
					</section>
					{socialAsset && (releaseReady || ["published", "analysing"].includes(asset.status)) && !(publishing && asset.status === "scheduled") ? <ManualPostAction assetId={asset.id} body={asset.body} status={asset.status} liveUrl={liveUrl} recordedAt={typeof manualPost?.recorded_at === "string" && Number.isFinite(Date.parse(manualPost.recorded_at)) ? manualPost.recorded_at : null} /> : null}
					{buffer ? <SocialPublishAction assetId={asset.id} connected={buffer.connected} channels={buffer.channels} copy={asset} updatedAt={asset.updated_at} /> : null}
					{socialAsset && asset.format !== "short-form video" ? <ContentDetails key={`media-${asset.updated_at}`} assetId={asset.id} updatedAt={asset.updated_at} metadata={asset.metadata} editable={["idea","ai_generated","editing"].includes(asset.status)} platform={asset.platform || asset.channel} /> : null}
					{asset.metadata?.clip || asset.format === "short-form video" ? <ContentDetails key={`clip-${asset.updated_at}`} assetId={asset.id} updatedAt={asset.updated_at} metadata={asset.metadata} editable={["idea","ai_generated","editing"].includes(asset.status)} platform={asset.platform || asset.channel} clip /> : null}
					{canPublish && socialAsset && ["approved","published","analysing"].includes(asset.status) ? <RecurringContent assetId={asset.id} /> : null}
					{typeof asset.metadata?.repurposing_source_id === "string" ? <section className="slip flex flex-col gap-2 p-5 sm:p-6"><h2 className="text-base font-semibold">Source and interpretation</h2><Link className="text-sm text-primary underline" href={`/repurpose/${asset.metadata.repurposing_source_id}`}>Open original source and extraction</Link>{["interpretation_notes","missing_information"].map(key => Array.isArray(asset.metadata[key]) && (asset.metadata[key] as unknown[]).length ? <div key={key}><h3 className="text-sm font-semibold">{key === "interpretation_notes" ? "AI interpretation" : "Missing information"}</h3><ul className="list-disc pl-5 text-sm text-muted-foreground">{(asset.metadata[key] as unknown[]).filter((text):text is string=>typeof text==="string").map((text,index)=><li key={index}>{text}</li>)}</ul></div> : null)}</section> : null}
					{publishing && asset.status === "scheduled" ? <PublicationStatus assetId={asset.id} provider={publishing.provider || "provider"} error={delivery?.data?.error} url={providerUrl} missingReceipt={!delivery?.data?.external_id} /> : null}
					{providerUrl && asset.status === "published" ? <section className="slip p-5 sm:p-6"><p className="dateline">{socialAsset ? "Published post" : "Published article"}</p><a href={providerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline underline-offset-2">Open live {socialAsset ? "post" : "article"}</a></section> : null}
					{cmsEligible ? <section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">{wordpress?.status === "connected" ? <WordPressPublishAction assetId={asset.id} /> : <><p className="dateline">WordPress publishing</p><p className="text-sm leading-5 text-muted-foreground">Connect WordPress in AI Settings to publish this approved article.</p><Link href="/settings/ai" className="text-sm font-medium text-primary underline underline-offset-2">Open AI Settings</Link></>}</section> : null}
					{cmsEligible ? <section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">{strapi?.status === "connected" ? <StrapiPublishAction assetId={asset.id} /> : <><p className="dateline">Strapi publishing</p><p className="text-sm leading-5 text-muted-foreground">Connect Strapi in AI Settings to publish this approved article.</p><Link href="/settings/ai" className="text-sm font-medium text-primary underline underline-offset-2">Open AI Settings</Link></>}</section> : null}

					<Link href="/calendar" className="text-sm font-semibold text-primary underline underline-offset-4">Open calendar to change or recover a schedule</Link>
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
										<span className="dateline">{formatDayTime(a.created_at)}{a.actor_name ? ` · ${a.actor_name}` : ""}{a.actor_role ? ` · ${a.actor_role.replaceAll("_", " ")}` : ""}</span>{a.previous_scheduled_for !== a.scheduled_for && (a.previous_scheduled_for || a.scheduled_for) ? <span className="text-xs text-muted-foreground">{a.previous_scheduled_for ? formatReminderTime(a.previous_scheduled_for) : "Unscheduled"} → {a.scheduled_for ? formatReminderTime(a.scheduled_for) : "Unscheduled"}</span> : null}
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
