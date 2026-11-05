import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export interface ProgressBarProps {
  current: number;
  target: number;
  label?: string;
  unit?: string;
  className?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ current, target, label, unit = "", className, showPercentage = true }: ProgressBarProps) {
  const percentage = target > 0 && Number.isFinite(current) && Number.isFinite(target)
    ? Math.max(0, Math.min(100, Math.round(current / target * 100))) : 0;
  const valueText = `${current.toLocaleString()} / ${target.toLocaleString()} ${unit}`.trim();
  return <div className={cn("flex flex-col gap-1.5", className)}>
    {label ? <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{label}</span><span className="text-xs tabular-nums text-muted-foreground">{valueText}</span></div> : null}
    <div className="flex items-center gap-2">
      <Progress value={percentage} aria-label={label ?? "Progress toward target"} aria-valuetext={valueText} />
      {showPercentage ? <span className="w-9 text-right text-xs font-medium tabular-nums">{percentage}%</span> : null}
    </div>
  </div>;
}
