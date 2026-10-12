import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSchedulable, createScheduledPost, getPostsByIds, MIN_SCHEDULE_LEAD_MS, parseSeoPlugin, postBySlugPath, publishWordPressPost, seoMetaFields, setPostDraft, toDateGmt, updatePostSchedule, type WordPressConfig } from "@/lib/integrations/wordpress";

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

describe("toDateGmt", () => {
  it("formats in UTC without milliseconds or a zone suffix", () => {
    expect(toDateGmt(new Date("2026-10-12T09:05:07.123Z"))).toBe("2026-10-12T09:05:07");
    expect(toDateGmt(new Date("2026-10-12T23:30:00+01:00"))).toBe("2026-10-12T22:30:00");
  });

  it("rejects an invalid date", () => {
    expect(() => toDateGmt(new Date("nope"))).toThrow(/valid date/);
  });
});

describe("assertSchedulable", () => {
  const now = Date.parse("2026-10-12T09:00:00Z");

  it("accepts a time at least 2 minutes ahead", () => {
    expect(() => assertSchedulable(new Date(now + MIN_SCHEDULE_LEAD_MS), now)).not.toThrow();
  });

  it("rejects past times and times less than 2 minutes ahead", () => {
    expect(() => assertSchedulable(new Date(now - 1000), now)).toThrow(/2 minutes/);
    expect(() => assertSchedulable(new Date(now + MIN_SCHEDULE_LEAD_MS - 1), now)).toThrow(/2 minutes/);
  });
});

describe("scheduling calls", () => {
  const config: WordPressConfig = { siteUrl: "https://blog.example.org", username: "editor", applicationPassword: "abcd efgh", seoPlugin: "none" };
  const base = "https://blog.example.org/wp-json/wp/v2";
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);
  const remote = (status: string) => ({ id: 7, status, date_gmt: "2026-10-12T10:00:00", link: "https://blog.example.org/?p=7" });

  afterEach(() => vi.unstubAllGlobals());

  describe("createScheduledPost", () => {
    const input = { title: "Title", body: "Body **text**", excerpt: "Excerpt", slug: "ril-123", seo: { title: "", description: "" } };

    it("creates a future post with date_gmt", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json(remote("future")));
      vi.stubGlobal("fetch", fetchMock);
      const when = inAnHour();

      await expect(createScheduledPost(config, { ...input, scheduledFor: when })).resolves.toMatchObject({ id: 7, seoSaved: null });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${base}/posts`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({ title: "Title", excerpt: "Excerpt", slug: "ril-123", status: "future", date_gmt: toDateGmt(when) });
      expect(body.content).toContain("<strong>text</strong>");
    });

    it("refuses a time too close to now without calling WordPress", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(createScheduledPost(config, { ...input, scheduledFor: new Date(Date.now() + 30000) })).rejects.toThrow(/2 minutes/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("reports when WordPress published instead of scheduling", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(remote("publish"))));
      await expect(createScheduledPost(config, { ...input, scheduledFor: inAnHour() })).rejects.toThrow(/"publish" instead of scheduling/);
    });
  });

  describe("updatePostSchedule", () => {
    it("checks the post is still future, then sends only the new date_gmt", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json(remote("future"))).mockResolvedValueOnce(json(remote("future")));
      vi.stubGlobal("fetch", fetchMock);
      const when = inAnHour();

      await updatePostSchedule(config, 7, when);
      expect(fetchMock.mock.calls[0][0]).toBe(`${base}/posts/7?context=edit&_fields=id,status,date_gmt,link`);
      expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
      expect(fetchMock.mock.calls[1][0]).toBe(`${base}/posts/7?_fields=id,status,date_gmt,link`);
      expect(fetchMock.mock.calls[1][1].method).toBe("POST");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ date_gmt: toDateGmt(when) });
    });

    it("refuses once WordPress no longer reports the post as future", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json(remote("publish")));
      vi.stubGlobal("fetch", fetchMock);
      await expect(updatePostSchedule(config, 7, inAnHour())).rejects.toThrow(/no longer scheduled \(it is "publish"\)/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("refuses a past time without calling WordPress", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(updatePostSchedule(config, 7, new Date(Date.now() - 1000))).rejects.toThrow(/2 minutes/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("setPostDraft", () => {
    it("moves a future post to draft", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json(remote("future"))).mockResolvedValueOnce(json(remote("draft")));
      vi.stubGlobal("fetch", fetchMock);

      await expect(setPostDraft(config, 7)).resolves.toMatchObject({ status: "draft" });
      expect(fetchMock.mock.calls[1][0]).toBe(`${base}/posts/7?_fields=id,status,date_gmt,link`);
      expect(fetchMock.mock.calls[1][1].method).toBe("POST");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ status: "draft" });
    });

    it("leaves an existing draft alone", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json(remote("draft")));
      vi.stubGlobal("fetch", fetchMock);
      await expect(setPostDraft(config, 7)).resolves.toMatchObject({ status: "draft" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("never unpublishes a live post", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json(remote("publish")));
      vi.stubGlobal("fetch", fetchMock);
      await expect(setPostDraft(config, 7)).rejects.toThrow(/no longer scheduled/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPostsByIds", () => {
    it("asks for every status in edit context, 100 per page", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json([remote("future")]));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getPostsByIds(config, [7, 9, 7])).resolves.toEqual([remote("future")]);
      expect(fetchMock.mock.calls[0][0]).toBe(`${base}/posts?include=7,9&status=any&context=edit&per_page=100&_fields=id,status,date_gmt,link`);
      expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    });

    it("batches more than 100 ids and skips the request when there are none", async () => {
      const fetchMock = vi.fn().mockImplementation(async () => json([]));
      vi.stubGlobal("fetch", fetchMock);

      await getPostsByIds(config, []);
      expect(fetchMock).not.toHaveBeenCalled();
      await getPostsByIds(config, Array.from({ length: 150 }, (_, i) => i + 1));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toContain("include=101,");
    });
  });
});
