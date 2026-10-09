import { afterEach, describe, expect, it, vi } from "vitest";
import { joinWarnings, PUBLICATION_NOT_RECORDED, recordPublication, type PublicationInsert } from "@/lib/content/record-publication";

const row: PublicationInsert = {
  organization_id: "org-1",
  content_asset_id: "asset-1",
  channel: "wordpress",
  status: "published",
  url: "https://blog.example.org/post",
};

type Result<T> = { data: T | null; error: { message: string } | null };

function fakeClient(result: Result<{ id: string }> | Error) {
  const insert = vi.fn(() => ({
    select: () => ({
      single: <T,>() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result as Result<T>)),
    }),
  }));
  return { client: { from: () => ({ insert }) }, insert };
}

afterEach(() => vi.restoreAllMocks());

describe("recordPublication", () => {
  it("returns the new row id and no warning when the insert succeeds", async () => {
    const { client, insert } = fakeClient({ data: { id: "pub-1" }, error: null });
    await expect(recordPublication(client, row)).resolves.toEqual({ id: "pub-1" });
    expect(insert).toHaveBeenCalledWith(row);
  });

  it("logs and warns when the database rejects the insert", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: { message: "column \"url\" does not exist" } });
    await expect(recordPublication(client, row)).resolves.toEqual({ id: null, warning: PUBLICATION_NOT_RECORDED });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("column \"url\" does not exist"));
  });

  it("logs and warns instead of throwing when the request itself fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(new Error("network down"));
    await expect(recordPublication(client, row)).resolves.toEqual({ id: null, warning: PUBLICATION_NOT_RECORDED });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("network down"));
  });
});

describe("joinWarnings", () => {
  it("joins the warnings that are present and returns undefined when there are none", () => {
    expect(joinWarnings(undefined, undefined)).toBeUndefined();
    expect(joinWarnings("A.", undefined, "B.")).toBe("A. B.");
  });
});
