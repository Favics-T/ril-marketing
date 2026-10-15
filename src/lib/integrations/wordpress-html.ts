import { Marked, type Tokens } from "marked";

/** Link targets we let through; anything else (javascript:, data:, …) is rendered as plain text. */
const SAFE_LINK = /^(https?:|mailto:|\/(?!\/)|#)/i;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// AI blog bodies are Markdown. Single line breaks stay breaks, as they did when
// bodies were sent as escaped paragraphs.
const markdown = new Marked({ gfm: true, breaks: true });
markdown.use({
  renderer: {
    // Raw HTML in the body is shown as text, never passed through as markup.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link(token: Tokens.Link) {
      if (SAFE_LINK.test(token.href.trim())) return false;
      return this.parser.parseInline(token.tokens);
    },
    image(token: Tokens.Image) {
      if (/^https:/i.test(token.href.trim())) return false;
      return escapeHtml(token.text);
    },
  },
});

/** Convert an article's Markdown body to the HTML WordPress stores as post content. */
export function markdownToWordPressHtml(body: string): string {
  if (!body.trim()) return "";
  return (markdown.parse(body, { async: false }) as string).trim();
}
