import { describe, expect, it } from "vitest";
import { markdownToWordPressHtml } from "@/lib/integrations/wordpress-html";

describe("markdownToWordPressHtml", () => {
  it("renders headings instead of literal hashes", () => {
    const html = markdownToWordPressHtml("## Why it matters\n\nBody text.");
    expect(html).toContain("<h2>Why it matters</h2>");
    expect(html).toContain("<p>Body text.</p>");
    expect(html).not.toContain("##");
  });

  it("renders bold, italic and inline code", () => {
    expect(markdownToWordPressHtml("**bold**, *italic* and `code`")).toBe(
      "<p><strong>bold</strong>, <em>italic</em> and <code>code</code></p>"
    );
  });

  it("renders bulleted and numbered lists", () => {
    const html = markdownToWordPressHtml("- one\n- two\n\n1. first\n2. second");
    expect(html).toMatch(/<ul>\s*<li>one<\/li>\s*<li>two<\/li>\s*<\/ul>/);
    expect(html).toMatch(/<ol>\s*<li>first<\/li>\s*<li>second<\/li>\s*<\/ol>/);
  });

  it("renders links and blockquotes", () => {
    const html = markdownToWordPressHtml("> A quote\n\nRead [the report](https://example.org/report).");
    expect(html).toMatch(/<blockquote>\s*<p>A quote<\/p>\s*<\/blockquote>/);
    expect(html).toContain('<a href="https://example.org/report">the report</a>');
  });

  it("renders fenced code blocks with their contents escaped", () => {
    const html = markdownToWordPressHtml("```\nif (a < b) {}\n```");
    expect(html).toContain("<pre><code>if (a &lt; b) {}");
  });

  it("keeps single line breaks", () => {
    expect(markdownToWordPressHtml("Line one\nLine two")).toBe("<p>Line one<br>Line two</p>");
  });

  it("escapes raw HTML blocks and inline tags instead of passing them through", () => {
    const html = markdownToWordPressHtml('<script>alert(1)</script>\n\nHello <img src=x onerror="alert(1)"> world');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("drops unsafe link targets but keeps the link text", () => {
    const html = markdownToWordPressHtml("[click me](javascript:alert(1)) and [data](data:text/html,hi)");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click me");
  });

  it("returns an empty string for an empty or blank body", () => {
    expect(markdownToWordPressHtml("")).toBe("");
    expect(markdownToWordPressHtml("  \n\n  ")).toBe("");
  });
});
