import type { ReactNode } from "react";

export function PageMotion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className} data-page-motion>{children}</div>;
}
