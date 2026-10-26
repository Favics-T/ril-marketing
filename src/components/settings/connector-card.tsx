import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusStamp } from "@/components/ui/status-stamp";

/**
 * Shared frame for every connector on Settings → AI: what the service is for,
 * whether it is connected, and the one action that changes that. Presentational
 * only — each connector owns its own connect flow underneath.
 */
export function ConnectorCard({
  icon,
  title,
  blurb,
  connected,
  badge,
  children,
  id,
}: {
  icon: ReactNode;
  title: string;
  blurb: string;
  connected: boolean;
  /** Short factual line under the blurb, e.g. the connected account. */
  badge?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="slip ril-connector scroll-mt-24 flex flex-col px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
              connected
                ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h3>
            <p className="mt-1 max-w-[54ch] text-[13px] leading-5 text-muted-foreground">
              {blurb}
            </p>
            {badge ? <p className="dateline mt-1.5">{badge}</p> : null}
          </div>
        </div>
        <StatusStamp variant={connected ? "approved" : "cold"}>
          {connected ? "Connection saved" : "Not connected"}
        </StatusStamp>
      </div>
      <div className="mt-4 border-t border-border/80 pt-4">{children}</div>
    </section>
  );
}
