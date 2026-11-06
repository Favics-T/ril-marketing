import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { AuthForm } from "./auth-form";

describe("authentication before hydration", () => {
  it.each(["sign-in", "sign-up"] as const)("keeps %s credentials out of GET requests", mode => {
    const html = renderToStaticMarkup(<AuthForm mode={mode} />);
    expect(html).toMatch(/<form\b[^>]*\bmethod="post"/);
    expect(html).toMatch(/<button\b[^>]*\btype="submit"[^>]*\bdisabled=""/);
    expect(html).toMatch(/<input\b[^>]*\btype="password"/);
  });
});
