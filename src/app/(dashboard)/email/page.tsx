import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { publicAppOrigin } from "@/lib/integrations/public-app-origin";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { applyActiveConsentFilter } from "@/lib/email/consent";
import { listSegments } from "@/lib/audience/segments";
import { listCampaignRollups } from "@/lib/audience/campaigns";
import { createEmailCampaign, transitionEmailCampaign } from "@/actions/email";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { Input } from "@/components/ui/input";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { todayDateline } from "@/lib/format";
import { z } from "zod";
import { getResendConfig } from "@/lib/integrations/resend";
import { getUserRole } from "@/lib/audience/access";
import { ResendSettings } from "@/components/content/resend-settings";
import { EmailDeliveryActions } from "@/components/content/email-delivery-actions";
import Link from "next/link";
import { isReviewerRole } from "@/lib/audience/access";

export const metadata: Metadata = { title: "Email Marketing" };
type EmailRow = { id:string; name:string; subject:string; preview_text:string; body:string; status:string; audience_segment_id:string|null; campaign_id:string|null; created_at:string; created_by:string|null };

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ campaign?: string; review?: string }> }) {
  const search = await searchParams;
  const campaignFilter = z.string().uuid().safeParse(search.campaign).success ? search.campaign : undefined;
  const reviewFilter = z.string().uuid().safeParse(search.review).success ? search.review : undefined;
  const organizationId = await getCallerOrganizationId();
  const supabase = await createClient();
  const campaignQuery = organizationId ? supabase.from("email_campaigns").select("*").eq("organization_id", organizationId).is("metadata->>nurture", null).order("created_at", { ascending: false }).limit(100) : null;
  if (campaignQuery && campaignFilter) campaignQuery.eq("campaign_id", campaignFilter);
  if (campaignQuery && reviewFilter) campaignQuery.eq("id", reviewFilter);
  const [segments, campaignRollups, emailResult] = organizationId ? await Promise.all([
    listSegments(organizationId),
    listCampaignRollups(organizationId),
    campaignQuery!,
  ]) : [[], [], { data: [], error: null }];
  const emails = (emailResult.data ?? []) as EmailRow[];
  const [leadCount, segmentCounts] = organizationId ? await Promise.all([
    applyActiveConsentFilter(supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
    Promise.all(segments.map(async (segment) => {
      const { count } = await applyActiveConsentFilter(supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("audience_segment_id", segment.id));
      return [segment.id, count ?? 0] as const;
    })),
  ]) : [{ count: 0 }, []];
  const countBySegment = new Map(segmentCounts as Array<readonly [string, number]>);
  const eligible = (id: string | null) => id ? countBySegment.get(id) ?? 0 : leadCount.count ?? 0;
  const campaignNames = new Map(campaignRollups.map((campaign) => [campaign.id, campaign.name]));
  const segmentNames = new Map(segments.map((segment) => [segment.id, segment.name]));
  const [resend, role] = organizationId ? await Promise.all([getResendConfig(organizationId), getUserRole(organizationId)]) : [null, null];
  const appOrigin = publicAppOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const webhookUrl = appOrigin ? `${appOrigin}/api/webhooks/resend` : "";
  const canManageProvider = Boolean(role && ["owner", "admin", "marketing_manager"].includes(role));
  const { data: { user } } = await supabase.auth.getUser();
  const deliveryResult = organizationId && emails.length ? await supabase.from("email_campaign_deliveries").select("campaign_id,status,opened_count,clicked_count").eq("organization_id", organizationId).in("campaign_id", emails.map((email) => email.id)).limit(20000) : { data: [] };
  const deliveryStats = new Map<string, { queued:number; sent:number; delivered:number; opened:number; clicked:number; bounced:number; complained:number; failed:number }>();
  for (const delivery of deliveryResult.data ?? []) {
    const stats = deliveryStats.get(delivery.campaign_id) ?? { queued:0,sent:0,delivered:0,opened:0,clicked:0,bounced:0,complained:0,failed:0 };
    if (delivery.status === "queued" || delivery.status === "sending") stats.queued++;
    if (["sent", "delivered", "opened", "clicked", "bounced", "complained"].includes(delivery.status)) stats.sent++;
    if (["delivered", "opened", "clicked"].includes(delivery.status)) stats.delivered++;
    if (delivery.status === "bounced") stats.bounced++;
    if (delivery.status === "complained") stats.complained++;
    if (delivery.status === "failed") stats.failed++;
    stats.opened += delivery.opened_count ?? 0;
    stats.clicked += delivery.clicked_count ?? 0;
    deliveryStats.set(delivery.campaign_id, stats);
  }

  return <div className="workspace-page workflow-page">
    <header><p className="dateline">{todayDateline()} · audience-led delivery</p><h1>Email Marketing</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Write campaign emails for a defined audience. Only opted-in, unsuppressed contacts are eligible; each send checks consent again before delivery.{campaignFilter ? " Showing this campaign’s email drafts." : ""}</p></header>
    <p className="text-sm leading-6 text-muted-foreground">Write a draft → ask another reviewer to approve it → choose when to send. {resend?.webhookSecret ? "Your sender setup is saved." : <a href="#sender-settings" className="font-semibold text-primary underline underline-offset-4">Set up a sender before delivery.</a>}</p>
    <details className="slip p-5 sm:p-6" open={emails.length === 0}><DisclosureSummary>Create an email draft</DisclosureSummary><div><div className="mb-4"><p className="dateline">Compose</p><h2 className="mt-1 text-lg font-bold">Create an email draft</h2><p className="mt-1 text-sm text-muted-foreground">Drafts need a second reviewer before they can be marked approved.</p></div>
      <form action={createEmailCampaign} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className="dateline">Internal name</span><Input name="name" required minLength={3} maxLength={160} placeholder="Founder programme invitation" /></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Subject line</span><Input name="subject" required maxLength={200} placeholder="Join the next founder cohort" /></label>
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Preview text</span><Input name="preview_text" maxLength={240} placeholder="A short line shown beside the subject in the inbox" /></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Campaign</span><select name="campaign_id" defaultValue={campaignFilter ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">No campaign linked</option>{campaignRollups.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><span className="dateline">Audience</span><select name="audience_segment_id" defaultValue="" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All opted-in contacts ({leadCount.count ?? 0})</option>{segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({countBySegment.get(segment.id) ?? 0})</option>)}</select></label>
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Email copy</span><textarea name="body" required minLength={10} maxLength={12000} rows={7} placeholder="Write the message and call to action…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-1 focus-visible:ring-ring" /></label>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[65ch] text-[13px] leading-5 text-muted-foreground">Audience counts include contacts with recorded marketing consent and an email address, excluding unsubscribes and provider suppressions. Resend {resend?.webhookSecret ? "is connected with event tracking." : "must be connected with its verified sender and signed webhook before queuing."}</p><FormSubmitButton className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">Save draft</FormSubmitButton></div>
      </form>
    </div></details>
    <section className="flex flex-col gap-3"><div><p className="dateline">Workflow · {emails.length} drafts</p><h2 className="mt-1 text-lg font-bold">Email campaigns</h2></div>
      {reviewFilter ? <Link href="/email" className="text-sm font-semibold text-primary underline">View all emails</Link> : null}
      {emails.length === 0 ? <EmptyState title={reviewFilter ? "Email not found" : "No email drafts yet"} description={reviewFilter ? "This email may have been removed or is outside this workspace. Return to all emails to choose another." : "Create an audience-specific email above. You can write a draft before connecting a sender."} action={reviewFilter ? { label: "View all emails", href: "/email" } : undefined} /> : <ul className="flex flex-col gap-3">{emails.map(email => {
        const stats = deliveryStats.get(email.id);
        const canApprove = isReviewerRole(role) && Boolean(user?.id && email.created_by !== user.id);
        return <li key={email.id} id={`email-${email.id}`} className="slip flex scroll-mt-6 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2"><StatusStamp status={email.status} /><span className="dateline">{eligible(email.audience_segment_id)} opted-in recipients</span><span className="ml-auto text-[13px] leading-5 text-muted-foreground">{email.campaign_id ? campaignNames.get(email.campaign_id) ?? "Campaign" : "No campaign linked"}</span></div>
          <div><h3 className="font-bold">{email.name}</h3><p className="mt-0.5 text-sm text-foreground">Subject: {email.subject}</p>{email.preview_text ? <p className="text-[13px] leading-5 text-muted-foreground">Inbox preview: {email.preview_text}</p> : null}
            <details open={email.status === "review" || Boolean(reviewFilter)} className="mt-3 border-y py-3"><DisclosureSummary>Read full email</DisclosureSummary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{email.body}</p></details>
            <p className="mt-2 dateline">Audience · {email.audience_segment_id ? segmentNames.get(email.audience_segment_id) ?? "Segment" : "All opted-in contacts"}</p>
          </div>
          {stats ? <p className="dateline">Delivery · {stats.queued} queued · {stats.sent} sent · {stats.delivered} delivered · {stats.opened} opens · {stats.clicked} clicks · {stats.bounced} bounced · {stats.complained} complaints · {stats.failed} failed</p> : null}
          {email.status === "review" ? <p className="text-sm text-muted-foreground">{canApprove ? "Check the full message and audience before approving. Approval does not send this email." : "Waiting for a different eligible reviewer. Authors cannot approve their own email."}</p> : null}
          {email.status === "approved" && eligible(email.audience_segment_id) === 0 ? <p className="text-sm text-muted-foreground">No eligible recipients yet. <Link href="/leads" className="text-primary underline">Check your contacts and their consent</Link> before sending.</p> : null}
          <div className="flex flex-wrap gap-2 border-t border-border/80 pt-3">
            {email.status === "draft" ? <form action={transitionEmailCampaign}><input type="hidden" name="id" value={email.id} /><input type="hidden" name="to" value="review" /><FormSubmitButton size="sm" variant="outline">Submit for review</FormSubmitButton></form> : null}
            {email.status === "review" && canApprove ? <form action={transitionEmailCampaign}><input type="hidden" name="id" value={email.id} /><input type="hidden" name="to" value="approved" /><FormSubmitButton size="sm" variant="outline">Approve email</FormSubmitButton></form> : null}
            {email.status === "approved" ? <EmailDeliveryActions campaignId={email.id} status={email.status} hasRecipients={eligible(email.audience_segment_id) > 0} /> : null}
            {email.status === "scheduled" ? <><EmailDeliveryActions campaignId={email.id} status={email.status} hasRecipients={true} /><form action={transitionEmailCampaign}><input type="hidden" name="id" value={email.id} /><input type="hidden" name="to" value="paused" /><FormSubmitButton size="sm" variant="outline">Pause sending</FormSubmitButton></form></> : null}
            {email.status === "paused" ? <form action={transitionEmailCampaign}><input type="hidden" name="id" value={email.id} /><input type="hidden" name="to" value="scheduled" /><FormSubmitButton size="sm" variant="outline">Resume delivery</FormSubmitButton></form> : null}
          </div>
        </li>;
      })}</ul>}
    </section>
    <details id="sender-settings" className="slip scroll-mt-6 p-5"><DisclosureSummary>Sender settings · {resend && resend.webhookSecret ? "connection saved" : "setup required before sending"}</DisclosureSummary><ResendSettings connected={Boolean(resend)} fromEmail={resend?.fromEmail ?? ""} fromName={resend?.fromName ?? "Renaissance Innovation Labs"} replyTo={resend?.replyTo ?? ""} hasWebhook={Boolean(resend?.webhookSecret)} webhookUrl={webhookUrl} canManage={canManageProvider} /></details>
  </div>;
}
