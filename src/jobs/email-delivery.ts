import "server-only";
import { publicAppOrigin } from "@/lib/integrations/public-app-origin";

import { createAdminClient } from "@/lib/supabase/admin";
import { getResendConfig } from "@/lib/integrations/resend";
import { createUnsubscribeToken } from "@/lib/email/tokens";
import { hasActiveConsent } from "@/lib/email/consent";

type Delivery = { id:string; organization_id:string; campaign_id:string; lead_id:string; attempts:number; unsubscribe_token_hash:string };
type Campaign = { id:string; organization_id:string; status:string; delivery_authorized_at:string|null; subject:string; preview_text:string; body:string; name:string };
type Lead = { id:string; organization_id:string; email:string|null; name:string|null; marketing_consent:boolean; email_unsubscribed_at:string|null; email_suppressed_at:string|null };

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char] ?? char); }
function publicOrigin() {
  const origin = publicAppOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin) throw new Error("Set NEXT_PUBLIC_SITE_URL to the public HTTPS application address before sending email.");
  return origin;
}

async function sendOne(delivery: Delivery, campaign: Campaign, lead: Lead, unsubscribeTokens: Map<string,string>) {
  const admin = createAdminClient();
  const { data: currentCampaign, error: campaignError } = await admin.from("email_campaigns").select("status,delivery_authorized_at,metadata").eq("organization_id", delivery.organization_id).eq("id", delivery.campaign_id).maybeSingle<{status:string;delivery_authorized_at:string|null;metadata:Record<string,unknown>}>();
  if (campaignError) throw new Error(`Could not recheck campaign: ${campaignError.message}`);
  if (currentCampaign?.status === "paused") {
    await admin.from("email_campaign_deliveries").update({ status: "queued", attempts: Math.max(0, delivery.attempts - 1), next_attempt_at: new Date(Date.now() + 30 * 60_000).toISOString(), error: "Campaign paused before send." }).eq("id", delivery.id);
    return "queued";
  }
  if (currentCampaign?.status !== "scheduled" || !currentCampaign.delivery_authorized_at) {
    await admin.from("email_campaign_deliveries").update({ status: "cancelled", error: "Campaign is no longer scheduled for delivery." }).eq("id", delivery.id);
    return "cancelled";
  }
  if (currentCampaign.metadata?.nurture === true) {
    const metadata = currentCampaign.metadata;
    const [sequence, enrollment] = await Promise.all([
      admin.from("nurture_sequences").select("status,created_by,approved_by").eq("organization_id", delivery.organization_id).eq("id", metadata.nurture_sequence_id).maybeSingle(),
      admin.from("nurture_enrollments").select("status,current_step,lead_id,sequence_id").eq("organization_id", delivery.organization_id).eq("id", metadata.nurture_enrollment_id).maybeSingle(),
    ]);
    if (sequence.error || enrollment.error) throw new Error("Could not recheck nurture authorization.");
    const enrolled = enrollment.data;
    const approved = sequence.data?.approved_by && sequence.data.created_by && sequence.data.approved_by !== sequence.data.created_by;
    const eligible = enrolled?.status === "active" && enrolled.current_step === metadata.nurture_step && enrolled.lead_id === delivery.lead_id && enrolled.sequence_id === metadata.nurture_sequence_id;
    if (!eligible || !sequence.data || sequence.data.status === "archived") {
      await admin.from("email_campaign_deliveries").update({ status: "cancelled", error: "Nurture enrollment is no longer eligible." }).eq("id", delivery.id);
      return "cancelled";
    }
    if (sequence.data.status !== "active" || !approved) {
      await admin.from("email_campaign_deliveries").update({ status: "queued", attempts: Math.max(0, delivery.attempts - 1), next_attempt_at: new Date(Date.now() + 30 * 60_000).toISOString(), error: "Nurture sequence is paused or awaiting approval." }).eq("id", delivery.id);
      return "queued";
    }
  }
  const config = await getResendConfig(delivery.organization_id);
  if (!config) {
    await admin.from("email_campaign_deliveries").update({ status: "queued", attempts: Math.max(0, delivery.attempts - 1), error: "Resend is not connected or its key cannot be decrypted.", next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString() }).eq("id", delivery.id);
    return "queued";
  }
  if (!config.webhookSecret) {
    await admin.from("email_campaign_deliveries").update({ status: "queued", attempts: Math.max(0, delivery.attempts - 1), error: "Configure the Resend webhook signing secret before sending.", next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString() }).eq("id", delivery.id);
    return "queued";
  }
  const { data: currentLead, error: leadError } = await admin.from("leads").select("id,organization_id,email,name,marketing_consent,email_unsubscribed_at,email_suppressed_at").eq("organization_id", delivery.organization_id).eq("id", lead.id).maybeSingle<Lead>();
  if (leadError) throw new Error(`Could not recheck recipient: ${leadError.message}`);
  if (currentLead) lead = currentLead;
  if (!currentLead || !hasActiveConsent(lead)) {
    const status = lead.email_unsubscribed_at ? "unsubscribed" : "cancelled";
    await admin.from("email_campaign_deliveries").update({ status, error: "Recipient no longer has active marketing consent." }).eq("id", delivery.id);
    return status;
  }
  const token = unsubscribeTokens.get(delivery.id);
  if (!token) {
    await admin.from("email_campaign_deliveries").update({ status: "failed", error: "Unsubscribe token is missing." }).eq("id", delivery.id);
    return "failed";
  }
  const unsubscribeUrl = `${publicOrigin()}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
  const bodyText = `${campaign.body}\n\n——\nYou are receiving this because you opted in to Renaissance Innovation Labs marketing updates. Unsubscribe: ${unsubscribeUrl}`;
  const preheader = campaign.preview_text ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0">${escapeHtml(campaign.preview_text)}</span>` : "";
  const html = `${preheader}<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHtml(campaign.body)}</div><hr><p style="font-size:12px;color:#555">You are receiving this because you opted in to Renaissance Innovation Labs marketing updates. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>.</p>`;
  const senderName = config.fromName.replace(/[\r\n<>]/g, " ").trim().slice(0, 120);
  const payload = {
    from: `${senderName} <${config.fromEmail}>`, to: [lead.email], subject: campaign.subject,
    text: bodyText, html,
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "X-Entity-Ref-ID": delivery.id },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `ril-delivery-${delivery.id}` },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    clearTimeout(timer);
    const message = error instanceof Error && error.name === "AbortError" ? "Resend request timed out; a retry uses the same idempotency key." : "Could not reach Resend; a retry uses the same idempotency key.";
    const attempts = delivery.attempts;
    await admin.from("email_campaign_deliveries").update({ status: attempts >= 3 ? "failed" : "queued", error: message, next_attempt_at: new Date(Date.now() + attempts * 5 * 60_000).toISOString() }).eq("id", delivery.id);
    return attempts >= 3 ? "failed" : "queued";
  }
  clearTimeout(timer);
  const result = await response.json().catch(() => null) as { id?: string; message?: string; error?: { message?: string } } | null;
  if (!response.ok || !result?.id) {
    const attempts = delivery.attempts;
    const message = (result?.message ?? result?.error?.message ?? `Resend returned HTTP ${response.status}.`).slice(0, 700);
    await admin.from("email_campaign_deliveries").update({ status: attempts >= 3 ? "failed" : "queued", error: message, next_attempt_at: new Date(Date.now() + attempts * 5 * 60_000).toISOString() }).eq("id", delivery.id);
    return attempts >= 3 ? "failed" : "queued";
  }
  const { error } = await admin.from("email_campaign_deliveries").update({ status: "sent", provider_message_id: result.id, sent_at: new Date().toISOString(), error: null }).eq("id", delivery.id);
  if (error) return "sending"; // retry will carry the same idempotency key
  const { error: replayError } = await admin.rpc("replay_resend_email_events", { p_organization_id: delivery.organization_id, p_provider_message_id: result.id });
  if (replayError) console.error("Could not replay early Resend webhook events", replayError.message);
  return "sent";
}

export async function processEmailDeliveryBatch(options: { limit?: number; organizationId?: string; campaignId?: string } = {}) {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  let recovery = admin.from("email_campaign_deliveries").update({ status: "queued", error: "Recovered an interrupted send; provider idempotency protects retries." }).eq("status", "sending").lt("updated_at", staleBefore);
  if (options.organizationId) recovery = recovery.eq("organization_id", options.organizationId);
  if (options.campaignId) recovery = recovery.eq("campaign_id", options.campaignId);
  const { error: recoveryError } = await recovery;
  if (recoveryError) throw new Error(`Could not recover interrupted deliveries: ${recoveryError.message}`);
  let campaignsQuery = admin.from("email_campaigns").select("id").eq("status", "scheduled").not("delivery_authorized_at", "is", null).limit(10000);
  if (options.organizationId) campaignsQuery = campaignsQuery.eq("organization_id", options.organizationId);
  if (options.campaignId) campaignsQuery = campaignsQuery.eq("id", options.campaignId);
  const { data: authorizedCampaigns, error: campaignError } = await campaignsQuery;
  if (campaignError) throw new Error(`Could not find authorized email campaigns: ${campaignError.message}`);
  const campaignIds = (authorizedCampaigns ?? []).map((campaign) => campaign.id);
  if (!campaignIds.length) return { processed: 0, sent: 0, failed: 0, pending: 0 };
  let query = admin.from("email_campaign_deliveries").select("id,organization_id,campaign_id,lead_id,attempts,unsubscribe_token_hash").eq("status", "queued").lte("next_attempt_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(Math.min(100, Math.max(1, options.limit ?? 50)));
  query = query.in("campaign_id", campaignIds);
  if (options.organizationId) query = query.eq("organization_id", options.organizationId);
  if (options.campaignId) query = query.eq("campaign_id", options.campaignId);
  const { data: raw, error } = await query;
  if (error) throw new Error(`Could not read queued email deliveries: ${error.message}`);
  const rows = (raw ?? []) as Delivery[];
  if (!rows.length) return { processed: 0, sent: 0, failed: 0, pending: 0 };
  publicOrigin();
  const [campaignResult, leadResult] = await Promise.all([
    admin.from("email_campaigns").select("id,organization_id,status,delivery_authorized_at,subject,preview_text,body,name").in("id", [...new Set(rows.map((row) => row.campaign_id))]),
    admin.from("leads").select("id,organization_id,email,name,marketing_consent,email_unsubscribed_at,email_suppressed_at").in("id", [...new Set(rows.map((row) => row.lead_id))]),
  ]);
  if (campaignResult.error || leadResult.error) throw new Error(campaignResult.error?.message ?? leadResult.error?.message ?? "Could not load email recipients.");
  const campaigns = new Map(((campaignResult.data ?? []) as Campaign[]).map((row) => [row.id, row]));
  const leads = new Map(((leadResult.data ?? []) as Lead[]).map((row) => [row.id, row]));
  const tokens = new Map<string,string>();
  const claimedRows = await Promise.all(rows.map(async (row) => {
    const claim = await admin.from("email_campaign_deliveries").update({ status: "sending", attempts: row.attempts + 1, error: null }).eq("id", row.id).eq("status", "queued").select("id").maybeSingle();
    if (!claim.data) return null;
    tokens.set(row.id, createUnsubscribeToken(row.organization_id, row.id, row.lead_id));
    return { ...row, attempts: row.attempts + 1 };
  }));
  const claimed = claimedRows.filter((row): row is Delivery => Boolean(row));
  let sent = 0; let failed = 0; let pending = 0;
  for (let index = 0; index < claimed.length; index += 4) {
    const outcomes = await Promise.all(claimed.slice(index, index + 4).map(async (delivery) => {
      const campaign = campaigns.get(delivery.campaign_id);
      const lead = leads.get(delivery.lead_id);
      if (!campaign || !lead || campaign.organization_id !== delivery.organization_id || lead.organization_id !== delivery.organization_id) {
        await admin.from("email_campaign_deliveries").update({ status: "cancelled", error: "Campaign or lead record is missing from this workspace." }).eq("id", delivery.id);
        return "cancelled";
      }
      if (campaign.status !== "scheduled" || !campaign.delivery_authorized_at) {
        await admin.from("email_campaign_deliveries").update({ status: "cancelled", error: "Campaign is no longer scheduled for delivery." }).eq("id", delivery.id);
        return "cancelled";
      }
      try {
        return await sendOne(delivery, campaign, lead, tokens);
      } catch (error) {
        console.error("Email delivery deferred", error instanceof Error ? error.message : "Delivery check failed.");
        await admin.from("email_campaign_deliveries").update({ status: "queued", attempts: Math.max(0, delivery.attempts - 1), next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(), error: "Delivery checks failed; retrying before sending." }).eq("id", delivery.id).eq("status", "sending");
        return "queued";
      }
    }));
    for (const outcome of outcomes) { if (outcome === "sent") sent++; else if (outcome === "failed") failed++; else if (outcome === "queued" || outcome === "sending") pending++; }
  }
  const claimedCampaignIds = [...new Set(claimed.map((row) => row.campaign_id))];
  for (const campaignId of claimedCampaignIds) {
    const { count, error: countError } = await admin.from("email_campaign_deliveries").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["queued", "sending"]);
    if (!countError && count === 0) await admin.from("email_campaigns").update({ status: "sent" }).eq("id", campaignId).eq("status", "scheduled");
  }
  return { processed: claimed.length, sent, failed, pending };
}
