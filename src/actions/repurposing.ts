"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { generateRepurposing, prepareSourceMaterial } from "@/lib/ai/provider";
import { getBrandGuidance } from "@/lib/brand/knowledge";
import {
  NEWSLETTER_STYLES,
  SOCIAL_PLATFORMS,
  type GenerationContext,
  type RepurposeKind,
} from "@/lib/ai/types";
import { extractRepurposingSource } from "@/lib/content/repurposing-extraction";
import {
  sourceInputSchema,
  type RepurposingSource,
} from "@/lib/content/repurposing-source";
import { publicResourceUrl } from "@/lib/integrations/public-resource";
import { getActivity } from "@/lib/content/activities";

function refresh(id: string) {
  revalidatePath("/repurpose");
  revalidatePath(`/repurpose/${id}`);
  revalidatePath("/library");
  revalidatePath("/publishing");
}
async function caller() {
  const org = await requireOrganizationId();
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Sign in before repurposing content.");
  return { org, client, user };
}
export async function createRepurposingSource(
  _previous: unknown,
  form: FormData,
) {
  try {
    const { org, client, user } = await caller();
    const parsed = sourceInputSchema.parse({
      title: form.get("title"),
      source_kind: form.get("source_kind"),
      activity_id: form.get("activity_id") || null,
      attachment_id: form.get("attachment_id") || null,
      source_url: form.get("source_url") || "",
      input_text: form.get("input_text") || "",
      requested_kinds: [...new Set(form.getAll("kinds"))],
      options: {
        newsletterStyle: form.get("newsletter_style") || "event_recap",
        tone: form.get("tone") || "",
        seoFocusKeyword: form.get("seo_keyword") || "",
        cta: form.get("cta") || "",
      },
    });
    if (
      parsed.options.newsletterStyle &&
      !NEWSLETTER_STYLES.includes(
        parsed.options.newsletterStyle as (typeof NEWSLETTER_STYLES)[number],
      )
    )
      throw new Error("Choose a supported newsletter style.");
    if (["activity", "attachment"].includes(parsed.source_kind)) {
      if (!parsed.activity_id) throw new Error("Choose a source activity.");
      const { data } = await client
        .from("activities")
        .select("id")
        .eq("organization_id", org)
        .eq("id", parsed.activity_id)
        .maybeSingle();
      if (!data) throw new Error("Choose an activity in this workspace.");
      if (parsed.source_kind === "attachment") {
        const { data: file } = await client
          .from("activity_attachments")
          .select("id")
          .eq("organization_id", org)
          .eq("activity_id", parsed.activity_id)
          .eq("id", parsed.attachment_id)
          .maybeSingle();
        if (!file) throw new Error("Choose a file belonging to this activity.");
      }
    }
    if (!["activity", "attachment"].includes(parsed.source_kind))
      parsed.activity_id = null;
    if (parsed.source_kind !== "attachment") parsed.attachment_id = null;
    if (parsed.source_kind === "url") publicResourceUrl(parsed.source_url);
    else parsed.source_url = "";
    if (
      ["summary", "transcript"].includes(parsed.source_kind) &&
      parsed.input_text.trim().length < 30
    )
      throw new Error("Supply at least 30 characters of source text.");
    const { data, error } = await createAdminClient()
      .from("repurposing_sources")
      .insert({
        ...parsed,
        source_url: parsed.source_url || null,
        organization_id: org,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data)
      throw new Error("Could not save this source. Try again.");
    refresh(data.id);
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? error.issues[0]?.message
          : error instanceof Error
            ? error.message
            : "Could not save the source.",
    };
  }
}
export async function saveSourceSummary(
  id: string,
  _previous: unknown,
  form: FormData,
) {
  try {
    const { org } = await caller();
    const summary = z
      .string()
      .trim()
      .min(30)
      .max(50000)
      .parse(form.get("manual_summary"));
    const admin = createAdminClient();
    const { data: source } = await admin
      .from("repurposing_sources")
      .select("revision,status,updated_at,processing_started_at")
      .eq("organization_id", org)
      .eq("id", z.uuid().parse(id))
      .maybeSingle();
    if (!source || source.updated_at !== form.get("expected_updated_at"))
      throw new Error("This source changed. Refresh before saving.");
    if (
      source.status === "processing" &&
      Date.parse(source.processing_started_at) > Date.now() - 10 * 60000
    )
      throw new Error(
        "A generation run is still in progress. Wait for it to finish.",
      );
    const { data, error } = await admin
      .from("repurposing_sources")
      .update({
        manual_summary: summary,
        analysis: {},
        status: "idea",
        error: null,
        completed_kinds: [],
        asset_ids: [],
        run_token: null,
        revision: source.revision + 1,
      })
      .eq("id", id)
      .eq("organization_id", org)
      .eq("updated_at", source.updated_at)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error("Could not save the summary. Refresh and try again.");
    refresh(id);
    return {
      ok: true,
      message:
        "Manual summary saved as a new source revision. Earlier generated drafts remain in the library.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? "Write at least 30 characters of summary."
          : error instanceof Error
            ? error.message
            : "Could not save the summary.",
    };
  }
}
export async function runRepurposing(id: string) {
  let org = "",
    token = "";
  try {
    const context = await caller();
    org = context.org;
    const admin = createAdminClient();
    const { data: source, error } = await admin
      .from("repurposing_sources")
      .select("*")
      .eq("organization_id", org)
      .eq("id", z.uuid().parse(id))
      .maybeSingle<
        RepurposingSource & { processing_started_at: string | null }
      >();
    if (error || !source)
      throw new Error("Source not found in this workspace.");
    if (source.status === "completed")
      return {
        ok: true,
        message:
          "This revision is already generated. Open its drafts below, or save a new summary revision.",
      };
    if (
      source.status === "processing" &&
      Date.parse(source.processing_started_at || "") > Date.now() - 10 * 60000
    )
      throw new Error("This source is already processing. Refresh shortly.");
    token = randomUUID();
    const { data: claimed, error: claimError } = await admin
      .from("repurposing_sources")
      .update({
        status: "processing",
        run_token: token,
        processing_started_at: new Date().toISOString(),
        error: null,
      })
      .eq("organization_id", org)
      .eq("id", id)
      .eq("updated_at", source.updated_at)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) {
      token = "";
      throw new Error(
        "Another run claimed this source. Refresh before trying again.",
      );
    }
    const analysis = source.analysis.summary
      ? (source.analysis as Awaited<
          ReturnType<typeof extractRepurposingSource>
        >)
      : await extractRepurposingSource(source);
    const { error: analysisError } = await admin
      .from("repurposing_sources")
      .update({ analysis })
      .eq("organization_id", org)
      .eq("id", id)
      .eq("run_token", token);
    if (analysisError)
      throw new Error(
        "The extracted source could not be saved. No drafts were released.",
      );
    const material = await prepareSourceMaterial(org, [
      {
        kind: source.manual_summary ? "notes" : "transcript",
        label: `${source.source_kind}: ${source.title}`,
        text: analysis.transcript || analysis.summary,
        timestamped: /(?:^|\n)\[?(?:\d{1,2}:)?\d{1,2}:\d{2}/.test(
          analysis.transcript,
        ),
      },
      ...(analysis.keyMoments.length
        ? [
            {
              kind: "key_moments" as const,
              label: "Source timestamps",
              text: analysis.keyMoments
                .map((moment) => `${moment.time}: ${moment.note}`)
                .join("\n"),
              timestamped: true,
            },
          ]
        : []),
    ]);
    const [{ data: organization }, brandGuidance] = await Promise.all([
      admin.from("organizations").select("name").eq("id", org).maybeSingle(),
      getBrandGuidance(org, source.title).catch(() => []),
    ]);
    const ctx: GenerationContext = {
      organizationName: organization?.name || "RIL",
      activityTitle: source.title,
      activityDescription: analysis.summary,
      outcomes: null,
      speakers: [],
      partners: [],
      eventDate: null,
      segmentName: null,
      topics: analysis.topics,
      formats: [],
      platforms: [...SOCIAL_PLATFORMS],
      hooks: [],
      ctas: analysis.callsToAction,
      brandGuidance,
      sourceMaterial: material.materials,
      options: source.options,
    };
    if (source.activity_id) {
      const activity = await getActivity(org, source.activity_id);
      if (!activity)
        throw new Error(
          "The source activity is no longer available in this workspace.",
        );
      Object.assign(ctx, {
        outcomes: activity.outcomes,
        speakers: activity.speakers,
        partners: activity.partners,
        eventDate: activity.event_date,
        segmentName: activity.segment?.name || null,
        registrationUrl: activity.registration_url,
      });
    }
    const kinds = source.requested_kinds.filter(
      (kind) => !source.completed_kinds.includes(kind),
    );
    const output = await generateRepurposing(org, kinds, ctx);
    const failed = new Set<RepurposeKind>(output.failedKinds);
    if (
      kinds.includes("social_pack") &&
      !SOCIAL_PLATFORMS.every((platform) =>
        output.drafts.some(
          (draft) => draft.kind === "social" && draft.platform === platform,
        ),
      )
    )
      failed.add("social_pack");
    const completed = kinds.filter((kind) => !failed.has(kind));
    const warning = [...material.notes, ...output.warnings];
    const problem = failed.size
      ? `Some formats could not be generated: ${[...failed].join(", ")}. Retry to fill the missing outputs; saved drafts are kept.`
      : null;
    const drafts = output.drafts.map((draft) => ({
      ...draft,
      metadata: {
        ...draft.metadata,
        source_duration_seconds: analysis.durationSeconds,
        source_quotes: analysis.quotes,
        source_statistics: analysis.statistics,
        source_snapshot: {
          title: source.title,
          revision: source.revision,
          summary: analysis.summary,
          transcript: analysis.transcript,
          manual: !!source.manual_summary,
        },
      },
    }));
    const { error: finishError } = await admin.rpc("finish_repurposing", {
      p_source: id,
      p_org: org,
      p_token: token,
      p_drafts: drafts,
      p_model: output.model,
      p_completed: completed,
      p_error: problem,
    });
    if (finishError)
      throw new Error(
        "Drafts could not be saved atomically. Your source and extraction are retained; retry safely.",
      );
    await admin
      .from("repurposing_sources")
      .update({ analysis: { ...analysis, warnings: warning } })
      .eq("organization_id", org)
      .eq("id", id)
      .is("run_token", null)
      .eq("revision", source.revision);
    token = "";
    refresh(id);
    return {
      ok: !problem,
      message:
        problem ||
        `${drafts.length} source-linked drafts saved for human review. ${warning.join(" ")}`,
      error: problem || undefined,
    };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "This source address is invalid. Open it again from Repurpose content."
        : error instanceof Error
          ? error.message
          : "Source processing failed. Retry or add a manual summary.";
    if (org && token)
      await createAdminClient()
        .from("repurposing_sources")
        .update({
          status: "idea",
          error: message.slice(0, 1200),
          run_token: null,
        })
        .eq("organization_id", org)
        .eq("id", id)
        .eq("run_token", token);
    if (id) refresh(id);
    return { ok: false, error: message };
  }
}
