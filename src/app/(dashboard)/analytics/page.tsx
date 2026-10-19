import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getKpiProgress } from "@/lib/audience/kpis";
import { KpiProgressChart } from "@/components/dashboard-charts";
import { ChannelIdentity } from "@/components/channel-identity";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {title:"Marketing Analytics"};

export default async function AnalyticsPage() {
  const org=await getCallerOrganizationId();
  if (!org) return <div className="workspace-page"><h1>Marketing Analytics</h1><Link href="/onboarding">Set up your workspace</Link></div>;
  const client=await createClient();
  const end=new Date();
  const start=new Date(end.getTime()-56*86400000);
  const [leads,assets,kpis]=await Promise.all([
    client.from("leads").select("id,created_at,is_qualified,is_converted,source_platform",{count:"exact"}).eq("organization_id",org).gte("created_at",start.toISOString()).order("created_at").limit(5000),
    client.from("content_assets").select("id,views,clicks,registrations",{count:"exact"}).eq("organization_id",org).gte("created_at",start.toISOString()).limit(5000),
    getKpiProgress(org),
  ]);
  const leadRows=leads.data??[];
  const assetRows=assets.data??[];
  const qualified=leadRows.filter(l=>l.is_qualified).length;
  const converted=leadRows.filter(l=>l.is_converted).length;
  const views=assetRows.reduce((n,a)=>n+Number(a.views??0),0);
  const weeks=Array.from({length:8},(_,i)=>{
    const from=new Date(start.getTime()+i*7*86400000);
    const to=new Date(from.getTime()+7*86400000);
    return {label:from.toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"}),count:leadRows.filter(l=>new Date(l.created_at)>=from&&new Date(l.created_at)<to).length};
  });
  const max=Math.max(1,...weeks.map(w=>w.count));
  const sources=new Map<string,number>();
  for(const lead of leadRows){const key=lead.source_platform||"Unassigned";sources.set(key,(sources.get(key)??0)+1);}
  const sourceRows=[...sources].sort((a,b)=>b[1]-a[1]);
  const partial=(leads.count??0)>leadRows.length||(assets.count??0)>assetRows.length;
  const failed=Boolean(leads.error||assets.error);
  return <div className="workspace-page analytics-workspace">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="dateline">{start.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – {end.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</p><h1>Marketing Analytics</h1><p className="mt-2 text-sm text-muted-foreground">Eight weeks of recorded lead capture and content performance.</p></div><Button asChild variant="outline"><Link href="/reports">Create a report</Link></Button></header>
    {(failed||partial)&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">{failed?"Some metrics could not be loaded. Refresh to retry.":"This view uses up to 5,000 records per dataset. Counts and charts below represent that sample."}</p>}
    <dl className="workspace-metrics">{[{label:"Captured leads",value:leads.error?"—":leadRows.length,detail:"In the last eight weeks"},{label:"Qualified leads",value:leads.error?"—":qualified,detail:"Marked qualified by your team"},{label:"Lead conversion",value:leads.error?"—":leadRows.length?`${(converted/leadRows.length*100).toFixed(1)}%`:"0%",detail:`${converted} recorded conversions`},{label:"Content views",value:assets.error?"—":views,detail:"Recorded asset counters"}].map(m=><div key={m.label} className="workspace-metric"><dt>{m.label}</dt><dd>{m.value.toLocaleString()}</dd><p>{m.detail}</p></div>)}</dl>
    <div className="workspace-dashboard-grid"><section className="workspace-panel overflow-hidden"><header className="workspace-panel-heading"><div><h2>Lead capture over time</h2><p>Weekly totals · recorded capture dates</p></div></header><figure className="p-5"><svg viewBox="0 0 560 210" className="w-full" role="img" aria-label={`Weekly lead capture: ${weeks.map(w=>`${w.label}: ${w.count}`).join(", ")}`}>
      {[0,.5,1].map(t=><g key={t}><line x1="24" x2="550" y1={165-t*140} y2={165-t*140} stroke="hsl(var(--border))"/><text x="18" y={169-t*140} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">{Math.round(max*t)}</text></g>)}
      {weeks.map((w,i)=><g key={w.label}><rect x={40+i*64} y={165-w.count/max*140} width="32" height={w.count/max*140} rx="4" fill="hsl(var(--primary))"/><text x={56+i*64} y={Math.max(14,157-w.count/max*140)} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">{w.count}</text><text x={56+i*64} y="188" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{w.label}</text></g>)}
    </svg><figcaption className="text-xs text-muted-foreground">Counts reflect leads captured in this workspace, rather than estimated channel reach.</figcaption></figure></section>
      <section className="workspace-panel overflow-hidden"><header className="workspace-panel-heading"><div><h2>Where leads came from</h2><p>Recorded source attribution</p></div></header><ul>{sourceRows.map(([source,count])=><li key={source} className="workspace-row"><span className="flex-1 text-sm"><ChannelIdentity channel={source} /></span><span className="text-xs text-muted-foreground">{Math.round(count/leadRows.length*100)}%</span><span className="text-sm font-semibold tabular-nums">{count}</span></li>)}</ul>{!sourceRows.length&&<p className="workspace-empty">No leads captured during this period.</p>}</section></div>
    <KpiProgressChart kpis={kpis}/>
    <div className="rounded-lg border p-4 text-xs leading-6 text-muted-foreground">Website and Search Console performance are included in generated reports when Google Analytics is connected. Paid-media spend, social audience growth, and PR monitoring need additional provider integrations. <Link href="/settings/ai" className="font-semibold text-primary">Manage integrations</Link></div>
  </div>;
}
