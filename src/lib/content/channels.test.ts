import { describe, expect, it } from "vitest";
import { checkChannelLimits, normalizeChannel } from "@/lib/content/channels";

describe("normalizeChannel", () => {
  it("maps free-typed channels onto the fixed list", () => {
    expect(normalizeChannel("LinkedIn")).toBe("linkedin");
    expect(normalizeChannel(" Twitter ")).toBe("x");
    expect(normalizeChannel("blog")).toBe("website");
    expect(normalizeChannel("newsletter")).toBe("email");
    expect(normalizeChannel("Telegram")).toBe("other");
    expect(normalizeChannel("")).toBeNull();
    expect(normalizeChannel(null)).toBeNull();
  });
});

describe("checkChannelLimits", () => {
  it("passes copy within the limit and blocks copy over it", () => {
    expect(checkChannelLimits("linkedin", "a".repeat(3000)).problems).toEqual([]);
    expect(checkChannelLimits("linkedin", "a".repeat(3001)).problems[0]).toMatch(/3001 characters; the limit is 3000/);
  });

  it("counts X links as 23 characters and checks each thread post separately", () => {
    const withLink = `${"a".repeat(250)} https://example.com/a/very/long/path/that/would/otherwise/overflow`;
    expect(checkChannelLimits("x", withLink).problems).toEqual([]);
    const thread = `Short post\n\n— Optional thread (post each separately) —\n\n1/ fine\n\n2/ ${"b".repeat(300)}`;
    const check = checkChannelLimits("x", thread);
    expect(check.problems).toHaveLength(1);
    expect(check.problems[0]).toMatch(/^Thread post 2 is/);
  });

  it("limits Instagram hashtags", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ");
    expect(checkChannelLimits("instagram", `Caption\n\n${tags}`).problems[0]).toMatch(/allows 30 hashtags; this has 31/);
  });

  it("never blocks channels without a limit or short-form clip briefs", () => {
    expect(checkChannelLimits("website", "a".repeat(50000)).problems).toEqual([]);
    expect(checkChannelLimits(null, "a".repeat(50000)).problems).toEqual([]);
    expect(checkChannelLimits("x", "a".repeat(1000), "short-form video").problems).toEqual([]);
  });
});
