import Link from "next/link";
import { AlertCircle, ArrowUpRight, FileText, Globe } from "lucide-react";
import { getUserRole, isReviewerRole } from "@/lib/audience/access";
import { getWordPressConfig } from "@/lib/integrations/wordpress";
import { getStrapiConfig } from "@/lib/integrations/strapi";
import { articleSeo, listWebsiteArticles, listWebsiteDeliveryIssues, WEBSITE_PAGE_SIZE, WEBSITE_STAGES, type WebsiteFilters } from "@/lib/content/website-publishing";
import { publicationDestination, safePublicationUrl } from "@/lib/content/publications";
import { formatDayTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { RichText } from "@/components/ui/rich-text";
import { WordPressPublishAction } from "@/components/content/wordpress-publish-action";
import { StrapiPublishAction } from "@/components/content/strapi-publish-action";
import { WebsiteConnectionCheck, WebsiteDeliveryCheck, WebsiteSeoForm } from "./website-publishing-controls";

const stageLabels = { all: "All articles", drafts: "Drafts", review: "In review", approved: "Approved", scheduled: "Scheduled", published: "Published" };
const HUB = "/audience/landing-pages";

export async function WebsitePublishing({ organizationId, filters }: { organizationId: string; filters: WebsiteFilters }) {
  const [articlesResult, issuesResult, wpResult, strapiResult, roleResult] = await Promise.allSettled([
    listWebsiteArticles(organizationId, filters), listWebsiteDeliveryIssues(organizationId, filters.campaign),
    getWordPressConfig(organizationId), getStrapiConfig(organizationId), getUserRole(organizationId),
  ]);
  const wordpress = wpResult.status === "fulfilled" ? wpResult.value : null;
  const strapi = strapiResult.status === "fulfilled" ? strapiResult.value : null;
  const role = roleResult.status === "fulfilled" ? roleResult.value : null;
  const canPublish = isReviewerRole(role);
  const canManage = Boolean(role && ["owner", "admin", "marketing_manager"].includes(role));
  const result = articlesResult.status === "fulfilled" ? articlesResult.value : null;
  const href = (stage = result?.stage ?? "all", page = 1) => {
    const query = new URLSearchParams({ view: "website", stage });
    if (page > 1) query.set("page", String(page));
    if (result?.q) query.set("q", result.q);
    if (filters.campaign) query.set("campaign", filters.campaign);
    return `${HUB}?${query}`;
  };
  const issues = issuesResult.status === "fulfilled" ? issuesResult.value : [];
  return <section aria-labelledby="website-publishing-heading" className="flex min-w-0 flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="website-publishing-heading" className="text-xl font-semibold tracking-tight">Website publishing and SEO</h2><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">Prepare an article, review its search metadata, then publish approved copy to WordPress or Strapi. WordPress can also deliver it at a scheduled time.</p></div>
      {canPublish ? <WebsiteDeliveryCheck /> : null}
    </header>

    <div className="grid gap-4 md:grid-cols-2" aria-label="Website connections">
      {([
        { key: "wordpress", name: "WordPress", config: wordpress, address: wordpress?.siteUrl, detail: "Publish now or schedule in WAT.", seo: wordpress?.seoPlugin && wordpress.seoPlugin !== "none" ? "SEO plugin configured." : "Choose Yoast or Rank Math in connection settings to send the SEO fields." },
        { key: "strapi", name: "Strapi", config: strapi, address: strapi?.baseUrl, detail: "Publish approved articles immediately.", seo: strapi?.seoTitleField && strapi?.seoDescriptionField ? "Search fields mapped." : "Map the SEO title and description fields in connection settings." },
      ] as const).map(provider => <section key={provider.key} className="slip flex min-w-0 flex-col items-start gap-3 p-5" aria-label={`${provider.name} connection`}>
        <div className="flex w-full flex-wrap items-center justify-between gap-2"><h3 className="inline-flex items-center gap-2 text-base font-semibold"><Globe className="size-4 text-muted-foreground" aria-hidden="true" />{provider.name}</h3><span className="text-xs font-semibold">{provider.config ? "Connection saved" : "Not connected"}</span></div>
        <p className="text-sm text-muted-foreground">{provider.detail}</p>
        {provider.address ? <p className="max-w-full break-all text-sm text-foreground">{provider.address}</p> : null}
        <p className="text-xs leading-5 text-muted-foreground">{provider.seo}</p>
        <Button asChild variant="link" size="sm" className="h-auto min-h-9 px-0"><Link href={`/settings/ai#connection-cms_${provider.key}`}>{provider.config ? "Manage connection" : `Connect ${provider.name}`}<ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
        {canManage && provider.config ? <WebsiteConnectionCheck provider={provider.key} /> : null}
      </section>)}
    </div>

    {issuesResult.status === "rejected" ? <p role="alert" className="text-sm text-destructive">Delivery alerts are unavailable. Open an article’s delivery history or refresh to try again.</p> : issues.length ? <section aria-labelledby="website-alerts-heading" className="slip flex flex-col gap-4 p-5">
      <h3 id="website-alerts-heading" className="inline-flex items-center gap-2 text-base font-semibold"><AlertCircle className="size-4" aria-hidden="true" />Marketing attention needed</h3>
      <ul className="flex flex-col gap-4">{issues.map(issue => <li key={issue.id} className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{issue.asset.title}</p><p className="mt-1 max-w-prose break-words text-sm leading-6 text-muted-foreground">{publicationDestination(issue.channel)}: {issue.status === "failed" ? "Publishing failed. The article is available for review before retrying." : "Delivery has not been confirmed. Check the provider before sending again."} {issue.error}</p>{issue.scheduled_for ? <p className="mt-1 text-xs text-muted-foreground">Planned for {formatDayTime(issue.scheduled_for)}</p> : null}</div><Button asChild variant="outline" size="sm"><Link href={`/library/${issue.content_asset_id}`}>Review delivery</Link></Button></li>)}</ul>
      <p className="text-xs text-muted-foreground">Shows problems among the 50 most recent pending or failed website deliveries. Check deliveries to reconcile provider status.</p>
    </section> : null}

    <div className="flex flex-col gap-3">
      <nav aria-label="Website article status" className="flex flex-wrap gap-1">{WEBSITE_STAGES.map(stage => <Button asChild key={stage} size="sm" variant={result?.stage === stage ? "secondary" : "ghost"}><Link href={href(stage)} aria-current={result?.stage === stage ? "page" : undefined}>{stageLabels[stage]}</Link></Button>)}</nav>
      <form action={HUB} method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value="website" /><input type="hidden" name="stage" value={result?.stage ?? "all"} />{filters.campaign ? <input type="hidden" name="campaign" value={filters.campaign} /> : null}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold">Search articles<Input name="q" key={result?.q} defaultValue={result?.q} maxLength={200} placeholder="Article title or copy" /></label><Button type="submit" variant="outline">Search</Button>{result?.q ? <Button asChild variant="ghost"><Link href={`${HUB}?${new URLSearchParams({ view: "website", stage: result.stage, ...(filters.campaign ? { campaign: filters.campaign } : {}) })}`}>Clear search</Link></Button> : null}
      </form>
    </div>

    {!result ? <EmptyState title="Articles are temporarily unavailable" description="Your content is retained. Refresh this view to load it again." action={{ label: "Reload website articles", href: href() }} /> : <>
      <p className="text-sm text-muted-foreground">{result.total} matching {result.total === 1 ? "article" : "articles"}. Search metadata accompanies approved copy when the connected site’s SEO fields are configured. Advanced SEO scoring and link recommendations are separate from this publishing workflow.</p>
      {result.articles.length ? <ul className="flex flex-col gap-4">{result.articles.map(asset => {
        const seo = articleSeo(asset.metadata);
        const editable = ["idea", "ai_generated", "editing"].includes(asset.status);
        const request = asset.metadata?.publishing as { state?: string; provider?: unknown } | undefined;
        const provider = typeof request?.provider === "string" ? request.provider : null;
        const inFlight = Boolean(request && request.state !== "failed");
        const liveUrl = safePublicationUrl(typeof asset.metadata?.published_url === "string" ? asset.metadata.published_url : typeof asset.metadata?.wordpress_url === "string" ? asset.metadata.wordpress_url : typeof asset.metadata?.strapi_url === "string" ? asset.metadata.strapi_url : null);
        return <li key={asset.id} className="slip overflow-hidden">
          <article aria-labelledby={`article-${asset.id}`}>
            <header className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><StatusStamp status={asset.status} /><span className="text-xs text-muted-foreground">{asset.format || "Website article"}{provider ? ` · ${publicationDestination(provider)}` : ""}</span></div><h3 id={`article-${asset.id}`} className="break-words text-base font-semibold"><Link href={`/library/${asset.id}`} className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{asset.title}</Link></h3><p className="mt-2 text-xs text-muted-foreground">{asset.scheduled_for ? `Planned ${formatDayTime(asset.scheduled_for)}` : `Updated ${formatDayTime(asset.updated_at)}`}</p></div><Button asChild variant="outline" size="sm"><Link href={`/library/${asset.id}`}>{asset.status === "review" ? "Review article" : editable ? "Edit article" : "Open article"}</Link></Button></header>
            <div className="flex flex-col gap-3 border-t px-5 py-4 sm:px-6"><h4 className="text-sm font-semibold">Search metadata</h4><dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]"><dt className="text-muted-foreground">SEO title</dt><dd className="break-words">{seo.title || <span className="text-muted-foreground">Not set</span>}</dd><dt className="text-muted-foreground">Meta description</dt><dd className="max-w-prose break-words leading-6">{seo.description || <span className="text-muted-foreground">Not set</span>}</dd></dl>
              {asset.metadata?.wordpress_seo_saved === false ? <p role="alert" className="max-w-prose text-sm leading-6 text-destructive">WordPress did not save this article’s SEO fields. Check the site’s SEO plugin settings and correct the fields in WordPress. <Link href="/settings/ai#connection-cms_wordpress" className="font-semibold underline underline-offset-4">Review SEO connection settings</Link></p> : null}
              {editable ? <details><DisclosureSummary>Edit search metadata<span className="sr-only"> for {asset.title}</span></DisclosureSummary><div className="pt-4"><WebsiteSeoForm key={asset.updated_at} assetId={asset.id} updatedAt={asset.updated_at} title={seo.title} description={seo.description} /></div></details> : <p className="text-xs leading-5 text-muted-foreground">Search metadata is locked with the reviewed copy. Return to Editing in the article to make changes, then request approval again.</p>}
            </div>
            <details className="border-t px-5 py-3 sm:px-6"><DisclosureSummary>Preview article<span className="sr-only">: {asset.title}</span></DisclosureSummary><div className="max-w-prose py-4">{asset.body ? <RichText>{asset.body}</RichText> : <p className="text-sm text-muted-foreground">Add article copy before requesting approval.</p>}</div></details>
            <footer className="flex flex-col gap-4 border-t bg-muted/20 p-5 sm:p-6">
              {asset.status === "approved" && canPublish && !inFlight ? <div className="grid gap-6 md:grid-cols-2">{wordpress ? <WordPressPublishAction assetId={asset.id} /> : <p className="text-sm text-muted-foreground">Connect WordPress above to publish or schedule this approved article.</p>}{strapi ? <StrapiPublishAction assetId={asset.id} /> : <p className="text-sm text-muted-foreground">Connect Strapi above to publish this approved article.</p>}</div> : <p className="text-sm text-muted-foreground">{editable ? "Save your article and search metadata, then open the article to submit it for review." : asset.status === "review" ? "A reviewer must approve this version before it can be published." : asset.status === "scheduled" || inFlight && asset.status === "approved" ? "A delivery request is already recorded. Check its status or open the article to manage its schedule." : asset.status === "approved" ? "A reviewer can publish this approved article." : "Publication is recorded in the article’s delivery history."}</p>}
              {liveUrl && ["published", "analysing"].includes(asset.status) ? <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 w-fit items-center gap-2 rounded text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View live article<ArrowUpRight className="size-4" aria-hidden="true" /></a> : null}
            </footer>
          </article>
        </li>;
      })}</ul> : <EmptyState title="No articles in this view" description="Create a website draft, or choose a different status or search term." action={{ label: "Create blog draft", href: "/library/new?channel=website&format=blog" }} />}
      {result.total > WEBSITE_PAGE_SIZE ? <nav aria-label="Website article pages" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {result.page} of {Math.ceil(result.total / WEBSITE_PAGE_SIZE)}</p><div className="flex gap-2">{result.page > 1 ? <Button asChild variant="outline"><Link href={href(result.stage, result.page - 1)}>Previous</Link></Button> : null}{result.page * WEBSITE_PAGE_SIZE < result.total ? <Button asChild variant="outline"><Link href={href(result.stage, result.page + 1)}>Next</Link></Button> : null}</div></nav> : null}
    </>}
    <p className="inline-flex items-start gap-2 text-xs leading-5 text-muted-foreground"><FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Headings, emphasis and lists are rendered in the preview and converted for website delivery. Scheduling and publishing always use the recorded approval.</p>
  </section>;
}
