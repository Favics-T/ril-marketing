
import { Disclosure } from "@/components/ui/disclosure";

import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { FieldLabel as ShadcnFieldLabel, Field as ShadcnField, FieldSet as ShadcnFieldSet, FieldLegend as ShadcnFieldLegend } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { ChannelIdentity } from "@/components/channel-identity";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const channelOptions = [
  ["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["facebook", "Facebook"],
  ["x", "X"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["email", "Email"],
  ["website", "Website"], ["events", "Events"], ["paid_ads", "Paid ads"], ["pr", "PR"], ["other", "Other"],
] as const;
const funnelOptions = [
  ["awareness", "Awareness · reach new people"], ["engagement", "Engagement · start conversations"], ["lead_capture", "Lead capture · collect interest"],
  ["nurturing", "Nurturing · follow up"], ["conversion", "Conversion · turn interest into action"], ["retention", "Retention · keep people involved"],
] as const;
const currencies = ["NGN", "USD", "GBP", "EUR"] as const;
const labelClass = "dateline";
const fieldClass = "flex flex-col gap-1.5";

export type CampaignFieldsValue = {
  name?: string;
  objective?: string;
  target_audience?: string;
  funnel_stage?: string;
  audience_segment_id?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  budget?: number | null;
  budget_currency?: string;
  channels?: string[];
};

export function CampaignFields({ segments, initial = {} }: { segments: Array<{id:string;name:string}>; initial?: CampaignFieldsValue }) {
  return <>
    <ShadcnField asChild><ShadcnFieldLabel className={`${fieldClass} sm:col-span-2`}><span >Campaign name</span><Input name="name" required minLength={3} maxLength={160} defaultValue={initial.name ?? ""} placeholder="e.g. September founders programme" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={`${fieldClass} sm:col-span-2`}><span >Objective</span><Textarea name="objective" rows={3} maxLength={4000} defaultValue={initial.objective ?? ""} placeholder="What should this campaign achieve? Add a measurable outcome where possible." /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={`${fieldClass} sm:col-span-2`}><span >Target audience</span><Textarea name="target_audience" rows={2} maxLength={1000} defaultValue={initial.target_audience ?? ""} placeholder="Who should this campaign reach?" /></ShadcnFieldLabel></ShadcnField>
    <Disclosure className="border-t pt-3 sm:col-span-2 lg:col-span-4" initiallyOpen={Boolean(initial.name)} title={<>Plan, channels &amp; budget (optional)</>}><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <ShadcnField asChild><ShadcnFieldLabel className={fieldClass}><span >Audience segment</span><ShadcnNativeSelect name="audience_segment_id" defaultValue={initial.audience_segment_id ?? ""} className=""><ShadcnNativeSelectOption value="">No linked segment</ShadcnNativeSelectOption>{segments.map((segment)=><ShadcnNativeSelectOption key={segment.id} value={segment.id}>{segment.name}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={fieldClass}><span >Main focus</span><ShadcnNativeSelect name="funnel_stage" defaultValue={initial.funnel_stage ?? "awareness"} className="">{funnelOptions.map(([value,label])=><ShadcnNativeSelectOption key={value} value={value}>{label}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={fieldClass}><span >Starts</span><Input name="starts_on" type="date" defaultValue={initial.starts_on ?? ""} /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={fieldClass}><span >Ends</span><Input name="ends_on" type="date" defaultValue={initial.ends_on ?? ""} /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={fieldClass}><span >Budget · optional</span><Input name="budget" type="number" min="0" step="0.01" defaultValue={initial.budget ?? ""} placeholder="No paid budget" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className={fieldClass}><span >Budget currency</span><ShadcnNativeSelect name="budget_currency" defaultValue={initial.budget_currency ?? "NGN"} className="">{currencies.map((currency)=><ShadcnNativeSelectOption key={currency} value={currency}>{currency}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnFieldSet className="flex flex-col gap-2 sm:col-span-2"><ShadcnFieldLegend className={labelClass}>Channels</ShadcnFieldLegend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{channelOptions.map(([value])=><ShadcnField asChild orientation="horizontal" key={value}><ShadcnFieldLabel key={value} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"><ShadcnCheckbox  name="channels" value={value} defaultChecked={initial.channels?.includes(value)} className="size-4 accent-primary" /><ChannelIdentity channel={value} /></ShadcnFieldLabel></ShadcnField>)}</div></ShadcnFieldSet>
    </div></Disclosure>
  </>;
}
