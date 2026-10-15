"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageMotion({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    let frame = 0;
    function enter() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        animation?.cancel();
        if (preference.matches || document.hidden) return;
        animation = element!.animate(
          [{ opacity: .65, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
          { duration: 220, easing: "cubic-bezier(.16,1,.3,1)" }
        );
      });
    }
    const stop = () => { if (preference.matches) animation?.cancel(); };
    // Streaming can replace the loading surface after the route has committed.
    const observer = new MutationObserver(enter);
    observer.observe(element, { childList: true });
    preference.addEventListener("change", stop);
    enter();
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", stop);
      cancelAnimationFrame(frame);
      animation?.cancel();
    };
  }, [pathname]);

  return <div ref={ref} className={className} data-page-motion>{children}</div>;
}
