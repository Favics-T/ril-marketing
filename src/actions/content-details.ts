"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { socialPostSchema } from "@/lib/content/social-media";
import { z } from "zod";

export async function saveContentDetails(
  assetId: string,
  _previous: unknown,
  form: FormData,
) {
  try {
    const org = await requireOrganizationId();
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("Sign in to edit this draft.");
    const { data: asset, error } = await client
      .from("content_assets")
      .select("id,status,metadata,updated_at")
      .eq("organization_id", org)
      .eq("id", z.uuid().parse(assetId))
      .maybeSingle();
    if (
      error ||
      !asset ||
      !["idea", "ai_generated", "editing"].includes(asset.status)
    )
      throw new Error(
        "Return this content to Editing before changing its media or clip instructions.",
      );
    if (asset.updated_at !== form.get("expected_updated_at"))
      throw new Error("This draft changed. Refresh before saving.");
    const field = form.get("detail_kind");
    let value: unknown;
    let content: Record<string, unknown> = {};
    if (field === "social_post") {
      const urls = String(form.get("media_urls") ?? "")
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean);
      value = socialPostSchema.parse({
        media: urls.map((url) => ({
          type: form.get("media_type") || "image",
          url,
          alt: String(form.get("media_alt") ?? ""),
        })),
        postType: form.get("post_type") || "post",
        videoTitle: form.get("video_title") || "",
        youtubeCategory: form.get("youtube_category") || "27",
        madeForKids: form.get("made_for_kids") === "on",
      });
    } else if (field === "clip_edit") {
      const time = z.string().regex(/^(?:\d{1,2}:)?[0-5]?\d:[0-5]\d$/);
      const clip = z
        .object({
          start: time,
          end: time,
          caption: z.string().trim().min(1).max(2200),
          platform: z.enum(["instagram", "tiktok", "youtube", "linkedin", "x"]),
        })
        .parse({
          start: form.get("clip_start"),
          end: form.get("clip_end"),
          caption: form.get("clip_caption"),
          platform: form.get("clip_platform"),
        });
      const seconds = (v: string) =>
        v.split(":").reduce((n, s) => n * 60 + Number(s), 0);
      if (seconds(clip.end) <= seconds(clip.start))
        throw new Error("The clip end must be after its start.");
      const duration = asset.metadata?.source_duration_seconds;
      if (typeof duration === "number" && seconds(clip.end) > duration)
        throw new Error(
          "The clip end exceeds the source recording’s duration.",
        );
      value = clip;
      const original = asset.metadata?.clip as
        | { hook?: string; objective?: string; reason?: string }
        | undefined;
      content = {
        platform: clip.platform,
        channel: clip.platform,
        body: [
          `Clip: ${clip.start}–${clip.end}`,
          original?.hook ? `Hook: ${original.hook}` : null,
          `Caption:\n${clip.caption}`,
          original?.objective ? `Objective: ${original.objective}` : null,
          original?.reason ? `Why this clip: ${original.reason}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      };
    } else throw new Error("Choose the details to save.");
    const { data: saved, error: saveError } = await client
      .from("content_assets")
      .update({ ...content, metadata: { ...asset.metadata, [field]: value } })
      .eq("organization_id", org)
      .eq("id", asset.id)
      .eq("updated_at", asset.updated_at)
      .in("status", ["idea", "ai_generated", "editing"])
      .select("id")
      .maybeSingle();
    if (saveError || !saved)
      throw new Error(
        "This draft changed or its details could not be saved. Refresh and try again.",
      );
    revalidatePath(`/library/${assetId}`);
    revalidatePath("/publishing");
    return {
      ok: true,
      message:
        "Details saved. This revision needs human review before publishing.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? error.issues[0]?.message
          : error instanceof Error
            ? error.message
            : "Could not save these details.",
    };
  }
}
