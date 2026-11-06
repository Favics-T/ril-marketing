import "server-only";
import { createHash } from "node:crypto";
import { sourceAccess, type SourceProvider } from "./source-connections";

export type ImportItem = { id: string; title: string; url: string; updatedAt?: string };
export type ImportedContent = ImportItem & { body: string; warning?: string; transcriptAvailable?: boolean };
type RichText = { plain_text?: string; text?: { content?: string }; annotations?: { bold?: boolean; italic?: boolean; code?: boolean } };
type NotionPage = { id: string; url: string; last_edited_time?: string; archived?: boolean; in_trash?: boolean; properties?: Record<string, { type: string; title?: RichText[] }> };
type Block = { id: string; type: string; has_children?: boolean; [key: string]: unknown };

export function importAssetId(org: string, provider: SourceProvider, id: string) {
  const hex = createHash("sha256").update(`${org}:${provider}:${id}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function notionText(parts: RichText[] = []) { return parts.map(part => part.plain_text ?? part.text?.content ?? "").join(""); }
export function notionBlockText(block: Block) {
  const value = block[block.type] as { rich_text?: RichText[]; checked?: boolean; language?: string; title?: string; url?: string; cells?: RichText[][] } | undefined;
  const text = (value?.rich_text ?? []).map(part => {
    let content = notionText([part]);
    if (part.annotations?.code) content = `\`${content.replaceAll("`", "\\`")}\``;
    if (part.annotations?.bold) content = `**${content}**`;
    if (part.annotations?.italic) content = `*${content}*`;
    return content;
  }).join("");
  if (/^heading_[123]$/.test(block.type)) return `${"#".repeat(Number(block.type.slice(-1)))} ${text}`;
  if (block.type === "bulleted_list_item") return `- ${text}`;
  if (block.type === "numbered_list_item") return `1. ${text}`;
  if (block.type === "to_do") return `- [${value?.checked ? "x" : " "}] ${text}`;
  if (block.type === "quote") return text.split("\n").map(line => `> ${line}`).join("\n");
  if (block.type === "code") return `\`\`\`${value?.language ?? ""}\n${text}\n\`\`\``;
  if (block.type === "divider") return "---";
  if (block.type === "table_row") return `| ${(value?.cells ?? []).map(cell => notionText(cell).replaceAll("|", "\\|")).join(" | ")} |`;
  if (["image", "video", "file", "pdf", "audio", "unsupported", "child_page", "child_database"].includes(block.type)) return `[${block.type.replaceAll("_", " ")} omitted${value?.title ? `: ${value.title}` : ""}]`;
  return text;
}
async function notionRequest(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.notion.com/v1/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 404 || response.status === 403 ? "Share this page with your Notion connection and enable Read content, then try again." : response.status === 401 ? "Reconnect Notion in Settings." : response.status === 429 ? "Notion is busy. Wait a moment and try again." : "Notion could not return the page. Try again.");
  return response.json();
}
function notionItem(page: NotionPage): ImportItem { return { id: page.id, title: notionText(Object.values(page.properties ?? {}).find(property => property.type === "title")?.title) || "Untitled Notion page", url: `https://www.notion.so/${page.id.replaceAll("-", "")}`, updatedAt: page.last_edited_time }; }
export async function listNotionPages(org: string, query: string, cursor?: string) {
  const { accessToken } = await sourceAccess(org, "notion");
  const data = await notionRequest(accessToken, "search", { method: "POST", body: JSON.stringify({ ...(query ? { query } : {}), filter: { value: "page", property: "object" }, sort: { direction: "descending", timestamp: "last_edited_time" }, page_size: 20, ...(cursor ? { start_cursor: cursor } : {}) }) });
  return { items: (data.results as NotionPage[]).filter(page => !page.archived && !page.in_trash).map(notionItem), cursor: data.has_more ? data.next_cursor as string : null };
}
export async function readNotionPage(org: string, id: string): Promise<ImportedContent> {
  if (!/^[\da-f-]{32,36}$/i.test(id)) throw new Error("Choose a valid Notion page.");
  const { accessToken } = await sourceAccess(org, "notion");
  const page = await notionRequest(accessToken, `pages/${encodeURIComponent(id)}`) as NotionPage;
  if (page.archived || page.in_trash) throw new Error("This page is archived in Notion. Restore it before importing.");
  let requests = 0, omitted = false;
  async function children(blockId: string, depth: number): Promise<string> {
    if (depth > 5 || requests >= 30) throw new Error("This Notion page is too large to import at once. Split it into smaller pages.");
    const lines: string[] = [];
    let cursor: string | undefined;
    do {
      if (++requests > 30) throw new Error("This Notion page is too large. Split it into smaller pages.");
      const data = await notionRequest(accessToken, `blocks/${encodeURIComponent(blockId)}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const block of data.results as Block[]) {
        const text = notionBlockText(block); lines.push(text);
        if (text.includes(" omitted")) omitted = true;
        if (block.has_children && !["child_page", "child_database"].includes(block.type)) lines.push(await children(block.id, depth + 1));
      }
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return lines.filter(Boolean).join("\n\n");
  }
  const body = await children(id, 0);
  if (body.length > 20000) throw new Error("This page exceeds the 20,000-character draft limit. Split it into smaller Notion pages.");
  return { ...notionItem(page), body, warning: omitted ? "Embedded files, unsupported blocks and child pages are not copied. Review the original page for omitted material." : undefined };
}
export async function youtubeRequest(org: string, path: string) {
  const { accessToken } = await sourceAccess(org, "youtube");
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 401 ? "Reconnect YouTube in Settings." : response.status === 403 ? "YouTube denied access. Check channel permissions and API quota in Google Cloud." : "YouTube could not return this content. Try again.");
  return response;
}
export async function listYouTubeVideos(org: string, cursor?: string) {
  const { uploadsPlaylist } = await sourceAccess(org, "youtube");
  if (!uploadsPlaylist) throw new Error("Reconnect YouTube to load your channel's uploads.");
  const data = await (await youtubeRequest(org, `playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylist)}&maxResults=20${cursor ? `&pageToken=${encodeURIComponent(cursor)}` : ""}`)).json();
  return { items: (data.items ?? []).filter((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId).map((item: { snippet: { title: string; publishedAt: string }; contentDetails: { videoId: string } }) => ({ id: item.contentDetails.videoId, title: item.snippet.title, url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`, updatedAt: item.snippet.publishedAt })), cursor: data.nextPageToken ?? null } as { items: ImportItem[]; cursor: string | null };
}
export function captionText(vtt: string) {
  return vtt.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim() && !/^WEBVTT|^Kind:|^Language:|^NOTE|^\d+$|-->/i.test(line)).map(line => line.replace(/<[^>]*>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').trim()).filter((line, index, all) => line !== all[index - 1]).join("\n");
}
export async function readYouTubeVideo(org: string, id: string): Promise<ImportedContent> {
  if (!/^[\w-]{11}$/.test(id)) throw new Error("Choose a valid YouTube video.");
  const { accountId } = await sourceAccess(org, "youtube");
  const data = await (await youtubeRequest(org, `videos?part=snippet&id=${id}`)).json(), video = data.items?.[0];
  if (!video || video.snippet?.channelId !== accountId) throw new Error("Choose a video from your connected YouTube channel.");
  let transcript = "", warning = "";
  try {
    const captions = await (await youtubeRequest(org, `captions?part=snippet&videoId=${id}`)).json();
    const tracks = (captions.items ?? []).filter((track: { snippet?: { status?: string } }) => track.snippet?.status === "serving");
    const track = tracks.find((track: { snippet: { language: string } }) => track.snippet.language.startsWith("en")) ?? tracks[0];
    if (track) transcript = captionText(await (await youtubeRequest(org, `captions/${encodeURIComponent(track.id)}?tfmt=vtt`)).text());
  } catch { warning = "YouTube could not provide captions. Paste a transcript below, or import the description only. A description is not a transcript."; }
  if (!transcript && !warning) warning = "No downloadable captions are available. Paste a transcript below, or import the description only.";
  const body = [video.snippet.description, transcript ? `## Transcript\n\n${transcript}` : ""].filter(Boolean).join("\n\n");
  if (body.length > 20000) return { id, title: video.snippet.title, url: `https://www.youtube.com/watch?v=${id}`, body: video.snippet.description || "", transcriptAvailable: false, warning: "The transcript exceeds the draft limit. Paste an excerpt or summary below; the description is shown here." };
  return { id, title: video.snippet.title, url: `https://www.youtube.com/watch?v=${id}`, updatedAt: video.snippet.publishedAt, body, transcriptAvailable: Boolean(transcript), warning };
}
