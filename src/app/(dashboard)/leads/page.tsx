import { DirectoryFilters } from "@/components/directory-filters";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listLeads } from "@/lib/leads/leads";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { scoreLabel } from "@/lib/leads/scoring";
import { formatDay, todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };

const STAGES = [
  "all",
  "awareness",
  "engagement",
  "captured",
  "nurturing",
  "converted",
  "retention",
] as const;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const stage = (STAGES as readonly string[]).includes(sp.stage ?? "")
    ? (sp.stage as string)
    : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const orgId = await getCallerOrganizationId();
  const result = orgId
    ? await listLeads(orgId, { stage, page })
    : { leads: [], total: 0 };

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

  const stageHref = (s: string) =>
    s === "all" ? "/leads" : `/leads?stage=${encodeURIComponent(s)}`;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (stage !== "all") params.set("stage", stage);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  };

  return <div className="workspace-page lead-directory">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1>Leads</h1><p className="mt-3 text-muted-foreground">Know who is interested, understand the signal, and follow up with purpose.</p><p className="dateline">{todayDateline()}</p></div><Link href="/audience/landing-pages" className="ril-inline-action">Manage lead capture<ArrowRight aria-hidden="true" /></Link></header>
    <div className="record-directory">
      <DirectoryFilters title="Filter leads" active={stage !== "all"}><nav className="directory-filter-nav" aria-label="Lead funnel stage"><p>Funnel stage</p>{STAGES.map(value => <Link key={value} href={stageHref(value)} aria-current={stage === value ? "page" : undefined}>{value === "all" ? "All leads" : value}</Link>)}</nav><p className="text-sm leading-6 text-muted-foreground">Scores explain the signals behind a lead. Marketing consent remains a separate choice.</p></DirectoryFilters>
      <section className="directory-results" aria-label="Lead records"><div className="directory-result-heading"><p><strong>{result.total.toLocaleString()}</strong> {result.total === 1 ? "lead" : "leads"}{stage === "all" ? " across your workspace" : ` in ${stage}`}</p><span>Most recent first</span></div>
        {!result.leads.length ? <EmptyState title={stage === "all" ? "Make your first connection" : "No leads in this stage"} description={stage === "all" ? "Create a campaign page and share its public link. People who register their interest will appear here." : "Choose another stage or view all leads to continue."} action={stage === "all" ? { label: "Manage capture pages", href: "/audience/landing-pages" } : { label: "View all leads", href: "/leads" }} /> : <div className="directory-records"><div className="workspace-list-heading"><span>Contact and context</span><span>Captured and score</span></div><ul>{result.leads.map(lead => <li key={lead.id}><Link href={`/leads/${lead.id}`} className="directory-record-row">
          <div className="directory-record-main"><h2>{lead.name || lead.email || "Unnamed lead"}</h2><p className="line-clamp-2">{[lead.organisation, lead.email, lead.interest].filter(Boolean).join(" · ") || "No details recorded"}</p>{lead.score_reason ? <p className="line-clamp-2">Why: {lead.score_reason}</p> : null}<div className="directory-record-state"><StatusStamp variant="scheduled">{lead.funnel_stage}</StatusStamp>{lead.is_qualified ? <StatusStamp status="qualified" /> : null}{lead.is_converted ? <StatusStamp status="converted" /> : null}</div></div>
          <div className="directory-record-meta"><span>{formatDay(lead.created_at)}</span>{lead.score ? <StatusStamp status={lead.score}>{scoreLabel(lead.score)}</StatusStamp> : null}<span className="directory-record-secondary">Open lead<ArrowRight aria-hidden="true" className="ml-2 size-4" /></span></div>
        </Link></li>)}</ul></div>}
        {totalPages > 1 ? <nav aria-label="Pagination" className="directory-pagination">{page > 1 ? <Link href={pageHref(page - 1)}><ArrowLeft aria-hidden="true" />Previous</Link> : <span />}<span>Page {page} of {totalPages}</span>{page < totalPages ? <Link href={pageHref(page + 1)}>Next<ArrowRight aria-hidden="true" /></Link> : <span />}</nav> : null}
      </section>
    </div>
  </div>;
}