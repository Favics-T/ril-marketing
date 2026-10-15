import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageCopy } from "@/components/landing-pages/page-copy";

const render = (markdown: string) => renderToStaticMarkup(<PageCopy markdown={markdown} />);

describe("PageCopy", () => {
  it("renders the formatting the editor offers", () => {
    const html = render("## Who it's for\n\nBuilt for **founders** and *operators*.\n\n- One\n- Two\n\n1. First\n\n> A quote\n\n[Apply](https://example.com)");
    expect(html).toContain("<h2");
    expect(html).toContain("<strong");
    expect(html).toContain("<em>operators</em>");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<blockquote");
    expect(html).toMatch(/<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer"/);
  });

  it("keeps line breaks in copy written before the rich editor", () => {
    expect(render("Line one\nLine two")).toContain("Line one<br/>");
  });

  it("never renders raw HTML, scripts, images or unsafe links", () => {
    const html = render('<script>alert(1)</script>\n\n<b onclick="x()">hi</b>\n\n![x](https://example.com/a.png)\n\n[bad](javascript:alert(1))');
    expect(html).not.toMatch(/script|onclick|<img|<a |javascript:/);
    expect(html).toContain("bad");
  });

  it("keeps a single h1 on the page by folding other heading levels into h2 and h3", () => {
    const html = render("# Top\n\n#### Deep");
    expect(html).not.toContain("<h1");
    expect(html).toMatch(/<h2[^>]*>Top<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>Deep<\/h3>/);
  });
});
