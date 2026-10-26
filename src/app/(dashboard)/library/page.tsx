import { DirectoryFilters } from "@/components/directory-filters";
import { ContentChannels } from "@/components/channel-identity";
import { ChannelSelect } from "@/components/channel-select";
import { channelLabel } from "@/lib/channels";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listAssets } from "@/lib/content/assets";
import { ASSET_STATUSES } from "@/lib/content/transitions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { reminderState } from "@/lib/content/reminders";
import { ReminderFlag } from "@/components/content/reminder-flag";

export const metadata: Metadata = { title: "Content Library" };

const VALID_STATUSES = new Set<string>(["all", ...ASSET_STATUSES]);

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string; channel?: string; activity?: string; campaign?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status && VALID_STATUSES.has(sp.status) ? sp.status : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() ?? "";
  const channel = sp.channel ?? "all";
  const activity = sp.activity ?? "all";
  const campaign = sp.campaign ?? "all";
  const hasFilters = status !== "all" || Boolean(q) || channel !== "all" || activity !== "all" || campaign !== "all";

  const orgId = await getCallerOrganizationId();
  const supabase = orgId ? await createClient() : null;
  const [activityResult, campaignResult, channelResult] = supabase
    ? await Promise.all([
        supabase.from("activities").select("id,title").eq("organization_id", orgId).order("event_date", { ascending: false }).limit(200),
        supabase.from("campaigns").select("id,name").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200),
        supabase.from("content_assets").select("channel").eq("organization_id", orgId).not("channel", "is", null).limit(500),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const activityOptions = (activityResult.data ?? []) as Array<{ id: string; title: string }>;
  const campaignOptions = (campaignResult.data ?? []) as Array<{ id: string; name: string }>;
  const channelOptions = [...new Set((channelResult.data ?? []).map((row) => row.channel).filter((v): v is string => Boolean(v)))].sort();
  const result = orgId
    ? await listAssets(orgId, { status, page, q, channel, activityId: activity, campaignId: campaign })
    : { assets: [], total: 0 };

  const now = new Date();
  const totalPages = Math.max(1, Math.ceil(result.total / 20));
  const filters = ["all", ...ASSET_STATUSES] as const;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    if (channel !== "all") params.set("channel", channel);
    if (activity !== "all") params.set("activity", activity);
    if (campaign !== "all") params.set("campaign", campaign);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/library${qs ? `?${qs}` : ""}`;
  };
  const filterHref = (nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (q) params.set("q", q);
    if (channel !== "all") params.set("channel", channel);
    if (activity !== "all") params.set("activity", activity);
    if (campaign !== "all") params.set("campaign", campaign);
    const qs = params.toString();
    return `/library${qs ? `?${qs}` : ""}`;
  };

  return <div className="workspace-page library-directory">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1>Content Library</h1><p className="mt-1 text-muted-foreground">Drafts, reviews, and published content.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/library/import">Import content</Link></Button><Button asChild><Link href="/library/new"><Plus data-icon="inline-start" aria-hidden="true" />Add content</Link></Button></div></header>
    <div className="record-directory">
      <DirectoryFilters active={hasFilters}>
        <form method="get" action="/library">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <label><span>Search content</span><input name="q" defaultValue={q} maxLength={200} placeholder="Title or draft text" className="border px-3 py-2" /></label>
          <details open={channel !== "all" || activity !== "all" || campaign !== "all"}><summary>More filters</summary><div>
            <label><span>Channel</span><ChannelSelect key={channel} name="channel" defaultValue={channel} options={[["all", "All channels"], ...channelOptions.map(value => [value, channelLabel(value)] as const)]} /></label>
            <label><span>Source activity</span><select name="activity" defaultValue={activity} className="border px-3 py-2"><option value="all">All activities</option>{activityOptions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label><span>Campaign</span><select name="campaign" defaultValue={campaign} className="border px-3 py-2"><option value="all">All campaigns</option>{campaignOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div></details>
          <div><Button type="submit">Apply filters</Button>{hasFilters ? <Button asChild variant="ghost"><Link href="/library">Clear</Link></Button> : null}</div>
        </form>
        <nav className="directory-filter-nav" aria-label="Content status"><p>Workflow status</p>{filters.map(value => <Link key={value} href={filterHref(value)} aria-current={status === value ? "page" : undefined}>{value === "all" ? "All content" : value === "ai_generated" ? "AI generated" : value.replaceAll("_", " ")}</Link>)}</nav>
      </DirectoryFilters>
      <section className="directory-results" aria-label="Content results">
        <div className="directory-result-heading"><p><strong>{result.total.toLocaleString()}</strong> {result.total === 1 ? "content item" : "content items"}{hasFilters ? " match your filters" : " in your library"}</p><span>Most recent first</span></div>
        {!result.assets.length ? <EmptyState title={hasFilters ? "No content matches these filters" : "Your next draft starts here"} description={hasFilters ? "Try a different search or clear your filters to see all content." : "Write a draft, import existing material, or repurpose an activity for your audience."} action={hasFilters ? { label: "Clear filters", href: "/library" } : { label: "Add content", href: "/library/new" }} /> : <div className="directory-records"><div className="workspace-list-heading"><span>Content and channel</span><span>Next action</span></div><ul>{result.assets.map(asset => <li key={asset.id} className="directory-record-row">
          <div className="directory-record-main"><Link href={`/library/${asset.id}`}><h2>{asset.title}</h2></Link><div className="library-record-details"><ContentChannels channel={asset.channel} platform={asset.platform} format={asset.format} /><div className="directory-record-state"><StatusStamp status={asset.status} /><ReminderFlag state={reminderState(asset, now)} />{asset.metadata?.calendar_generator === true ? <span className="text-xs text-muted-foreground">Calendar proposal</span> : null}{asset.sensitivity === "high" ? <span className="text-xs font-semibold text-destructive">High sensitivity</span> : null}</div></div></div>
          <div className="directory-record-meta"><span>{asset.metadata?.calendar_generator === true && typeof asset.metadata.suggested_publish_at === "string" ? `Suggested ${formatDay(asset.metadata.suggested_publish_at)}` : formatDay(asset.scheduled_for ?? asset.published_at ?? asset.created_at)}</span><Link href={`/repurpose?asset=${asset.id}`} aria-label={`Repurpose ${asset.title}`} className="directory-record-secondary">Repurpose</Link></div>
        </li>)}</ul></div>}
        {totalPages > 1 ? <nav className="directory-pagination" aria-label="Pagination">{page > 1 ? <Link href={pageHref(page - 1)}><ArrowLeft aria-hidden="true" />Previous</Link> : <span />}<span>Page {page} of {totalPages}</span>{page < totalPages ? <Link href={pageHref(page + 1)}>Next<ArrowRight aria-hidden="true" /></Link> : <span />}</nav> : null}
      </section>
    </div>
  </div>;
}
