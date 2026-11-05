import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCheck } from "lucide-react";
import { StatusStamp } from "@/components/ui/status-stamp";
import { ReminderFlag } from "@/components/content/reminder-flag";
import { ChannelIdentity } from "@/components/channel-identity";
import { WorkspaceSection } from "@/components/workspace-section";
import { formatInZone } from "@/lib/time";
import type { NeedsAttention } from "@/lib/content/attention";

/**
 * Command Centre panel for failed publishes and overdue posts (REN-421).
 * `attention` is null when the query failed; the rest of the dashboard still renders.
 */
export function NeedsAttentionPanel({ attention }: { attention: NeedsAttention | null }) {
  const total = attention?.total ?? 0;
  return <WorkspaceSection id="attention-heading" className="overflow-hidden" title={<>Needs attention{attention && total > 0 ? ` (${total})` : ""}</>} description="Failed publishes and posts whose time has passed." action={attention && total > attention.items.length ? <Link href="/calendar" className="ril-inline-action">View calendar<ArrowRight aria-hidden="true"/></Link> : undefined}>
    {!attention
      ? <p role="alert" className="workspace-empty flex items-center gap-3 text-destructive"><AlertCircle className="size-5 shrink-0"/>Couldn&apos;t load failed and overdue posts. Refresh to retry.</p>
      : !attention.items.length
        ? <p className="workspace-empty flex items-center gap-3"><CheckCheck className="size-5 shrink-0"/>Nothing needs attention: no failed or overdue posts.</p>
        : <ul>{attention.items.map((item) => <li key={item.key}><Link href={`/library/${item.assetId}`} className="workspace-row"><div className="min-w-0 flex-1">
            <p className="workspace-row-meta mb-1">{item.kind === "failed"
              ? <>Failed {formatInZone(item.at, "shortDateTime")}{item.destination ? ` on ${item.destination}` : ""}{item.dueAt ? ` · was due ${formatInZone(item.dueAt, "shortDateTime")}` : ""}</>
              : <>Was due {formatInZone(item.at, "shortDateTime")}</>}</p>
            <p className="workspace-row-title">{item.title}</p>
            <div className="workspace-row-meta"><ChannelIdentity channel={item.channel}/></div>
            {item.error ? <p className="mt-1 text-xs text-destructive">{item.error}</p> : null}
          </div>{item.kind === "failed" ? <StatusStamp status="failed"/> : <ReminderFlag state="overdue"/>}</Link></li>)}</ul>}
  </WorkspaceSection>;
}
