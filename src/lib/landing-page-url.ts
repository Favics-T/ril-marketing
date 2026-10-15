type PublicPageIdentity = { id: string; slug: string };

/** Longest landing page copy, in Markdown characters including formatting. */
export const LANDING_PAGE_COPY_MAX = 10_000;

const pageIdSuffix = /^(.*)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function publicLandingPagePath(page: PublicPageIdentity): string {
  return `/p/${page.slug}-${page.id}`;
}

/** The only page fields the public lead form receives in the browser. */
export type LeadFormPage = { cta_label: string; registration_url: string | null };

/**
 * Props for the client-side lead form. A client component's props are
 * serialised into the public HTML, so pass these fields only, never the
 * whole page record with its workspace and campaign IDs (REN-416).
 */
export function leadFormPage(page: LeadFormPage): LeadFormPage {
  return { cta_label: page.cta_label, registration_url: page.registration_url };
}

export function parsePublicLandingPageKey(key: string): PublicPageIdentity | null {
  const match = pageIdSuffix.exec(key);
  return match?.[1] ? { slug: match[1], id: match[2].toLowerCase() } : null;
}
