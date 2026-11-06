"use client";

import { useEffect, useRef } from "react";
import { fallbackMark, renderMark, sampleMark } from "@/lib/ascii-mark";

const COLS = 88;

export function AsciiLogo({ className }: { className?: string }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = ref.current;
    const panel = pre?.parentElement;
    if (!pre || !panel) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const font = getComputedStyle(pre).fontFamily;
    if (context) context.font = `100px ${font}`;
    const cellAspect = context ? context.measureText("M").width / 100 : .6;
    const rows = Math.round(COLS * (715 / 561) * cellAspect);
    let samples = fallbackMark(COLS, rows);
    let frame = 0, cancelled = false, lastFrame = 0, elapsed = 0, panelVisible = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function paint(time: number) {
      const text = renderMark(samples, COLS, rows, time);
      if (pre!.textContent !== text) pre!.textContent = text;
    }
    function fit() {
      const { width, height } = panel!.getBoundingClientRect();
      const wasVisible = panelVisible;
      panelVisible = width > 0 && height > 0;
      pre!.style.fontSize = `${Math.max(1, Math.min(12, width * .82 / (COLS * cellAspect), height * .82 / rows))}px`;
      if (wasVisible !== panelVisible) synchronizeMotion();
    }
    function tick(now: number) {
      if (cancelled || !panelVisible || document.hidden || motion.matches) return;
      if (now - lastFrame >= 80) {
        elapsed += lastFrame ? Math.min(now - lastFrame, 120) : 0;
        lastFrame = now;
        paint(elapsed);
      }
      frame = requestAnimationFrame(tick);
    }
    function synchronizeMotion() {
      cancelAnimationFrame(frame);
      lastFrame = 0;
      if (motion.matches || document.hidden || !panelVisible) paint(0);
      else frame = requestAnimationFrame(tick);
    }

    fit(); paint(0);
    const resize = new ResizeObserver(fit);
    resize.observe(panel);
    motion.addEventListener("change", synchronizeMotion);
    document.addEventListener("visibilitychange", synchronizeMotion);
    synchronizeMotion();
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled || !context) return;
      try {
        canvas.width = COLS; canvas.height = rows;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, COLS, rows);
        const sampled = sampleMark(context.getImageData(0, 0, COLS, rows).data);
        if (sampled.some(value => value > 0)) samples = sampled;
      } catch { /* Retain the bracket silhouette if image pixels are unavailable. */ }
      paint(motion.matches ? 0 : elapsed);
    };
    image.src = "/assets/images/ril-hero.png";

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      motion.removeEventListener("change", synchronizeMotion);
      document.removeEventListener("visibilitychange", synchronizeMotion);
      image.onload = null;
    };
  }, []);

  return <div className={className} aria-hidden="true">
    <pre ref={ref} className="m-0 select-none whitespace-pre font-mono" style={{ lineHeight: 1, letterSpacing: 0, fontVariantLigatures: "none" }} />
  </div>;
}
