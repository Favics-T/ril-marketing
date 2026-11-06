import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8").replace(/\r\n/g, "\n");
const rehearsal = read("supabase/tests/ren416_rehearsal.sql");
// Top-level transaction control only; DO blocks use bare BEGIN and END $$;.
const transactionStatements = (sql: string) =>
  [...sql.matchAll(/^\s*(BEGIN|COMMIT|END|ROLLBACK)\s*;/gim)].map((match) => match[1].toUpperCase());

describe("REN-416 production rehearsal", () => {
  it("is regenerated from the current migration and isolation checks", () => {
    expect(() => execFileSync(process.execPath, ["scripts/build-ren416-rehearsal.mjs", "--check"], { cwd: root, stdio: "pipe" })).not.toThrow();
  });

  it("opens one transaction and only ever rolls it back", () => {
    expect(transactionStatements(rehearsal)).toEqual(["BEGIN", "ROLLBACK"]);
    expect(rehearsal.trimEnd().endsWith("\nROLLBACK;")).toBe(true);
  });

  it("wraps a migration that has no transaction control of its own", () => {
    expect(transactionStatements(read("supabase/migrations/20261015000000_workspace_access_fix.sql"))).toEqual([]);
  });
});
