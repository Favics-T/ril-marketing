"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { requireReviewer } from "@/lib/audience/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { futureSchedule } from "@/lib/content/scheduling";
import { processContentPublishingBatch } from "@/jobs/content-publishing";

export async function runPublishingChecks() {
  try {
    const org = await requireOrganizationId();
    await requireReviewer(org);
    const result = await processContentPublishingBatch(20, org);
    revalidatePath("/publishing");
    revalidatePath("/library");
    revalidatePath("/calendar");
    return {
      ok: result.failed + result.recurringFailed === 0,
      message: `${result.checked} deliveries checked; ${result.recurringPrepared} repeating drafts prepared.${result.failed + result.recurringFailed ? ` ${result.failed + result.recurringFailed} checks could not finish. Try again; existing records are retained.` : ""}`,
    };
  } catch {
    return {
      ok: false,
      message:
        "Publishing checks could not finish. Check your connections and try again.",
    };
  }
}

export async function createRecurringContent(
  assetId: string,
  _previous: unknown,
  form: FormData,
) {
  try {
    const org = await requireOrganizationId();
    await requireReviewer(org);
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("Sign in before setting up repeats.");
    const { data: asset } = await client
      .from("content_assets")
      .select("id,status,body")
      .eq("organization_id", org)
      .eq("id", z.uuid().parse(assetId))
      .maybeSingle();
    if (
      !asset ||
      !["approved", "published", "analysing"].includes(asset.status) ||
      !asset.body?.trim()
    )
      throw new Error(
        "Choose approved or published content with copy to repeat.",
      );
    const cadence = z
      .enum(["daily", "weekly", "monthly"])
      .parse(form.get("cadence"));
    const remaining = z.coerce
      .number()
      .int()
      .min(1)
      .max(52)
      .parse(form.get("count"));
    const next_due = futureSchedule(String(form.get("next_due") || ""));
    const { error } = await createAdminClient()
      .from("recurring_content")
      .insert({
        organization_id: org,
        content_asset_id: asset.id,
        created_by: user.id,
        cadence,
        remaining,
        next_due,
      });
    if (error)
      throw new Error(
        error.code === "23505"
          ? "This content already has an active repeating plan."
          : "Could not save this repeating plan.",
      );
    revalidatePath(`/library/${assetId}`);
    revalidatePath("/publishing");
    return {
      ok: true,
      message:
        "Repeats will create drafts up to seven days ahead. Each draft needs fresh human approval and a confirmed publishing time.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? "Check the repeat interval, date and count."
          : error instanceof Error
            ? error.message
            : "Could not save the plan.",
    };
  }
}
export async function pauseRecurringContent(ruleId: string) {
  const org = await requireOrganizationId();
  await requireReviewer(org);
  const { error } = await createAdminClient()
    .from("recurring_content")
    .update({ enabled: false })
    .eq("organization_id", org)
    .eq("id", z.uuid().parse(ruleId));
  if (error) throw new Error("Could not pause the plan.");
  revalidatePath("/publishing");
  revalidatePath("/library/[id]", "page");
}
export async function acknowledgePublishingAlert(id: string) {
  const org = await requireOrganizationId();
  await requireReviewer(org);
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { error } = await createAdminClient()
    .from("publishing_alerts")
    .update({
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("organization_id", org)
    .eq("id", z.uuid().parse(id));
  if (error) throw new Error("Could not acknowledge this alert.");
  revalidatePath("/publishing");
}
