"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { ChannelSelect } from "@/components/channel-select";
import { useActionState, useMemo, useState } from "react";
import { updateContentDraft, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { APPROVAL_CATEGORIES } from "@/lib/content/workflow";
import { checkChannelLimits, normalizeChannel } from "@/lib/content/channels";
import type { ChannelOption } from "@/lib/content/connected-channels";
import { channelLabel } from "@/lib/channels";
import Link from "next/link";
import { useDraftSession } from "@/components/content/draft-session";

const field = "flex flex-col gap-1.5";

/** Live character and hashtag count against the channel's hard limits. */
function LimitMeter({ channel, body, format }: { channel: string; body: string; format: string | null }) {
  const check = checkChannelLimits(channel, body, format);
  if (!check.limit || format === "short-form video") return null;
  const over = check.problems.length > 0;
  const near = !over && check.length >= check.limit * 0.9;
  const tone = over ? "text-destructive" : near ? "text-amber-700 " : "text-muted-foreground";
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
  asset, channels,
}: {
  channels: ChannelOption[];
  asset: { approval_category?: string; updated_at?: string; id: string; title: string; body: string | null; channel: string | null; format?: string | null; topic: string | null; hook: string | null; cta: string | null; metadata?: Record<string, unknown> | null };
}) {
  const { setDirty } = useDraftSession();
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
    async (previous, formData) => { const result = await updateContentDraft(asset.id, previous, formData); if (result.ok) setDirty(false); return result; },
    null
  );

  return (
    <ShadcnFieldGroup asChild><form id="draft-editor" aria-busy={pending} onChangeCapture={() => setDirty(true)} onReset={event => event.preventDefault()} action={action} className="flex scroll-mt-6 flex-col gap-3 border-t border-border px-5 py-5 sm:px-6">
      <input type="hidden" name="expected_updated_at" value={asset.updated_at ?? ""} />
      <div className="draft-editor-heading"><div><h2 className="text-xl font-semibold">Writing</h2><p className="mt-1 text-sm text-muted-foreground">Keep the copy grounded in its source.</p></div><p>{bodyText.trim() ? bodyText.trim().split(/\s+/).length.toLocaleString() : 0} words</p></div>

      <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Title</span><Input name="title" required maxLength={200} defaultValue={asset.title} /></ShadcnFieldLabel></ShadcnField>
      <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Working copy</span><Textarea name="body" rows={10} maxLength={20000} value={bodyText} onChange={(event) => setBodyText(event.target.value)} /></ShadcnFieldLabel></ShadcnField>
      <LimitMeter channel={channel} body={bodyText} format={asset.format ?? null} />
      <Disclosure className="draft-context-details" title={<>Channel, context &amp; approval requirements</>}><div className="draft-context-fields">      <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Approval category</span><ShadcnNativeSelect name="approval_category" defaultValue={asset.approval_category ?? "standard"} className="">{APPROVAL_CATEGORIES.map(([value, text]) => <ShadcnNativeSelectOption key={value} value={value}>{text}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect><span className="text-xs text-muted-foreground">Sensitive content needs two independent reviewers, including a named owner, admin or leader.</span></ShadcnFieldLabel></ShadcnField>      <div className="grid gap-3 sm:grid-cols-2">
        <ShadcnField asChild><ShadcnFieldLabel className={field}>
          <span >Channel</span>
          <ChannelSelect name="channel" value={channel} onValueChange={setChannel} placeholder="Not set" className="h-10" options={[["", "Not set"], ...channels, ...(channel && !channels.some(([value]) => value === channel) ? [[channel, `${channelLabel(channel)} · not connected`] as const] : [])]} />
          <span className="text-xs text-muted-foreground">Choose from connected accounts. <Link href="/settings/ai" className="text-primary underline">Manage connections</Link></span>
          {remappedFrom ? <span className="text-xs text-muted-foreground">Previously typed as &ldquo;{remappedFrom}&rdquo;. Pick the matching channel.</span> : null}
        </ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Topic</span><Input name="topic" maxLength={200} defaultValue={asset.topic ?? ""} /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Hook</span><Input name="hook" maxLength={500} defaultValue={asset.hook ?? ""} /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Call to action</span><Input name="cta" maxLength={500} defaultValue={asset.cta ?? ""} /></ShadcnFieldLabel></ShadcnField>
      </div>
</div></Disclosure>
      <Disclosure className="border-t border-border pt-4" initiallyOpen={channel === "website"} title={<>Search details for website articles{channel === "website" ? ` · ${seoChecks.filter(Boolean).length}/4 editorial checks` : " (optional)"}</>}>
        
        <div className="mt-4 flex flex-col gap-3">
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >SEO title · {seoTitle.length}/60 recommended</span><Input name="seo_title" maxLength={70} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Clear page title with the main topic" /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Meta description · {seoDescription.length}/160 recommended</span><Textarea name="seo_description" rows={3} maxLength={320} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder="Summarise the page accurately for search results" /></ShadcnFieldLabel></ShadcnField>
        <div className="grid gap-3 sm:grid-cols-2"><ShadcnField asChild><ShadcnFieldLabel className={field}><span >Target terms · comma separated</span><Input name="seo_keywords" maxLength={500} value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} placeholder="innovation, founders programme" /></ShadcnFieldLabel></ShadcnField><ShadcnField asChild><ShadcnFieldLabel className={field}><span >Internal link suggestions · one per line</span><Textarea name="seo_internal_links" rows={2} maxLength={1000} value={seoLinks} onChange={(event) => setSeoLinks(event.target.value)} placeholder="Related program or resource URLs" /></ShadcnFieldLabel></ShadcnField></div>
        <p className="text-xs leading-5 text-muted-foreground">Checks cover recommended title and description lengths, a target term in the title and copy, and at least one internal link suggestion. They do not predict rankings or replace a technical SEO audit.</p>
      </div></Disclosure>
      {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
      {state?.ok ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm text-emerald-700 ">Draft saved. When the copy is ready, choose Review in Content status.</p></ShadcnAlert> : null}
      <div className="draft-save-bar"><p>Save this revision before requesting review.</p><Button type="submit" size="sm" className="w-fit" disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button></div>
    </form></ShadcnFieldGroup>
  );
}
