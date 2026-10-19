import { ChannelIdentity } from "@/components/channel-identity";
import type { Metadata } from "next";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listCampaignRollups } from "@/lib/audience/campaigns";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay, todayDateline } from "@/lib/format";
import { listSegments } from "@/lib/audience/segments";
import { CampaignCreate } from "@/components/audience/campaign-create";
import { CampaignStatus } from "@/components/audience/campaign-status";
import { CampaignEditor } from "@/components/audience/campaign-editor";
import Link from "next/link";
import { campaignAnchor } from "@/lib/content/activity-display";

export const metadata: Metadata = { title: "Campaigns" };

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function CampaignsPage() {
  const orgId = await getCallerOrganizationId();
  const campaigns = orgId
    ? await listCampaignRollups(orgId)
    : [];
  const segments = orgId
    ? await listSegments(orgId)
    : [];

  return (
    <div className="workspace-page workflow-page campaign-workspace">
      <div>
        <p className="dateline">
          {todayDateline()} · {campaigns.length} campaigns
        </p>
        <h1>
          Campaigns
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
          Track each initiative’s audience reach, registrations, and lead quality
          against its objective.
        </p>
      </div>

      <CampaignCreate segments={segments.map(({ id, name }) => ({ id, name }))} />

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Campaigns group content, leads, and performance around one objective. They appear here once created."
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {campaigns.map((c) => (
            <li key={c.id} id={campaignAnchor(c.id)} className="slip flex scroll-mt-6 flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusStamp status={c.status} />
                {c.segment_name ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {c.segment_name}
                  </span>
                ) : null}
                <span className="dateline ml-auto tabular-nums">
                  {formatDay(c.starts_on)} → {formatDay(c.ends_on)}
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground">{c.name}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{c.objective || "No objective recorded yet."}</p>
              <dl className="grid gap-x-5 gap-y-2 border-t border-border/80 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="dateline">Target audience</dt><dd className="mt-0.5 text-sm text-foreground">{c.target_audience || c.segment_name || "Not defined"}</dd></div>
                <div><dt className="dateline">Funnel stage</dt><dd className="mt-0.5 text-sm capitalize text-foreground">{c.funnel_stage.replaceAll("_", " ")}</dd></div>
                <div><dt className="dateline">Channels</dt><dd className="mt-0.5 text-sm text-foreground">{c.channels.length ? c.channels.map(channel => <ChannelIdentity key={channel} channel={channel} className="mr-2" />) : "Not selected"}</dd></div>
                <div><dt className="dateline">Planned budget</dt><dd className="mt-0.5 text-sm tabular-nums text-foreground">{c.budget === null ? "Not set" : `${c.budget_currency} ${Number(c.budget).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`}</dd></div>
              </dl>
              <CampaignStatus campaignId={c.id} status={c.status} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold"><Link href={`/library?campaign=${encodeURIComponent(c.id)}`} className="-mx-1 inline-block px-1 py-1.5 text-primary underline-offset-2 hover:underline">Campaign content</Link><Link href={`/email?campaign=${encodeURIComponent(c.id)}`} className="-mx-1 inline-block px-1 py-1.5 text-primary underline-offset-2 hover:underline">Campaign email</Link><Link href={`/audience/landing-pages?campaign=${encodeURIComponent(c.id)}`} className="-mx-1 inline-block px-1 py-1.5 text-primary underline-offset-2 hover:underline">Campaign landing pages</Link></div>
              <dl className="campaign-results grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Assets", value: String(c.assets) },
                  { label: "Views", value: c.views.toLocaleString() },
                  { label: "Registrations", value: c.registrations.toLocaleString() },
                  { label: "Leads", value: String(c.leads) },
                  { label: "Qualified", value: `${c.qualified_leads} (${pct(c.qualified_rate)})` },
                  { label: "Conversion", value: pct(c.conversion_rate) },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="dateline">{stat.label}</dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {c.status !== "completed" ? <CampaignEditor campaign={c} segments={segments.map(({id,name})=>({id,name}))} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
