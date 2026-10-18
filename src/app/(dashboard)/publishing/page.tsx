import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { listSocialQueue, SOCIAL_QUEUE_STAGES } from "@/lib/content/social-queue";
import { SOCIAL_PLATFORMS, parseLivePostUrl } from "@/lib/content/manual-posting";
import { getBufferStatus } from "@/lib/integrations/buffer";
import { formatDayTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Social publishing" };
const stageLabels = { all: "All posts", review: "In review", approved: "Approved", scheduled: "Scheduled", published: "Published" };

export default async function PublishingPage({ searchParams }: { searchParams: Promise<{ stage?: string; platform?: string; page?: string }> }) {
  const org = await requireOrganizationId();
  const [result, buffer] = await Promise.all([listSocialQueue(org, await searchParams), getBufferStatus(org)]);
  const href = (stage = result.stage, page = 1) => {
    const query = new URLSearchParams({ stage, platform: result.platform, page: String(page) });
    return `/publishing?${query}`;
  };
  return <div className="workspace-page flex flex-col gap-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1>Social publishing</h1><p className="mt-2 max-w-[64ch] text-sm leading-6 text-muted-foreground">Review your posts, send approved copy through Buffer, or post manually and record the live link.</p></div>
      <Button asChild><Link href="/library/new"><Plus data-icon="inline-start" aria-hidden="true" />Create content</Link></Button>
    </header>
    <section aria-label="Publishing connection" className="slip flex flex-wrap items-center justify-between gap-4 p-5">
      <div><h2 className="text-sm font-semibold">{buffer.connected ? "Buffer connection saved" : "Start with manual posting"}</h2><p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">{buffer.connected ? `${buffer.channels.length} saved channels. Availability and approval are checked again before sending. Text publishing is supported; photos and videos use manual posting.` : "No connection is needed to copy approved text and record a published post. Connect Buffer for supported text posts and scheduled delivery."}</p></div>
      <Button asChild variant="outline"><Link href="/settings/ai#connection-buffer">{buffer.connected ? "Manage Buffer" : "Connect Buffer"}<ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Publishing stage" className="flex flex-wrap gap-1">{SOCIAL_QUEUE_STAGES.map(stage => <Button key={stage} asChild variant={result.stage === stage ? "secondary" : "ghost"} size="sm"><Link href={href(stage)} aria-current={result.stage === stage ? "page" : undefined}>{stageLabels[stage]}</Link></Button>)}</nav>
      <form method="get" action="/publishing" className="flex flex-wrap items-center gap-2"><input type="hidden" name="stage" value={result.stage} /><label htmlFor="social-platform" className="text-sm">Platform</label><select id="social-platform" name="platform" defaultValue={result.platform} className="h-10 rounded-md border border-input bg-card px-3 text-sm"><option value="all">All platforms</option>{SOCIAL_PLATFORMS.filter(value => value !== "twitter").map(value => <option key={value} value={value}>{value === "x" ? "X" : value === "linkedin" ? "LinkedIn" : value.replace(/^./, c => c.toUpperCase())}</option>)}</select><Button type="submit" variant="outline">Filter</Button></form>
    </div>
    <p className="text-sm text-muted-foreground">{result.total} matching {result.total === 1 ? "post" : "posts"}. Open a post to check its recorded approval and choose how to publish.</p>
    {result.assets.length ? <ul className="slip divide-y divide-border">{result.assets.map(asset => {
      const request = asset.metadata?.publishing as { state?: string; provider?: string } | undefined;
      const manual = asset.metadata?.manual_post as { url?: string } | undefined;
      const liveUrl = parseLivePostUrl(typeof manual?.url === "string" ? manual.url : typeof asset.metadata?.published_url === "string" ? asset.metadata.published_url : "");
      return <li key={asset.id} className="flex min-w-0 flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><StatusStamp status={asset.status} /><span className="text-xs text-muted-foreground">{asset.platform || asset.channel} · {asset.format || "Social post"}</span>{request?.state === "failed" ? <span className="text-xs font-medium text-destructive">Delivery failed; review before retrying</span> : null}</div>
        <Link href={`/library/${asset.id}`} className="group block min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="break-words text-base font-semibold group-hover:text-primary">{asset.title}</h2><p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{asset.body || "No post copy yet."}</p></Link>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{asset.status === "scheduled" ? `${request?.provider && request.state !== "failed" ? "Provider delivery" : "Manual posting reminder"} · ${formatDayTime(asset.scheduled_for)}` : asset.published_at ? `Published ${formatDayTime(asset.published_at)}` : `Updated ${formatDayTime(asset.updated_at)}`}</span><div className="flex flex-wrap items-center gap-4">{liveUrl ? <a href={liveUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">View live post</a> : null}<Link href={`/library/${asset.id}`} className="font-semibold text-primary underline underline-offset-4">{asset.status === "review" ? "Review post" : asset.status === "approved" ? "Prepare to publish" : asset.status === "scheduled" ? "Manage delivery" : "View post"}</Link></div></div>
      </li>;
    })}</ul> : <EmptyState title="No posts in this view" description="Social content appears here once it reaches Review. Create a draft or choose another publishing stage." />}
    {result.total > 20 ? <nav aria-label="Social post pages" className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">Page {result.page} of {Math.ceil(result.total / 20)}</span><div className="flex gap-2">{result.page > 1 ? <Button asChild variant="outline"><Link href={href(result.stage, result.page - 1)}>Previous</Link></Button> : null}{result.page * 20 < result.total ? <Button asChild variant="outline"><Link href={href(result.stage, result.page + 1)}>Next</Link></Button> : null}</div></nav> : null}
  </div>;
}
