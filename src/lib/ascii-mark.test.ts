import { describe, expect, it } from "vitest";
import { fallbackMark, renderMark, sampleMark } from "./ascii-mark";

describe("ASCII mark rendering", () => {
  it("retains transparent negative space at every animation phase", () => {
    const samples = sampleMark(new Uint8ClampedArray([255,255,255,0, 60,120,240,255]));
    expect(samples[0]).toBe(0);
    for (const time of [0, 3000, 6000, 9000]) expect(renderMark(samples, 2, 1, time)[0]).toBe(" ");
  });
  it("preserves different face tones instead of flattening the silhouette", () => {
    const samples = sampleMark(new Uint8ClampedArray([20,50,100,255, 80,140,220,255, 180,220,255,255]));
    expect(samples[0]).toBeLessThan(samples[1]); expect(samples[1]).toBeLessThan(samples[2]);
    expect(new Set(renderMark(samples, 3, 1)).size).toBe(3);
  });
  it("is stable at a fixed phase and keeps the character grid intact", () => {
    const mask = fallbackMark(88, 67);
    const frame = renderMark(mask, 88, 67, 0);
    expect(frame).toBe(renderMark(mask, 88, 67, 0));
    expect(frame.split("\n")).toHaveLength(67);
    expect(frame.split("\n").every(line => line.length === 88)).toBe(true);
    expect(mask[33 * 88 + 44]).toBe(0);
  });
});
