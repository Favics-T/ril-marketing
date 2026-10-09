import { describe, expect, it } from "vitest";
import { publicationDestination, publicationTime, safePublicationUrl } from "@/lib/content/publications";

describe("publicationDestination", () => {
  it("names known destinations and tidies unknown ones", () => {
    expect(publicationDestination("wordpress")).toBe("WordPress");
    expect(publicationDestination("Strapi")).toBe("Strapi");
    expect(publicationDestination("buffer")).toBe("Buffer");
    expect(publicationDestination("google_business")).toBe("Google business");
  });
});

describe("publicationTime", () => {
  it("prefers the publish time and falls back to when the attempt was recorded", () => {
    expect(publicationTime({ published_at: "2026-10-08T10:00:00Z", created_at: "2026-10-08T09:59:00Z" })).toBe("2026-10-08T10:00:00Z");
    expect(publicationTime({ published_at: null, created_at: "2026-10-08T09:59:00Z" })).toBe("2026-10-08T09:59:00Z");
  });
});

describe("safePublicationUrl", () => {
  it("keeps http(s) links and drops anything else", () => {
    expect(safePublicationUrl("https://blog.example.org/post/1")).toBe("https://blog.example.org/post/1");
    expect(safePublicationUrl("http://cms.local/api/posts/2")).toBe("http://cms.local/api/posts/2");
    expect(safePublicationUrl("javascript:alert(1)")).toBeNull();
    expect(safePublicationUrl("not a url")).toBeNull();
    expect(safePublicationUrl(null)).toBeNull();
  });
});
