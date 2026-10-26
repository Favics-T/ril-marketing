import { describe, expect, it } from "vitest";
import { landingPageContentSchema, pageContent, publicMediaUrl, videoEmbedUrl } from "./landing-page-content";

describe("landing page section contracts", () => {
  it("keeps legacy rich-text pages valid without invented sections", () => {
    expect(pageContent(null)).toMatchObject({ version: 1, benefits: [], testimonials: [], faqs: [], description: "" });
  });
  it("accepts the complete builder contract and trims authored content", () => {
    const result = landingPageContentSchema.parse({ description: " An invitation ", benefits: ["Meet your peers"], programme: [{ label: "Venue", detail: "RIL" }], image: { url: "https://media.example.com/photo.jpg", alt: "The programme venue" }, video: { url: "https://youtu.be/dQw4w9WgXcQ", title: "Overview" }, testimonials: [{ quote: "A real supplied quote", name: "Named participant" }], faqs: [{ question: "Where?", answer: "At RIL." }] });
    expect(result.description).toBe("An invitation");
    expect(result.testimonials[0].role).toBe("");
  });
  it("requires complete optional sections and image descriptions", () => {
    expect(landingPageContentSchema.safeParse({ benefits: [""] }).success).toBe(false);
    expect(landingPageContentSchema.safeParse({ image: { url: "https://example.com/photo.jpg", alt: "" } }).success).toBe(false);
    expect(landingPageContentSchema.safeParse({ faqs: [{ question: "Where?", answer: "" }] }).success).toBe(false);
    expect(landingPageContentSchema.safeParse({ benefits: Array(9).fill("Benefit") }).success).toBe(false);
  });
  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "http://example.com/photo.jpg", "https://user:secret@example.com/image", "https://127.0.0.1/a", "https://[::1]/a", "https://localhost/a", "https://files.local/a", "https://example.com:8443/a", "https://example.com/private.jpg?token=private-jwt"])("refuses unsafe public media %s", url => {
    expect(publicMediaUrl(url)).toBeNull();
  });
  it("embeds only recognised video IDs, without carrying tracking parameters", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=campaign")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&secret=private")).toBeNull();
    expect(videoEmbedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345?dnt=1");
    expect(videoEmbedUrl("https://youtube.com.attacker.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=../../bad")).toBeNull();
  });
});
