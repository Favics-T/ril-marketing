import { ChannelIdentity } from "@/components/channel-identity";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ContentMixMotion } from "@/components/content-mix-motion";
import "@/components/content-mix-motion.css";
import { channelLabel } from "@/lib/channels";
import type { KpiProgress } from "@/lib/audience/kpis";

const TINTS = ["#e5e7eb", "#a6b0bd", "#748194"];

export function ContentMixChart({ channels, total }: { channels: { channel: string; count: number }[]; total: number }) {
  const count = channels.reduce((sum, item) => sum + item.count, 0);
  const ordered = channels.filter(item => item.count > 0).sort((a,b) => b.count-a.count);
  const slices = ordered.slice(0, ordered.length > 3 ? 2 : 3);
  if (ordered.length > 3) slices.push({ channel: "Other", count: ordered.slice(2).reduce((sum,item)=>sum+item.count,0) });
  let angle = -Math.PI / 2 - (slices[0]?.count ?? 0) / Math.max(count,1) * Math.PI;
  const point = (radius: number, at: number) => `${120+radius*Math.cos(at)} ${120+radius*Math.sin(at)}`;
  return (
    <section aria-labelledby="content-mix-heading" className="flex flex-col overflow-hidden rounded-xl border border-[var(--surface-strong-border)] bg-[var(--surface-strong)] text-[var(--surface-strong-foreground)]">
      <header className="border-b border-[var(--surface-strong-border)] px-6 py-5"><h2 id="content-mix-heading" className="text-[15px] font-semibold">Content mix</h2><p className="mt-1 text-xs leading-5 text-[var(--surface-strong-muted)]">{count < total ? `${count} sampled assets of ${total}` : `${count} content assets`} · share by channel</p></header>
      {!count ? <div className="px-5 py-12 text-sm text-[#d7e0eb]">Add content to see how it is distributed across your channels. <Link href="/library/new" className="mt-4 block underline">Add content</Link></div> : <figure className="px-5 pb-5 pt-3">
        <ContentMixMotion><svg viewBox="0 0 240 240" className="mx-auto my-5 w-full max-w-60" role="img" aria-label={`Content mix, ${count} assets: ${slices.map(s=>`${channelLabel(s.channel)} ${Number((s.count/count*100).toFixed(1))} percent`).join(", ")}`}>
          {slices.map((slice,i)=>{
            const fraction=slice.count/count;
            const gap=Math.min(.025,fraction*Math.PI*.1);
            const start=angle+gap; angle+=fraction*Math.PI*2;
            const end=angle-gap;
            const mid=(start+end)/2;
            const corner=Math.min(6,(end-start)*48/4);
            const outerInset=corner/104;
            const innerInset=corner/48;
            const outerLarge=end-start-2*outerInset>Math.PI?1:0;
            const innerLarge=end-start-2*innerInset>Math.PI?1:0;
            const path=`M ${point(104,start+outerInset)} A 104 104 0 ${outerLarge} 1 ${point(104,end-outerInset)} Q ${point(104,end)} ${point(104-corner,end)} L ${point(48+corner,end)} Q ${point(48,end)} ${point(48,end-innerInset)} A 48 48 0 ${innerLarge} 0 ${point(48,start+innerInset)} Q ${point(48,start)} ${point(48+corner,start)} L ${point(104-corner,start)} Q ${point(104,start)} ${point(104,start+outerInset)} Z`;
            return <g key={slice.channel} className="content-mix-slice" style={{"--slice-delay":`${i*60}ms`,"--slice-x":`${Math.cos(mid)*4}px`,"--slice-y":`${Math.sin(mid)*4}px`} as CSSProperties}><g className="content-mix-slice-body">{slices.length===1?<circle cx="120" cy="120" r="76" fill="none" stroke={TINTS[i]} strokeWidth="56"/>:<path d={path} fill={TINTS[i]}/>}<title>{`${channelLabel(slice.channel)}: ${slice.count} assets (${Number((fraction*100).toFixed(1))}%)`}</title>{fraction>.06&&<text x={120+76*Math.cos(mid)} y={120+76*Math.sin(mid)} dominantBaseline="middle" textAnchor="middle" fill={i<2?"#182332":"#0b1420"} fontSize="14" fontWeight="600" style={{fontVariantNumeric:"tabular-nums"}}>{Math.round(fraction*100)}%</text>}</g></g>;
          })}
        </svg></ContentMixMotion>
        <ul className="mb-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium" aria-label="Channel legend">{slices.map((slice,i)=><li key={slice.channel} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-[2px]" style={{background:TINTS[i]}} aria-hidden="true"/><span className="capitalize text-[#e5e7eb]">{<ChannelIdentity channel={slice.channel} />}</span><span className="tabular-nums text-[var(--surface-strong-muted)]">{slice.count}</span></li>)}</ul>
        <figcaption className="sr-only">Share of content by channel. {slices.map(s=>`${channelLabel(s.channel)}: ${s.count} assets.`).join(" ")}</figcaption>
      </figure>}
    </section>
  );
}

export function KpiProgressChart({ kpis }: { kpis: KpiProgress[] }) {
  return <section className="workspace-panel overflow-hidden" aria-labelledby="kpi-progress-heading">
    <header className="workspace-panel-heading"><div><h2 id="kpi-progress-heading">Progress toward your goals</h2><p>Current period · each target equals 100%</p></div></header>
    {!kpis.length ? <p className="workspace-empty">No targets are configured for this workspace.</p> : <figure className="p-5">
      <div className="flex justify-between pb-4 text-xs text-muted-foreground"><span>Target completion</span><span>0% to 100%</span></div>
      <ul className="space-y-4">{kpis.map(kpi=>{
        const pct=kpi.fraction===null?null:Math.min(100,Math.max(0,kpi.fraction*100));
        const value=kpi.current===null?"Not measured":`${Number(kpi.current.toFixed(1)).toLocaleString()} / ${kpi.target_value.toLocaleString()} ${kpi.unit}`;
        return <li key={kpi.id}><div className="mb-1.5 flex flex-wrap justify-between gap-1 text-xs"><span className="font-semibold">{kpi.name}</span><span className="text-muted-foreground">{value}</span></div><svg viewBox="0 0 400 16" preserveAspectRatio="none" className="h-4 w-full" role="img" aria-label={`${kpi.name}: ${value}${pct===null?"":`; ${Number(pct.toFixed(1))}% of target`}`}><rect x="0" y="4" width="400" height="8" rx="4" fill="hsl(var(--muted))"/>{[100,200,300].map(x=><line key={x} x1={x} x2={x} y1="1" y2="15" stroke="hsl(var(--border))"/>)}{pct===null?<line x1="0" x2="400" y1="8" y2="8" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 4"/>:<rect x="0" y="4" width={pct*4} height="8" rx="4" fill="hsl(var(--primary))"/>}</svg></li>;
      })}</ul><figcaption className="mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground">Unmeasured goals use dashed lines. Missing data is never shown as zero progress.</figcaption>
    </figure>}
  </section>;
}
