"use client";

import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

export function DirectoryFilters({ children, title = "Filter content", active = false }: { children: ReactNode; title?: string; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <aside className="directory-filters" data-expanded={open} aria-label={title}>
    <button type="button" className="directory-filter-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><SlidersHorizontal aria-hidden="true" /><span>{title}</span>{active ? <span className="directory-filter-active">Active</span> : null}<ChevronDown aria-hidden="true" /></button>
    <div id={id} className="directory-filter-content">{children}</div>
  </aside>;
}
