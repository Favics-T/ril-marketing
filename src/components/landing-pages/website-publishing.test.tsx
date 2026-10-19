import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ articles: vi.fn(), issues: vi.fn(), wp: vi.fn(), strapi: vi.fn(), role: vi.fn() }));
vi.mock("@/lib/content/website-publishing", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/content/website-publishing")>(), listWebsiteArticles: mocks.articles, listWebsiteDeliveryIssues: mocks.issues }));
vi.mock("@/lib/integrations/wordpress", () => ({ getWordPressConfig: mocks.wp }));
vi.mock("@/lib/integrations/strapi", () => ({ getStrapiConfig: mocks.strapi }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role, isReviewerRole: (role: string) => ["owner", "admin", "marketing_manager", "leadership"].includes(role) }));
vi.mock("@/actions/wordpress", () => ({ publishApprovedBlog: vi.fn(), scheduleApprovedBlog: vi.fn() }));
vi.mock("@/actions/strapi", () => ({ publishApprovedToStrapi: vi.fn() }));
vi.mock("@/actions/website-publishing", () => ({ checkWebsiteDeliveries: vi.fn(), saveWebsiteSeo: vi.fn(), testWebsiteConnection: vi.fn() }));
import { WebsitePublishing } from "./website-publishing";

const article = { id: "article", title: "A real source article", body: "## Introduction\n\n**Source facts**\n\n- First point\n- Second point", channel: "website", format: "blog", status: "approved", updated_at: "2026-10-19T10:00:00Z", metadata: { seo: { title: "Search title", description: "Search description" } } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.role.mockResolvedValue("owner"); mocks.issues.mockResolvedValue([]);
  mocks.wp.mockResolvedValue({ siteUrl: "https://site.example", applicationPassword: "secret-must-stay-on-server", seoPlugin: "yoast" });
  mocks.strapi.mockResolvedValue({ baseUrl: "https://cms.example", apiToken: "private-token", seoTitleField: "seo.title", seoDescriptionField: "seo.description" });
  mocks.articles.mockResolvedValue({ articles: [article], total: 1, stage: "all", page: 1, q: "" });
});

describe("website publishing workspace", () => {
  it("renders article formatting, search metadata and approval-gated publishing without serializing credentials", async () => {
    const html = renderToStaticMarkup(await WebsitePublishing({ organizationId: "workspace", filters: {} }));
    expect(html).toContain("Publish now to WordPress"); expect(html).toContain("Publish now to Strapi");
    expect(html).toContain("Search title"); expect(html).toContain("<strong>Source facts</strong>"); expect(html).toContain("<li>First point</li>");
    expect(html).not.toContain("secret-must-stay-on-server"); expect(html).not.toContain("private-token");
    expect(html).toContain("connection-cms_wordpress"); expect(html).toContain("connection-cms_strapi");
  });

  it("hides publishing for members and for requests that are already in flight", async () => {
    mocks.role.mockResolvedValue("member");
    let html = renderToStaticMarkup(await WebsitePublishing({ organizationId: "workspace", filters: {} }));
    expect(html).not.toContain("Publish now to WordPress"); expect(html).not.toContain("Test connection");
    mocks.role.mockResolvedValue("owner");
    mocks.articles.mockResolvedValue({ articles: [{ ...article, metadata: { publishing: { provider: "wordpress" } } }], total: 1, stage: "approved", page: 1 });
    html = renderToStaticMarkup(await WebsitePublishing({ organizationId: "workspace", filters: {} }));
    expect(html).not.toContain("Publish now to WordPress"); expect(html).toContain("already recorded");
  });

  it("shows unavailable states rather than an empty successful queue when reads fail", async () => {
    mocks.articles.mockRejectedValue(new Error("Private SQL error")); mocks.issues.mockRejectedValue(new Error("Private diagnostics"));
    const html = renderToStaticMarkup(await WebsitePublishing({ organizationId: "workspace", filters: {} }));
    expect(html).toContain("Articles are temporarily unavailable"); expect(html).toContain("Delivery alerts are unavailable");
    expect(html).not.toContain("Private SQL error"); expect(html).not.toContain("0 matching");
  });

  it("keeps a WordPress SEO write failure visible after delivery is recorded", async () => {
    mocks.articles.mockResolvedValue({ articles: [{ ...article, status: "published", metadata: { wordpress_seo_saved: false } }], total: 1, stage: "published", page: 1 });
    const html = renderToStaticMarkup(await WebsitePublishing({ organizationId: "workspace", filters: {} }));
    expect(html).toContain("WordPress did not save this article’s SEO fields");
    expect(html).toContain("Review SEO connection settings");
    expect(html).not.toContain("Publish now to WordPress");
  });
});
