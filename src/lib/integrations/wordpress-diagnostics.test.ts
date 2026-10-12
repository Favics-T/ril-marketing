import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { describeSiteTimezone, runWordPressConnectionTest } from "@/lib/integrations/wordpress-diagnostics";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

const input = { siteUrl: "https://blog.example.org", username: "editor", applicationPassword: "abcd efgh", seoPlugin: "none" as const };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const index = { name: "Example", namespaces: ["wp/v2"], timezone_string: "Africa/Lagos", gmt_offset: 1 };
const editor = { name: "Ed", roles: ["editor"], capabilities: { edit_posts: true, publish_posts: true } };
const statuses = (checks: Array<{ id: string; status: string }>) => Object.fromEntries(checks.map((c) => [c.id, c.status]));

beforeEach(() => vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never));
afterEach(() => vi.unstubAllGlobals());

describe("describeSiteTimezone", () => {
  it("prefers the named zone and falls back to the offset", () => {
    expect(describeSiteTimezone({ timezone_string: "Africa/Lagos", gmt_offset: 1 })).toBe("Africa/Lagos");
    expect(describeSiteTimezone({ timezone_string: "", gmt_offset: 5.5 })).toBe("UTC+5:30");
    expect(describeSiteTimezone({ timezone_string: "", gmt_offset: "-3" })).toBe("UTC-3");
    expect(describeSiteTimezone({ timezone_string: "", gmt_offset: 0 })).toBe("UTC");
  });
});

describe("runWordPressConnectionTest", () => {
  it("passes every check for a working site and reads the timezone without credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json(editor));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWordPressConnectionTest(input);
    expect(result.ok).toBe(true);
    expect(statuses(result.checks)).toEqual({ address: "pass", rest: "pass", auth: "pass", capabilities: "pass", seo: "skip" });
    expect(result.checks.find((c) => c.id === "rest")?.detail).toContain("Africa/Lagos");
    expect(fetchMock.mock.calls[0][0]).toBe("https://blog.example.org/wp-json/");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toMatch(/^Basic /);
  });

  it("fails the address check for a host that doesn't resolve, skipping the rest", async () => {
    vi.mocked(lookup).mockRejectedValueOnce(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWordPressConnectionTest(input);
    expect(result.ok).toBe(false);
    expect(result.checks[0].detail).toMatch(/doesn't exist/);
    expect(statuses(result.checks)).toMatchObject({ rest: "skip", auth: "skip", capabilities: "skip", seo: "skip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a host on a private network", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }] as never);
    const result = await runWordPressConnectionTest(input);
    expect(result.checks[0]).toMatchObject({ status: "fail", detail: expect.stringMatching(/public network/) });
  });

  it("explains a stripped Authorization header apart from bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json({ code: "rest_not_logged_in", message: "You are not currently logged in." }, 401)));
    const stripped = await runWordPressConnectionTest(input);
    expect(stripped.checks.find((c) => c.id === "auth")?.detail).toMatch(/didn't receive the login details/);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json({ code: "incorrect_password", message: "The provided password is an invalid application password." }, 401)));
    const rejected = await runWordPressConnectionTest(input);
    expect(rejected.checks.find((c) => c.id === "auth")?.detail).toMatch(/rejected the username or application password/);
    expect(statuses(rejected.checks)).toMatchObject({ auth: "fail", capabilities: "skip" });
  });

  it("fails when the account can't publish", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json({ name: "C", roles: ["contributor"], capabilities: { edit_posts: true } })));
    const result = await runWordPressConnectionTest(input);
    expect(result.checks.find((c) => c.id === "capabilities")).toMatchObject({ status: "fail", detail: expect.stringMatching(/contributor.*can't publish/) });
  });

  it("warns but carries on when the API hides itself from anonymous requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ code: "rest_cannot_access" }, 401)).mockResolvedValueOnce(json(editor)));
    const result = await runWordPressConnectionTest(input);
    expect(result.ok).toBe(true);
    expect(statuses(result.checks)).toMatchObject({ rest: "warn", auth: "pass" });
  });

  it("fails the API check when /wp-json/ isn't WordPress", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ hello: "world" })));
    const result = await runWordPressConnectionTest(input);
    expect(statuses(result.checks)).toMatchObject({ rest: "fail", auth: "skip" });
  });

  it("checks the selected SEO plugin", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json(index))
      .mockResolvedValueOnce(json(editor))
      .mockResolvedValueOnce(json(index)));
    const result = await runWordPressConnectionTest({ ...input, seoPlugin: "rankmath" });
    expect(result.checks.find((c) => c.id === "seo")).toMatchObject({ status: "fail", detail: expect.stringMatching(/Rank Math is not active/) });
  });
});
