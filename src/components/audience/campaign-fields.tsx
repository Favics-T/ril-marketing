import { ChannelIdentity } from "@/components/channel-identity";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const channelOptions = [
  ["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["facebook", "Facebook"],
  ["x", "X"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["email", "Email"],
  ["website", "Website"], ["events", "Events"], ["paid_ads", "Paid ads"], ["pr", "PR"], ["other", "Other"],
] as const;
const funnelOptions = [
  ["awareness", "Awareness"], ["engagement", "Engagement"], ["lead_capture", "Lead capture"],
  ["nurturing", "Nurturing"], ["conversion", "Conversion"], ["retention", "Retention"],
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
    <label className={`${fieldClass} sm:col-span-2`}><span className={labelClass}>Campaign name</span><Input name="name" required minLength={3} maxLength={160} defaultValue={initial.name ?? ""} placeholder="e.g. September founders programme" /></label>
    <label className={`${fieldClass} sm:col-span-2`}><span className={labelClass}>Objective</span><Textarea name="objective" rows={3} maxLength={4000} defaultValue={initial.objective ?? ""} placeholder="What should this campaign achieve? Add a measurable outcome where possible." /></label>
    <label className={`${fieldClass} sm:col-span-2`}><span className={labelClass}>Target audience</span><Textarea name="target_audience" rows={2} maxLength={1000} defaultValue={initial.target_audience ?? ""} placeholder="Who should this campaign reach?" /></label>
    <label className={fieldClass}><span className={labelClass}>Audience segment</span><select name="audience_segment_id" defaultValue={initial.audience_segment_id ?? ""} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">No linked segment</option>{segments.map((segment)=><option key={segment.id} value={segment.id}>{segment.name}</option>)}</select></label>
    <label className={fieldClass}><span className={labelClass}>Funnel stage</span><select name="funnel_stage" defaultValue={initial.funnel_stage ?? "awareness"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{funnelOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className={fieldClass}><span className={labelClass}>Starts</span><Input name="starts_on" type="date" defaultValue={initial.starts_on ?? ""} /></label>
    <label className={fieldClass}><span className={labelClass}>Ends</span><Input name="ends_on" type="date" defaultValue={initial.ends_on ?? ""} /></label>
    <label className={fieldClass}><span className={labelClass}>Budget · optional</span><Input name="budget" type="number" min="0" step="0.01" defaultValue={initial.budget ?? ""} placeholder="No paid budget" /></label>
    <label className={fieldClass}><span className={labelClass}>Budget currency</span><select name="budget_currency" defaultValue={initial.budget_currency ?? "NGN"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{currencies.map((currency)=><option key={currency} value={currency}>{currency}</option>)}</select></label>
    <fieldset className="flex flex-col gap-2 sm:col-span-2"><legend className={labelClass}>Channels</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{channelOptions.map(([value])=><label key={value} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"><input type="checkbox" name="channels" value={value} defaultChecked={initial.channels?.includes(value)} className="size-4 accent-primary" /><ChannelIdentity channel={value} /></label>)}</div></fieldset>
  </>;
}
