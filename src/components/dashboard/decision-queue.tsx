"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCheck, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { StatusStamp } from "@/components/ui/status-stamp";

export type DecisionItem = { id: string; title: string; kind: "content" | "insight"; detail: string; status: string; href: string };

export function DecisionQueue({ items, contentCount, insightCount, unavailable }: {
  items: DecisionItem[]; contentCount: number; insightCount: number; unavailable: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "content" | "insight">("all");
  const visible = items.filter(item => filter === "all" || item.kind === filter);
  const total = contentCount + insightCount;
  const filters = [{key:"all",label:"All decisions",count:total},{key:"content",label:"Content",count:contentCount},{key:"insight",label:"Insights",count:insightCount}] as const;
  return <Card asChild><section className="decision-queue" aria-labelledby="decisions-heading">
    <CardHeader className="decision-heading"><div><CardTitle asChild><h2 id="decisions-heading">Review queue</h2></CardTitle><CardDescription>{unavailable ? "Some review information is unavailable." : total ? total.toLocaleString() + (total === 1 ? " item is ready for a decision." : " items are ready for a decision.") : "Your review queue is clear."}</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/approvals">All approvals</Link></Button></CardHeader>
    <div className="decision-toolbar"><ToggleGroup type="single" value={filter} onValueChange={value=>{if(value==="all"||value==="content"||value==="insight")setFilter(value);}} aria-label="Filter review queue">
      {filters.map(item=><ToggleGroupItem key={item.key} value={item.key}>{item.label}<Badge variant="secondary">{unavailable ? "Unavailable" : item.count}</Badge></ToggleGroupItem>)}
    </ToggleGroup></div>
    <CardContent className="p-0">
      {visible.length ? <ul className="review-records" aria-label="Items ready for review">{visible.map(item=><li className="review-record" key={item.kind+item.id}>
        <div className="review-record-copy"><p className="review-record-kind">{item.kind === "content" ? "Content draft" : "Audience insight"}</p><h3><Link href={item.href}>{item.title}</Link></h3><p className="review-record-detail">{item.detail}</p></div>
        <div className="review-record-action glass-review-action"><StatusStamp status={item.status} /><Button asChild variant="secondary" size="sm"><Link href={item.href} aria-label={`Review ${item.title}`}>Review</Link></Button></div>
      </li>)}</ul> : <Empty><EmptyHeader><EmptyMedia variant="icon">{unavailable?<AlertCircle aria-hidden="true" />:<CheckCheck aria-hidden="true" />}</EmptyMedia><EmptyTitle>{unavailable?"Review information is incomplete":"Nothing waiting here"}</EmptyTitle><EmptyDescription>{unavailable?"Open approvals or refresh to try again.":"Drafts and audience insights appear here when they are ready for human review."}</EmptyDescription></EmptyHeader></Empty>}
    </CardContent>
    <CardFooter className="decision-footer"><p>AI prepares. Your team approves.</p>{visible.length>0&&total>items.length?<Button asChild variant="link" size="sm"><Link href="/approvals">View all {total.toLocaleString()} decisions</Link></Button>:null}</CardFooter>
  </section></Card>;
}
