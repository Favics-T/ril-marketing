import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChannelIdentity, ContentChannels } from "./channel-identity";
import { ChannelSelect } from "./channel-select";

describe("social channel identity", () => {
  it.each(["linkedin", "instagram", "facebook", "x", "twitter", "youtube", "tiktok", "threads", "bluesky", "pinterest", "mastodon", "Instagram"])("names the %s icon for assistive technology and hover", channel => {
    const html = renderToStaticMarkup(<ChannelIdentity channel={channel} />);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="[^"]+" title="[^"]+"/);
    expect(html).toContain('<svg');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/>(Instagram|LinkedIn|Facebook|YouTube|TikTok|Threads|Bluesky|X)</);
  });

  it("preserves non-social and unrecognised source names", () => {
    expect(renderToStaticMarkup(<ChannelIdentity channel="email" />)).toContain(">Email</span>");
    expect(renderToStaticMarkup(<ChannelIdentity channel="Partner referral" />)).toContain("Partner referral");
    expect(renderToStaticMarkup(<ChannelIdentity channel={null} />)).toBe("");
  });

  it("does not repeat the same platform when a legacy alias is also stored", () => {
    const html = renderToStaticMarkup(<ContentChannels channel="twitter" platform="x" format="social post" />);
    expect(html.match(/role="img"/g)).toHaveLength(1);
    expect(html).toContain("social post");
  });

  it("submits the original value for filters that can be cleared", () => {
    const options = [["", "All platforms"], ["x", "X"]] as const;
    expect(renderToStaticMarkup(<ChannelSelect name="platform" options={options} defaultValue="x" />)).toContain('type="hidden" name="platform" value="x"');
    expect(renderToStaticMarkup(<ChannelSelect name="platform" options={options} />)).toContain('type="hidden" name="platform" value=""');
    expect(renderToStaticMarkup(<ChannelSelect name="platform" options={options} disabled />)).toMatch(/<input[^>]+disabled=""[^>]+name="platform"/);
  });
});
