import { setTimeout } from "node:timers/promises";

const input = process.argv[2];
let origin;
try {
  const url = new URL(input);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !(url.protocol === "https:" || url.protocol === "http:" && loopback)) throw new Error();
  origin = url.origin;
} catch {
  console.error("Pass a public HTTPS origin or a localhost HTTP origin without a path, query or credentials.");
  process.exit(1);
}

async function probe(path, init = {}) {
  return fetch(new URL(path, origin), { ...init, redirect: "manual", signal: AbortSignal.timeout(10_000) });
}

if (process.argv.includes("--wait")) {
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await probe("/sign-in");
      await response.body?.cancel();
      if (response.ok) { ready = true; break; }
    } catch {}
    await setTimeout(250);
  }
  if (!ready) {
    console.error("FAIL Server did not become ready within 30 seconds.");
    process.exit(1);
  }
}

const checks = [
  ...["/", "/sign-in"].map(path => ({ path, status: 200, html: true })),
  ...["/dashboard", "/library", "/approvals", "/analytics", "/settings/ai"].map(path => ({ path, status: 307, login: true })),
  ...["/api/cron/email-delivery", "/api/cron/content-publishing"].map(path => ({ path, status: 401 })),
  { path: "/api/webhooks/resend", status: 405 },
  { path: "/api/webhooks/resend", status: 400, init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } },
];
let failures = 0;
for (const check of checks) {
  const name = `${check.init?.method ?? "GET"} ${check.path}`;
  try {
    const response = await probe(check.path, check.init);
    let ok = response.status === check.status;
    if (check.html) ok &&= response.headers.get("content-type")?.includes("text/html") === true;
    if (check.login) {
      const target = new URL(response.headers.get("location") ?? "", origin);
      ok &&= target.origin === origin && target.pathname === "/sign-in";
    }
    await response.body?.cancel();
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: HTTP ${response.status}${ok ? "" : `; expected ${check.status}${check.login ? " redirect to this site's /sign-in" : ""}`}`);
  } catch {
    failures++;
    console.error(`FAIL ${name}: request failed`);
  }
}
console.log("Checks used no credentials and made no authenticated requests. No email or publishing job was triggered.");
process.exitCode = failures ? 1 : 0;
