import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSeoPlugin, postBySlugPath, publishWordPressPost, seoMetaFields, type WordPressConfig } from "@/lib/integrations/wordpress";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));

const seo = { title: "SEO title", description: "Meta description" };

describe("seoMetaFields", () => {
  it("sends nothing when no SEO plugin is configured", () => {
    expect(seoMetaFields("none", seo)).toEqual({});
  });

  it("maps to Yoast's post meta keys", () => {
    expect(seoMetaFields("yoast", seo)).toEqual({
      _yoast_wpseo_title: "SEO title",
      _yoast_wpseo_metadesc: "Meta description",
    });
  });

  it("maps to Rank Math's post meta keys", () => {
    expect(seoMetaFields("rankmath", seo)).toEqual({
      rank_math_title: "SEO title",
      rank_math_description: "Meta description",
    });
  });

  it("leaves out empty values so the plugin's defaults apply", () => {
    expect(seoMetaFields("rankmath", { title: "  ", description: " D " })).toEqual({ rank_math_description: "D" });
  });
});

describe("parseSeoPlugin", () => {
  it("falls back to none for missing or unknown values", () => {
    expect(parseSeoPlugin(undefined)).toBe("none");
    expect(parseSeoPlugin("aioseo")).toBe("none");
    expect(parseSeoPlugin("yoast")).toBe("yoast");
  });
});

describe("postBySlugPath", () => {
  it("searches every status a post we created can be in, so retries find drafts and scheduled posts", () => {
    const path = postBySlugPath("ril-123");
    expect(path).toContain("slug=ril-123");
    expect(path).toContain("status=publish,future,draft,pending,private");
    expect(path).toContain("context=edit");
  });

  it("encodes the slug", () => {
    expect(postBySlugPath("a b&c")).toContain("slug=a%20b%26c");
  });
});

describe("publishWordPressPost", () => {
  const config: WordPressConfig = { siteUrl: "https://blog.example.org", username: "editor", applicationPassword: "abcd efgh", seoPlugin: "none" };
  const input = { title: "Title", body: "## Heading\n\n**Bold** text", excerpt: "Excerpt", slug: "ril-123", seo: { title: "", description: "" } };
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  afterEach(() => vi.unstubAllGlobals());

  it("looks the slug up across statuses and creates the post as HTML when none exists", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ id: 7, link: "https://blog.example.org/title", status: "publish" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(publishWordPressPost(config, input)).resolves.toMatchObject({ id: 7, alreadyCreated: false });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://blog.example.org/wp-json/wp/v2${postBySlugPath("ril-123")}`);
    const created = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(created.content).toContain("<h2>Heading</h2>");
    expect(created.content).toContain("<strong>Bold</strong>");
    expect(created.status).toBe("publish");
  });

  it("links an already published post without creating a duplicate", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ id: 7, link: "https://blog.example.org/title", status: "publish" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(publishWordPressPost(config, input)).resolves.toMatchObject({ id: 7, alreadyCreated: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("publishes an existing draft or scheduled post instead of creating a duplicate", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([{ id: 7, link: "https://blog.example.org/?p=7", status: "future" }]))
      .mockResolvedValueOnce(json({ id: 7, link: "https://blog.example.org/title", status: "publish" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(publishWordPressPost(config, input)).resolves.toMatchObject({ id: 7, url: "https://blog.example.org/title", alreadyCreated: true });
    expect(fetchMock.mock.calls[1][0]).toBe("https://blog.example.org/wp-json/wp/v2/posts/7");
    const update = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(update.status).toBe("publish");
    expect(update.date_gmt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("refuses to touch a private post that holds the slug", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([{ id: 7, link: "https://blog.example.org/?p=7", status: "private" }])));
    await expect(publishWordPressPost(config, input)).rejects.toThrow(/private WordPress post/);
  });
});
