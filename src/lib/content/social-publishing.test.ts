import { describe, expect, it } from "vitest";
import { bufferPostProblem } from "./social-publishing";

const copy = { body: "Approved copy", platform: "linkedin", channel: "social", format: "social post" };
const channel = { id: "account", service: "linkedin", isDisconnected: false, isLocked: false, isQueuePaused: false };
describe("social publishing preflight", () => {
  it("accepts approved Instagram images and YouTube videos with their required metadata",()=>{
    expect(bufferPostProblem({...copy,platform:"instagram",metadata:{social_post:{media:[{type:"image",url:"https://media.ril.org/photo.jpg"}]}}},{...channel,service:"instagram"})).toBeNull();
    expect(bufferPostProblem({...copy,platform:"youtube",metadata:{social_post:{media:[{type:"video",url:"https://media.ril.org/movie.mp4"}],videoTitle:"Source highlights"}}},{...channel,service:"youtube"})).toBeNull();
  });
  it("rejects expiring media, mismatched post types, incomplete YouTube videos and mixed media",()=>{
    expect(bufferPostProblem({...copy,metadata:{social_post:{media:[{type:"image",url:"https://media.ril.org/photo.jpg?token=secret"}]}}},channel)).toContain("correct");
    expect(bufferPostProblem({...copy,metadata:{social_post:{postType:"story"}}},channel)).toContain("Reels and stories");
    expect(bufferPostProblem({...copy,platform:"youtube",metadata:{social_post:{media:[{type:"video",url:"https://media.ril.org/movie.mp4"}]}}},{...channel,service:"youtube"})).toContain("title");
    expect(bufferPostProblem({...copy,metadata:{social_post:{media:[{type:"video",url:"https://media.ril.org/movie.mp4"},{type:"image",url:"https://media.ril.org/photo.jpg"}]}}},channel)).toContain("one video");
  });
  it("permits matching approved text and the Twitter alias", () => {
    expect(bufferPostProblem(copy, channel)).toBeNull();
    expect(bufferPostProblem({ ...copy, platform: "x" }, { ...channel, service: "twitter" })).toBeNull();
  });
  it.each(["isDisconnected", "isLocked", "isQueuePaused"])("blocks %s even when the copy fits", field => {
    expect(bufferPostProblem(copy, { ...channel, [field]: true })).toBeTruthy();
  });
  it("does not send a script, empty text, media-only post or a different platform", () => {
    expect(bufferPostProblem({ ...copy, format: "short-form video" }, channel)).toContain("production script");
    expect(bufferPostProblem({ ...copy, body: " " }, channel)).toContain("copy");
    expect(bufferPostProblem({ ...copy, platform: "instagram" }, { ...channel, service: "instagram" })).toContain("media");
    expect(bufferPostProblem(copy, { ...channel, service: "facebook" })).toContain("matching");
  });
  it("blocks a multi-part X draft and oversized paragraphs before Buffer", () => {
    const x = { ...channel, service: "x" };
    expect(bufferPostProblem({ ...copy, platform: "x", body: "Main\n\n— Optional thread (post each separately) —\n\nMore" }, x)).toContain("separate X thread");
    expect(bufferPostProblem({ ...copy, platform: "x", body: "a".repeat(281) }, x)).toContain("280");
  });
  it("enforces conservative text limits on supported networks outside the editorial catalogue", () => {
    for (const [service, limit] of [["threads", 500], ["bluesky", 300], ["mastodon", 500]] as const) {
      expect(bufferPostProblem({ ...copy, platform: service, body: "a".repeat(limit + 1) }, { ...channel, service })).toContain(`${limit}`);
    }
  });
});
