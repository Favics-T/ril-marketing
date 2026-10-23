import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workflowGuideFor } from "./workflow-guides";

const root = join(process.cwd(), "src/app/(dashboard)");
const routes = readdirSync(root, { recursive: true }).map(String).filter(file => /(?:^|[/\\])page\.tsx$/.test(file)).map(file => "/" + file.replace(/[/\\]page\.tsx$/, "").replaceAll("\\", "/").replace(/\[[^/]+\]/g, "example-id"));

describe("workflow navigation coverage", () => {
  it.each(routes)("provides a guide and a working next destination for %s", route => {
    const guide = workflowGuideFor(route);
    expect(guide).toBeDefined();
    const destination = guide!.next.href.split(/[?#]/)[0];
    expect(existsSync(join(root, destination.slice(1), "page.tsx"))).toBe(true);
  });
  it("does not match unrelated paths with a shared word prefix", () => {
    expect(workflowGuideFor("/library-archive")).toBeUndefined();
    expect(workflowGuideFor("/sign-in")).toBeUndefined();
  });
});
