import "server-only";
import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";

export function publicResourceUrl(value: string): URL {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !url.hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|test|invalid|example)\.?$/i.test(
      url.hostname,
    ) ||
    /^[\d.]+$|[\[\]:]/.test(url.hostname)
  )
    throw new Error(
      "Use a public HTTPS address without a login or custom port.",
    );
  return url;
}
export function publicAddress(address: string): boolean {
  if (address.includes(":"))
    return /^[23]/i.test(address) && !/^2001:(?:db8|0):/i.test(address);
  const p = address.split(".").map(Number);
  return (
    p.length === 4 &&
    p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    !(
      p[0] === 0 ||
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] >= 224 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && [0, 168].includes(p[1])) ||
      (p[0] === 198 && ([18, 19].includes(p[1]) || p[1] === 51)) ||
      (p[0] === 203 && p[1] === 0 && p[2] === 113)
    )
  );
}
/** Pin a checked DNS result to the HTTPS connection; redirects cannot enter a private network. */
export async function readPublicResource(
  value: string,
  options: { head?: boolean; maxBytes?: number } = {},
) {
  const url = publicResourceUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((row) => !publicAddress(row.address)))
    throw new Error("This address does not resolve only to a public network.");
  const pin = addresses[0];
  return new Promise<{
    bytes: Buffer;
    mimeType: string;
    length: number | null;
  }>((resolve, reject) => {
    const maxBytes = options.maxBytes ?? 14 * 1024 * 1024;
    const requestOptions: RequestOptions & { autoSelectFamily: boolean } = {
      method: options.head ? "HEAD" : "GET",
      family: pin.family,
      autoSelectFamily: false,
      lookup: (_host, _opts, done) => done(null, pin.address, pin.family),
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "identity",
        "User-Agent": "RIL-Source-Reader/1.0",
      },
    };
    const req = request(url, requestOptions, (response) => {
      if (
        !response.statusCode ||
        response.statusCode < 200 ||
        response.statusCode >= 300
      ) {
        response.resume();
        reject(
          new Error(
            "Use a direct file or page URL that opens without a login or redirect.",
          ),
        );
        return;
      }
      const rawLength = response.headers["content-length"];
      const length =
        rawLength && Number.isFinite(Number(rawLength))
          ? Number(rawLength)
          : null;
      if (!options.head && length && length > maxBytes) {
        response.destroy();
        reject(
          new Error(
            "This source is too large. Upload a shorter file or paste a transcript.",
          ),
        );
        return;
      }
      const mimeType = (response.headers["content-type"] ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy(
            new Error("This source exceeds the supported size."),
          );
        } else chunks.push(chunk);
      });
      response.on("aborted", () =>
        reject(
          new Error("The source download was interrupted. Please try again."),
        ),
      );
      response.on("error", reject);
      response.on("end", () =>
        resolve({ bytes: Buffer.concat(chunks), mimeType, length }),
      );
    });
    const deadline = setTimeout(
      () =>
        req.destroy(
          new Error(
            "The source server timed out. Try again or paste the source text.",
          ),
        ),
      25000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.setTimeout(25000, () =>
      req.destroy(
        new Error(
          "The source server timed out. Try again or paste the source text.",
        ),
      ),
    );
    req.on("error", reject);
    req.end();
  });
}
