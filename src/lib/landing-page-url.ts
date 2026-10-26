type PublicPageIdentity = { id: string; slug: string };

/** Longest landing page copy, in Markdown characters including formatting. */
export const LANDING_PAGE_COPY_MAX = 10_000;

const pageIdSuffix =
  /^(.*)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function publicLandingPagePath(page: PublicPageIdentity): string {
  return `/p/${page.slug}-${page.id}`;
}

/**
 * A registration link that is safe to save and to put in a public href: an
 * absolute http or https URL whose host has at least two non-empty
 * dot-separated labels, so "https:ril", "https://localhost" and
 * "javascript:…" are refused. Returns the normalised URL, or null.
 */
export function safeRegistrationUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const labels = url.hostname.split(".");
  if (labels.length < 2 || labels.some((label) => !label)) return null;
  return url.href;
}

/** The only page fields the public lead form receives in the browser. */
export type LeadFormPage = {
  cta_label: string;
  registration_url: string | null;
};

/**
 * Props for the client-side lead form. A client component's props are
 * serialised into the public HTML, so pass these fields only, never the
 * whole page record with its workspace and campaign IDs (REN-416).
 */
export function leadFormPage(page: LeadFormPage): LeadFormPage {
  return {
    cta_label: page.cta_label,
    registration_url: safeRegistrationUrl(page.registration_url),
  };
}

export function parsePublicLandingPageKey(
  key: string,
): PublicPageIdentity | null {
  const match = pageIdSuffix.exec(key);
  return match?.[1] ? { slug: match[1], id: match[2].toLowerCase() } : null;
}
