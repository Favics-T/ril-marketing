"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, requireReviewer } from "@/lib/audience/access";
import { getWordPressConfig } from "@/lib/integrations/wordpress";
import { runWordPressConnectionTest } from "@/lib/integrations/wordpress-diagnostics";
import { getStrapiConfig, verifyStrapiConnection } from "@/lib/integrations/strapi";
import { syncPublication } from "@/lib/content/publishing";

const HUB = "/audience/landing-pages";
type Result = { ok: boolean; message?: string; error?: string; checks?: Array<{ label: string; status: string; detail: string }> };

export async function testWebsiteConnection(provider: string): Promise<Result> {
  try {
    const parsed = z.enum(["wordpress", "strapi"]).parse(provider);
    const org = await requireOrganizationId();
    const role = await getUserRole(org);
    if (!role || !["owner", "admin", "marketing_manager"].includes(role)) return { ok: false, error: "Ask a workspace owner, admin or marketing manager to test this connection." };
    if (parsed === "wordpress") {
      const config = await getWordPressConfig(org);
      if (!config) return { ok: false, error: "Connect WordPress in AI & Integrations first." };
      const result = await runWordPressConnectionTest({ ...config, seoPlugin: config.seoPlugin ?? "none" });
      return { ...result, message: result.ok ? "WordPress connection checks finished. Review any warnings below." : "WordPress needs attention. Review the checks below." };
    }
    const config = await getStrapiConfig(org);
    if (!config) return { ok: false, error: "Connect Strapi in AI & Integrations first." };
    await verifyStrapiConnection(config);
    return { ok: true, message: "Strapi is reachable and the saved token can read the article collection. Create permission is checked when you publish." };
  } catch (error) {
    return { ok: false, error: error instanceof z.ZodError ? "Choose WordPress or Strapi." : error instanceof Error ? error.message : "Connection check failed. Review the connection settings and try again." };
  }
}

export async function checkWebsiteDeliveries(): Promise<Result> {
  try {
    const org = await requireOrganizationId();
    await requireReviewer(org);
    const client = await createClient();
    const { data, error } = await client.from("publications").select("content_asset_id")
      .eq("organization_id", org).in("channel", ["wordpress", "strapi"])
      .in("status", ["queued", "scheduled", "missed"])
      .order("created_at").limit(50);
    if (error) return { ok: false, error: "Delivery records could not be loaded. Try again." };
    const assetIds = [...new Set((data ?? []).map(row => row.content_asset_id as string))];
    let checked = 0;
    let failed = 0;
    for (let i = 0; i < assetIds.length; i += 4) {
      const results = await Promise.allSettled(assetIds.slice(i, i + 4).map(id => syncPublication(org, id)));
      checked += results.filter(result => result.status === "fulfilled").length;
      failed += results.filter(result => result.status === "rejected").length;
    }
    for (const path of [HUB, "/library", "/library/[id]", "/calendar", "/dashboard", "/publishing"]) {
      if (path.includes("[id]")) revalidatePath(path, "page"); else revalidatePath(path);
    }
    return { ok: failed === 0, message: `${checked} ${checked === 1 ? "delivery" : "deliveries"} checked.${failed ? ` ${failed} could not be confirmed. Open the article’s delivery history before retrying.` : ""}${data?.length === 50 ? " Showing the first 50 pending records; run again after resolving them to check more." : ""}` };
  } catch {
    return { ok: false, error: "Deliveries could not be checked. Confirm your reviewer access and connections, then try again." };
  }
}

export async function saveWebsiteSeo(assetId: string, _previous: Result | null, form: FormData): Promise<Result> {
  try {
    const id = z.uuid().parse(assetId);
    const org = await requireOrganizationId();
    const client = await createClient();
    const { data: asset, error } = await client.from("content_assets").select("*")
      .eq("organization_id", org).eq("id", id).maybeSingle();
    if (error || !asset) return { ok: false, error: "Article not found in this workspace." };
    if (asset.channel !== "website" && asset.format !== "blog") return { ok: false, error: "Choose a website article." };
    if (!["idea", "ai_generated", "editing"].includes(asset.status)) return { ok: false, error: "Move the article back to Editing before changing its search metadata. It will need approval again." };
    const fields = z.object({ expected: z.string().min(1), title: z.string().trim().max(70), description: z.string().trim().max(320) })
      .parse({ expected: form.get("expected_updated_at"), title: form.get("seo_title") ?? "", description: form.get("seo_description") ?? "" });
    const metadata = asset.metadata ?? {};
    const value = metadata.seo;
    const seo = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const { data: saved, error: saveError } = await client.from("content_assets").update({ metadata: {
      ...metadata, seo: { ...seo, title: fields.title, description: fields.description, audit: null, appliedAt: null },
    } }).eq("organization_id", org).eq("id", id).eq("status", asset.status).eq("updated_at", fields.expected).select("id").maybeSingle();
    if (saveError || !saved) return { ok: false, error: "This article changed or could not be saved. Refresh before updating its search metadata." };
    for (const path of [HUB, "/library", `/library/${id}`, "/seo"]) revalidatePath(path);
    return { ok: true, message: "Search metadata saved. Submit the article for review when it is ready." };
  } catch (error) {
    return { ok: false, error: error instanceof z.ZodError ? "Refresh the article and check the search fields before saving." : "Search metadata could not be saved. Refresh and try again." };
  }
}
