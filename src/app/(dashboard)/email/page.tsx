import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { applyActiveConsentFilter } from "@/lib/email/consent";
import { listSegments } from "@/lib/audience/segments";
import { listCampaignRollups } from "@/lib/audience/campaigns";
import { Button } from "@/components/ui/button";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { todayDateline } from "@/lib/format";
import { z } from "zod";
import { getResendConfig } from "@/lib/integrations/resend";
import { getUserRole } from "@/lib/audience/access";
import { ResendSettings } from "@/components/content/resend-settings";
import { EmailDeliveryActions } from "@/components/content/email-delivery-actions";
import { EmailCreateForm } from "@/components/email/email-create-form";
import { EmailTransitionButton } from "@/components/email/email-transition-button";
import { describeDeliveryProblem, readDeliveryProblem, resumeStatus } from "@/lib/email/workflow";
import { awaitingSeniorSignoff, DEFAULT_SENSITIVITY_SETTINGS, flagRefusal, seniorApprovalRefusal } from "@/lib/email/sensitivity";
import { getWorkspaceSettings } from "@/lib/settings/workspace";
import { SensitiveSignoffNote } from "@/components/email/email-signoff";
import { EmailSignoffControls } from "@/components/email/email-signoff-controls";

export const metadata: Metadata = { title: "Email Marketing" };
type EmailRow = { id:string; name:string; subject:string; preview_text:string; body:string; status:string; audience_segment_id:string|null; campaign_id:string|null; created_at:string; metadata:Record<string, unknown>|null; created_by:string|null; submitted_by:string|null; approved_by:string|null; is_sensitive:boolean; sensitive_approved_by:string|null };

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const search = await searchParams;
  const campaignFilter = z.string().uuid().safeParse(search.campaign).success ? search.campaign : undefined;
  const organizationId = await getCallerOrganizationId();
  const supabase = await createClient();
  const campaignQuery = organizationId ? supabase.from("email_campaigns").select("*").eq("organization_id", organizationId).is("metadata->>nurture", null).order("created_at", { ascending: false }).limit(100) : null;
  if (campaignQuery && campaignFilter) campaignQuery.eq("campaign_id", campaignFilter);
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
  const [resend, role, settings, userResult] = organizationId ? await Promise.all([
    getResendConfig(organizationId), getUserRole(organizationId),
    getWorkspaceSettings(organizationId).catch(() => DEFAULT_SENSITIVITY_SETTINGS), supabase.auth.getUser(),
  ]) : [null, null, DEFAULT_SENSITIVITY_SETTINGS, null];
  const actor = { id: userResult?.data.user?.id ?? null, role };
  const webhookUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/webhooks/resend` : "";
  const canManageProvider = Boolean(role && ["owner", "admin", "marketing_manager"].includes(role));
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

  return <div className="workspace-page flex flex-col gap-5 md:gap-7">
    <header><p className="dateline">{todayDateline()} · audience-led delivery</p><h1>Email Marketing</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Write campaign emails for a defined audience. Only opted-in, unsuppressed contacts are eligible; each send checks consent again before delivery.{campaignFilter ? " Showing this campaign’s email drafts." : ""}</p></header>
<details className="slip p-5" open={!resend || !resend.webhookSecret}><summary>Sender settings · {resend && resend.webhookSecret ? "connected" : "setup required"}</summary><ResendSettings connected={Boolean(resend)} fromEmail={resend?.fromEmail ?? ""} fromName={resend?.fromName ?? "Renaissance Innovation Labs"} replyTo={resend?.replyTo ?? ""} hasWebhook={Boolean(resend?.webhookSecret)} webhookUrl={webhookUrl} canManage={canManageProvider} /></details>
    <details className="slip p-5 sm:p-6" open={emails.length === 0}><summary>Create an email draft</summary><div><div className="mb-4"><p className="dateline">Compose</p><h2 className="mt-1 text-lg font-bold">Create an email draft</h2><p className="mt-1 text-sm text-muted-foreground">Drafts need a second reviewer before they can be marked approved.</p></div>
      <EmailCreateForm campaignFilter={campaignFilter ?? ""} campaigns={campaignRollups.map((campaign) => ({ id: campaign.id, name: campaign.name }))} segments={segments.map((segment) => ({ id: segment.id, name: segment.name, count: countBySegment.get(segment.id) ?? 0 }))} allContactsCount={leadCount.count ?? 0} senderReady={Boolean(resend?.webhookSecret)} />
    </div></details>
    <section className="flex flex-col gap-3"><div><p className="dateline">Workflow · {emails.length} drafts</p><h2 className="mt-1 text-lg font-bold">Email campaigns</h2></div>
      {emails.length === 0 ? <EmptyState title="No email drafts yet" description="Create an audience-specific email above." /> : <ul className="flex flex-col gap-3">{emails.map((email) => { const stats = deliveryStats.get(email.id); const problem = email.status === "paused" ? readDeliveryProblem(email.metadata) : null; const awaiting = awaitingSeniorSignoff(email); const canFlag = !flagRefusal(email, actor, settings); const canApprove = !seniorApprovalRefusal(email, actor, settings); return <li key={email.id} className="slip flex flex-col gap-3 p-5"><div className="flex flex-wrap items-center gap-2"><StatusStamp status={email.status} /><SensitiveSignoffNote campaign={email} approverRoles={settings.sensitiveApproverRoles} /><span className="dateline">{eligible(email.audience_segment_id)} opted-in recipients</span><span className="ml-auto text-[13px] leading-5 text-muted-foreground">{email.campaign_id ? campaignNames.get(email.campaign_id) ?? "Campaign" : "Unlinked campaign"}</span></div><div><h3 className="font-bold"><Link href={`/email/${email.id}`} className="underline-offset-2 hover:underline">{email.name}</Link></h3>{typeof email.metadata?.source_content_asset_id === "string" ? <p className="dateline">From newsletter · <Link href={`/library/${email.metadata.source_content_asset_id}`} className="text-primary underline underline-offset-2">open source newsletter</Link></p> : null}<p className="mt-0.5 text-sm text-foreground">{email.subject}</p>{email.preview_text ? <p className="text-[13px] leading-5 text-muted-foreground">{email.preview_text}</p> : null}<p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{email.body}</p><p className="mt-2 dateline">Audience · {email.audience_segment_id ? segmentNames.get(email.audience_segment_id) ?? "Segment" : "All opted-in contacts"}</p></div>{problem ? <p role="alert" className="text-sm leading-5 text-destructive">{describeDeliveryProblem(problem)}</p> : null}{stats ? <p className="dateline">Delivery · {stats.queued} queued · {stats.sent} sent · {stats.delivered} delivered · {stats.opened} opens · {stats.clicked} clicks · {stats.bounced} bounced · {stats.complained} complaints · {stats.failed} failed</p> : null}<div className="flex flex-wrap gap-2 border-t border-border/80 pt-3">{email.status === "draft" ? <><Button asChild size="sm" variant="outline"><Link href={`/email/${email.id}`}>Edit draft</Link></Button><EmailTransitionButton emailId={email.id} to="review" label="Submit for review" /></> : null}{email.status === "review" ? <EmailTransitionButton emailId={email.id} to="approved" label="Approve" /> : null}{email.status === "approved" && !awaiting ? <EmailDeliveryActions campaignId={email.id} status={email.status} hasRecipients={eligible(email.audience_segment_id) > 0} /> : null}{email.status === "scheduled" ? <><EmailDeliveryActions campaignId={email.id} status={email.status} hasRecipients={true} /><EmailTransitionButton emailId={email.id} to="paused" label="Pause sending" /></> : null}{email.status === "paused" && !(awaiting && resumeStatus(email) === "scheduled") ? <EmailTransitionButton emailId={email.id} to="scheduled" label="Resume" /> : null}<EmailSignoffControls emailId={email.id} isSensitive={email.is_sensitive} canFlag={canFlag} canApprove={canApprove} /></div></li>})}</ul>}
    </section>
  </div>;
}
