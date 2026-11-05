"use client";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


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
  return <ShadcnFieldGroup asChild><form action={action} className="grid gap-3 sm:grid-cols-2">
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Internal name</span><Input name="name" required minLength={3} maxLength={160} placeholder="Founder programme invitation" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Subject line</span><Input name="subject" required maxLength={200} placeholder="Join the next founder cohort" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 sm:col-span-2"><span >Preview text</span><Input name="preview_text" maxLength={240} placeholder="A short line shown beside the subject in the inbox" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Campaign</span><ShadcnNativeSelect name="campaign_id" defaultValue={campaignFilter} className=""><ShadcnNativeSelectOption value="">No campaign linked</ShadcnNativeSelectOption>{campaigns.map((campaign) => <ShadcnNativeSelectOption key={campaign.id} value={campaign.id}>{campaign.name}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Audience</span><ShadcnNativeSelect name="audience_segment_id" defaultValue="" className=""><ShadcnNativeSelectOption value="">All opted-in contacts ({allContactsCount})</ShadcnNativeSelectOption>{segments.map((segment) => <ShadcnNativeSelectOption key={segment.id} value={segment.id}>{segment.name} ({segment.count})</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 sm:col-span-2"><span >Email copy</span><ShadcnTextarea name="body" required minLength={10} maxLength={12000} rows={7} placeholder="Write the message and call to action…" className="w-full leading-6" /></ShadcnFieldLabel></ShadcnField>
    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[65ch] text-[13px] leading-5 text-muted-foreground">Audience counts include contacts with recorded marketing consent and an email address, excluding unsubscribes and provider suppressions. Resend {senderReady ? "is connected with event tracking." : "must be connected with its verified sender and signed webhook before queuing."}</p><Button type="submit" disabled={pending} className="px-4">{pending ? "Saving…" : "Save draft"}</Button></div>
    {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="sm:col-span-2 text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
  </form></ShadcnFieldGroup>;
}
