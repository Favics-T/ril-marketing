"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileText, Lightbulb, CheckCheck } from "lucide-react";
import { StatusStamp } from "@/components/ui/status-stamp";

export type DecisionItem = { id: string; title: string; kind: "content" | "insight"; detail: string; status: string; href: string };

export function DecisionQueue({ items, contentCount, insightCount, unavailable }: {
  items: DecisionItem[]; contentCount: number; insightCount: number; unavailable: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "content" | "insight">("all");
  const visible = items.filter(item => filter === "all" || item.kind === filter);
  const total = contentCount + insightCount;
  const tabs = [{ key: "all", label: "All decisions", count: total }, { key: "content", label: "Content", count: contentCount }, { key: "insight", label: "Insights", count: insightCount }] as const;

  return <section className="decision-queue" aria-labelledby="decisions-heading">
    <header className="decision-heading"><div><h2 id="decisions-heading">Needs your decision</h2><p>{unavailable ? "Some review information is unavailable." : total ? `${total} ${total === 1 ? "item is" : "items are"} ready for a human review.` : "Your review queue is clear."}</p></div><Link href="/approvals" className="ril-inline-action">Open approvals<ArrowRight aria-hidden="true" /></Link></header>
    <div className="decision-tabs" role="group" aria-label="Filter review queue">{tabs.map(tab => <button type="button" key={tab.key} onClick={() => setFilter(tab.key)} aria-pressed={filter === tab.key}>{tab.label}<span>{unavailable ? "Unavailable" : tab.count}</span></button>)}</div>
    <ul className="decision-list">{visible.map(item => <li key={item.kind + item.id}><Link href={item.href} className="decision-row"><span className="decision-kind" aria-hidden="true">{item.kind === "content" ? <FileText /> : <Lightbulb />}</span><div className="decision-copy"><p>{item.detail}</p><h3>{item.title}</h3><StatusStamp status={item.status} /></div><span className="decision-open">Review<ArrowRight aria-hidden="true" /></span></Link></li>)}</ul>
    {!visible.length ? <div className="decision-empty"><CheckCheck aria-hidden="true" /><div><h3>{unavailable ? "Review information is incomplete" : "Nothing waiting here"}</h3><p>{unavailable ? "Open approvals or refresh to try again." : "New drafts and audience insights will appear here when they are ready for review."}</p></div></div> : null}
    <footer><span>AI prepares the work. Your team decides what goes live.</span>{visible.length > 0 && total > items.length ? <Link href="/approvals" className="ril-inline-action">View all {total} decisions</Link> : null}</footer>
  </section>;
}
