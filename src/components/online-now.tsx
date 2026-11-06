"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { StatusIndicator } from "@/components/indicator";
import {
  ShareBarList,
  ShareBarListContent,
  ShareBarListFill,
  ShareBarListItem,
  ShareBarListLabel,
  ShareBarListValue,
} from "@/components/share-bar-list";
import type { LiveVisitorStats } from "@/lib/analytics/visitor-stats";

export interface OnlineNowProps {
  /** Live counts fetched on the server — never hardcoded (DESIGN.md). */
  stats: LiveVisitorStats;
  className?: string;
}

/**
 * dashboard-5 widget, wired to real data: distinct visitors in the rolling
 * live window, a delta badge only when the previous window has a baseline,
 * and the device split of whoever is online right now.
 */
export function OnlineNow({ stats, className }: OnlineNowProps) {
  const { count, deltaPct, devices, windowMinutes } = stats;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 flex-col gap-0">
          <CardTitle className="font-mono text-2xl tabular-nums">
            {count}
          </CardTitle>
          <CardDescription>
            {/* ui/tooltip ships without a provider — wrap locally or it throws. */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      "cursor-help px-1 py-px font-normal text-muted-foreground",
                      "hover:underline-0"
                    )}
                    type="button"
                    variant="link"
                  >
                    <StatusIndicator />
                    <span>visitors online</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  In the last {windowMinutes} minutes.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
        </div>
        {count > 0 && deltaPct !== null ? (
          <Delta value={deltaPct} variant="badge">
            <DeltaIcon variant="trend" />
            <DeltaValue suffix="%" />
          </Delta>
        ) : null}
      </CardHeader>
      <CardContent className="relative flex items-center px-0 py-4">
        {devices.length === 0 ? (
          <p className="w-full px-6 py-3 text-sm text-muted-foreground">
            {count === 0
              ? "No one online right now."
              : "No device data for this window."}
          </p>
        ) : (
          <ShareBarList>
            {devices.map((device) => (
              <ShareBarListItem key={device.label} value={device.share}>
                <ShareBarListContent>
                  <ShareBarListLabel>{device.label}</ShareBarListLabel>
                  <ShareBarListValue>{device.share}%</ShareBarListValue>
                </ShareBarListContent>
                <ShareBarListFill data-online-bar />
              </ShareBarListItem>
            ))}
          </ShareBarList>
        )}
      </CardContent>
    </Card>
  );
}
