import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listTrends } from "@/lib/content/trends";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay, todayDateline } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/audience/access";
import { TrendMonitorControls } from "@/components/content/trend-monitor-controls";
import { TrendWorkflowActions } from "@/components/content/trend-workflow-actions";
import { TrendCreateForm } from "@/components/content/trend-create-form";

export const metadata: Metadata = { title: "Trends" };

const STATUSES = ["all", "new", "approved", "dismissed"] as const;
const LABELS: Record<string, string> = {
  all: "All",
  new: "New",
  approved: "Approved",
  dismissed: "Dismissed",
};

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as string)
    : "all";

  const orgId = await getCallerOrganizationId();
  const trends = orgId
    ? await listTrends(orgId, status)
    : [];
  let monitoringEnabled = false;
  let lastSyncedAt: string | null = null;
  let canManageMonitoring = false;
  let segments: Array<{ id: string; name: string }> = [];
  if (orgId) {
    const supabase = await createClient();
    const [{ data: monitor }, role, { data: segmentRows }] = await Promise.all([
      supabase.from("trend_monitoring_settings").select("enabled,last_synced_at").eq("organization_id", orgId).maybeSingle<{ enabled: boolean; last_synced_at: string | null }>(),
      getUserRole(orgId).catch(() => null),
      supabase.from("audience_segments").select("id,name").eq("organization_id", orgId).order("name").limit(100),
    ]);
    monitoringEnabled = monitor?.enabled ?? false;
    lastSyncedAt = monitor?.last_synced_at ?? null;
    canManageMonitoring = Boolean(role && ["owner", "admin", "marketing_manager"].includes(role));
    segments = (segmentRows ?? []) as Array<{ id: string; name: string }>;
  }

  const tabHref = (s: string) =>
    s === "all" ? "/trends" : `/trends?status=${s}`;

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <div>
        <p className="dateline">
          {todayDateline()} · {trends.length} signals
        </p>
        <h1>
          Trends
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
          Review sourced industry developments, suggested angles, and risk
          notes before creating content.
        </p>
      </div>

      {canManageMonitoring ? <TrendMonitorControls enabled={monitoringEnabled} lastSyncedAt={lastSyncedAt} /> : null}
      <TrendCreateForm />

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

      {trends.length === 0 ? (
        <EmptyState
          title="No trends yet"
          description={
            status === "all"
              ? "Relevant industry developments land here for marketing to turn into blogs, posts, and campaigns."
              : "Nothing with this status right now."
          }
        />
      ) : (
        <section className="slip overflow-hidden" aria-label="Sourced trend signals"><div className="workspace-list-heading"><span>Signal, source and editorial angle</span><span>Source date</span></div><ul className="ledger divide-y divide-border/80">
          {trends.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-6 sm:flex-nowrap sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusStamp status={t.status} />
                  {t.source ? (
                    t.source_url ? (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="dateline -my-1 py-1 underline-offset-2 hover:underline"
                      >
                        {t.source}
                      </a>
                    ) : (
                      <span className="dateline">{t.source}</span>
                    )
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm font-semibold tracking-[-0.01em] leading-6 text-foreground">
                  {t.title}
                </p>
                {t.angle ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    Angle: {t.angle}
                  </p>
                ) : null}
                {t.relevance ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">RIL relevance: {t.relevance}</p> : null}
                {t.audience ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Audience: {t.audience}</p> : null}
                {t.summary ? <div className="mt-2"><p className="dateline">Publisher summary · verify before reuse</p><p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{t.summary}</p></div> : null}
                {t.risk ? (
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Risk note: {t.risk}
                  </p>
                ) : null}
                {t.analysis_status === "unanalysed" ? <p className="mt-1 text-[13px] leading-5 font-medium text-amber-700 dark:text-amber-400">AI analysis unavailable · verify claims before use</p> : null}
                <TrendWorkflowActions trendId={t.id} status={t.status} segments={segments} />
              </div>
              <div className="shrink-0 text-right"><p className="dateline tabular-nums">{formatDay(t.source_published_at ?? t.created_at)}</p>{t.source_published_at ? <p className="dateline mt-1">Published</p> : null}</div>
            </li>
          ))}
        </ul></section>
      )}
    </div>
  );
}
