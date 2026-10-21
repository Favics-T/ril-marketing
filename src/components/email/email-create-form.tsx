"use client";

import { useActionState } from "react";
import { createEmailCampaign, type EmailActionResult } from "@/actions/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  campaignFilter: string;
  campaigns: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string; count: number }>;
  allContactsCount: number;
  senderReady: boolean;
};

export function EmailCreateForm({ campaignFilter, campaigns, segments, allContactsCount, senderReady }: Props) {
  const [state, action, pending] = useActionState<EmailActionResult | null, FormData>(createEmailCampaign, null);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <label className="flex flex-col gap-1.5"><span className="dateline">Internal name</span><Input name="name" required minLength={3} maxLength={160} placeholder="Founder programme invitation" /></label>
    <label className="flex flex-col gap-1.5"><span className="dateline">Subject line</span><Input name="subject" required maxLength={200} placeholder="Join the next founder cohort" /></label>
    <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Preview text</span><Input name="preview_text" maxLength={240} placeholder="A short line shown beside the subject in the inbox" /></label>
    <label className="flex flex-col gap-1.5"><span className="dateline">Campaign</span><select name="campaign_id" defaultValue={campaignFilter} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">No campaign linked</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
    <label className="flex flex-col gap-1.5"><span className="dateline">Audience</span><select name="audience_segment_id" defaultValue="" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All opted-in contacts ({allContactsCount})</option>{segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({segment.count})</option>)}</select></label>
    <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Email copy</span><textarea name="body" required minLength={10} maxLength={12000} rows={7} placeholder="Write the message and call to action…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-1 focus-visible:ring-ring" /></label>
    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[65ch] text-[13px] leading-5 text-muted-foreground">Audience counts include contacts with recorded marketing consent and an email address, excluding unsubscribes and provider suppressions. Resend {senderReady ? "is connected with event tracking." : "must be connected with its verified sender and signed webhook before queuing."}</p><Button type="submit" disabled={pending} className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">{pending ? "Saving…" : "Save draft"}</Button></div>
    {state?.error ? <p role="alert" className="sm:col-span-2 text-sm text-destructive">{state.error}</p> : null}
  </form>;
}
