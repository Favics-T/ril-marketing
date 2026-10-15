type PublicPageIdentity = { id: string; slug: string };

/** Longest landing page copy, in Markdown characters including formatting. */
export const LANDING_PAGE_COPY_MAX = 10_000;

const pageIdSuffix = /^(.*)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function publicLandingPagePath(page: PublicPageIdentity): string {
  return `/p/${page.slug}-${page.id}`;
}

export function parsePublicLandingPageKey(key: string): PublicPageIdentity | null {
  const match = pageIdSuffix.exec(key);
  return match?.[1] ? { slug: match[1], id: match[2].toLowerCase() } : null;
}
