import { describe, expect, it } from "vitest";
import { composeNewsletterBody } from "@/lib/ai/specs/newsletter";
import { isApprovedNewsletter, isEmailAuthorRole, markdownToPlainText, newsletterToEmailDraft, subjectOptions, type NewsletterSource } from "./from-newsletter";

const newsletter = (overrides: Partial<NewsletterSource> = {}): NewsletterSource => ({
  title: "Inside the Lagos Solar Hack",
  body: "## What happened\n\nTeams built working prototypes over the weekend.",
  format: "newsletter",
  status: "approved",
  metadata: { subject_lines: ["Inside the Lagos Solar Hack", "Five prototypes worth watching", "Hack recap: what we built"], preview_text: "The fridge that texts you, and four more ideas." },
  audience_segment_id: "segment",
  campaign_id: "campaign",
  ...overrides,
});

describe("who may turn a newsletter into an email", () => {
  it.each(["owner", "admin", "marketing_manager"])("allows %s", (role) => expect(isEmailAuthorRole(role)).toBe(true));
  it.each(["leadership", "member", null, undefined, ""])("refuses %s", (role) => expect(isEmailAuthorRole(role)).toBe(false));
});

describe("which assets qualify", () => {
  it.each(["approved", "scheduled", "published", "analysing"])("accepts a %s newsletter", (status) => expect(isApprovedNewsletter({ format: "newsletter", status })).toBe(true));
  it.each(["idea", "ai_generated", "editing", "review"])("refuses a %s newsletter", (status) => expect(isApprovedNewsletter({ format: "newsletter", status })).toBe(false));
  it("refuses approved assets that are not newsletters", () => expect(isApprovedNewsletter({ format: "blog", status: "approved" })).toBe(false));
});

describe("subject options", () => {
  it("puts the current title first and drops duplicates of it", () => {
    expect(subjectOptions("Inside the Lagos Solar Hack", newsletter().metadata)).toEqual(["Inside the Lagos Solar Hack", "Five prototypes worth watching", "Hack recap: what we built"]);
  });
  it("keeps a human-edited title ahead of the generated options", () => {
    expect(subjectOptions("Our edited subject", newsletter().metadata)[0]).toBe("Our edited subject");
    expect(subjectOptions("Our edited subject", newsletter().metadata)).toHaveLength(4);
  });
  it("ignores duplicates by case, blanks and non-strings, and clips to 200 characters", () => {
    const options = subjectOptions("Hello", { subject_lines: ["hello", " ", 42, "x".repeat(250)] });
    expect(options[0]).toBe("Hello");
    expect(options).toHaveLength(2);
    expect(options[1].length).toBeLessThanOrEqual(200);
  });
  it("falls back to the title for a manual newsletter with no metadata", () => {
    expect(subjectOptions("Manual newsletter", null)).toEqual(["Manual newsletter"]);
  });
});

describe("Markdown to plain text", () => {
  it("turns the spec's newsletter Markdown into readable text", () => {
    const markdown = composeNewsletterBody({
      subjectLines: ["s"], previewText: "p", intro: "Hello friends.", topic: null,
      highlights: [{ heading: "The fridge that texts you", paragraph: "It sends a text when the fridge warms up." }],
      quotes: [{ text: "It saved our batch.", speaker: "A nurse" }],
      links: [{ label: "Register", url: "https://example.com/register" }],
      cta: "Join the next cohort", closing: "See you soon.",
    } as Parameters<typeof composeNewsletterBody>[0], [{ label: "Register", url: "https://example.com/register" }]);
    expect(markdownToPlainText(markdown)).toBe([
      "Hello friends.",
      "The fridge that texts you\n\nIt sends a text when the fridge warms up.",
      "\"It saved our batch.\" — A nurse",
      "- Register: https://example.com/register",
      "Join the next cohort",
      "See you soon.",
    ].join("\n\n"));
  });
  it("handles bare links, star bullets, code and extra blank lines", () => {
    expect(markdownToPlainText("* [https://a.test](https://a.test)\n\n\n\nUse `code` and __bold__\r\n### Heading ###")).toBe("- https://a.test\n\nUse code and bold\nHeading");
  });
});

describe("newsletter to email draft", () => {
  it("maps subject, options, preview, body, audience and campaign", () => {
    const result = newsletterToEmailDraft(newsletter());
    expect(result).toEqual({ ok: true, draft: {
      name: "Newsletter · Inside the Lagos Solar Hack",
      subject: "Inside the Lagos Solar Hack",
      subjectOptions: ["Inside the Lagos Solar Hack", "Five prototypes worth watching", "Hack recap: what we built"],
      previewText: "The fridge that texts you, and four more ideas.",
      body: "What happened\n\nTeams built working prototypes over the weekend.",
      audienceSegmentId: "segment",
      campaignId: "campaign",
    } });
  });
  it("leaves preview text empty when the newsletter has none", () => {
    const result = newsletterToEmailDraft(newsletter({ metadata: {} }));
    expect(result.ok && result.draft.previewText).toBe("");
  });
  it("clips preview text to 240 characters", () => {
    const result = newsletterToEmailDraft(newsletter({ metadata: { preview_text: "word ".repeat(80) } }));
    expect(result.ok && result.draft.previewText.length).toBeLessThanOrEqual(240);
  });
  it("refuses a newsletter that is not approved", () => {
    expect(newsletterToEmailDraft(newsletter({ status: "review" })).ok).toBe(false);
  });
  it("refuses an empty body", () => {
    expect(newsletterToEmailDraft(newsletter({ body: "  " }))).toEqual({ ok: false, error: "The newsletter has no body copy to send." });
  });
  it("refuses, rather than truncates, a body over the email limit", () => {
    const result = newsletterToEmailDraft(newsletter({ body: "a".repeat(12001) }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Shorten the newsletter/);
  });
});
