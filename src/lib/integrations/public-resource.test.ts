import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import {
  publicAddress,
  publicResourceUrl,
  readPublicResource,
} from "./public-resource";
beforeEach(() => vi.clearAllMocks());
describe("public source reader", () => {
  it.each([
    "http://ril.org/file",
    "https://user:pass@ril.org/file",
    "https://127.0.0.1/file",
    "https://[::1]/file",
    "https://cms.localhost/file",
    "https://cms.ril.org:8443/file",
  ])("rejects unsafe source URLs: %s", (url) =>
    expect(() => publicResourceUrl(url)).toThrow(),
  );
  it.each([
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "192.168.1.2",
    "172.16.0.5",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("rejects private, special and mapped addresses: %s", (address) =>
    expect(publicAddress(address)).toBe(false),
  );
  it("refuses a DNS answer containing any private address before opening a socket", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      readPublicResource("https://media.ril.org/file"),
    ).rejects.toThrow("public network");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  function response(
    status: number,
    body: string,
    headers: Record<string, string> = {},
  ) {
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mocks.request.mockImplementation((_url, options, callback) => {
      const req = Object.assign(new EventEmitter(), {
        setTimeout: vi.fn(),
        end: () =>
          queueMicrotask(() => {
            const res = Object.assign(new EventEmitter(), {
              statusCode: status,
              headers,
              resume: () => req.emit("close"),
              destroy: (error?: Error) => {
                if (error) res.emit("error", error);
                req.emit("close");
              },
            });
            callback(res);
            if (status >= 200 && status < 300) {
              res.emit("data", Buffer.from(body));
              res.emit("end");
              req.emit("close");
            }
          }),
        destroy: vi.fn(),
      });
      const done = vi.fn();
      options.lookup("media.ril.org", {}, done);
      expect(done).toHaveBeenCalledWith(null, "93.184.216.34", 4);
      expect(options.autoSelectFamily).toBe(false);
      return req;
    });
  }
  it("pins the checked DNS result and returns source bytes", async () => {
    response(200, "Source material", {
      "content-type": "text/plain; charset=utf-8",
      "content-length": "15",
    });
    const result = await readPublicResource("https://media.ril.org/file");
    expect(result.bytes.toString()).toBe("Source material");
    expect(result.mimeType).toBe("text/plain");
  });
  it("never follows redirects into a private destination", async () => {
    response(302, "", { location: "http://169.254.169.254/secret" });
    await expect(
      readPublicResource("https://media.ril.org/file"),
    ).rejects.toThrow("redirect");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("bounds downloads even when Content-Length is absent", async () => {
    response(200, "0123456789");
    await expect(
      readPublicResource("https://media.ril.org/file", { maxBytes: 4 }),
    ).rejects.toThrow("size");
  });
});
