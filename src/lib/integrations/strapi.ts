import "server-only";
import { lookup } from "node:dns/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-box";
import type { DeliveryPost } from "@/lib/content/publishing";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";

type IntegrationRow = { status: string; config: Record<string, string> };
export type StrapiConfig = {
  baseUrl: string;
  apiToken: string;
  collection: string;
  slugField: string;
  titleField: string;
  bodyField: string;
  excerptField: string;
  /** Optional; a dotted path such as `seo.metaTitle` targets a field inside a component. */
  seoTitleField: string;
  seoDescriptionField: string;
};

const DEFAULTS = { collection: "articles", slugField: "slug", titleField: "title", bodyField: "content", excerptField: "", seoTitleField: "", seoDescriptionField: "" };

/** Same public-host guard the WordPress connector uses: HTTPS only, no credentials, no bare IPs or local hosts. */
function normalizeBaseUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter the full URL of your Strapi instance."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || host === "localhost" || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || /^\d+(\.\d+){3}$/.test(host) || url.port || host.includes(":")) {
    throw new Error("Use your public Strapi URL over HTTPS, without query parameters or credentials.");
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

/** A collection API id is a URL path segment; keep it to Strapi's own safe character set. */
function sanitizeCollection(value: string) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed || !/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) throw new Error("Enter the collection's API ID (letters, numbers and hyphens), e.g. articles.");
  return trimmed;
}

async function requestStrapi<T>(config: StrapiConfig, path: string, init: RequestInit = {}): Promise<T> {
  const addresses = await lookup(new URL(config.baseUrl).hostname, { all: true });
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
  if (!addresses.length || hasPrivateAddress) throw new Error("Strapi URL must resolve only to public network addresses.");
  const response = await fetch(`${config.baseUrl}/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string; status?: number } } & T;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DeliveryRejected("Strapi rejected the API token, or it lacks find/create permission for this collection.");
    if (response.status === 404) throw new DeliveryRejected("Strapi could not find that collection. Check the collection API ID.");
    const detail = typeof payload.error?.message === "string" ? payload.error.message.slice(0, 180) : `HTTP ${response.status}`;
    if ([400, 422].includes(response.status)) throw new DeliveryRejected(`Strapi rejected the article: ${detail}`);
    throw new Error(`Strapi request failed: ${detail}`);
  }
  return payload;
}

function entryRef(config: StrapiConfig, entry: { id?: number | string; documentId?: string }) {
  const ref = entry.documentId ?? (entry.id != null ? String(entry.id) : "");
  return { id: ref, url: `${config.baseUrl}/api/${config.collection}/${ref}` };
}

/** Confirm the API token can read the target collection. Auth/not-found errors are mapped in requestStrapi. */
export async function verifyStrapiConnection(config: StrapiConfig): Promise<{ collection: string }> {
  await requestStrapi(config, `/${config.collection}?pagination[pageSize]=1`);
  return { collection: config.collection };
}

/** Read a verified, connected Strapi connection for the org, or null when absent/undecryptable. */
export async function getStrapiConfig(organizationId: string): Promise<StrapiConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("status,config")
    .eq("organization_id", organizationId)
    .eq("key", "cms_strapi")
    .maybeSingle<IntegrationRow>();
  if (!data || data.status !== "connected") return null;
  const apiToken = decryptSecret(data.config.apiToken ?? "");
  if (!apiToken) return null;
  let baseUrl: string;
  try { baseUrl = normalizeBaseUrl(data.config.baseUrl ?? ""); } catch { return null; }
  return {
    baseUrl,
    apiToken,
    collection: data.config.collection || DEFAULTS.collection,
    slugField: data.config.slugField || DEFAULTS.slugField,
    titleField: data.config.titleField || DEFAULTS.titleField,
    bodyField: data.config.bodyField || DEFAULTS.bodyField,
    excerptField: data.config.excerptField || DEFAULTS.excerptField,
    seoTitleField: data.config.seoTitleField || DEFAULTS.seoTitleField,
    seoDescriptionField: data.config.seoDescriptionField || DEFAULTS.seoDescriptionField,
  };
}

/** REST path that finds an entry by its slug — the idempotency probe before creating. */
export function slugFilterPath(config: StrapiConfig, slug: string) {
  return `/${config.collection}?filters[${encodeURIComponent(config.slugField)}][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`;
}

export async function getStrapiDelivery(config: StrapiConfig, assetId: string): Promise<DeliveryPost> {
  const slug = `ril-${assetId}`;
  type Entry = { id?: number | string; documentId?: string; publishedAt?: string | null; attributes?: Record<string, unknown> };
  const result = await requestStrapi<{ data?: Entry[] }>(config, slugFilterPath(config, slug));
  const entry = result.data?.[0];
  if (!entry) throw new Error("Strapi has no matching entry yet. Check the request in Strapi before sending again.");
  const fields = entry.attributes ?? entry;
  const publishedAt = typeof fields.publishedAt === "string" ? fields.publishedAt : null;
  return { ...entryRef(config, entry), sourceSlug: slug, status: publishedAt ? "published" : "failed", publishedAt, ...(!publishedAt ? {error: "The matching Strapi entry is a draft. It was not marked as published."} : {}) };
}

type StrapiArticle = { title: string; body: string; excerpt: string; slug: string; seo: { title: string; description: string } };

/** Set `value` at a field name or a one-level `component.field` path. */
function setField(fields: Record<string, unknown>, path: string, value: string) {
  const [root, child] = path.split(".");
  if (!child) { fields[root] = value; return; }
  const component = fields[root] && typeof fields[root] === "object" ? fields[root] as Record<string, unknown> : {};
  fields[root] = { ...component, [child]: value };
}

/** Map article fields onto the user's configured Strapi field names. Optional fields are sent only when both a field and text exist. */
export function entryFields(config: StrapiConfig, entry: StrapiArticle) {
  const fields: Record<string, unknown> = {
    [config.titleField]: entry.title,
    [config.bodyField]: entry.body,
    [config.slugField]: entry.slug,
  };
  if (config.excerptField && entry.excerpt) fields[config.excerptField] = entry.excerpt;
  if (config.seoTitleField && entry.seo.title.trim()) setField(fields, config.seoTitleField, entry.seo.title.trim());
  if (config.seoDescriptionField && entry.seo.description.trim()) setField(fields, config.seoDescriptionField, entry.seo.description.trim());
  return fields;
}

/**
 * Publish an entry, idempotent by slug: an existing entry with the same slug is
 * linked rather than duplicated. Sets publishedAt so Strapi's draft/publish
 * collections go live immediately (v4 and v5).
 */
export async function publishStrapiEntry(
  config: StrapiConfig,
  entry: StrapiArticle,
): Promise<{ id: string; url: string; alreadyCreated: boolean }> {
  const existing = await requestStrapi<{ data?: Array<{ id?: number | string; documentId?: string }> }>(config, slugFilterPath(config, entry.slug));
  const found = existing.data?.[0];
  if (found) return { ...entryRef(config, found), alreadyCreated: true };

  const created = await requestStrapi<{ data?: { id?: number | string; documentId?: string } }>(
    config,
    `/${config.collection}`,
    { method: "POST", body: JSON.stringify({ data: { ...entryFields(config, entry), publishedAt: new Date().toISOString() } }) },
  );
  if (!created.data) throw new Error("Strapi accepted the article but returned no entry to link.");
  return { ...entryRef(config, created.data), alreadyCreated: false };
}

/** Public wrapper so the action layer can validate a user-entered URL before saving. */
export function validateStrapiUrl(value: string): string {
  return normalizeBaseUrl(value);
}

export { sanitizeCollection };
