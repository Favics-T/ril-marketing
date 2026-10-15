import { describe, expect, it } from "vitest";
import {
  entryFields,
  sanitizeCollection,
  slugFilterPath,
  validateStrapiUrl,
  type StrapiConfig,
} from "@/lib/integrations/strapi";

const config: StrapiConfig = {
  baseUrl: "https://cms.example.com",
  apiToken: "tok",
  collection: "articles",
  slugField: "slug",
  titleField: "title",
  bodyField: "content",
  excerptField: "summary",
  seoTitleField: "",
  seoDescriptionField: "",
};
const noSeo = { title: "", description: "" };

describe("validateStrapiUrl", () => {
  it("accepts a public HTTPS URL and strips the trailing slash", () => {
    expect(validateStrapiUrl("https://cms.example.com/")).toBe("https://cms.example.com");
    expect(validateStrapiUrl("https://cms.example.com/base/")).toBe("https://cms.example.com/base");
  });

  it("rejects non-public and unsafe URLs (SSRF guard)", () => {
    expect(() => validateStrapiUrl("http://cms.example.com")).toThrow();
    expect(() => validateStrapiUrl("https://localhost")).toThrow();
    expect(() => validateStrapiUrl("https://127.0.0.1")).toThrow();
    expect(() => validateStrapiUrl("https://cms.local")).toThrow();
    expect(() => validateStrapiUrl("https://cms.internal")).toThrow();
    expect(() => validateStrapiUrl("https://user:pass@cms.example.com")).toThrow();
    expect(() => validateStrapiUrl("https://cms.example.com:8443")).toThrow();
    expect(() => validateStrapiUrl("https://cms.example.com/?x=1")).toThrow();
    expect(() => validateStrapiUrl("https://cms.example.com/#f")).toThrow();
    expect(() => validateStrapiUrl("not-a-url")).toThrow();
  });
});

describe("sanitizeCollection", () => {
  it("trims surrounding slashes and accepts Strapi API IDs", () => {
    expect(sanitizeCollection("/articles/")).toBe("articles");
    expect(sanitizeCollection("blog-posts")).toBe("blog-posts");
  });

  it("rejects empty or unsafe collection ids", () => {
    expect(() => sanitizeCollection("")).toThrow();
    expect(() => sanitizeCollection("bad name")).toThrow();
    expect(() => sanitizeCollection("../secrets")).toThrow();
  });
});

describe("slugFilterPath", () => {
  it("builds a slug-scoped, single-page filter using the configured field", () => {
    expect(slugFilterPath(config, "ril-123")).toBe(
      "/articles?filters[slug][$eq]=ril-123&pagination[pageSize]=1"
    );
  });

  it("honours a renamed slug field and encodes the value", () => {
    expect(slugFilterPath({ ...config, slugField: "permalink" }, "a b")).toBe(
      "/articles?filters[permalink][$eq]=a%20b&pagination[pageSize]=1"
    );
  });
});

describe("entryFields", () => {
  it("maps article fields onto the configured Strapi field names", () => {
    expect(entryFields(config, { title: "T", body: "B", excerpt: "E", slug: "s", seo: noSeo })).toEqual({
      title: "T",
      content: "B",
      slug: "s",
      summary: "E",
    });
  });

  it("omits the excerpt when no excerpt field is configured", () => {
    expect(
      entryFields({ ...config, excerptField: "" }, { title: "T", body: "B", excerpt: "E", slug: "s", seo: noSeo })
    ).toEqual({ title: "T", content: "B", slug: "s" });
  });

  it("omits the excerpt when the excerpt text is empty", () => {
    expect(entryFields(config, { title: "T", body: "B", excerpt: "", slug: "s", seo: noSeo })).toEqual({
      title: "T",
      content: "B",
      slug: "s",
    });
  });

  it("sends the SEO title and description to plain fields", () => {
    expect(
      entryFields(
        { ...config, excerptField: "", seoTitleField: "metaTitle", seoDescriptionField: "metaDescription" },
        { title: "T", body: "B", excerpt: "", slug: "s", seo: { title: "ST", description: "SD" } }
      )
    ).toEqual({ title: "T", content: "B", slug: "s", metaTitle: "ST", metaDescription: "SD" });
  });

  it("groups SEO fields that share a component", () => {
    expect(
      entryFields(
        { ...config, excerptField: "", seoTitleField: "seo.metaTitle", seoDescriptionField: "seo.metaDescription" },
        { title: "T", body: "B", excerpt: "", slug: "s", seo: { title: " ST ", description: "SD" } }
      )
    ).toEqual({ title: "T", content: "B", slug: "s", seo: { metaTitle: "ST", metaDescription: "SD" } });
  });

  it("leaves out SEO fields with no text", () => {
    expect(
      entryFields(
        { ...config, excerptField: "", seoTitleField: "seo.metaTitle", seoDescriptionField: "seo.metaDescription" },
        { title: "T", body: "B", excerpt: "", slug: "s", seo: { title: "", description: "SD" } }
      )
    ).toEqual({ title: "T", content: "B", slug: "s", seo: { metaDescription: "SD" } });
  });
});
