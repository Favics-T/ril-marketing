import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { KpiProgress } from "@/lib/audience/kpis";

export function CommandGoals({ kpis }: { kpis: KpiProgress[] }) {
  const measured = kpis.filter(kpi => kpi.current !== null && kpi.fraction !== null);
  const unmeasured = kpis.filter(kpi => kpi.current === null || kpi.fraction === null);

  return <section className="workspace-panel command-goals" aria-labelledby="command-goals-heading">
    <header className="workspace-panel-heading">
      <div><h2 id="command-goals-heading">Progress toward your goals</h2><p>Recorded results against each target</p></div>
      <Link href="/analytics" className="command-text-link">Analytics<ArrowUpRight aria-hidden="true" /></Link>
    </header>
    {!kpis.length ? <p className="workspace-empty">No targets are configured for this workspace.</p> : <div className="command-goals-body">
      {measured.length > 0 ? <figure>
        <div className="command-goal-axis"><span>Target completion</span><span>100%</span></div>
        <ul className="command-goal-list">{measured.map(kpi => {
          const percentage = Math.max(0, (kpi.fraction ?? 0) * 100);
          const progress = Math.min(100, percentage);
          const value = `${Number(kpi.current!.toFixed(1)).toLocaleString()} / ${kpi.target_value.toLocaleString()} ${kpi.unit}`;
          return <li key={kpi.id}>
            <div className="command-goal-label"><div><h3>{kpi.name}</h3><p>{value} · {kpi.period.replaceAll("_", " ")}</p></div><strong>{Number(percentage.toFixed(1))}%</strong></div>
            <svg viewBox="0 0 400 20" preserveAspectRatio="none" role="img" aria-label={`${kpi.name}: ${value}; ${Number(percentage.toFixed(1))}% of target`}>
              <rect x="0" y="6" width="400" height="8" rx="4" fill="hsl(var(--muted))" />
              {[100, 200, 300].map(x => <line key={x} x1={x} x2={x} y1="3" y2="17" stroke="hsl(var(--border))" />)}
              <rect x="0" y="6" width={progress * 4} height="8" rx="4" fill="hsl(var(--primary))" />
            </svg>
          </li>;
        })}</ul>
        <figcaption className="sr-only">Bars show progress against targets, capped at 100%. Numeric labels show the actual percentage.</figcaption>
      </figure> : <p className="text-sm text-muted-foreground">No measured results yet. Your configured targets are listed below.</p>}
      {unmeasured.length > 0 && <details className="command-unmeasured">
        <summary><span>{unmeasured.length} {unmeasured.length === 1 ? "goal awaits" : "goals await"} measurement</span><ChevronDown aria-hidden="true" /></summary>
        <p>Missing measurements are not counted as zero progress.</p>
        <ul>{unmeasured.map(kpi => <li key={kpi.id}><span>{kpi.name}</span><span>Target: {kpi.target_value.toLocaleString()} {kpi.unit}</span></li>)}</ul>
      </details>}
    </div>}
  </section>;
}
