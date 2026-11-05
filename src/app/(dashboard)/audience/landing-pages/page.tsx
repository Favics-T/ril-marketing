import { WorkspacePageHeader } from "@/components/workspace-page-header";

import { Card as ShadcnCard } from "@/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listLandingPages } from "@/lib/landing-pages";
import { publicLandingPagePath } from "@/lib/landing-page-url";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { todayDateline } from "@/lib/format";
import { z } from "zod";
import { WebsitePublishing } from "@/components/landing-pages/website-publishing";
import { getUserRole, isReviewerRole } from "@/lib/audience/access";

export const metadata: Metadata = { title: "Landing Pages" };

export default async function LandingPagesPage({ searchParams }: { searchParams: Promise<{ campaign?: string; view?: string; stage?: string; q?: string; page?: string }> }) {
  const search = await searchParams;
  const campaignId = z.string().uuid().safeParse(search.campaign).success ? search.campaign : undefined;
  const organizationId = await getCallerOrganizationId();
  const canBuild = organizationId ? isReviewerRole(await getUserRole(organizationId)) : false;
  const websiteView = search.view === "website";
  const pages = organizationId && !websiteView ? await listLandingPages(organizationId, campaignId) : [];
  const viewHref = (view: string) => `/audience/landing-pages?${new URLSearchParams({ view, ...(campaignId ? { campaign: campaignId } : {}) })}`;
  return (
    <div className="workspace-page landing-directory flex flex-col gap-6">
      <WorkspacePageHeader title={<>Landing Pages</>} eyebrow={<>{todayDateline()}{!websiteView ? ` · ${pages.length} pages` : ""}</>} description={<>Manage campaign pages and publish approved website articles.{campaignId ? " Showing content for this campaign." : ""}</>} actions={<> {websiteView || canBuild ? <Button asChild className="px-4"><Link href={websiteView ? "/library/new?channel=website&format=blog" : "/audience/landing-pages/new"}>{websiteView ? "Create blog draft" : "Create landing page"}</Link></Button> : null} </>} />
      <nav aria-label="Landing Pages workspace" className="flex flex-wrap gap-1 border-b border-border pb-3"><Button asChild variant={!websiteView ? "secondary" : "ghost"}><Link href={viewHref("pages")} aria-current={!websiteView ? "page" : undefined}>Campaign pages</Link></Button><Button asChild variant={websiteView ? "secondary" : "ghost"}><Link href={viewHref("website")} aria-current={websiteView ? "page" : undefined}>Website publishing &amp; SEO</Link></Button></nav>
      {websiteView ? organizationId ? <WebsitePublishing organizationId={organizationId} filters={{ ...search, campaign: campaignId }} /> : <EmptyState title="Choose a workspace" description="Open a workspace before managing website publishing." action={{ label: "Set up workspace", href: "/onboarding" }} /> : pages.length ? (
        <ShadcnCard asChild><ul className="ledger slip divide-y divide-border/80 overflow-hidden">{pages.map((page) => <li key={page.id}><Link href={`/audience/landing-pages/${page.id}`} className="flex items-start justify-between gap-4 rounded-lg px-5 py-4 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusStamp status={page.status} /><span className="dateline break-all">{publicLandingPagePath(page)}</span></div><h2 className="mt-1.5 truncate text-sm font-semibold tracking-[-0.01em]">{page.title}</h2><p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{page.headline}</p></div><span className="dateline shrink-0">Open</span></Link></li>)}</ul></ShadcnCard>
      ) : <EmptyState title="No landing pages yet" description={canBuild ? "Build a focused page for an activity or campaign. The public form will capture interest and record campaign attribution." : "A marketing manager, owner, admin or leader can create the first campaign page. You can view pages here once they are saved."} action={canBuild ? { label: "Create landing page", href: "/audience/landing-pages/new" } : undefined} />}
    </div>
  );
}
