"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { workflowGuideFor } from "@/lib/workflow-guides";

export function WorkflowHelp() {
  const pathname = usePathname();
  return <PageGuide key={pathname} pathname={pathname} />;
}

function PageGuide({ pathname }: { pathname: string }) {
  const guide = workflowGuideFor(pathname);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  if (!guide) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="sm" className="min-h-10 shrink-0 gap-2" aria-label="How to use this page"><CircleHelp aria-hidden="true" className="size-4" /><span className="hidden lg:inline">Page guide</span></Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} collisionPadding={16} className="max-h-[min(640px,80dvh)] w-[min(400px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-5" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId} className="text-base font-semibold">{guide.title}</h2>
      <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">{guide.purpose}</p>
      <ol className="mt-4 space-y-4">{guide.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span><span className="sr-only">Step {index + 1}. </span>{step}</span></li>)}</ol>
      {guide.next.href === pathname ? <Button variant="outline" className="mt-5 w-full" onClick={() => setOpen(false)}>Got it, continue on this page</Button> : <Link href={guide.next.href} onClick={() => setOpen(false)} className="mt-5 flex min-h-11 items-center justify-between gap-3 rounded-md border-t pt-3 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{guide.next.label}<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>}
    </PopoverContent>
  </Popover>;
}
