"use client";

import { useActionState, useMemo, useState } from "react";
import { updateContentDraft, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CHANNELS, checkChannelLimits, normalizeChannel } from "@/lib/content/channels";

const field = "flex flex-col gap-1.5";
const label = "dateline";

/** Live character and hashtag count against the channel's hard limits. */
function LimitMeter({ channel, body, format }: { channel: string; body: string; format: string | null }) {
  const check = checkChannelLimits(channel, body, format);
  if (!check.limit || format === "short-form video") return null;
  const over = check.problems.length > 0;
  const near = !over && check.length >= check.limit * 0.9;
  const tone = over ? "text-destructive" : near ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";
  return (
    <div aria-live="polite" className={`flex flex-col gap-1 text-xs ${tone}`}>
      <p className="tabular-nums">
        {channel === "x" ? "Longest post: " : ""}
        {check.length.toLocaleString()}/{check.limit.toLocaleString()} characters
        {check.hashtagLimit ? ` · ${check.hashtags}/${check.hashtagLimit} hashtags` : ""}
        {near ? " · nearly at the limit" : ""}
      </p>
      {over ? (
        <ul className="list-disc pl-4">
          {check.problems.map((problem) => <li key={problem}>{problem}</li>)}
          <li>This can&apos;t be sent for review until it fits.</li>
        </ul>
      ) : null}
    </div>
  );
}

export function DraftEditor({
  asset,
}: {
  asset: { id: string; title: string; body: string | null; channel: string | null; format?: string | null; topic: string | null; hook: string | null; cta: string | null; metadata?: Record<string, unknown> | null };
}) {
  const [channel, setChannel] = useState<string>(normalizeChannel(asset.channel) ?? "");
  const remappedFrom = asset.channel && normalizeChannel(asset.channel) === "other" && asset.channel.trim().toLowerCase() !== "other" ? asset.channel : null;
  const seo = asset.metadata?.seo && typeof asset.metadata.seo === "object" ? asset.metadata.seo as { title?: string; description?: string; keywords?: string[]; internalLinks?: string[] } : {};
  const [bodyText, setBodyText] = useState(asset.body ?? "");
  const [seoTitle, setSeoTitle] = useState(seo.title ?? "");
  const [seoDescription, setSeoDescription] = useState(seo.description ?? "");
  const [seoKeywords, setSeoKeywords] = useState(seo.keywords?.join(", ") ?? "");
  const [seoLinks, setSeoLinks] = useState(seo.internalLinks?.join("\n") ?? "");
  const seoChecks = useMemo(() => {
    const keywords = seoKeywords.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    const allText = `${seoTitle} ${seoDescription} ${bodyText}`.toLowerCase();
    return [
      seoTitle.length >= 30 && seoTitle.length <= 60,
      seoDescription.length >= 120 && seoDescription.length <= 160,
      keywords.length > 0 && keywords.some((keyword) => seoTitle.toLowerCase().includes(keyword) && allText.includes(keyword)),
      seoLinks.split("\n").some((item) => item.trim().length > 0),
    ];
  }, [bodyText, seoDescription, seoKeywords, seoLinks, seoTitle]);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => updateContentDraft(asset.id, previous, formData),
    null
  );

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border px-5 py-5 sm:px-6">
      <div>
        <p className="dateline">Human review</p>
        <h2 className="mt-1 text-base font-bold">Edit draft</h2>
      </div>
      <label className={field}><span className={label}>Title</span><Input name="title" required maxLength={200} defaultValue={asset.title} /></label>
      <label className={field}><span className={label}>Copy</span><Textarea name="body" rows={10} maxLength={20000} value={bodyText} onChange={(event) => setBodyText(event.target.value)} /></label>
      <LimitMeter channel={channel} body={bodyText} format={asset.format ?? null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>
          <span className={label}>Channel</span>
          <select name="channel" value={channel} onChange={(event) => setChannel(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Not set</option>
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {remappedFrom ? <span className="text-xs text-muted-foreground">Previously typed as &ldquo;{remappedFrom}&rdquo;. Pick the matching channel.</span> : null}
        </label>
        <label className={field}><span className={label}>Topic</span><Input name="topic" maxLength={200} defaultValue={asset.topic ?? ""} /></label>
        <label className={field}><span className={label}>Hook</span><Input name="hook" maxLength={500} defaultValue={asset.hook ?? ""} /></label>
        <label className={field}><span className={label}>Call to action</span><Input name="cta" maxLength={500} defaultValue={asset.cta ?? ""} /></label>
      </div>
      <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="dateline">Website content</p><legend className="mt-1 text-sm font-semibold">Search metadata &amp; on-page checks</legend></div><span className="dateline">{seoChecks.filter(Boolean).length}/4 checks · editorial aid only</span></div>
        <label className={field}><span className={label}>SEO title · {seoTitle.length}/60 recommended</span><Input name="seo_title" maxLength={70} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Clear page title with the main topic" /></label>
        <label className={field}><span className={label}>Meta description · {seoDescription.length}/160 recommended</span><Textarea name="seo_description" rows={3} maxLength={320} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder="Summarise the page accurately for search results" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className={field}><span className={label}>Target terms · comma separated</span><Input name="seo_keywords" maxLength={500} value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} placeholder="innovation, founders programme" /></label><label className={field}><span className={label}>Internal link suggestions · one per line</span><Textarea name="seo_internal_links" rows={2} maxLength={1000} value={seoLinks} onChange={(event) => setSeoLinks(event.target.value)} placeholder="Related program or resource URLs" /></label></div>
        <p className="text-xs leading-5 text-muted-foreground">Checks cover recommended title and description lengths, a target term in the title and copy, and at least one internal link suggestion. They do not predict rankings or replace a technical SEO audit.</p>
      </fieldset>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state?.ok ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Draft saved.</p> : null}
      <Button type="submit" size="sm" className="w-fit" disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button>
    </form>
  );
}
