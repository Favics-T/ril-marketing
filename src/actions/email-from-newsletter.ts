"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { getUserRole } from "@/lib/audience/access";
import { CUSTOM_SUBJECT_CHOICE, EMAIL_LIMITS, isApprovedNewsletter, isEmailAuthorRole, newsletterToEmailDraft, type NewsletterSource } from "@/lib/email/from-newsletter";

export interface EmailDraftActionResult { ok: boolean; error?: string; message?: string; }

const ROLE_ERROR = "Creating and editing email campaigns requires an owner, admin or marketing manager role.";

/**
 * Creates a draft email campaign from an approved newsletter, or opens the one
 * already made from it. Nothing is sent: the draft goes through the normal
 * email review, approval and queue steps.
 */
export async function createEmailFromNewsletter(assetId: string): Promise<EmailDraftActionResult> {
  let target: string;
  try {
    const organizationId = await requireOrganizationId();
    if (!isEmailAuthorRole(await getUserRole(organizationId))) return { ok: false, error: ROLE_ERROR };
    if (!z.string().uuid().safeParse(assetId).success) return { ok: false, error: "Choose a valid newsletter." };
    const supabase = await createClient();
    const { data: asset, error: assetError } = await supabase.from("content_assets")
      .select("id,title,body,format,status,metadata,audience_segment_id,campaign_id")
      .eq("organization_id", organizationId).eq("id", assetId).maybeSingle<NewsletterSource & { id: string }>();
    if (assetError) return { ok: false, error: `Could not load the newsletter: ${assetError.message}` };
    if (!asset) return { ok: false, error: "Newsletter not found." };
    if (!isApprovedNewsletter(asset)) return { ok: false, error: "Only an approved newsletter can become an email campaign." };

    const { data: existing, error: existingError } = await supabase.from("email_campaigns").select("id")
      .eq("organization_id", organizationId).contains("metadata", { source_content_asset_id: asset.id })
      .order("created_at", { ascending: true }).limit(1);
    if (existingError) return { ok: false, error: `Could not check for an existing email: ${existingError.message}` };

    if (existing?.[0]) {
      target = existing[0].id;
    } else {
      const mapped = newsletterToEmailDraft(asset);
      if (!mapped.ok) return { ok: false, error: mapped.error };
      const { draft } = mapped;
      // Only keep links that still resolve inside this workspace.
      const [segment, campaign] = await Promise.all([
        draft.audienceSegmentId ? supabase.from("audience_segments").select("id").eq("organization_id", organizationId).eq("id", draft.audienceSegmentId).maybeSingle() : Promise.resolve({ data: null }),
        draft.campaignId ? supabase.from("campaigns").select("id").eq("organization_id", organizationId).eq("id", draft.campaignId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error } = await supabase.from("email_campaigns").insert({
        organization_id: organizationId,
        campaign_id: campaign.data ? draft.campaignId : null,
        audience_segment_id: segment.data ? draft.audienceSegmentId : null,
        name: draft.name,
        subject: draft.subject,
        preview_text: draft.previewText,
        body: draft.body,
        status: "draft",
        created_by: user?.id ?? null,
        metadata: { source: "newsletter", source_content_asset_id: asset.id, subject_options: draft.subjectOptions },
      }).select("id").single<{ id: string }>();
      if (error || !created) return { ok: false, error: error?.message ?? "Could not create the email draft." };
      target = created.id;
    }
    revalidatePath("/email");
    revalidatePath(`/library/${asset.id}`);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the email draft." };
  }
  redirect(`/email/${target}`);
}

const draftSchema = z.object({
  subject: z.string().trim().min(EMAIL_LIMITS.subjectMin, "Choose or write a subject line.").max(EMAIL_LIMITS.subject),
  preview_text: z.string().trim().max(EMAIL_LIMITS.previewText),
  body: z.string().trim().min(EMAIL_LIMITS.bodyMin, "Add the email copy.").max(EMAIL_LIMITS.body),
  audience_segment_id: z.union([z.string().uuid(), z.literal("")]),
});

/** Edits the copy and audience of a draft email campaign. Drafts only. */
export async function updateEmailDraft(emailId: string, _previous: EmailDraftActionResult | null, formData: FormData): Promise<EmailDraftActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    if (!isEmailAuthorRole(await getUserRole(organizationId))) return { ok: false, error: ROLE_ERROR };
    if (!z.string().uuid().safeParse(emailId).success) return { ok: false, error: "Choose a valid email campaign." };
    const choice = String(formData.get("subject_choice") ?? "");
    const parsed = draftSchema.safeParse({
      subject: choice === CUSTOM_SUBJECT_CHOICE ? formData.get("subject_custom") ?? "" : choice,
      preview_text: formData.get("preview_text") ?? "",
      body: formData.get("body") ?? "",
      audience_segment_id: formData.get("audience_segment_id") ?? "",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the email details." };
    const supabase = await createClient();
    const { data: email } = await supabase.from("email_campaigns").select("id,status")
      .eq("organization_id", organizationId).eq("id", emailId).maybeSingle<{ id: string; status: string }>();
    if (!email) return { ok: false, error: "Email campaign not found." };
    if (email.status !== "draft") return { ok: false, error: "Only a draft email can be edited." };
    if (parsed.data.audience_segment_id) {
      const { data: segment } = await supabase.from("audience_segments").select("id")
        .eq("organization_id", organizationId).eq("id", parsed.data.audience_segment_id).maybeSingle();
      if (!segment) return { ok: false, error: "Choose an audience segment from this workspace." };
    }
    const { data: updated, error } = await supabase.from("email_campaigns").update({
      subject: parsed.data.subject,
      preview_text: parsed.data.preview_text,
      body: parsed.data.body,
      audience_segment_id: parsed.data.audience_segment_id || null,
    }).eq("organization_id", organizationId).eq("id", emailId).eq("status", "draft").select("id").maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!updated) return { ok: false, error: "This email left draft while you were editing. Reload to see its status." };
    revalidatePath("/email");
    revalidatePath(`/email/${emailId}`);
    return { ok: true, message: "Draft saved." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the email draft." };
  }
}
