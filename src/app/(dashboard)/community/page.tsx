
import { Disclosure } from "@/components/ui/disclosure";
import { WorkspacePageHeader } from "@/components/workspace-page-header";

import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Card as ShadcnCard } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ChannelIdentity } from "@/components/channel-identity";
import { ChannelSelect } from "@/components/channel-select";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createCommunityItem, createLeadFromCommunityItem, saveCommunityReply, transitionCommunityItem } from "@/actions/community";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Community Inbox" };
type InboxItem = { id:string; platform:string; external_url:string|null; author_label:string; body:string; category:string; priority:string; reply_draft:string; status:string; ai_model:string; created_at:string; lead_id:string|null };
const transition = (id:string, action:string) => <ShadcnFieldGroup asChild><form action={transitionCommunityItem}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} /><FormSubmitButton size="sm" variant="outline">{action === "approve_reply" ? "Approve reply" : action === "replied" ? "Mark posted" : action === "reviewed" ? "Mark reviewed" : "Ignore"}</FormSubmitButton></form></ShadcnFieldGroup>;

export default async function CommunityPage() {
  const organizationId = await getCallerOrganizationId();
  const supabase = await createClient();
  const { data } = organizationId ? await supabase.from("community_items").select("*").eq("organization_id", organizationId).order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(300) : { data: [] };
  const items = (data ?? []) as InboxItem[];
  const open = items.filter((item) => ["new", "reviewed", "reply_approved"].includes(item.status));
  return <div className="workspace-page workflow-page">
<WorkspacePageHeader title={<>Community Inbox</>} eyebrow={<>{todayDateline()} · {open.length} open items</>} description={<>Prioritise questions, leads, complaints and partnership opportunities. Replies require a second-person approval before you post them.</>} />
<div className="operations-workbench glass-operations"><div className="operations-main"><section className="flex flex-col gap-3"><div><p className="dateline">Queue · {items.length} recorded</p><h2 className="mt-1 text-lg font-bold">Comments and mentions</h2></div>
      {items.length === 0 ? <EmptyState title="No community items" description="Record a comment above. Connected-channel sync can be added when social account permissions are configured." /> : <ul className="flex flex-col gap-3">{items.map((item)=><ShadcnCard asChild key={item.id}><li key={item.id} className="slip overflow-hidden"><div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3 sm:px-5"><StatusStamp status={item.status} /><span className="text-[13px] font-bold tracking-[-0.01em]"><ChannelIdentity channel={item.platform} /></span><span className="dateline">{item.category.replaceAll("_", " ")}</span>{item.priority === "high" ? <StatusStamp variant="hot">HIGH PRIORITY</StatusStamp> : null}<span className="ml-auto dateline">{new Date(item.created_at).toLocaleString("en-GB")}</span></div>
        <div className="grid gap-4 p-5 sm:p-5 lg:grid-cols-[1fr_1fr]"><div><p className="dateline">{item.author_label || "No public author provided"} · {item.ai_model}</p><blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-border/80 pl-3 text-sm leading-6">{item.body}</blockquote>{item.external_url ? <a href={item.external_url} target="_blank" rel="noreferrer" className="-my-1 mt-2 inline-flex min-h-11 items-center rounded py-1.5 text-[13px] leading-5 text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">Open original comment</a> : null}</div>
          <div>{["new","reviewed"].includes(item.status) ? <ShadcnFieldGroup asChild><form action={saveCommunityReply} className="flex flex-col gap-2"><input type="hidden" name="id" value={item.id} /><ShadcnField asChild><ShadcnFieldLabel htmlFor={`community-reply-${item.id}`} className="dateline">Suggested reply · review before posting<span className="sr-only"> · {item.author_label || "Anonymous author"} on {item.platform}: {item.body.slice(0,80)}</span></ShadcnFieldLabel></ShadcnField><Textarea id={`community-reply-${item.id}`} name="reply" defaultValue={item.reply_draft} required minLength={2} maxLength={1500} rows={4} /><FormSubmitButton size="sm" variant="outline" className="w-fit">Save reply draft</FormSubmitButton></form></ShadcnFieldGroup> : <><p className="dateline">Suggested reply · review before posting</p><p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-6">{item.reply_draft || "No reply draft."}</p></>}{item.status === "reply_approved" ? <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Post the approved text on {item.platform}; then mark it posted here.</p> : null}</div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/80 px-4 py-3 sm:px-5">{item.status === "new" ? transition(item.id,"reviewed") : null}{["new","reviewed"].includes(item.status) ? <>{transition(item.id,"approve_reply")}{transition(item.id,"ignored")}</> : null}{item.status === "reply_approved" ? transition(item.id,"replied") : null}{item.status === "replied" ? <p className="self-center text-[13px] leading-5 text-muted-foreground">Reply marked as posted manually.</p> : null}{item.category === "lead" && !item.lead_id ? <ShadcnFieldGroup asChild><form action={createLeadFromCommunityItem}><input type="hidden" name="id" value={item.id} /><FormSubmitButton size="sm">Add to lead follow-up</FormSubmitButton></form></ShadcnFieldGroup> : null}{item.lead_id ? <a href={`/leads/${item.lead_id}`} className="self-center rounded text-[13px] leading-5 text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">Open CRM lead</a> : null}</div>
      </li></ShadcnCard>)}</ul>}
    </section></div><aside className="operations-reference operations-compose" aria-label="Record a community item"><ShadcnCard asChild><Disclosure className="slip p-5 sm:p-6" initiallyOpen={items.length === 0} title={<>Record a comment or mention</>}><div><div className="mb-4"><p className="dateline">Inbound item</p><h2 className="mt-1 text-lg font-bold">Record a comment or mention</h2><p className="mt-1 text-sm text-muted-foreground">Add comments copied from a connected social platform. Platform comment syncing and direct replies are not configured yet.</p></div>
      <ShadcnFieldGroup asChild><form action={createCommunityItem} className="grid gap-3 sm:grid-cols-2">
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Platform</span><ChannelSelect name="platform" required placeholder="Choose a platform" className="h-10" options={["LinkedIn","Instagram","Facebook","X","YouTube","TikTok","Website","Other"].map(value => [value, value] as const)} /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Author or handle</span><Input name="author_label" maxLength={160} placeholder="Public handle, if available" /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 sm:col-span-2"><span >Comment URL · optional</span><Input name="external_url" type="url" placeholder="https://…" /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 sm:col-span-2"><span >Comment text</span><Textarea name="body" required minLength={3} maxLength={5000} rows={4} placeholder="Paste the comment or mention…" /></ShadcnFieldLabel></ShadcnField>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[65ch] text-[13px] leading-5 text-muted-foreground">When an AI provider is configured, the comment text is sent for classification and a reply suggestion. Otherwise local keyword rules are used. Every reply stays a draft until a different reviewer approves it.</p><FormSubmitButton className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">Classify &amp; add</FormSubmitButton></div>
      </form></ShadcnFieldGroup>
    </div></Disclosure></ShadcnCard></aside></div>
</div>;
}
