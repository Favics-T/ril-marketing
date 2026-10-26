"use client";

import * as React from "react";

/**
 * Tagline reveal — the one big-type moment between hero and workflow.
 * Words start muted and activate in reading order as the block travels
 * through the viewport, driven by a rAF-throttled scroll listener.
 * Reduced-motion and no-JS readers see full colour from the start.
 */
const TEXT =
  "Your activity is the source. Your audience gives it direction. AI prepares the draft. Your team makes the call.";

export function Tagline() {
  const words = React.useMemo(() => TEXT.split(" "), []);
  const ref = React.useRef<HTMLParagraphElement>(null);
  const [enhanced, setEnhanced] = React.useState(false);
  const [active, setActive] = React.useState(words.length);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnhanced(true);

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const travel = vh * 0.55 + rect.height;
      const passed = vh * 0.8 - rect.top;
      const progress = Math.min(1, Math.max(0, passed / travel));
      setActive(Math.round(progress * words.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [words.length]);

  return (
    <section aria-label="The promise" className="ril-home-statement">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
        <p
          ref={ref}
          className="max-w-[680px] text-4xl font-bold leading-[1.18] tracking-tight text-foreground sm:text-5xl"
        >
          {words.map((word, i) => (
            <span
              key={`${word}-${i}`}
              data-active={!enhanced || i < active ? "true" : "false"}
              className="tagline-word"
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
