import { describe, expect, it } from "vitest";
import { parseSeoPlugin, seoMetaFields } from "@/lib/integrations/wordpress";

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
