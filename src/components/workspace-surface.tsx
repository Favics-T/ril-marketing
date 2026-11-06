"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function WorkspaceSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const family = pathname.startsWith("/settings") ? "settings"
    : /^\/(library|repurpose|seo|activities)/.test(pathname) ? "content"
    : pathname.startsWith("/audience") ? "audience"
    : /^\/(leads|email|nurture|community)/.test(pathname) ? "growth"
    : /^\/(analytics|reports)/.test(pathname) ? "reporting" : "planning";
  return <div className="workspace-surface" data-family={family}>{children}</div>;
}
