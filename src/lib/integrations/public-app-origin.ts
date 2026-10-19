export function publicAppOrigin(value: string | undefined): string | null {
  try {
    if (!value) return null;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (!host.includes(".") || /^\[|^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || /(?:^|\.)(?:localhost|local|test|invalid|example)$/.test(host)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
