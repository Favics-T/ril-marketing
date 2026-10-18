"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { getUserRole, requireReviewer } from "@/lib/audience/access";
import { decryptSecret, encryptSecret, isEncryptionEnabled } from "@/lib/crypto/secret-box";
import { claimPublication, saveDelivery, noteUncertainDelivery } from "@/lib/content/publishing";
import { getStrapiConfig, publishStrapiEntry, sanitizeCollection, validateStrapiUrl, verifyStrapiConnection, type StrapiConfig } from "@/lib/integrations/strapi";

type ActionResult = { ok: boolean; message?: string; warning?: string; error?: string; url?: string };

async function requireCmsManager(organizationId: string) {
  const role = await getUserRole(organizationId);
  if (!role || !["owner", "admin", "marketing_manager"].includes(role)) throw new Error("CMS settings require an owner, admin or marketing manager.");
}

const fieldName = z.string().trim().max(80).refine((v) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(v), "Field names use letters, numbers and underscores, and start with a letter.");
// SEO fields often live in a component, so `seo.metaTitle` is allowed as well as a plain field name.
const seoFieldPath = z.string().trim().max(80).refine((v) => v === "" || /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/.test(v), "SEO fields use a field name, or a component and field such as seo.metaTitle.").default("");
const settingsSchema = z.object({
  baseUrl: z.string().trim().url().max(500),
  apiToken: z.string().trim().max(500).default(""),
  collection: z.string().trim().min(1).max(120),
  titleField: fieldName,
  bodyField: fieldName,
  slugField: fieldName,
  excerptField: z.string().trim().max(80).refine((v) => v === "" || /^[a-zA-Z][a-zA-Z0-9_]*$/.test(v), "Field names use letters, numbers and underscores, and start with a letter.").default(""),
  seoTitleField: seoFieldPath,
  seoDescriptionField: seoFieldPath,
});

export async function saveStrapiConnection(formData: FormData): Promise<ActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireCmsManager(organizationId);
    if (!isEncryptionEnabled()) return { ok: false, error: "Set AI_CONFIG_SECRET before storing a Strapi API token." };
    const parsed = settingsSchema.safeParse({
      baseUrl: formData.get("baseUrl"),
      apiToken: formData.get("apiToken") ?? "",
      collection: formData.get("collection"),
      titleField: formData.get("titleField"),
      bodyField: formData.get("bodyField"),
      slugField: formData.get("slugField"),
      excerptField: formData.get("excerptField") ?? "",
      seoTitleField: formData.get("seoTitleField") ?? "",
      seoDescriptionField: formData.get("seoDescriptionField") ?? "",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the Strapi settings." };

    let baseUrl: string;
    try { baseUrl = validateStrapiUrl(parsed.data.baseUrl); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Enter a public HTTPS Strapi URL." }; }
    let collection: string;
    try { collection = sanitizeCollection(parsed.data.collection); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Enter the collection API ID." }; }

    const admin = createAdminClient();
    const { data: current } = await admin.from("integrations").select("config").eq("organization_id", organizationId).eq("key", "cms_strapi").maybeSingle<{ config: Record<string, string> }>();
    const apiToken = parsed.data.apiToken.trim() || decryptSecret(current?.config.apiToken ?? "");
    if (!apiToken) return { ok: false, error: "Paste the Strapi API token with find and create permission for this collection." };

    const config: StrapiConfig = { baseUrl, apiToken, collection, slugField: parsed.data.slugField, titleField: parsed.data.titleField, bodyField: parsed.data.bodyField, excerptField: parsed.data.excerptField, seoTitleField: parsed.data.seoTitleField, seoDescriptionField: parsed.data.seoDescriptionField };
    await verifyStrapiConnection(config);
    const { error } = await admin.from("integrations").upsert({
      organization_id: organizationId,
      key: "cms_strapi",
      display_name: "Strapi publishing",
      status: "connected",
      config: { baseUrl, collection, slugField: config.slugField, titleField: config.titleField, bodyField: config.bodyField, excerptField: config.excerptField, seoTitleField: config.seoTitleField, seoDescriptionField: config.seoDescriptionField, apiToken: encryptSecret(apiToken) },
    }, { onConflict: "organization_id,key" });
    if (error) return { ok: false, error: "Could not save the verified Strapi connection." };
    revalidatePath("/settings/ai");
    return { ok: true, message: `Connected to the “${collection}” collection.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not connect Strapi." };
  }
}

export async function disconnectStrapi(): Promise<ActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireCmsManager(organizationId);
    const admin = createAdminClient();
    const { error } = await admin.from("integrations").update({ status: "not_connected", config: {} }).eq("organization_id", organizationId).eq("key", "cms_strapi");
    if (error) return { ok: false, error: "Could not disconnect Strapi." };
    revalidatePath("/settings/ai");
    return { ok: true, message: "Strapi disconnected." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not disconnect Strapi." }; }
}

export async function publishApprovedToStrapi(assetId: string): Promise<ActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireReviewer(organizationId);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in before publishing." };
    const { data: asset, error: assetError } = await supabase.from("content_assets").select("id,title,body,format,channel,status,metadata,updated_at").eq("organization_id", organizationId).eq("id", assetId).maybeSingle();
    if (assetError || !asset) return { ok: false, error: "Content asset not found." };
    if (asset.status !== "approved") return { ok: false, error: "Only approved content can be published to Strapi." };
    if (asset.format !== "blog" && asset.channel !== "website") return { ok: false, error: "Strapi publishing is only available for blog and website content." };
    if (!asset.body?.trim()) return { ok: false, error: "Add the article body before publishing." };
    const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
    const existingLink = typeof metadata.strapi_url === "string" ? metadata.strapi_url : null;
    if (existingLink) return { ok: false, error: "This content is already linked to a Strapi entry.", url: existingLink };
    const config = await getStrapiConfig(organizationId);
    if (!config) return { ok: false, error: "Connect Strapi in AI Settings before publishing." };
    const {error: approvalError} = await supabase.rpc("check_content_release", {p_asset: assetId, p_organization: organizationId});
    if (approvalError) return {ok: false, error: approvalError.message};
    const seo = metadata.seo && typeof metadata.seo === "object" ? metadata.seo as { title?: string; description?: string } : {};
    const excerpt = seo.description?.trim() || asset.body.replace(/\s+/g, " ").trim().slice(0, 180);
    const slug = `ril-${asset.id}`;
    const publicationId = await claimPublication(organizationId, asset, "strapi", user.id);
    let published: Awaited<ReturnType<typeof publishStrapiEntry>>;
    try {
      published = await publishStrapiEntry(config, { title: asset.title, body: asset.body, excerpt, slug, seo: { title: seo.title ?? "", description: seo.description ?? "" } });
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Could not publish to Strapi.";
      await noteUncertainDelivery(organizationId, publicationId, message);
      revalidatePath(`/library/${assetId}`);
      return { ok: false, error: message + " Check Strapi before trying again; the request is reserved to prevent duplicate publication." };
    }
    await saveDelivery(organizationId, publicationId, assetId, {id: String(published.id), status: "published", url: published.url, publishedAt: new Date().toISOString()});
    revalidatePath("/library");
    revalidatePath(`/library/${assetId}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { ok: true, message: published.alreadyCreated ? "Linked the existing Strapi entry." : "Published to Strapi.", url: published.url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not publish to Strapi." };
  }
}
