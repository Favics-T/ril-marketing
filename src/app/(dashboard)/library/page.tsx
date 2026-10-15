import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listAssets } from "@/lib/content/assets";
import { ASSET_STATUSES } from "@/lib/content/transitions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay, todayDateline } from "@/lib/format";
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

  return (
    <div className="workspace-page flex flex-col gap-4 md:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div>
        <p className="dateline">
          {todayDateline()} · {result.total} assets
        </p>
        <h1>
          Content Library
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
          Manage drafts, review content, and keep track of everything you publish.
        </p>
      </div><Button asChild><Link href="/library/new"><Plus data-icon="inline-start" aria-hidden="true" />Add content</Link></Button></header>

      <form method="get" action="/library" className="slip grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label className="flex flex-col gap-1.5 lg:col-span-2"><span className="dateline">Search copy</span><input name="q" defaultValue={q} maxLength={200} placeholder="Title or draft text" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" /></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Channel</span><select name="channel" defaultValue={channel} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">All channels</option>{channelOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Source activity</span><select name="activity" defaultValue={activity} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">All activities</option>{activityOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Campaign</span><select name="campaign" defaultValue={campaign} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">All campaigns</option>{campaignOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-5"><Button variant="ghost" asChild><Link href="/library">Clear filters</Link></Button><Button type="submit" className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">Apply filters</Button></div>
      </form>

      <nav aria-label="Filter by status" className="flex flex-wrap">
        {filters.map((f) => (
          <Link
            key={f}
            href={filterHref(f)}
            aria-current={status === f ? "page" : undefined}
            className="capitalize"
          >
            {f === "all" ? "All" : f === "ai_generated" ? "AI generated" : f.replace(/_/g, " ")}
          </Link>
        ))}
      </nav>

      {result.assets.length === 0 ? (
        <EmptyState
          title="No content yet"
          description={
            status === "all"
              ? "Assets appear once you generate content from an activity or create one manually."
              : "No assets match this filter. Try another stage."
          }
        />
      ) : (
        <section className="slip overflow-hidden" aria-label="Content assets">
        <div className="workspace-list-heading"><span>Content and channel</span><span>Last activity</span></div>
        <ul className="ledger">
          {result.assets.map((a) => (
            <li key={a.id}>
              <Link
                href={`/library/${a.id}`}
                className="content-library-row flex items-start justify-between gap-4 px-5 py-4 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
              >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusStamp status={a.status} />
                  <ReminderFlag state={reminderState(a, now)} />
                  {a.metadata?.calendar_generator === true ? (
                    <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Calendar proposal
                    </span>
                  ) : null}
                  {a.sensitivity === "high" ? (
                    <span className="rounded-md border border-destructive bg-destructive/5 px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-destructive">
                      High sensitivity
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {a.title}
                </h2>
                <p className="mt-0.5 truncate text-[13px] leading-5 text-muted-foreground">
                  {[a.channel, a.platform, a.format].filter(Boolean).join(" · ") ||
                    "No channel set"}
                </p>
              </div>
              <span className="dateline shrink-0 tabular-nums">
                {a.metadata?.calendar_generator === true && typeof a.metadata.suggested_publish_at === "string"
                  ? `Suggested ${formatDay(a.metadata.suggested_publish_at)}`
                  : formatDay(a.scheduled_for ?? a.published_at ?? a.created_at)}
              </span>
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
