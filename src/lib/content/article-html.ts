function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Preserve headings and lists from generated Markdown without executing source HTML.
export function articleHtml(body: string) {
  const blocks: string[] = [];
  let paragraph: string[] = [], items: string[] = [], ordered = false;
  const flushParagraph = () => { if (paragraph.length) blocks.push(`<p>${paragraph.map(escapeHtml).join("<br>")}</p>`); paragraph = []; };
  const flushList = () => { if (items.length) { const tag = ordered ? "ol" : "ul"; blocks.push(`<${tag}>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`); } items = []; };
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const list = /^\s*(?:([-*])|\d+\.)\s+(.+)$/.exec(line);
    if (heading) { flushParagraph(); flushList(); const level = Math.max(2, heading[1].length); blocks.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`); }
    else if (list) { flushParagraph(); const nextOrdered = !list[1]; if (items.length && nextOrdered !== ordered) flushList(); ordered = nextOrdered; items.push(list[2]); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  return blocks.join("\n");
}
