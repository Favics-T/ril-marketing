// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressBar } from "./progress-bar";
import { RecordPagination } from "@/components/record-navigation";

afterEach(cleanup);

describe("shared library components", () => {
  it.each([{ current: 5, target: 0, expected: 0 }, { current: -5, target: 10, expected: 0 }, { current: 20, target: 10, expected: 100 }])("keeps progress valid for $current / $target", ({ current, target, expected }) => {
    render(<ProgressBar current={current} target={target} label="Registrations" />);
    const progress = screen.getByRole("progressbar", { name: "Registrations" });
    expect(progress.getAttribute("aria-valuenow")).toBe(String(expected));
    expect(progress.getAttribute("aria-valuetext")).toContain(`${current} / ${target}`);
    expect(progress.querySelector('[data-slot="progress-indicator"]')?.getAttribute("style")).not.toContain("NaN");
  });

  it("keeps an unavailable previous page out of keyboard navigation", () => {
    render(<RecordPagination page={1} totalPages={3} nextHref="/library?page=2" />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to next page" }).getAttribute("href")).toBe("/library?page=2");
    const previous = screen.getByText("Previous").closest("a");
    expect(previous?.getAttribute("aria-disabled")).toBe("true");
    expect(previous?.getAttribute("tabindex")).toBe("-1");
    expect(previous?.hasAttribute("href")).toBe(false);
  });
});
