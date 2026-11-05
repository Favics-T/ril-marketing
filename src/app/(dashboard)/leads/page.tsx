import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RecordFilters, RecordPagination } from "@/components/record-navigation";

import { Card as ShadcnCard } from "@/components/ui/card";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { DirectoryFilters } from "@/components/directory-filters";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <WorkspacePageHeader title="Leads" eyebrow={todayDateline()} description="Understand the interest. Keep the next conversation moving." actions={<Link href="/audience/landing-pages" className="ril-inline-action">Manage lead capture<ArrowRight aria-hidden="true" /></Link>} />
    <div className="record-directory">
      <DirectoryFilters title="Filter leads" active={stage !== "all"}><RecordFilters label="Lead funnel stage" value={stage} items={STAGES.map(value => ({value, label: value === "all" ? "All leads" : value, href: stageHref(value)}))} /><p className="text-sm leading-6 text-muted-foreground">Scores explain the signals behind a lead. Marketing consent remains a separate choice.</p></DirectoryFilters>
      <section className="directory-results" aria-label="Lead records"><div className="directory-result-heading"><p><strong>{result.total.toLocaleString()}</strong> {result.total === 1 ? "lead" : "leads"}{stage === "all" ? " across your workspace" : ` in ${stage}`}</p><span>Most recent first</span></div>
        {!result.leads.length ? <EmptyState title={stage === "all" ? "Make your first connection" : "No leads in this stage"} description={stage === "all" ? "Create a campaign page and share its public link. People who register their interest will appear here." : "Choose another stage or view all leads to continue."} action={stage === "all" ? { label: "Manage capture pages", href: "/audience/landing-pages" } : { label: "View all leads", href: "/leads" }} /> : <ShadcnCard className="record-table-panel"><Table className="record-table lead-table" aria-label="Lead records"><TableHeader><TableRow><TableHead scope="col">Contact</TableHead><TableHead scope="col">Funnel stage</TableHead><TableHead scope="col">Captured / score</TableHead></TableRow></TableHeader><TableBody>{result.leads.map(lead => <TableRow key={lead.id}><TableCell data-label="Contact"><div className="directory-record-main"><Link href={`/leads/${lead.id}`}><h2>{lead.name || lead.email || "Unnamed lead"}</h2></Link><p className="line-clamp-2">{[lead.organisation, lead.email, lead.interest].filter(Boolean).join(" · ") || "No details recorded"}</p>{lead.score_reason ? <p className="line-clamp-2">Why: {lead.score_reason}</p> : null}</div></TableCell><TableCell data-label="Funnel stage"><div className="directory-record-workflow"><StatusStamp variant="scheduled">{lead.funnel_stage}</StatusStamp>{lead.is_qualified ? <StatusStamp status="qualified" /> : null}{lead.is_converted ? <StatusStamp status="converted" /> : null}</div></TableCell><TableCell data-label="Captured / score"><div className="directory-record-meta"><span>{formatDay(lead.created_at)}</span>{lead.score ? <StatusStamp status={lead.score}>{scoreLabel(lead.score)}</StatusStamp> : null}<Button asChild variant="ghost" size="sm"><Link href={`/leads/${lead.id}`} className="directory-record-secondary">Open lead<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button></div></TableCell></TableRow>)}</TableBody></Table></ShadcnCard>}
        <RecordPagination page={page} totalPages={totalPages} previousHref={page > 1 ? pageHref(page - 1) : undefined} nextHref={page < totalPages ? pageHref(page + 1) : undefined} />
      </section>
    </div>
  </div>;
}