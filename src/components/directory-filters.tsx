"use client";
import { Button as ShadcnButton } from "@/components/ui/button";


import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

export function DirectoryFilters({ children, title = "Filter content", active = false }: { children: ReactNode; title?: string; active?: boolean }) {
  const [open, setOpen] = useState(active);
  const id = useId();
  return <Collapsible open={open} onOpenChange={setOpen} asChild><aside className="directory-filters" data-expanded={open} aria-label={title}>
    <CollapsibleTrigger asChild><ShadcnButton variant="outline" type="button" className="directory-filter-toggle" aria-controls={id} data-active={active}><SlidersHorizontal data-icon="inline-start" aria-hidden="true" /><span>{title}</span>{active ? <Badge variant="secondary">Active</Badge> : null}<ChevronDown data-icon="inline-end" aria-hidden="true" /></ShadcnButton></CollapsibleTrigger>
    <CollapsibleContent forceMount id={id} className="directory-filter-content data-[state=closed]:hidden">{children}</CollapsibleContent>
  </aside></Collapsible>;
}
