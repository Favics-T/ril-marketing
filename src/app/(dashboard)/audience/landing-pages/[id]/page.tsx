import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getLandingPage, getLandingPageOptions, getLandingPageConnections } from "@/lib/landing-pages";
import { publicLandingPagePath } from "@/lib/landing-page-url";
import { getUserRole, isReviewerRole } from "@/lib/audience/access";
import { LandingPageForm } from "@/components/landing-pages/landing-page-form";
import { LandingPageStatus } from "@/components/landing-pages/landing-page-status";
import { LandingPageContent } from "@/components/landing-pages/page-content";
import { StatusStamp } from "@/components/ui/status-stamp";
import { campaignAnchor } from "@/lib/content/activity-display";

export const metadata: Metadata = { title: "Landing page review" };

export default async function LandingPageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizationId = await getCallerOrganizationId();
  if (!organizationId) notFound();
  const page = await getLandingPage(organizationId, id);
  if (!page) notFound();
  const [options, role, connections] = await Promise.all([
    getLandingPageOptions(organizationId),
    getUserRole(organizationId),
    getLandingPageConnections(organizationId, page),
  ]);
  return (
    <div className="workspace-page campaign-page-editor mx-auto w-full max-w-5xl">
      <header><Link href="/audience/landing-pages" className="group inline-flex min-h-9 items-center gap-1.5 rounded-md py-2 text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" /> Landing Pages</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1>{page.title}</h1><StatusStamp status={page.status} /></div><p className="mt-1 break-all text-sm text-muted-foreground">Public route: {publicLandingPagePath(page)}</p></header>
      {page.status === "published" || page.status === "paused" ? <p className="text-sm">{page.status === "published" ? <Link href={publicLandingPagePath(page)} target="_blank" className="inline-flex items-center gap-2 text-primary hover:underline">View published page<ExternalLink className="size-4" aria-hidden="true" /></Link> : "This page is not public while paused."}</p> : null}
      <section className="slip flex flex-col gap-3 p-5 sm:p-6"><h2 className="text-base font-bold">Review &amp; publish</h2><p className="text-sm leading-6 text-muted-foreground">Draft → review → approved → published. The author and latest editor cannot approve their own copy. A different owner, admin or leader publishes after approval.</p>{page.metadata?.ai_copy ? <p className="text-sm font-medium text-primary">Contains AI-generated copy. Check the offer and facts before approval.</p> : null}{isReviewerRole(role) && page.status !== "draft" ? <LandingPageStatus pageId={page.id} status={page.status} updatedAt={page.updated_at} /> : !isReviewerRole(role) ? <p className="text-sm text-muted-foreground">Ask a marketing manager, owner, admin or leader to edit or review this page.</p> : null}</section>
      {page.status === "draft" && isReviewerRole(role) ? <LandingPageForm key={page.updated_at} page={page} {...options} /> : <section className="slip space-y-6 p-5 sm:p-6"><h2 className="text-lg font-bold">Page preview</h2><LandingPageContent headline={page.headline} body={page.body} metadata={{ builder: page.metadata?.builder }} preview /><p className="text-sm font-medium">Form button: {page.cta_label}</p></section>}
      <section className="slip space-y-5 p-5 sm:p-6"><h2 className="text-lg font-bold">Campaign &amp; results</h2>
        {page.campaign_id ? <Link className="text-sm font-semibold text-primary hover:underline" href={`/audience/campaigns#${campaignAnchor(page.campaign_id)}`}>{options.campaigns.find(item => item.id === page.campaign_id)?.name ?? "View linked campaign"}</Link> : <p className="text-sm text-muted-foreground">No campaign linked yet. Choose one in the draft before review.</p>}
        <dl className="grid grid-cols-2 gap-5 border-y py-4"><div><dt className="text-sm text-muted-foreground">Recorded page visits</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{connections.views ?? "Unavailable"}</dd></div><div><dt className="text-sm text-muted-foreground">Leads from this page</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{connections.leads ?? "Unavailable"}</dd></div></dl>
        <p className="text-xs leading-5 text-muted-foreground">Visits use the first-party page beacon and may be blocked by visitor privacy settings. Page-specific tracking starts with this builder update.</p>
        <div className="flex flex-wrap gap-5 text-sm font-semibold text-primary"><Link href="/leads" className="hover:underline">View leads</Link><Link href="/reports" className="hover:underline">View analytics</Link><Link href="/email" className="hover:underline">Manage email follow-up</Link></div>
        <div><h3 className="text-sm font-semibold">Emails linked to this campaign</h3>{connections.emails === null ? <p className="mt-2 text-sm text-muted-foreground">Email campaigns could not be loaded. Try refreshing.</p> : connections.emails.length ? <ul className="mt-2 divide-y">{connections.emails.map(email => <li key={email.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><Link href={`/email/${email.id}`} className="text-primary hover:underline">{email.name}</Link><StatusStamp status={email.status} /></li>)}</ul> : <p className="mt-2 text-sm leading-6 text-muted-foreground">No email campaigns linked. Create an email draft for the same campaign to follow up with visitors who opt in.</p>}</div>
        <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Hosting and domain setup are managed by your workspace admin. Saving, approval and preview do not publish a public link or send email.</p>
      </section>
    </div>
  );
}
