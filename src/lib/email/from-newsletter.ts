/**
 * Pure helpers that turn an approved newsletter (a content asset) into an email
 * campaign draft. Kept free of `server-only` so they can be unit tested.
 */

/** Roles that may create and edit email campaigns from newsletters (REN-419). */
export const EMAIL_AUTHOR_ROLES = ["owner", "admin", "marketing_manager"] as const;

export function isEmailAuthorRole(role: string | null | undefined): boolean {
  return (EMAIL_AUTHOR_ROLES as readonly string[]).includes(role ?? "");
}

/** Asset statuses that mean the newsletter has passed human approval. */
export const APPROVED_NEWSLETTER_STATUSES = ["approved", "scheduled", "published", "analysing"] as const;

/** Form value for "write my own subject line" in the subject picker. */
export const CUSTOM_SUBJECT_CHOICE = "__custom";

/** Limits match the email campaign form and table constraints. */
export const EMAIL_LIMITS = { name: 160, subject: 200, subjectMin: 2, previewText: 240, bodyMin: 10, body: 12000 } as const;

export type NewsletterSource = {
  title: string;
  body: string | null;
  format: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  audience_segment_id: string | null;
  campaign_id: string | null;
};

export type NewsletterEmailDraft = {
  name: string;
  subject: string;
  subjectOptions: string[];
  previewText: string;
  body: string;
  audienceSegmentId: string | null;
  campaignId: string | null;
};

export function isApprovedNewsletter(asset: Pick<NewsletterSource, "format" | "status">): boolean {
  return asset.format === "newsletter" && (APPROVED_NEWSLETTER_STATUSES as readonly string[]).includes(asset.status);
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Subject choices: the newsletter's current title first (it may carry a human
 * edit), then the generated options, de-duplicated case-insensitively.
 */
export function subjectOptions(title: string, metadata: Record<string, unknown> | null): string[] {
  const generated = Array.isArray(metadata?.subject_lines) ? metadata.subject_lines : [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const raw of [title, ...generated]) {
    if (typeof raw !== "string") continue;
    const option = clip(raw.replace(/\s+/g, " ").trim(), EMAIL_LIMITS.subject);
    const key = option.toLowerCase();
    if (option.length < EMAIL_LIMITS.subjectMin || seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  return options;
}

/**
 * Newsletter bodies are Markdown, but delivery sends plain text. Turn the
 * Markdown the newsletter spec produces into text a reader can follow.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/, "$1")
        .replace(/^\s{0,3}>\s?/, "")
        .replace(/^(\s*)[*+]\s+/, "$1- ")
        .replace(/!?\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_match, label: string, url: string) => {
          const text = label.trim();
          return !text || text === url ? url : `${text}: ${url}`;
        })
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\s+$/, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function newsletterToEmailDraft(
  asset: NewsletterSource
): { ok: true; draft: NewsletterEmailDraft } | { ok: false; error: string } {
  if (!isApprovedNewsletter(asset)) return { ok: false, error: "Only an approved newsletter can become an email campaign." };
  const options = subjectOptions(asset.title, asset.metadata);
  if (!options.length) return { ok: false, error: "Give the newsletter a title before creating its email." };
  const body = markdownToPlainText(asset.body ?? "");
  if (body.length < EMAIL_LIMITS.bodyMin) return { ok: false, error: "The newsletter has no body copy to send." };
  if (body.length > EMAIL_LIMITS.body) {
    return { ok: false, error: `The newsletter is ${body.length.toLocaleString("en")} characters; an email can hold ${EMAIL_LIMITS.body.toLocaleString("en")}. Shorten the newsletter first.` };
  }
  const preview = typeof asset.metadata?.preview_text === "string" ? asset.metadata.preview_text.replace(/\s+/g, " ").trim() : "";
  return {
    ok: true,
    draft: {
      name: clip(`Newsletter · ${asset.title.trim()}`, EMAIL_LIMITS.name),
      subject: options[0],
      subjectOptions: options,
      previewText: clip(preview, EMAIL_LIMITS.previewText),
      body,
      audienceSegmentId: asset.audience_segment_id,
      campaignId: asset.campaign_id,
    },
  };
}
