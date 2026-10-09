import "server-only";
import { lookup } from "node:dns/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-box";

type IntegrationRow = { status: string; config: Record<string, string> };
export type WordPressSeoPlugin = "none" | "yoast" | "rankmath";
export type WordPressConfig = { siteUrl: string; username: string; applicationPassword: string; seoPlugin: WordPressSeoPlugin };
export type ArticleSeo = { title: string; description: string };

export const WORDPRESS_SEO_PLUGINS: readonly WordPressSeoPlugin[] = ["none", "yoast", "rankmath"];

export function parseSeoPlugin(value: unknown): WordPressSeoPlugin {
  return WORDPRESS_SEO_PLUGINS.includes(value as WordPressSeoPlugin) ? value as WordPressSeoPlugin : "none";
}

/** Post meta keys each SEO plugin reads for the search title and meta description. Empty values are left out so the plugin's own defaults apply. */
export function seoMetaFields(plugin: WordPressSeoPlugin, seo: ArticleSeo): Record<string, string> {
  if (plugin === "none") return {};
  const keys = plugin === "yoast"
    ? { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc" }
    : { title: "rank_math_title", description: "rank_math_description" };
  const fields: Record<string, string> = {};
  if (seo.title.trim()) fields[keys.title] = seo.title.trim();
  if (seo.description.trim()) fields[keys.description] = seo.description.trim();
  return fields;
}

function normalizeSiteUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter the full URL of your WordPress site."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || host === "localhost" || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || /^\d+(\.\d+){3}$/.test(host) || host.includes(":")) {
    throw new Error("Use your public WordPress site URL over HTTPS, without query parameters or credentials.");
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function restRoot(siteUrl: string, namespace = "wp/v2") {
  return `${siteUrl.replace(/\/$/, "")}/wp-json/${namespace}`;
}

function authHeader(username: string, applicationPassword: string) {
  return `Basic ${Buffer.from(`${username}:${applicationPassword.replace(/\s/g, "")}`).toString("base64")}`;
}

async function requestWordPress<T>(config: WordPressConfig, path: string, init: RequestInit = {}, namespace = "wp/v2"): Promise<T> {
  const addresses = await lookup(new URL(config.siteUrl).hostname, { all: true });
  const hasPrivateAddress = addresses.some(({ address }) => {
    const normalized = address.toLowerCase();
    const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
    const parts = ipv4.split(".").map(Number);
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("ff") || (parts.length === 4 && (
      parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && (parts[1] === 0 || parts[1] === 168)) ||
      (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || (parts[1] === 51 && parts[2] === 100))) ||
      (parts[0] === 203 && parts[1] === 0 && parts[2] === 113)
    ));
  });
  if (!addresses.length || hasPrivateAddress) throw new Error("WordPress URL must resolve only to public network addresses.");
  const response = await fetch(`${restRoot(config.siteUrl, namespace)}${path}`, {
    ...init,
    headers: { Authorization: authHeader(config.username, config.applicationPassword), "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({})) as { message?: string } & T;
  if (!response.ok) {
    const detail = typeof payload.message === "string" ? payload.message.slice(0, 180) : `HTTP ${response.status}`;
    throw new Error(response.status === 401 || response.status === 403 ? "WordPress rejected the application password or the account lacks publishing permission." : `WordPress request failed: ${detail}`);
  }
  return payload;
}

export async function verifyWordPressConnection(config: WordPressConfig) {
  const profile = await requestWordPress<{ id: number; name: string; capabilities?: Record<string, boolean> }>(config, "/users/me?context=edit");
  if (!profile.capabilities?.edit_posts || !profile.capabilities.publish_posts) {
    throw new Error("The connected WordPress account needs permission to edit and publish posts.");
  }
  return { user: profile.name, userId: profile.id };
}

/**
 * Check the chosen SEO plugin can take our fields before publishing relies on it.
 * Rank Math exposes its own write route; Yoast's meta is only writable once the
 * site registers it for REST, which shows up in the posts schema.
 */
export async function verifyWordPressSeoPlugin(config: WordPressConfig) {
  if (config.seoPlugin === "rankmath") {
    const index = await requestWordPress<{ namespaces?: string[] }>(config, "", {}, "");
    if (!index.namespaces?.includes("rankmath/v1")) throw new Error("Rank Math is not active on this WordPress site.");
  }
  if (config.seoPlugin === "yoast") {
    const schema = await requestWordPress<{ schema?: { properties?: { meta?: { properties?: Record<string, unknown> } } } }>(config, "/posts", { method: "OPTIONS" });
    const meta = schema.schema?.properties?.meta?.properties ?? {};
    if (!("_yoast_wpseo_title" in meta) || !("_yoast_wpseo_metadesc" in meta)) {
      throw new Error("WordPress does not let the API write Yoast's SEO title and description yet. Add the snippet shown below to the site, then save again.");
    }
  }
}

/** Write the SEO title and description to the post's SEO plugin. Returns null when no plugin is configured or there is nothing to send. */
async function writeSeoMeta(config: WordPressConfig, postId: number, seo: ArticleSeo): Promise<boolean | null> {
  const meta = seoMetaFields(config.seoPlugin, seo);
  if (!Object.keys(meta).length) return null;
  try {
    if (config.seoPlugin === "rankmath") {
      await requestWordPress(config, "/updateMeta", { method: "POST", body: JSON.stringify({ objectType: "post", objectID: postId, meta }) }, "rankmath/v1");
      return true;
    }
    // Unregistered meta keys are dropped silently, so confirm from what WordPress echoes back.
    const post = await requestWordPress<{ meta?: Record<string, unknown> }>(config, `/posts/${postId}?context=edit`, { method: "POST", body: JSON.stringify({ meta }) });
    return Object.entries(meta).every(([key, value]) => post.meta?.[key] === value);
  } catch {
    return false;
  }
}

export async function getWordPressConfig(organizationId: string): Promise<WordPressConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("integrations").select("status,config").eq("organization_id", organizationId).eq("key", "cms_wordpress").maybeSingle<IntegrationRow>();
  if (data?.status !== "connected") return null;
  const applicationPassword = decryptSecret(data.config.applicationPassword ?? "");
  if (!applicationPassword) return null;
  try {
    return { siteUrl: normalizeSiteUrl(data.config.siteUrl ?? ""), username: data.config.username ?? "", applicationPassword, seoPlugin: parseSeoPlugin(data.config.seoPlugin) };
  } catch { return null; }
}

/**
 * Publish a post, idempotent by slug. The SEO fields are written after the post
 * exists (also for a linked one), and a failure there never undoes the publish:
 * `seoSaved` reports it instead, null meaning no SEO plugin was involved.
 */
export async function publishWordPressPost(config: WordPressConfig, input: { title: string; body: string; excerpt: string; slug: string; seo: ArticleSeo }) {
  const query = `?slug=${encodeURIComponent(input.slug)}&context=edit`;
  const existing = await requestWordPress<Array<{ id: number; link: string }>>(config, `/posts${query}`);
  if (existing[0]?.id) {
    const seoSaved = await writeSeoMeta(config, existing[0].id, input.seo);
    return { id: existing[0].id, url: existing[0].link, alreadyCreated: true, seoSaved };
  }

  const content = input.body.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`).join("\n");
  const post = await requestWordPress<{ id: number; link: string }>(config, "/posts", {
    method: "POST",
    body: JSON.stringify({ title: input.title, content, excerpt: input.excerpt, slug: input.slug, status: "publish" }),
  });
  if (!post.id || !post.link) throw new Error("WordPress did not return the published post URL.");
  const seoSaved = await writeSeoMeta(config, post.id, input.seo);
  return { id: post.id, url: post.link, alreadyCreated: false, seoSaved };
}

export function validateWordPressSiteUrl(value: string) { return normalizeSiteUrl(value); }
