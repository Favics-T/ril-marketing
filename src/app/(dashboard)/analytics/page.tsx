import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { analyticsPeriod } from "@/lib/analytics/marketing";
import { loadMarketingAnalytics } from "@/lib/analytics/load-marketing";
import { MarketingAnalyticsWorkspace } from "@/components/analytics/marketing-analytics";
import { KpiProgressChart } from "@/components/dashboard-charts";
import "./analytics.css";

export const metadata: Metadata = { title: "Marketing Analytics" };

export default async function AnalyticsPage({ searchParams }: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; view?: string }>;
}) {
  const organizationId = await getCallerOrganizationId();
  if (!organizationId) return <div className="workspace-page"><h1>Marketing Analytics</h1><p>Choose a workspace to see its results.</p><Link href="/onboarding" className="text-primary underline">Set up your workspace</Link></div>;
  const search = await searchParams;
  const period = analyticsPeriod(search);
  const result = await loadMarketingAnalytics(organizationId, period);
  const view = search.view === "content" || search.view === "audience" ? search.view : "overview";
  return <MarketingAnalyticsWorkspace data={result.analytics} initialView={view}
    referencesUnavailable={result.referencesUnavailable}
    goals={result.goalsUnavailable ? <section className="analytics-panel"><div className="analytics-section-heading"><h2>Workspace goals</h2><p>Goals could not be loaded. Refresh to retry.</p></div></section> : <KpiProgressChart kpis={result.goals} periodLabel="Year-to-date lead metrics · independent of the date filter" />} />;
}
