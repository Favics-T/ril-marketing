"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, requireReviewer } from "@/lib/audience/access";
import { createMarketingReport } from "@/lib/reports/generate";

const inputSchema = z.object({
  period_type: z.enum(["weekly", "monthly", "custom"]),
  period_start: z.string().date(),
  period_end: z.string().date(),
}).refine((value) => value.period_end >= value.period_start, { message: "End date must be on or after the start date." });

export async function generateMarketingReport(formData: FormData): Promise<void> {
  const organizationId = await requireOrganizationId();
  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Choose a valid reporting period.");
  const { data: { user } } = await createClient().then((client) => client.auth.getUser());
  await createMarketingReport(organizationId, parsed.data.period_type, parsed.data.period_start, parsed.data.period_end, user?.id ?? null);
  revalidatePath("/reports");
  redirect("/reports");
}

export async function createReportDraft(_previous: { ok?: boolean; error?: string } | null, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a valid reporting period." };
  try {
    const organizationId = await requireOrganizationId();
    const { data: { user } } = await createClient().then(client => client.auth.getUser());
    await createMarketingReport(organizationId, parsed.data.period_type, parsed.data.period_start, parsed.data.period_end, user?.id ?? null);
  } catch {
    return { error: "Could not create the report. Check that you are signed in, then try again. Your existing reports are unchanged." };
  }
  revalidatePath("/reports");
  return { ok: true };
}

export async function saveReportSchedule(formData: FormData): Promise<void> {
  const organizationId = await requireOrganizationId();
  const role = await getUserRole(organizationId);
  if (!role || !["owner", "admin", "marketing_manager"].includes(role)) {
    throw new Error("Report schedules require an owner, admin or marketing manager.");
  }
  const frequency = z.enum(["disabled", "weekly", "monthly"]).parse(formData.get("frequency"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("report_schedule_settings").upsert({
    organization_id: organizationId,
    frequency: frequency === "disabled" ? null : frequency,
    updated_by: user?.id ?? null,
  }, { onConflict: "organization_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
}

export async function markReportReviewed(formData: FormData): Promise<void> {
  const organizationId = await requireOrganizationId();
  await requireReviewer(organizationId);
  const id = z.string().uuid().parse(formData.get("id"));
  const { data: { user } } = await createClient().then((client) => client.auth.getUser());
  if (!user) throw new Error("Sign in to review this report.");
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_reports").update({ status: "reviewed", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", id).eq("status", "draft");
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
}
