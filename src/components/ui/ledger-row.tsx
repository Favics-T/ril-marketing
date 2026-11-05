import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LedgerRowProps {
  label: string;
  value: number | string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  unit?: string;
  href?: string;
  className?: string;
}

export function LedgerRow({
  label,
  value,
  change,
  changeType,
  unit,
  href,
  className,
}: LedgerRowProps) {
  const content = (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="tnum text-xl font-semibold">
          {typeof value === "number" ? value.toLocaleString() : value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </span>
        {change !== undefined && changeType && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              changeType === "increase" && "text-emerald-600 ",
              changeType === "decrease" && "text-red-600 ",
              changeType === "neutral" && "text-muted-foreground"
            )}
          >
            {changeType === "increase" && <ArrowUp className="h-3 w-3" />}
            {changeType === "decrease" && <ArrowDown className="h-3 w-3" />}
            {changeType === "neutral" && <Minus className="h-3 w-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "block hover:bg-muted/50 rounded px-2 -mx-2 transition-colors",
          className
        )}
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
