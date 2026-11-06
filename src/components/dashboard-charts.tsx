"use client";

import Link from "next/link";
import { Pie, PieChart, type PieLabelRenderProps } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { ChannelIdentity } from "@/components/channel-identity";
import { channelLabel } from "@/lib/channels";
import type { KpiProgress } from "@/lib/audience/kpis";

const COLORS = ["var(--app-chart-1)", "var(--app-chart-2)", "var(--app-chart-3)"];
const LABEL_COLORS = ["var(--app-chart-label-1)", "var(--app-chart-label-2)", "var(--app-chart-label-3)"];

function PercentageLabel({ cx, cy, midAngle = 0, innerRadius, outerRadius, percent = 0, index = 0 }: PieLabelRenderProps) {
  if (percent <= .06) return null;
  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) / 2;
  const radians = -midAngle * Math.PI / 180;
  return <text x={Number(cx) + radius * Math.cos(radians)} y={Number(cy) + radius * Math.sin(radians)} textAnchor="middle" dominantBaseline="middle" fill={LABEL_COLORS[index]} fontWeight={600} fontSize={14}>{Math.round(percent * 100)}%</text>;
}

export function ContentMixChart({ channels, total }: { channels: { channel: string; count: number }[]; total: number }) {
  const count = channels.reduce((sum, item) => sum + item.count, 0);
  const ordered = channels.filter(item => item.count > 0).sort((a, b) => b.count - a.count);
  const slices = ordered.slice(0, ordered.length > 3 ? 2 : 3);
  if (ordered.length > 3) slices.push({ channel: "Other", count: ordered.slice(2).reduce((sum, item) => sum + item.count, 0) });
  const data = slices.map((slice, index) => ({ ...slice, label: channelLabel(slice.channel), fill: `var(--color-channel${index})` }));
  const config: ChartConfig = Object.fromEntries(slices.map((slice, index) => [`channel${index}`, { label: channelLabel(slice.channel), color: COLORS[index] }]));
  return <Card asChild><section aria-labelledby="content-mix-heading" className="ril-content-mix flex flex-col overflow-hidden">
    <CardHeader className="flex-row items-start justify-between border-b"><CardTitle asChild><h2 id="content-mix-heading">Content mix</h2></CardTitle><CardDescription>{count < total ? `${count} sampled assets of ${total}` : `${count} content assets`} · share by channel</CardDescription></CardHeader>
    {!count ? <CardContent className="py-12"><p>Add content to see how it is distributed across your channels.</p><Link href="/library/new" className="mt-4 block">Add content</Link></CardContent> : <CardContent asChild className="pt-3"><figure>
      <ChartContainer config={config} className="mx-auto my-5 aspect-square h-60 w-full max-w-60" role="img" aria-label={`Content mix, ${count} assets: ${slices.map(slice => `${channelLabel(slice.channel)} ${Number((slice.count / count * 100).toFixed(1))} percent`).join(", ")}`}>
        <PieChart><ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="label" hideLabel />} /><Pie data={data} dataKey="count" nameKey="label" innerRadius={56} outerRadius={104} paddingAngle={3} stroke="var(--app-panel)" strokeWidth={2} isAnimationActive={false} labelLine={false} label={PercentageLabel} /></PieChart>
      </ChartContainer>
      <ul className="mb-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm" aria-label="Channel legend">{slices.map((slice, index) => <li key={slice.channel} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: COLORS[index] }} aria-hidden="true" /><ChannelIdentity channel={slice.channel} /><span className="tabular-nums text-muted-foreground">{slice.count}</span></li>)}</ul>
      <figcaption className="sr-only">Share of content by channel. {slices.map(slice => `${channelLabel(slice.channel)}: ${slice.count} assets.`).join(" ")}</figcaption>
    </figure></CardContent>}
  </section></Card>;
}

export function KpiProgressChart({ kpis, periodLabel = "Current period · each target equals 100%" }: { kpis: KpiProgress[]; periodLabel?: string }) {
  return <Card asChild><section className="workspace-panel overflow-hidden" aria-labelledby="kpi-progress-heading">
    <CardHeader className="workspace-panel-heading"><CardTitle asChild><h2 id="kpi-progress-heading">Progress toward your goals</h2></CardTitle><CardDescription>{periodLabel}</CardDescription></CardHeader>
    {!kpis.length ? <CardContent><p>No targets are configured for this workspace.</p></CardContent> : <CardContent asChild><figure>
      <div className="flex justify-between pb-4 text-xs text-muted-foreground"><span>Target completion</span><span>0% to 100%</span></div>
      <ul className="flex flex-col gap-4">{kpis.map(kpi => {
        const pct = kpi.fraction === null ? null : Math.min(100, Math.max(0, kpi.fraction * 100));
        const value = kpi.current === null ? "Not measured" : `${Number(kpi.current.toFixed(1)).toLocaleString()} / ${kpi.target_value.toLocaleString()} ${kpi.unit}`;
        return <li key={kpi.id}><div className="mb-1.5 flex flex-wrap justify-between gap-1 text-xs"><span className="font-semibold">{kpi.name}</span><span className="text-muted-foreground">{value}</span></div>{pct === null ? <p className="text-xs text-muted-foreground">Awaiting measurement</p> : <Progress value={pct} aria-label={kpi.name} getValueLabel={() => `${value}; ${Number(pct.toFixed(1))}% of target`} />}</li>;
      })}</ul><figcaption className="mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground">Goals without measurements are labelled “Not measured”. Missing data is never shown as zero progress.</figcaption>
    </figure></CardContent>}
  </section></Card>;
}
