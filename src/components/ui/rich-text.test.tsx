import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "./rich-text";

describe("report rich text", () => {
  it("renders headings, emphasis, bullets and code instead of Markdown markers", () => {
    const html = renderToStaticMarkup(<RichText>{"### Summary\n\n**Website traffic:** Recorded activity.\n\n* First item\n* Visit `/reports`"}</RichText>);
    expect(html).toContain("<h4>Summary</h4>");
    expect(html).toContain("<strong>Website traffic:</strong>");
    expect(html).toContain("<ul>"); expect(html).toContain("<li>First item</li>");
    expect(html).toContain("<code>/reports</code>");
    expect(html).not.toContain("**"); expect(html).not.toContain("###");
  });
  it("does not render raw HTML, executable links, or remote tracking images", () => {
    const html = renderToStaticMarkup(<RichText>{'<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n<img src="x" onerror="alert(1)" />\n\n![Chart](https://example.com/track.png)'}</RichText>);
    expect(html).not.toContain("<script"); expect(html).not.toContain("javascript:"); expect(html).not.toContain("onerror"); expect(html).not.toContain("<img");
  });
});
