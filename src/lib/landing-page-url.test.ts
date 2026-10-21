import { describe, expect, it } from "vitest";
import { leadFormPage, parsePublicLandingPageKey, publicLandingPagePath, safeRegistrationUrl } from "./landing-page-url";

const id = "0ae379a3-9723-4780-869a-51dbee4dc256";

describe("public landing page URLs", () => {
  it("keeps pages with the same slug distinct", () => {
    const first = publicLandingPagePath({ slug: "founder-programme", id });
    const second = publicLandingPagePath({ slug: "founder-programme", id: "f7c75156-1bb4-49b7-823f-109746355364" });
    expect(first).not.toBe(second);
    expect(parsePublicLandingPageKey(first.slice(3))).toEqual({ slug: "founder-programme", id });
  });

  it("does not treat a plain slug as a page ID route", () => {
    expect(parsePublicLandingPageKey("founder-programme")).toBeNull();
  });
});

describe("public lead form props (REN-416)", () => {
  it("passes only the call to action and registration link to the browser", () => {
    const page = {
      id, slug: "founder-programme", organization_id: "a0000000-0000-4000-8000-000000000001",
      campaign_id: "c0000000-0000-4000-8000-000000000001", activity_id: null, audience_segment_id: null,
      title: "Internal name", headline: "Build what comes next.", body: "", meta_description: "", status: "published",
      cta_label: "Register interest", registration_url: "https://example.com/register",
    };
    expect(leadFormPage(page)).toEqual({ cta_label: "Register interest", registration_url: "https://example.com/register" });
    expect(JSON.stringify(leadFormPage(page))).not.toContain(page.organization_id);
  });

  it("drops a registration link that isn't safe to show (REN-417)", () => {
    expect(leadFormPage({ cta_label: "Register", registration_url: "javascript:alert(1)" })).toEqual({ cta_label: "Register", registration_url: null });
    expect(leadFormPage({ cta_label: "Register", registration_url: null })).toEqual({ cta_label: "Register", registration_url: null });
  });
});

describe("safeRegistrationUrl (REN-417)", () => {
  it.each([
    ["https://example.com/register", "https://example.com/register"],
    ["http://events.example.org/a?b=c#d", "http://events.example.org/a?b=c#d"],
    ["  https://example.com/register  ", "https://example.com/register"],
    ["HTTPS://Example.COM", "https://example.com/"],
    ["https://lu.ma/ril-founders", "https://lu.ma/ril-founders"],
  ])("accepts %s", (value, expected) => {
    expect(safeRegistrationUrl(value)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "ftp://example.com/file",
    "mailto:events@example.com",
    "/register",
    "example.com/register",
    "not a url",
    "",
    "   ",
  ])("rejects %s", (value) => {
    expect(safeRegistrationUrl(value)).toBeNull();
  });

  it.each([
    "https:ril",
    "https://ril",
    "https://localhost",
    "http://localhost:3000/register",
    "https://example.",
    "https://.example.com",
    "https://example..com",
  ])("rejects %s, which has no real hostname", (value) => {
    expect(safeRegistrationUrl(value)).toBeNull();
  });

  it("rejects missing values", () => {
    expect(safeRegistrationUrl(null)).toBeNull();
    expect(safeRegistrationUrl(undefined)).toBeNull();
  });
});
