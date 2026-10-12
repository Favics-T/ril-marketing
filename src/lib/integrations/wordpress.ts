import "server-only";
import { lookup } from "node:dns/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { markdownToWordPressHtml } from "@/lib/integrations/wordpress-html";

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
 * Statuses the slug lookup searches. Without them WordPress returns published
 * posts only, so a retry would miss a scheduled or draft post and create a
 * duplicate. Trash is left out: WordPress renames a trashed post's slug.
 */
export const SLUG_LOOKUP_STATUSES = ["publish", "future", "draft", "pending", "private"] as const;

/** Path that finds the post already created for this slug, whatever its status. */
export function postBySlugPath(slug: string) {
  return `/posts?slug=${encodeURIComponent(slug)}&status=${SLUG_LOOKUP_STATUSES.join(",")}&context=edit`;
}

type WordPressPost = { id: number; link: string; status: string };

/**
 * Publish a post, idempotent by slug. The SEO fields are written after the post
 * exists (also for a linked one), and a failure there never undoes the publish:
 * `seoSaved` reports it instead, null meaning no SEO plugin was involved.
 */
export async function publishWordPressPost(config: WordPressConfig, input: { title: string; body: string; excerpt: string; slug: string; seo: ArticleSeo }) {
  const content = markdownToWordPressHtml(input.body);
  const [existing] = await requestWordPress<WordPressPost[]>(config, postBySlugPath(input.slug));
  if (existing?.id) {
    if (existing.status === "private") throw new Error("A private WordPress post already uses this article's slug. Make it public or delete it in WordPress, then publish again.");
    let live = existing;
    if (existing.status !== "publish") {
      // An earlier draft or scheduled copy: bring it live now with the current text.
      // date_gmt is set a minute back so a WordPress clock running behind ours can't
      // turn "publish" back into "future".
      const dateGmt = toDateGmt(new Date(Date.now() - 60000));
      live = await requestWordPress<WordPressPost>(config, `/posts/${existing.id}`, {
        method: "POST",
        body: JSON.stringify({ title: input.title, content, excerpt: input.excerpt, status: "publish", date_gmt: dateGmt }),
      });
      if (live.status !== "publish") throw new Error(`WordPress kept the existing post as "${live.status}" instead of publishing it.`);
    }
    const seoSaved = await writeSeoMeta(config, live.id, input.seo);
    return { id: live.id, url: live.link, alreadyCreated: true, seoSaved };
  }

  const post = await requestWordPress<{ id: number; link: string }>(config, "/posts", {
    method: "POST",
    body: JSON.stringify({ title: input.title, content, excerpt: input.excerpt, slug: input.slug, status: "publish" }),
  });
  if (!post.id || !post.link) throw new Error("WordPress did not return the published post URL.");
  const seoSaved = await writeSeoMeta(config, post.id, input.seo);
  return { id: post.id, url: post.link, alreadyCreated: false, seoSaved };
}

export function validateWordPressSiteUrl(value: string) { return normalizeSiteUrl(value); }

/** WordPress's date_gmt format: YYYY-MM-DDTHH:mm:ss in UTC, no zone suffix. */
export function toDateGmt(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid date and time.");
  return date.toISOString().slice(0, 19);
}

/**
 * How far ahead a scheduled time must be. WordPress publishes a post dated in
 * the past straight away instead of scheduling it, and request time plus clock
 * drift between us and the site can eat a smaller margin.
 */
export const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;

export function assertSchedulable(when: Date, now = Date.now()) {
  toDateGmt(when);
  if (when.getTime() - now < MIN_SCHEDULE_LEAD_MS) throw new Error("Choose a time at least 2 minutes from now.");
}

export type WordPressRemotePost = { id: number; status: string; date_gmt: string; link: string };

const REMOTE_POST_FIELDS = "id,status,date_gmt,link";

async function getRemotePost(config: WordPressConfig, postId: number) {
  return requestWordPress<WordPressRemotePost>(config, `/posts/${postId}?context=edit&_fields=${REMOTE_POST_FIELDS}`);
}

/**
 * Create a post WordPress will publish itself at `scheduledFor` (status
 * "future"). WP-Cron does the publishing, so it only fires when the site gets
 * traffic. Not idempotent by slug: the caller checks for an existing post.
 */
export async function createScheduledPost(config: WordPressConfig, input: { title: string; body: string; excerpt: string; slug: string; seo: ArticleSeo; scheduledFor: Date }) {
  assertSchedulable(input.scheduledFor);
  const post = await requestWordPress<WordPressRemotePost>(config, "/posts", {
    method: "POST",
    body: JSON.stringify({ title: input.title, content: markdownToWordPressHtml(input.body), excerpt: input.excerpt, slug: input.slug, status: "future", date_gmt: toDateGmt(input.scheduledFor) }),
  });
  if (!post.id) throw new Error("WordPress did not return the scheduled post.");
  // WordPress turns a date it considers past into an immediate publish.
  if (post.status !== "future") throw new Error(`WordPress saved the post as "${post.status}" instead of scheduling it. Check the site's clock and timezone settings.`);
  const seoSaved = await writeSeoMeta(config, post.id, input.seo);
  return { id: post.id, url: post.link, dateGmt: post.date_gmt, seoSaved };
}

/**
 * Move a scheduled post to a new time. Only valid while WordPress still holds
 * it as "future": changing date_gmt on a published post would re-date it, or
 * pull it back to scheduled if the new time is ahead.
 */
export async function updatePostSchedule(config: WordPressConfig, postId: number, scheduledFor: Date) {
  assertSchedulable(scheduledFor);
  const current = await getRemotePost(config, postId);
  if (current.status !== "future") throw new Error(`This WordPress post is no longer scheduled (it is "${current.status}"), so its time can't be changed.`);
  const post = await requestWordPress<WordPressRemotePost>(config, `/posts/${postId}?_fields=${REMOTE_POST_FIELDS}`, {
    method: "POST",
    body: JSON.stringify({ date_gmt: toDateGmt(scheduledFor) }),
  });
  if (post.status !== "future") throw new Error(`WordPress saved the post as "${post.status}" instead of rescheduling it.`);
  return post;
}

/**
 * Take a scheduled post off the schedule by turning it back into a draft.
 * Refuses a post that is already live: unscheduling must never unpublish.
 */
export async function setPostDraft(config: WordPressConfig, postId: number) {
  const current = await getRemotePost(config, postId);
  if (current.status === "draft") return current;
  if (current.status !== "future") throw new Error(`This WordPress post is no longer scheduled (it is "${current.status}"), so it was left unchanged.`);
  const post = await requestWordPress<WordPressRemotePost>(config, `/posts/${postId}?_fields=${REMOTE_POST_FIELDS}`, {
    method: "POST",
    body: JSON.stringify({ status: "draft" }),
  });
  if (post.status !== "draft") throw new Error(`WordPress kept the post as "${post.status}" instead of moving it to draft.`);
  return post;
}

/**
 * Current state of the given posts, in batches of 100 (the REST page cap).
 * status=any leaves out trashed posts, so a missing id means trashed or deleted.
 */
export async function getPostsByIds(config: WordPressConfig, ids: number[]) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const posts: WordPressRemotePost[] = [];
  for (let start = 0; start < unique.length; start += 100) {
    const batch = unique.slice(start, start + 100);
    posts.push(...await requestWordPress<WordPressRemotePost[]>(config, `/posts?include=${batch.join(",")}&status=any&context=edit&per_page=100&_fields=${REMOTE_POST_FIELDS}`));
  }
  return posts;
}
