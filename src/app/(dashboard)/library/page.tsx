import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RecordFilters, RecordPagination } from "@/components/record-navigation";

import { Disclosure } from "@/components/ui/disclosure";

import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField, FieldSet as ShadcnFieldSet, FieldLegend as ShadcnFieldLegend } from "@/components/ui/field";
import { Input as ShadcnInput } from "@/components/ui/input";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Card as ShadcnCard } from "@/components/ui/card";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { ContentChannels } from "@/components/channel-identity";
import { ChannelSelect } from "@/components/channel-select";
import { channelLabel } from "@/lib/channels";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
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
    <WorkspacePageHeader title="Content Library" description="Drafts, reviews, and published content." actions={<><Button asChild variant="outline"><Link href="/library/import">Import content</Link></Button><Button asChild><Link href="/library/new"><Plus data-icon="inline-start" aria-hidden="true" />Add content</Link></Button></>} />
    <div className="record-directory">
      <ShadcnCard asChild><section className="library-toolbar" aria-label="Find content">
        <ShadcnFieldGroup asChild><form method="get" action="/library">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <div className="library-search-primary"><ShadcnField asChild><ShadcnFieldLabel><span>Search content</span><ShadcnInput name="q" defaultValue={q} maxLength={200} placeholder="Search titles or draft text" className="" /></ShadcnFieldLabel></ShadcnField><Button type="submit">Apply filters</Button>{hasFilters ? <Button asChild variant="ghost"><Link href="/library">Clear filters</Link></Button> : null}</div>
          <Disclosure className="library-advanced-filters" initiallyOpen={channel !== "all" || activity !== "all" || campaign !== "all"} title={<>Channel, activity &amp; campaign</>}><ShadcnFieldSet><ShadcnFieldLegend className="sr-only">Additional content filters</ShadcnFieldLegend>
            <ShadcnField asChild><ShadcnFieldLabel><span>Channel</span><ChannelSelect key={channel} name="channel" defaultValue={channel} options={[["all", "All channels"], ...channelOptions.map(value => [value, channelLabel(value)] as const)]} /></ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel><span>Source activity</span><ShadcnNativeSelect name="activity" defaultValue={activity} className=""><ShadcnNativeSelectOption value="all">All activities</ShadcnNativeSelectOption>{activityOptions.map(item => <ShadcnNativeSelectOption key={item.id} value={item.id}>{item.title}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel><span>Campaign</span><ShadcnNativeSelect name="campaign" defaultValue={campaign} className=""><ShadcnNativeSelectOption value="all">All campaigns</ShadcnNativeSelectOption>{campaignOptions.map(item => <ShadcnNativeSelectOption key={item.id} value={item.id}>{item.name}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
          </ShadcnFieldSet></Disclosure>
        </form></ShadcnFieldGroup>
        <RecordFilters label="Content status" value={status} items={filters.map(value => ({value, label: value === "all" ? "All content" : value === "ai_generated" ? "AI generated" : value.replaceAll("_", " "), href: filterHref(value)}))} />
      </section></ShadcnCard>
      <section className="directory-results" aria-label="Content results">
        <div className="directory-result-heading"><p><strong>{result.total.toLocaleString()}</strong> {result.total === 1 ? "content item" : "content items"}{hasFilters ? " match your filters" : " in your library"}</p><span>Most recent first</span></div>
        {!result.assets.length ? <EmptyState title={hasFilters ? "No content matches these filters" : "Your next draft starts here"} description={hasFilters ? "Try a different search or clear your filters to see all content." : "Write a draft, import existing material, or repurpose an activity for your audience."} action={hasFilters ? { label: "Clear filters", href: "/library" } : { label: "Add content", href: "/library/new" }} /> : <ShadcnCard className="record-table-panel"><Table className="record-table library-table" aria-label="Content library"><TableHeader><TableRow><TableHead scope="col">Content</TableHead><TableHead scope="col">Workflow</TableHead><TableHead scope="col">Date / action</TableHead></TableRow></TableHeader><TableBody>{result.assets.map(asset => <TableRow key={asset.id}><TableCell data-label="Content"><div className="directory-record-main"><Link href={`/library/${asset.id}`}><h2>{asset.title}</h2></Link><div className="library-record-details"><ContentChannels channel={asset.channel} platform={asset.platform} format={asset.format} /></div></div></TableCell><TableCell data-label="Workflow"><div className="directory-record-workflow"><StatusStamp status={asset.status} /><ReminderFlag state={reminderState(asset, now)} />{asset.metadata?.calendar_generator === true ? <span className="text-xs text-muted-foreground">Calendar proposal</span> : null}{asset.sensitivity === "high" ? <span className="text-xs font-semibold text-destructive">High sensitivity</span> : null}</div></TableCell><TableCell data-label="Date / action"><div className="directory-record-meta"><span>{asset.metadata?.calendar_generator === true && typeof asset.metadata.suggested_publish_at === "string" ? `Suggested ${formatDay(asset.metadata.suggested_publish_at)}` : formatDay(asset.scheduled_for ?? asset.published_at ?? asset.created_at)}</span><Link href={`/repurpose?asset=${asset.id}`} aria-label={`Repurpose ${asset.title}`} className="directory-record-secondary">Repurpose</Link></div></TableCell></TableRow>)}</TableBody></Table></ShadcnCard>}
        <RecordPagination page={page} totalPages={totalPages} previousHref={page > 1 ? pageHref(page - 1) : undefined} nextHref={page < totalPages ? pageHref(page + 1) : undefined} />
      </section>
    </div>
  </div>;
}
