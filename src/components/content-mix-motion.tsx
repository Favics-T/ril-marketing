"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ContentMixMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    element.dataset.motion = "waiting";
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        element.dataset.motion = "playing";
        observer.disconnect();
      }
    }, { threshold: .25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className="content-mix-motion">{children}</div>;
}
