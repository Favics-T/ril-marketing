import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingPageContent } from "./page-content";
import { LeadCaptureForm } from "./lead-capture-form";

describe("public landing page sections", () => {
  it("renders complete sections with safe rich text and a privacy-preserving video placeholder", () => {
    const html = renderToStaticMarkup(<LandingPageContent headline="Meet your peers" body={'## The offer\n**Useful copy**\n<script>alert(1)</script>'} metadata={{ builder: { description: "For founders", benefits: ["Peer learning"], programme: [{ label: "Venue", detail: "RIL" }], image: { url: "https://example.com/photo.jpg", alt: "The venue" }, video: { url: "https://youtu.be/dQw4w9WgXcQ", title: "Programme overview" }, testimonials: [{ quote: "A supplied quote", name: "A participant" }], faqs: [{ question: "Who can join?", answer: "Founders." }] } }} />);
    for (const value of ["For founders", "Peer learning", "Venue", "The venue", "A supplied quote", "Who can join?", "Load video", "<strong", "<h1"]) expect(html).toContain(value);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
  });
  it("omits empty sections and gives dashboard previews no second h1", () => {
    const html = renderToStaticMarkup(<LandingPageContent headline="Meet your peers" body="" preview />);
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("Frequently");
    expect(html).not.toContain("In their words");
  });
  it("renders a disabled preview of the real lead form with separate consent", () => {
    const html = renderToStaticMarkup(<LeadCaptureForm page={{ cta_label: "Join the programme", registration_url: null }} pageKey="" preview />);
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('name="marketing_consent"');
    expect(html).toContain("optional and separate");
    expect(html).toContain('type="submit" disabled=""');
  });
});
