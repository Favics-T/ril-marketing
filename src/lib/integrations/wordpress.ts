import "server-only";
import { lookup } from "node:dns/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-box";
import type { DeliveryPost } from "@/lib/content/publishing";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";
import { articleHtml } from "@/lib/content/article-html";

type IntegrationRow = { status: string; config: Record<string, string> };
export type WordPressConfig = { siteUrl: string; username: string; applicationPassword: string };

function normalizeSiteUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter the full URL of your WordPress site."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || host === "localhost" || !host.includes(".") || /\.(local|internal|localhost|example|invalid|test)$/.test(host) || /^\d+(\.\d+){3}$/.test(host) || host.includes(":")) {
    throw new Error("Use your public WordPress site URL over HTTPS, without query parameters or credentials.");
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function restRoot(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2`;
}

function authHeader(username: string, applicationPassword: string) {
  return `Basic ${Buffer.from(`${username}:${applicationPassword.replace(/\s/g, "")}`).toString("base64")}`;
}

async function requestWordPress<T>(config: WordPressConfig, path: string, init: RequestInit = {}): Promise<T> {
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
  const response = await fetch(`${restRoot(config.siteUrl)}${path}`, {
    ...init,
    headers: { Authorization: authHeader(config.username, config.applicationPassword), "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({})) as { message?: string } & T;
  if (!response.ok) {
    const detail = typeof payload.message === "string" ? payload.message.slice(0, 180) : `HTTP ${response.status}`;
    if ([400, 401, 403, 422].includes(response.status)) throw new DeliveryRejected(`WordPress rejected the request: ${detail}`);
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

export async function getWordPressConfig(organizationId: string): Promise<WordPressConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("integrations").select("status,config").eq("organization_id", organizationId).eq("key", "cms_wordpress").maybeSingle<IntegrationRow>();
  if (data?.status !== "connected") return null;
  const applicationPassword = decryptSecret(data.config.applicationPassword ?? "");
  if (!applicationPassword) return null;
  try {
    return { siteUrl: normalizeSiteUrl(data.config.siteUrl ?? ""), username: data.config.username ?? "", applicationPassword };
  } catch { return null; }
}

type WordPressPost = { id: number; link: string; status: string; slug?: string; date_gmt?: string };

export function wordPressDelivery(post: WordPressPost): DeliveryPost {
  if (!post.id || !post.link) throw new Error("WordPress returned no post receipt. Check WordPress before retrying.");
  const date = post.date_gmt ? `${post.date_gmt.replace(/Z$/, "")}Z` : null;
  return { id: String(post.id), url: post.link, sourceSlug: post.slug, status: post.status === "publish" ? "published" : post.status === "future" ? "queued" : "failed", scheduledFor: post.status === "future" ? date : null, publishedAt: post.status === "publish" ? date : null, ...(post.status !== "publish" && post.status !== "future" ? { error: `WordPress post is ${post.status}. Review it before publishing.` } : {}) };
}

export async function getWordPressPost(config: WordPressConfig, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid WordPress post receipt.");
  return wordPressDelivery(await requestWordPress<WordPressPost>(config, `/posts/${id}?context=edit`));
}

export async function publishWordPressPost(config: WordPressConfig, input: { title: string; body: string; excerpt: string; slug: string; scheduledFor?: string }) {
  const query = `?slug=${encodeURIComponent(input.slug)}&context=edit`;
  let existing: WordPressPost[];
  try { existing = await requestWordPress<WordPressPost[]>(config, `/posts${query}`); }
  catch { throw new DeliveryRejected("WordPress could not check for an existing article. No new post was requested. Verify the connection before retrying."); }
  const prior = existing[0];
  if (prior?.id && ["publish", "future"].includes(prior.status)) return { ...wordPressDelivery(prior), alreadyCreated: true };

  const content = articleHtml(input.body);
  const post = await requestWordPress<WordPressPost>(config, prior?.id ? `/posts/${prior.id}` : "/posts", {
    method: "POST",
    body: JSON.stringify({ title: input.title, content, excerpt: input.excerpt, slug: input.slug, status: input.scheduledFor ? "future" : "publish", ...(input.scheduledFor ? { date_gmt: input.scheduledFor.replace(/Z$/, "") } : {}) }),
  });
  return { ...wordPressDelivery(post), alreadyCreated: Boolean(prior?.id) };
}

export function validateWordPressSiteUrl(value: string) { return normalizeSiteUrl(value); }
