import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCheck } from "lucide-react";
import { StatusStamp } from "@/components/ui/status-stamp";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { channelLabel } from "@/lib/channels";
import { formatInZone } from "@/lib/time";
import type { NeedsAttention } from "@/lib/content/attention";

/**
 * Command Centre panel for failed publishes and overdue posts (REN-421).
 * `attention` is null when the query failed; the rest of the dashboard still renders.
 */
export function NeedsAttentionPanel({ attention }: { attention: NeedsAttention | null }) {
  const total = attention?.total ?? 0;
  return <section className="workspace-panel overflow-hidden" aria-labelledby="attention-heading">
    <header className="workspace-panel-heading"><div><h2 id="attention-heading">Needs attention{attention && total > 0 ? ` (${total})` : ""}</h2><p>Failed publishes and posts whose time has passed.</p></div>{attention && total > attention.items.length ? <Link href="/calendar" className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">View all on the calendar<ArrowRight className="size-3.5"/></Link> : null}</header>
    {!attention
      ? <p role="alert" className="workspace-empty flex items-center gap-3 text-destructive"><AlertCircle className="size-5 shrink-0"/>Couldn&apos;t load failed and overdue posts. Refresh to retry.</p>
      : !attention.items.length
        ? <p className="workspace-empty flex items-center gap-3"><CheckCheck className="size-5 shrink-0"/>Nothing needs attention: no failed or overdue posts.</p>
        : <ul>{attention.items.map((item) => <li key={item.key}><Link href={`/library/${item.assetId}`} className="workspace-row"><div className="min-w-0 flex-1">
            <p className="workspace-row-meta mb-1">{item.kind === "failed"
              ? <>Failed {formatInZone(item.at, "shortDateTime")}{item.destination ? ` on ${item.destination}` : ""}{item.dueAt ? ` · was due ${formatInZone(item.dueAt, "shortDateTime")}` : ""}</>
              : <>Was due {formatInZone(item.at, "shortDateTime")}</>}</p>
            <p className="workspace-row-title">{item.title}</p>
            <p className="workspace-row-meta">{channelLabel(item.channel)}</p>
            {item.error ? <p className="mt-1 text-xs text-destructive">{item.error}</p> : null}
          </div>{item.kind === "failed" ? <StatusStamp status="failed"/> : <ReminderFlag state="overdue"/>}</Link></li>)}</ul>}
  </section>;
}
