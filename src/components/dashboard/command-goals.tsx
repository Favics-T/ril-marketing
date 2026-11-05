
import { Disclosure } from "@/components/ui/disclosure";

import { Card as ShadcnCard, CardHeader as ShadcnCardHeader, CardTitle as ShadcnCardTitle, CardDescription as ShadcnCardDescription, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowUpRight, } from "lucide-react";
import type { KpiProgress } from "@/lib/audience/kpis";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export function CommandGoals({ kpis }: { kpis: KpiProgress[] }) {
  const measured = kpis.filter(kpi => kpi.current !== null && kpi.fraction !== null);
  const unmeasured = kpis.filter(kpi => kpi.current === null || kpi.fraction === null);

  return <ShadcnCard asChild><section className="workspace-panel command-goals" aria-labelledby="command-goals-heading">
    <ShadcnCardHeader asChild className="flex-row items-start justify-between"><header className="workspace-panel-heading">
      <div><ShadcnCardTitle asChild><h2 id="command-goals-heading">Progress toward your goals</h2></ShadcnCardTitle><ShadcnCardDescription asChild><p>Recorded results against each target</p></ShadcnCardDescription></div>
      <Button asChild variant="ghost" size="sm" className="command-analytics-link"><Link href="/analytics">Analytics<ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
    </header></ShadcnCardHeader>
    <CardContent className="p-0">{!kpis.length ? <p className="workspace-empty">No targets are configured for this workspace.</p> : <div className="command-goals-body">
      {measured.length > 0 ? <figure>
        <div className="command-goal-axis"><span>Target completion</span><span>100%</span></div>
        <ul className="command-goal-list">{measured.map(kpi => {
          const percentage = Math.max(0, (kpi.fraction ?? 0) * 100);
          const progress = Math.min(100, percentage);
          const value = `${Number(kpi.current!.toFixed(1)).toLocaleString()} / ${kpi.target_value.toLocaleString()} ${kpi.unit}`;
          return <li key={kpi.id}>
            <div className="command-goal-label"><div><h3>{kpi.name}</h3><p>{value} · {kpi.period.replaceAll("_", " ")}</p></div><strong>{Number(percentage.toFixed(1))}%</strong></div>
            <Progress value={progress} className="mt-3" aria-label={kpi.name} aria-valuetext={`${value}; ${Number(percentage.toFixed(1))}% of target`} />
          </li>;
        })}</ul>
        <figcaption className="sr-only">Bars show progress against targets, capped at 100%. Numeric labels show the actual percentage.</figcaption>
      </figure> : <p className="text-sm text-muted-foreground">No measured results yet. Your configured targets are listed below.</p>}
      {unmeasured.length > 0 && <Disclosure className="command-unmeasured" title={<><span>{unmeasured.length} {unmeasured.length === 1 ? "goal awaits" : "goals await"} measurement</span></>}>
        
        <p>Missing measurements are not counted as zero progress.</p>
        <ul>{unmeasured.map(kpi => <li key={kpi.id}><span>{kpi.name}</span><span>Target: {kpi.target_value.toLocaleString()} {kpi.unit}</span></li>)}</ul>
      </Disclosure>}
    </div>}</CardContent>
  </section></ShadcnCard>;
}
