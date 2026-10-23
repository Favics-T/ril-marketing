import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), fetch: vi.fn() }));
vi.mock("./source-connections", () => ({ sourceAccess: mocks.access }));
import { captionText, importAssetId, listNotionPages, readNotionPage, readYouTubeVideo, listYouTubeVideos, notionBlockText } from "./content-import";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", mocks.fetch); mocks.access.mockResolvedValue({ accessToken: "server-token", accountId: "my-channel", uploadsPlaylist: "uploads" }); });
describe("Notion and YouTube imports", () => {
  it("uses stable workspace-specific IDs so repeat imports cannot overwrite drafts", () => {
    expect(importAssetId("org", "notion", "page")).toBe(importAssetId("org", "notion", "page"));
    expect(importAssetId("org", "notion", "page")).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-5[a-f\d]{3}-a[a-f\d]{3}-[a-f\d]{12}$/);
    expect(importAssetId("org", "notion", "page")).not.toBe(importAssetId("other", "notion", "page"));
  });
  it("searches only shared Notion pages and forwards pagination", async () => {
    mocks.fetch.mockResolvedValue(json({ results: [{ id: "page", properties: { Name: { type: "title", title: [{ plain_text: "Campaign notes" }] } } }], has_more: true, next_cursor: "next" }));
    expect(await listNotionPages("org", "campaign", "cursor")).toMatchObject({ items: [{ title: "Campaign notes" }], cursor: "next" });
    const [url, options] = mocks.fetch.mock.calls[0]; expect(url).toBe("https://api.notion.com/v1/search");
    expect(JSON.parse(options.body)).toMatchObject({ query: "campaign", start_cursor: "cursor", filter: { property: "object", value: "page" } });
    expect(mocks.access).toHaveBeenCalledWith("org", "notion");
  });
  it("imports nested Notion blocks and later pages without fetching embedded URLs", async () => {
    const page = "80000000-0000-4000-8000-000000000001";
    mocks.fetch.mockResolvedValueOnce(json({ id: page, properties: {} }))
      .mockResolvedValueOnce(json({ results: [{ id: "block", type: "heading_2", has_children: true, heading_2: { rich_text: [{ plain_text: "Topic" }] } }], has_more: true, next_cursor: "next" }))
      .mockResolvedValueOnce(json({ results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "Source evidence" }] } }], has_more: false }))
      .mockResolvedValueOnce(json({ results: [{ type: "video", video: { external: { url: "http://127.0.0.1/secret" } } }], has_more: false }));
    const result = await readNotionPage("org", page);
    expect(result.body).toContain("## Topic\n\nSource evidence"); expect(result.warning).toContain("not copied");
    expect(mocks.fetch.mock.calls.every(([url]) => String(url).startsWith("https://api.notion.com/v1/"))).toBe(true);
    expect(mocks.fetch.mock.calls[3][0]).toContain("start_cursor=next");
  });
  it("rejects inaccessible pages with actionable copy and never returns provider error bodies", async () => {
    mocks.fetch.mockResolvedValue(json({ message: "private-token" }, 403));
    await expect(readNotionPage("org", "80000000-0000-4000-8000-000000000001")).rejects.toThrow("Share this page");
  });
  it("keeps list, code and task structure", () => {
    expect(notionBlockText({ id: "1", type: "to_do", to_do: { checked: true, rich_text: [{ plain_text: "Review" }] } })).toBe("- [x] Review");
    expect(notionBlockText({ id: "2", type: "code", code: { language: "js", rich_text: [{ plain_text: "run()" }] } })).toBe("```js\nrun()\n```");
  });
  it("loads the connected channel uploads playlist rather than unrestricted YouTube search", async () => {
    mocks.fetch.mockResolvedValue(json({ items: [{ snippet: { title: "Our event" }, contentDetails: { videoId: "abcdefghijk" } }], nextPageToken: "next" }));
    expect(await listYouTubeVideos("org")).toMatchObject({ items: [{ id: "abcdefghijk" }], cursor: "next" });
    expect(mocks.fetch.mock.calls[0][0]).toContain("playlistId=uploads");
  });
  it("imports owned video captions without timestamp or formatting markup", async () => {
    mocks.fetch.mockResolvedValueOnce(json({ items: [{ snippet: { title: "Event", channelId: "my-channel", description: "Overview" } }] }))
      .mockResolvedValueOnce(json({ items: [{ id: "caption", snippet: { status: "serving", language: "en" } }] }))
      .mockResolvedValueOnce(new Response("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<b>Hello</b> &amp; welcome\nHello &amp; welcome"));
    const result = await readYouTubeVideo("org", "abcdefghijk"); expect(result.transcriptAvailable).toBe(true); expect(result.body).toBe("Overview\n\n## Transcript\n\nHello & welcome");
  });
  it("offers a manual transcript when captions cannot be downloaded", async () => {
    mocks.fetch.mockResolvedValueOnce(json({ items: [{ snippet: { title: "Event", channelId: "my-channel", description: "Only description" } }] })).mockResolvedValueOnce(json({},403));
    const result = await readYouTubeVideo("org", "abcdefghijk"); expect(result.transcriptAvailable).toBe(false); expect(result.warning).toContain("Paste a transcript"); expect(result.body).toBe("Only description");
  });
  it("rejects videos outside the connected channel before reading captions", async () => {
    mocks.fetch.mockResolvedValue(json({ items: [{ snippet: { channelId: "another-channel" } }] }));
    await expect(readYouTubeVideo("org", "abcdefghijk")).rejects.toThrow("connected YouTube channel"); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it("removes WebVTT cue IDs and timing lines", () => { expect(captionText("WEBVTT\n1\n00:00:00.000 --> 00:00:01.000\nFirst line")).toBe("First line"); });
});
