import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DisclosureSummary({ children, className, ...props }: ComponentProps<"summary">) {
  return <summary {...props} className={cn("disclosure-summary", className)}><span>{children}</span><ChevronDown aria-hidden="true" /></summary>;
}
