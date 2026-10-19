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
import { createClient } from "@/lib/supabase/server";
import { acknowledgePublishingAlert, pauseRecurringContent } from "@/actions/social-operations";
import { PublishingCheck } from "@/components/content/publishing-check";
import { getUserRole, isReviewerRole } from "@/lib/audience/access";

export const metadata: Metadata = { title: "Social publishing" };
const stageLabels = { all: "All posts", drafts: "Drafts", review: "In review", approved: "Approved", scheduled: "Scheduled", published: "Published" };

export default async function PublishingPage({ searchParams }: { searchParams: Promise<{ stage?: string; platform?: string; page?: string }> }) {
  const org = await requireOrganizationId();
  const [result, buffer] = await Promise.all([listSocialQueue(org, await searchParams), getBufferStatus(org)]);
  const client=await createClient();
  const canPublish=isReviewerRole(await getUserRole(org));
  const [alerts,rules]=await Promise.all([
    client.from("publishing_alerts").select("id,content_asset_id,message,kind").eq("organization_id",org).is("acknowledged_at",null).order("created_at",{ascending:false}).limit(30),
    client.from("recurring_content").select("id,content_asset_id,cadence,next_due,remaining").eq("organization_id",org).eq("enabled",true).order("next_due").limit(30),
  ]);
  if(alerts.error||rules.error)throw new Error("Could not load publishing alerts and repeating plans.");
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
      <div><h2 className="text-sm font-semibold">{buffer.connected ? "Buffer connection saved" : "Start with manual posting"}</h2><p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">{buffer.connected ? `${buffer.channels.length} saved channels. Approval and media are checked before sending. Publish now, choose an exact time or use the next Buffer queue slot.` : "Copy approved text and record its live link without a connection. Connect Buffer to send approved text, images and videos to supported accounts."}</p></div>
      <Button asChild variant="outline"><Link href="/settings/ai#connection-buffer">{buffer.connected ? "Manage Buffer" : "Connect Buffer"}<ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
    </section>
    {canPublish ? <PublishingCheck /> : null}
    {alerts.data?.length ? <section className="slip flex flex-col gap-4 p-5" aria-label="Marketing publishing alerts"><h2 className="text-base font-semibold">Needs Marketing’s attention</h2>{alerts.data.map(alert=><div key={alert.id} className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words text-sm">{alert.kind==="delivery_failed"?"A publishing attempt failed. Check its delivery history before retrying.":"Repeating draft prepared."} {alert.message}</p><Link href={`/library/${alert.content_asset_id}`} className="text-sm text-primary underline">Review content</Link></div><form action={acknowledgePublishingAlert.bind(null,alert.id)}><Button type="submit" variant="outline" size="sm">Acknowledge</Button></form></div>)}</section>:null}
    {rules.data?.length ? <details className="slip p-5"><summary className="cursor-pointer text-sm font-semibold">Repeating plans ({rules.data.length})</summary><ul className="mt-3 flex flex-col gap-3">{rules.data.map(rule=><li key={rule.id} className="flex flex-wrap items-center justify-between gap-3"><Link href={`/library/${rule.content_asset_id}`} className="text-sm text-primary underline">{rule.cadence} · {rule.remaining} drafts remaining · next proposed {formatDayTime(rule.next_due)}</Link>{canPublish ? <form action={pauseRecurringContent.bind(null,rule.id)}><Button type="submit" variant="outline" size="sm">Pause repeats</Button></form> : null}</li>)}</ul><p className="mt-3 text-xs text-muted-foreground">The protected publishing worker prepares drafts up to seven days ahead. Each occurrence requires approval; it is never posted automatically.</p></details>:null}
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
    })}</ul> : <EmptyState title="No posts in this view" description="Create a social draft or choose another publishing stage." />}
    {result.total > 20 ? <nav aria-label="Social post pages" className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">Page {result.page} of {Math.ceil(result.total / 20)}</span><div className="flex gap-2">{result.page > 1 ? <Button asChild variant="outline"><Link href={href(result.stage, result.page - 1)}>Previous</Link></Button> : null}{result.page * 20 < result.total ? <Button asChild variant="outline"><Link href={href(result.stage, result.page + 1)}>Next</Link></Button> : null}</div></nav> : null}
  </div>;
}
