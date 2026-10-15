"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { getUserRole, requireReviewer } from "@/lib/audience/access";
import { decryptSecret, encryptSecret, isEncryptionEnabled } from "@/lib/crypto/secret-box";
import { claimPublication, noteUncertainDelivery, saveDelivery } from "@/lib/content/publishing";
import { futureSchedule } from "@/lib/content/scheduling";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";
import { joinWarnings } from "@/lib/content/record-publication";
import { runWordPressConnectionTest, type ConnectionCheck } from "@/lib/integrations/wordpress-diagnostics";
import { getWordPressConfig, publishWordPressPost, validateWordPressSiteUrl, verifyWordPressConnection, verifyWordPressSeoPlugin, WORDPRESS_SEO_PLUGINS, type WordPressConfig, type WordPressSeoPlugin } from "@/lib/integrations/wordpress";

type ActionResult = { ok: boolean; message?: string; warning?: string; error?: string; url?: string };

async function requireCmsManager(organizationId: string) {
  const role = await getUserRole(organizationId);
  if (!role || !["owner", "admin", "marketing_manager"].includes(role)) throw new Error("CMS settings require an owner, admin or marketing manager.");
}

const settingsSchema = z.object({
  siteUrl: z.string().trim().url().max(500),
  username: z.string().trim().min(1).max(120),
  applicationPassword: z.string().trim().max(300).default(""),
  seoPlugin: z.enum(WORDPRESS_SEO_PLUGINS as [WordPressSeoPlugin, ...WordPressSeoPlugin[]]).default("none"),
});

export async function saveWordPressConnection(formData: FormData): Promise<ActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireCmsManager(organizationId);
    if (!isEncryptionEnabled()) return { ok: false, error: "Set AI_CONFIG_SECRET before storing a WordPress application password." };
    const parsed = settingsSchema.safeParse({ siteUrl: formData.get("siteUrl"), username: formData.get("username"), applicationPassword: formData.get("applicationPassword") ?? "", seoPlugin: formData.get("seoPlugin") ?? "none" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the WordPress settings." };
    let siteUrl: string;
    try { siteUrl = validateWordPressSiteUrl(parsed.data.siteUrl); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Enter a public HTTPS WordPress URL." }; }

    const admin = createAdminClient();
    const { data: current } = await admin.from("integrations").select("config").eq("organization_id", organizationId).eq("key", "cms_wordpress").maybeSingle<{ config: Record<string, string> }>();
    const password = parsed.data.applicationPassword.replace(/\s/g, "") || decryptSecret(current?.config.applicationPassword ?? "");
    if (!password) return { ok: false, error: "Create a WordPress Application Password for a user allowed to publish posts." };
    const config: WordPressConfig = { siteUrl, username: parsed.data.username, applicationPassword: password, seoPlugin: parsed.data.seoPlugin };
    const profile = await verifyWordPressConnection(config);
    await verifyWordPressSeoPlugin(config);
    const { error } = await admin.from("integrations").upsert({
      organization_id: organizationId,
      key: "cms_wordpress",
      display_name: "WordPress publishing",
      status: "connected",
      config: { siteUrl, username: parsed.data.username, applicationPassword: encryptSecret(password), user: profile.user, seoPlugin: config.seoPlugin },
    }, { onConflict: "organization_id,key" });
    if (error) return { ok: false, error: "Could not save the verified WordPress connection." };
    revalidatePath("/settings/ai");
    return { ok: true, message: `Connected as ${profile.user}.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not connect WordPress." };
  }
}

export type ConnectionTestResult = { ok: boolean; checks?: ConnectionCheck[]; error?: string };

/**
 * Run the connection checks on the form's values without saving anything.
 * A blank password falls back to the saved one, as saving does.
 */
export async function testWordPressConnection(formData: FormData): Promise<ConnectionTestResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireCmsManager(organizationId);
    const parsed = settingsSchema.safeParse({ siteUrl: formData.get("siteUrl"), username: formData.get("username"), applicationPassword: formData.get("applicationPassword") ?? "", seoPlugin: formData.get("seoPlugin") ?? "none" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the WordPress settings." };
    let password = parsed.data.applicationPassword.replace(/\s/g, "");
    if (!password) {
      const { data: current } = await createAdminClient().from("integrations").select("config").eq("organization_id", organizationId).eq("key", "cms_wordpress").maybeSingle<{ config: Record<string, string> }>();
      password = decryptSecret(current?.config.applicationPassword ?? "");
    }
    if (!password) return { ok: false, error: "Paste the application password to test the connection." };
    return await runWordPressConnectionTest({ siteUrl: parsed.data.siteUrl, username: parsed.data.username, applicationPassword: password, seoPlugin: parsed.data.seoPlugin });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not test the WordPress connection." };
  }
}

export async function disconnectWordPress(): Promise<ActionResult> {
  try {
    const organizationId = await requireOrganizationId();
    await requireCmsManager(organizationId);
    const admin = createAdminClient();
    const { error } = await admin.from("integrations").update({ status: "not_connected", config: {} }).eq("organization_id", organizationId).eq("key", "cms_wordpress");
    if (error) return { ok: false, error: "Could not disconnect WordPress." };
    revalidatePath("/settings/ai");
    return { ok: true, message: "WordPress disconnected." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not disconnect WordPress." }; }
}

export async function publishApprovedBlog(assetId: string): Promise<ActionResult> {
  return deliverApprovedBlog(assetId);
}

export async function scheduleApprovedBlog(assetId: string, scheduledFor: string): Promise<ActionResult> {
  try { return await deliverApprovedBlog(assetId, futureSchedule(scheduledFor)); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Invalid schedule." }; }
}

async function deliverApprovedBlog(assetId: string, scheduledFor?: string): Promise<ActionResult> {
  let requestId = "";
  let organizationId = "";
  try {
    organizationId = await requireOrganizationId();
    await requireReviewer(organizationId);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in before publishing." };
    const { data: asset, error: assetError } = await supabase.from("content_assets").select("id,title,body,format,channel,status,metadata,updated_at").eq("organization_id", organizationId).eq("id", assetId).maybeSingle();
    if (assetError || !asset) return { ok: false, error: "Content asset not found." };
    if (asset.status !== "approved") return { ok: false, error: "Only approved content can be published to WordPress." };
    if (asset.format !== "blog" && asset.channel !== "website") return { ok: false, error: "WordPress publishing is only available for blog and website content." };
    if (!asset.body?.trim()) return { ok: false, error: "Add the article body before publishing." };
    const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
    const existingLink = typeof metadata.wordpress_url === "string" ? metadata.wordpress_url : null;
    if (existingLink) return { ok: false, error: "This content is already linked to a WordPress post.", url: existingLink };
    const config = await getWordPressConfig(organizationId);
    if (!config) return { ok: false, error: "Connect WordPress in AI Settings before publishing." };
    const seo = metadata.seo && typeof metadata.seo === "object" ? metadata.seo as { title?: string; description?: string } : {};
    const excerpt = seo.description?.trim() || asset.body.replace(/\s+/g, " ").trim().slice(0, 180);
    const slug = `ril-${asset.id}`;
    requestId = await claimPublication(organizationId, asset, "wordpress", user.id, scheduledFor);
    const published = await publishWordPressPost(config, { title: asset.title, body: asset.body, excerpt, slug, scheduledFor, seo: { title: seo.title ?? "", description: seo.description ?? "" } });
    await saveDelivery(organizationId, requestId, asset.id, { ...published, id: String(published.id) });
    revalidatePath("/library");
    revalidatePath(`/library/${assetId}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { ok: published.status !== "failed", message: published.status === "published" ? "WordPress confirmed publication." : published.status === "queued" ? "Scheduled on WordPress. Delivery will be confirmed after it goes live." : undefined, warning: joinWarnings(published.seoSaved === false ? "The SEO title and description were not saved. Check the WordPress SEO settings." : undefined), error: published.error, url: published.url };
  } catch (error) {
    if (requestId) {
      try {
        if (error instanceof DeliveryRejected) await saveDelivery(organizationId, requestId, assetId, { id: "", status: "failed", error: error.message });
        else await noteUncertainDelivery(organizationId, requestId, error instanceof Error ? error.message : "Request failed.");
      } catch { /* Keep the reservation until the provider result can be recorded. */ }
    }
    if (requestId) revalidatePath(`/library/${assetId}`);
    return { ok: false, error: error instanceof Error ? error.message : "Could not publish to WordPress." };
  }
}
