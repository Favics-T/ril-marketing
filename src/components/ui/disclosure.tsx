"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DisclosureProps = Omit<React.ComponentPropsWithoutRef<typeof Collapsible>, "title"> & {
  title: React.ReactNode;
  summaryClassName?: string;
  initiallyOpen?: boolean;
};

export const Disclosure = React.forwardRef<HTMLDivElement, DisclosureProps>(function Disclosure(
  { title, summaryClassName, children, className, initiallyOpen, defaultOpen, onInvalidCapture, ...props }, ref,
) {
  const [expanded, setExpanded] = React.useState(initiallyOpen ?? defaultOpen ?? false);
  React.useEffect(() => { if (initiallyOpen !== undefined) setExpanded(initiallyOpen); }, [initiallyOpen]);
  return <Collapsible ref={ref} open={expanded} onOpenChange={setExpanded} onInvalidCapture={event => { if (!expanded) flushSync(() => setExpanded(true)); onInvalidCapture?.(event); }} data-slot="disclosure" data-disclosure="" className={cn("group/disclosure min-w-0", className)} {...props}>
    <CollapsibleTrigger asChild>
      <Button type="button" variant="ghost" data-slot="disclosure-trigger" className={cn("h-auto w-full justify-between gap-4 whitespace-normal text-left", summaryClassName)}>
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDown aria-hidden="true" className="transition-transform duration-150 group-data-[state=open]/disclosure:rotate-180 motion-reduce:transition-none" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent forceMount data-slot="disclosure-content" className="min-w-0 data-[state=closed]:hidden">
      {children}
    </CollapsibleContent>
  </Collapsible>;
});
