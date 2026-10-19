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

export const metadata: Metadata = { title: "Landing Pages" };

export default async function LandingPagesPage({ searchParams }: { searchParams: Promise<{ campaign?: string; view?: string; stage?: string; q?: string; page?: string }> }) {
  const search = await searchParams;
  const campaignId = z.string().uuid().safeParse(search.campaign).success ? search.campaign : undefined;
  const organizationId = await getCallerOrganizationId();
  const websiteView = search.view === "website";
  const pages = organizationId && !websiteView ? await listLandingPages(organizationId, campaignId) : [];
  const viewHref = (view: string) => `/audience/landing-pages?${new URLSearchParams({ view, ...(campaignId ? { campaign: campaignId } : {}) })}`;
  return (
    <div className="workspace-page landing-directory flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div><p className="dateline">{todayDateline()}{!websiteView ? ` · ${pages.length} pages` : ""}</p><h1>Landing Pages</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Manage campaign pages and publish approved website articles.{campaignId ? " Showing content for this campaign." : ""}</p></div>
        <Button asChild className="min-h-10 rounded-lg px-4 text-[13px] font-semibold"><Link href={websiteView ? "/library/new?channel=website&format=blog" : "/audience/landing-pages/new"}>{websiteView ? "Create blog draft" : "Create landing page"}</Link></Button>
      </header>
      <nav aria-label="Landing Pages workspace" className="flex flex-wrap gap-1 border-b border-border pb-3"><Button asChild variant={!websiteView ? "secondary" : "ghost"}><Link href={viewHref("pages")} aria-current={!websiteView ? "page" : undefined}>Campaign pages</Link></Button><Button asChild variant={websiteView ? "secondary" : "ghost"}><Link href={viewHref("website")} aria-current={websiteView ? "page" : undefined}>Website publishing &amp; SEO</Link></Button></nav>
      {websiteView ? organizationId ? <WebsitePublishing organizationId={organizationId} filters={{ ...search, campaign: campaignId }} /> : <EmptyState title="Choose a workspace" description="Open a workspace before managing website publishing." action={{ label: "Set up workspace", href: "/onboarding" }} /> : pages.length ? (
        <ul className="ledger slip divide-y divide-border/80 overflow-hidden">{pages.map((page) => <li key={page.id}><Link href={`/audience/landing-pages/${page.id}`} className="flex items-start justify-between gap-4 rounded-lg px-5 py-4 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusStamp status={page.status} /><span className="dateline break-all">{publicLandingPagePath(page)}</span></div><h2 className="mt-1.5 truncate text-sm font-semibold tracking-[-0.01em]">{page.title}</h2><p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{page.headline}</p></div><span className="dateline shrink-0">Open</span></Link></li>)}</ul>
      ) : <EmptyState title="No landing pages yet" description="Build a focused page for an activity or campaign. The public form will capture interest and record campaign attribution." action={{ label: "Create landing page", href: "/audience/landing-pages/new" }} />}
    </div>
  );
}
