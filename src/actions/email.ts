"use server";

import { publicAppOrigin } from "@/lib/integrations/public-app-origin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { requireReviewer } from "@/lib/audience/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { getResendConfig } from "@/lib/integrations/resend";
import { createUnsubscribeToken, hashUnsubscribeToken } from "@/lib/email/tokens";
import { applyActiveConsentFilter } from "@/lib/email/consent";
import { processEmailDeliveryBatch } from "@/jobs/email-delivery";

const schema = z.object({
  name: z.string().trim().min(3).max(160),
  subject: z.string().trim().min(2).max(200),
  preview_text: z.string().trim().max(240).default(""),
  body: z.string().trim().min(10).max(12000),
  campaign_id: z.union([z.string().uuid(), z.literal("")]).default(""),
  audience_segment_id: z.union([z.string().uuid(), z.literal("")]).default(""),
});

export async function createEmailCampaign(formData: FormData): Promise<void> {
  const organizationId = await requireOrganizationId();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the email details.");
  const supabase = await createClient();
  const [campaign, segment] = await Promise.all([
    parsed.data.campaign_id ? supabase.from("campaigns").select("id").eq("organization_id", organizationId).eq("id", parsed.data.campaign_id).maybeSingle() : Promise.resolve({ data: true }),
    parsed.data.audience_segment_id ? supabase.from("audience_segments").select("id").eq("organization_id", organizationId).eq("id", parsed.data.audience_segment_id).maybeSingle() : Promise.resolve({ data: true }),
  ]);
  if (!campaign.data || !segment.data) throw new Error("Choose a campaign and audience segment from this workspace.");
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("email_campaigns").insert({
    organization_id: organizationId,
    campaign_id: parsed.data.campaign_id || null,
    audience_segment_id: parsed.data.audience_segment_id || null,
    name: parsed.data.name,
    subject: parsed.data.subject,
    preview_text: parsed.data.preview_text,
    body: parsed.data.body,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/email");
  redirect("/email");
}

export async function transitionEmailCampaign(formData: FormData): Promise<void> {
  const organizationId = await requireOrganizationId();
  const id = z.string().uuid().parse(formData.get("id"));
  const to = z.enum(["review", "approved", "paused", "scheduled"]).parse(formData.get("to"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: item, error: fetchError } = await supabase.from("email_campaigns")
    .select("id,status,created_by").eq("organization_id", organizationId).eq("id", id).maybeSingle<{id:string;status:string;created_by:string|null}>();
  if (fetchError || !item) throw new Error("Email campaign not found.");
  const allowed = to === "review" ? item.status === "draft" : to === "approved" ? item.status === "review" : to === "scheduled" ? item.status === "paused" : ["draft", "review", "approved", "scheduled"].includes(item.status);
  if (!allowed) throw new Error("That email campaign can’t make this status change.");
  const patch: Record<string, string | null> = { status: to };
  if (to === "approved") {
    await requireReviewer(organizationId);
    if (!user?.id || item.created_by === user.id) throw new Error("A different workspace reviewer must approve this email.");
    patch.approved_by = user.id;
  }
  if (to === "paused" || to === "scheduled") await requireReviewer(organizationId);
  const { error } = await supabase.from("email_campaigns").update(patch).eq("organization_id", organizationId).eq("id", id);
  if (error) throw new Error(error.message);
  if (to === "paused") await (await createAdminClient()).from("email_campaign_deliveries").update({ error: "Campaign paused by a workspace reviewer." }).eq("organization_id", organizationId).eq("campaign_id", id).in("status", ["queued", "sending"]);
  if (to === "scheduled") await (await createAdminClient()).from("email_campaign_deliveries").update({ error: null, next_attempt_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("campaign_id", id).eq("status", "queued");
  revalidatePath("/email");
}

export interface EmailDeliveryActionResult { ok: boolean; error?: string; message?: string; }

function configuredSiteOrigin(): string | null {
  return publicAppOrigin(process.env.NEXT_PUBLIC_SITE_URL);
}

export async function queueEmailCampaign(campaignId: string): Promise<EmailDeliveryActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireReviewer(organizationId);
    if (!configuredSiteOrigin()) return { ok: false, error: "Set NEXT_PUBLIC_SITE_URL to the public HTTPS application URL before queuing email." };
    const ids = z.string().uuid().safeParse(campaignId);
    if (!ids.success) return { ok: false, error: "Choose a valid email campaign." };
    const supabase = await createClient();
    const { data: campaign } = await supabase.from("email_campaigns").select("id,status,audience_segment_id,created_by").eq("organization_id", organizationId).eq("id", campaignId).maybeSingle<{id:string;status:string;audience_segment_id:string|null;created_by:string|null}>();
    if (!campaign) return { ok: false, error: "Email campaign not found." };
    if (campaign.status !== "approved") return { ok: false, error: "Only a separately approved email campaign can be queued." };
    const provider = await getResendConfig(organizationId);
    if (!provider) return { ok: false, error: "Connect Resend with a verified sender before queuing this campaign." };
    if (!provider.webhookSecret) return { ok: false, error: "Add the Resend webhook signing secret before queuing, so delivery, bounce and engagement events can be verified." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || user.id === campaign.created_by) {
      return { ok: false, error: "A different workspace reviewer must queue the approved campaign." };
    }
    const recipients: Array<{ id:string; email:string }> = [];
    const seen = new Set<string>();
    for (let start = 0; start < 10000; start += 500) {
      let query = applyActiveConsentFilter(
        supabase.from("leads").select("id,email", { count: start === 0 ? "exact" : undefined }).eq("organization_id", organizationId)
      ).order("created_at", { ascending: true }).range(start, start + 499);
      if (campaign.audience_segment_id) query = query.eq("audience_segment_id", campaign.audience_segment_id);
      const { data, error, count } = await query;
      if (error) return { ok: false, error: `Could not load opted-in recipients: ${error.message}` };
      if (start === 0 && (count ?? 0) > 10000) return { ok: false, error: "This campaign exceeds the 10,000-recipient workspace limit. Narrow the audience segment before queuing." };
      for (const lead of data ?? []) {
        const email = (lead.email ?? "").trim();
        const key = email.toLowerCase();
        if (email && !seen.has(key)) { seen.add(key); recipients.push({ id: lead.id, email }); }
      }
      if ((data?.length ?? 0) < 500) break;
    }
    if (!recipients.length) return { ok: false, error: "No opted-in, unsuppressed recipients have an email address in this audience." };
    const admin = createAdminClient();
    let inserted = 0;
    for (let start = 0; start < recipients.length; start += 400) {
      const rows = recipients.slice(start, start + 400).map((lead) => {
        const id = randomUUID();
        return { id, organization_id: organizationId, campaign_id: campaignId, lead_id: lead.id, status: "queued", unsubscribe_token_hash: hashUnsubscribeToken(createUnsubscribeToken(organizationId, id, lead.id)) };
      });
      const { data, error } = await admin.from("email_campaign_deliveries").upsert(rows, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true }).select("id");
      if (error) return { ok: false, error: `Could not queue the audience: ${error.message}` };
      inserted += data?.length ?? 0;
    }
    const { data: scheduled, error: statusError } = await supabase.from("email_campaigns").update({ status: "scheduled" }).eq("organization_id", organizationId).eq("id", campaignId).eq("status", "approved").select("id").maybeSingle();
    if (statusError) return { ok: false, error: statusError.message };
    if (!scheduled) {
      const { data: current } = await supabase.from("email_campaigns").select("status").eq("organization_id", organizationId).eq("id", campaignId).maybeSingle<{status:string}>();
      if (current?.status !== "scheduled") return { ok: false, error: "Campaign changed while its audience was being queued. Review its current status." };
    }
    const { count } = await admin.from("email_campaign_deliveries").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("campaign_id", campaignId).in("status", ["queued", "sending", "sent", "delivered", "opened", "clicked"]);
    revalidatePath("/email");
    return { ok: true, message: `${inserted} new delivery records queued. ${count ?? recipients.length} delivery records exist; delivery starts only when a reviewer explicitly sends a batch.` };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not queue this email campaign." }; }
}

export async function sendEmailCampaignBatch(campaignId: string): Promise<EmailDeliveryActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireReviewer(organizationId);
    const id = z.string().uuid().safeParse(campaignId);
    if (!id.success) return { ok: false, error: "Choose a valid campaign." };
    const supabase = await createClient();
    const { data: campaign } = await supabase.from("email_campaigns").select("status").eq("organization_id", organizationId).eq("id", campaignId).maybeSingle<{status:string}>();
    if (campaign?.status !== "scheduled") return { ok: false, error: "Campaign must be scheduled and not paused before delivery." };
    const { data: authorized, error: authorizationError } = await supabase.from("email_campaigns").update({ delivery_authorized_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", campaignId).eq("status", "scheduled").select("id").maybeSingle();
    if (authorizationError || !authorized) return { ok: false, error: authorizationError?.message ?? "Campaign changed before it could be authorized for delivery." };
    const result = await processEmailDeliveryBatch({ organizationId, campaignId, limit: 20 });
    revalidatePath("/email");
    return { ok: true, message: `Batch complete: ${result.sent} sent, ${result.failed} failed, ${result.pending} retrying. ${result.processed} processed in this batch.` };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not send the next batch." }; }
}
