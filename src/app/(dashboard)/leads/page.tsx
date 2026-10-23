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

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div>
        <p className="dateline">
          {todayDateline()} · {result.total} leads
        </p>
        <h1>
          Leads
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
          Track every lead through the funnel and see why each score was assigned.
        </p>
      </div>

      <nav aria-label="Filter by stage" className="flex flex-wrap">
        {STAGES.map((s) => (
          <Link
            key={s}
            href={stageHref(s)}
            aria-current={stage === s ? "page" : undefined}
            className="capitalize"
          >
            {s === "all" ? "All" : s}
          </Link>
        ))}
      </nav>

      {result.leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description={
            stage === "all"
              ? "Create a campaign landing page and share its public link. People who submit its form will appear here for follow-up."
              : "No leads in this stage right now."
          }
          action={stage === "all" ? { label: "Manage lead capture pages", href: "/audience/landing-pages" } : { label: "View all leads", href: "/leads" }}
        />
      ) : (
        <section className="slip overflow-hidden" aria-label="Lead records"><div className="workspace-list-heading"><span>Contact and funnel stage</span><span>Captured / score</span></div><ul className="ledger">
          {result.leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/leads/${l.id}`}
                className="flex items-start justify-between gap-4 rounded-lg px-5 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
              >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusStamp variant="scheduled">{l.funnel_stage}</StatusStamp>
                  {l.is_qualified ? <StatusStamp status="qualified" /> : null}
                  {l.is_converted ? <StatusStamp status="converted" /> : null}
                </div>
                <h2 className="mt-2 text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {l.name || l.email || "Unnamed lead"}
                </h2>
                <p className="mt-0.5 truncate text-[13px] leading-5 text-muted-foreground">
                  {[l.organisation, l.email, l.interest].filter(Boolean).join(" · ") ||
                    "No details recorded"}
                </p>
                {l.score_reason ? (
                  <p className="mt-0.5 truncate text-[13px] leading-5 text-muted-foreground">
                    Why: {l.score_reason}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <span className="dateline block tabular-nums">
                  {formatDay(l.created_at)}
                </span>
                {l.score ? (
                  <span className="mt-1.5 flex justify-end">
                    <StatusStamp status={l.score}>{scoreLabel(l.score)}</StatusStamp>
                  </span>
                ) : null}
              </div>
              </Link>
            </li>
          ))}
        </ul></section>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="inline-flex min-h-9 items-center rounded-md py-2 font-medium text-primary outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="dateline tabular-nums">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="inline-flex min-h-9 items-center rounded-md py-2 font-medium text-primary outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
              Next <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
