"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { requireReviewer } from "@/lib/audience/access";
import { LANDING_PAGE_COPY_MAX, publicLandingPagePath } from "@/lib/landing-page-url";

export interface LandingPageActionResult { ok: boolean; id?: string; error?: string; }

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pageSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(80).regex(slugPattern, "Use a lowercase URL slug with letters, numbers, and hyphens."),
  headline: z.string().trim().min(5).max(200),
  // Markdown from the rich editor; the limit includes formatting characters.
  body: z.string().trim().max(LANDING_PAGE_COPY_MAX, "Page copy is too long. Shorten it before saving.").default(""),
  cta_label: z.string().trim().min(2).max(60),
  registration_url: z.union([z.string().trim().url().max(1000), z.literal("")]),
  meta_description: z.string().trim().max(320).default(""),
  campaign_id: z.string().uuid().nullable().optional(),
  activity_id: z.string().uuid().nullable().optional(),
  audience_segment_id: z.string().uuid().nullable().optional(),
});

function readForm(formData: FormData) {
  return pageSchema.safeParse({
    title: formData.get("title"), slug: formData.get("slug"), headline: formData.get("headline"),
    body: formData.get("body") ?? "", cta_label: formData.get("cta_label"),
    registration_url: formData.get("registration_url") ?? "", meta_description: formData.get("meta_description") ?? "",
    campaign_id: formData.get("campaign_id") || null, activity_id: formData.get("activity_id") || null,
    audience_segment_id: formData.get("audience_segment_id") || null,
  });
}

async function validateRelatedRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  data: z.infer<typeof pageSchema>
) {
  const checks = [
    data.campaign_id ? supabase.from("campaigns").select("id").eq("organization_id", organizationId).eq("id", data.campaign_id).maybeSingle() : Promise.resolve({ data: true }),
    data.activity_id ? supabase.from("activities").select("id").eq("organization_id", organizationId).eq("id", data.activity_id).maybeSingle() : Promise.resolve({ data: true }),
    data.audience_segment_id ? supabase.from("audience_segments").select("id").eq("organization_id", organizationId).eq("id", data.audience_segment_id).maybeSingle() : Promise.resolve({ data: true }),
  ];
  const records = await Promise.all(checks);
  return records.every((record) => Boolean(record.data));
}

export async function createLandingPage(
  _previous: LandingPageActionResult | null,
  formData: FormData
): Promise<LandingPageActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireReviewer(organizationId);
    const parsed = readForm(formData);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the page details." };
    const supabase = await createClient();
    if (!(await validateRelatedRecords(supabase, organizationId, parsed.data))) return { ok: false, error: "Choose an activity, campaign, or segment in your workspace." };
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("landing_pages").insert({
      organization_id: organizationId,
      ...parsed.data,
      registration_url: parsed.data.registration_url || null,
      created_by: user?.id ?? null,
      status: "draft",
    }).select("id").single<{ id: string }>();
    if (error || !data) return { ok: false, error: error?.code === "23505" ? "That URL slug is already in use." : error?.message ?? "Could not create page." };
    revalidatePath("/audience/landing-pages");
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create page." };
  }
}

export async function updateLandingPage(
  pageId: string,
  _previous: LandingPageActionResult | null,
  formData: FormData
): Promise<LandingPageActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireReviewer(organizationId);
    const parsedId = z.string().uuid().safeParse(pageId);
    const parsed = readForm(formData);
    if (!parsedId.success || !parsed.success) return { ok: false, error: parsed.success ? "Invalid page." : parsed.error.issues[0]?.message ?? "Check the page details." };
    const supabase = await createClient();
    if (!(await validateRelatedRecords(supabase, organizationId, parsed.data))) return { ok: false, error: "Choose an activity, campaign, or segment in your workspace." };
    const { data: existing } = await supabase.from("landing_pages").select("status").eq("organization_id", organizationId).eq("id", pageId).maybeSingle<{ status: string }>();
    if (!existing) return { ok: false, error: "Page not found." };
    if (existing.status !== "draft") return { ok: false, error: "Return this page to Draft before editing it." };
    const { error } = await supabase.from("landing_pages").update({ ...parsed.data, registration_url: parsed.data.registration_url || null }).eq("organization_id", organizationId).eq("id", pageId);
    if (error) return { ok: false, error: error.code === "23505" ? "That URL slug is already in use." : error.message };
    revalidatePath("/audience/landing-pages");
    revalidatePath(`/audience/landing-pages/${pageId}`);
    revalidatePath(publicLandingPagePath({ id: pageId, slug: parsed.data.slug }));
    return { ok: true, id: pageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update page." };
  }
}

export async function setLandingPageStatus(
  pageId: string,
  nextStatus: "review" | "draft" | "approved" | "published" | "paused"
): Promise<LandingPageActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    const role = await requireReviewer(organizationId);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in again to continue." };
    const { data: page } = await supabase.from("landing_pages").select("status, created_by, approved_by, slug, title, headline, cta_label").eq("organization_id", organizationId).eq("id", pageId).maybeSingle<{ status: string; created_by: string | null; approved_by: string | null; slug: string; title: string; headline: string; cta_label: string }>();
    if (!page) return { ok: false, error: "Page not found." };
    const allowed: Record<string, string[]> = { draft: ["review"], review: ["draft", "approved"], approved: ["review", "published"], published: ["paused"], paused: ["published", "draft"] };
    if (!allowed[page.status]?.includes(nextStatus)) return { ok: false, error: `Page cannot move from ${page.status} to ${nextStatus}.` };
    if (nextStatus === "approved" && user.id === page.created_by) return { ok: false, error: "A different reviewer must approve the page." };
    if (nextStatus === "published") {
      if (!["owner", "admin", "leadership"].includes(role)) return { ok: false, error: "Publishing a public landing page requires owner, admin or leadership approval." };
      if (!page.approved_by || user.id === page.approved_by) return { ok: false, error: "A different owner, admin or leader must publish after approval." };
      if (!page.title.trim() || !page.headline.trim() || !page.cta_label.trim()) return { ok: false, error: "Complete the title, headline and call to action before publishing." };
    }
    const patch: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "approved") patch.approved_by = user.id;
    if (nextStatus === "published") patch.published_by = user.id;
    if (nextStatus === "draft") patch.approved_by = null;
    const { error } = await supabase.from("landing_pages").update(patch).eq("organization_id", organizationId).eq("id", pageId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/audience/landing-pages");
    revalidatePath(`/audience/landing-pages/${pageId}`);
    revalidatePath(publicLandingPagePath({ id: pageId, slug: page.slug }));
    return { ok: true, id: pageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update page status." };
  }
}
