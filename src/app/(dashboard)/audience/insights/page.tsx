import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listInsights } from "@/lib/audience/insights";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { InsightActions } from "@/components/audience/insight-actions";
import { todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Audience Insights" };

const STATUSES = ["all", "PENDING_REVIEW", "APPROVED", "SUPPRESSED"] as const;
const LABELS: Record<string, string> = {
  all: "All",
  PENDING_REVIEW: "Pending",
  APPROVED: "Approved",
  SUPPRESSED: "Suppressed",
};

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as string)
    : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const orgId = await getCallerOrganizationId();
  const result = orgId
    ? await listInsights(orgId, { status, page })
    : { insights: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };

  const tabHref = (s: string) =>
    s === "all" ? "/audience/insights" : `/audience/insights?status=${s}`;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/audience/insights${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="workspace-page insight-directory">
      <div>
        <p className="dateline">
          {todayDateline()} · {result.total} findings
        </p>
        <h1>
          Audience Insights
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
          Review AI findings before they enter recommendations, drafts, or
          reports. Suppressed insights stay out.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            aria-current={status === s ? "page" : undefined}
          >
            {LABELS[s]}
          </Link>
        ))}
      </nav>

      {result.insights.length === 0 ? (
        <EmptyState
          title="No insights yet"
          description={
            status === "all"
              ? "Insights appear after the audience-analysis pass runs over your engagement, registration, and conversion data."
              : "Nothing with this status right now."
          }
        />
      ) : (
        <ul className="ledger slip overflow-hidden">
          {result.insights.map((ins) => (
            <li key={ins.id} className="flex flex-col gap-4 px-5 py-6 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusStamp status={ins.status} />
                <span className="dateline">
                  {ins.category.replace(/_/g, " ")}
                </span>
                <span className="dateline ml-auto tabular-nums">
                  Confidence {Math.round(ins.confidence_score * 100)}% · n=
                  {ins.sample_size}
                </span>
              </div>
              <div>
                <Link
                  href={`/audience/insights/${ins.id}`}
                  className="-my-1.5 inline-block py-1.5 text-balance text-sm font-semibold leading-6 tracking-[-0.01em] text-foreground transition-colors hover:text-primary hover:underline hover:underline-offset-2"
                >
                  {ins.summary}
                </Link>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {ins.recommendation}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] leading-5 text-muted-foreground">
                  Segment: {ins.segment?.name ?? "—"} · Signal:{" "}
                  {ins.signal_strength.toLowerCase()}
                  {ins.status === "SUPPRESSED" && ins.suppression_reason
                    ? ` · Reason: ${ins.suppression_reason}`
                    : ""}
                </span>
                {ins.status === "PENDING_REVIEW" ? (
                  <InsightActions insightId={ins.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="inline-flex min-h-9 items-center rounded-md py-2 font-medium text-primary outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="dateline tabular-nums">
            Page {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={pageHref(result.page + 1)} className="inline-flex min-h-9 items-center rounded-md py-2 font-medium text-primary outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
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
