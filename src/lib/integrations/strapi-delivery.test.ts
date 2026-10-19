import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryRejected } from "./delivery-error";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));
import { publishStrapiEntry, type StrapiConfig } from "./strapi";

const config: StrapiConfig = { baseUrl: "https://cms.example.com", apiToken: "test-token", collection: "articles", titleField: "title", bodyField: "content", slugField: "slug", excerptField: "", seoTitleField: "", seoDescriptionField: "" };
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("Strapi delivery certainty", () => {
  it.each([403, 422])("treats HTTP %s on article creation as a definitive rejection", async status => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: "Article rejected" } }, { status }));
    await expect(publishStrapiEntry(config, { title: "Article", body: "Copy", slug: "ril-article", excerpt: "", seo: { title: "Article", description: "Summary" } })).rejects.toBeInstanceOf(DeliveryRejected);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  it("does not classify a server error as proof that nothing was published", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: "Server error" } }, { status: 500 }));
    const error = await publishStrapiEntry(config, { title: "Article", body: "Copy", slug: "ril-article", excerpt: "", seo: { title: "Article", description: "Summary" } }).catch(error => error);
    expect(error).toBeInstanceOf(Error); expect(error).not.toBeInstanceOf(DeliveryRejected);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
