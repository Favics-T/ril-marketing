import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Approval inbox" };
const categories = ["all","content","insights","email","pages"] as const;
type Item = { id:string; title:string; status:string; created_at:string; category:string; href:string };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ type?:string }> }) {
  const {type} = await searchParams;
  const filter = categories.includes(type as typeof categories[number]) ? type! : "all";
  const org = await getCallerOrganizationId();
  const client = await createClient();
  if (!org) return <div className="workspace-page"><h1>Approval inbox</h1><p>Create a workspace to start reviewing content.</p><Link href="/onboarding">Set up workspace</Link></div>;
  const results = await Promise.all([
    client.from("content_assets").select("id,title,status,created_at",{count:"exact"}).eq("organization_id",org).eq("status","review").order("created_at").limit(100),
    client.from("audience_insights").select("id,summary,status,created_at",{count:"exact"}).eq("organization_id",org).eq("status","PENDING_REVIEW").order("created_at").limit(100),
    client.from("email_campaigns").select("id,name,status,created_at",{count:"exact"}).eq("organization_id",org).eq("status","review").order("created_at").limit(100),
    client.from("landing_pages").select("id,title,status,created_at",{count:"exact"}).eq("organization_id",org).eq("status","review").order("created_at").limit(100),
  ]);
  const names=["content","insights","email","pages"];
  const failures=results.flatMap((r,i)=>r.error?[names[i]]:[]);
  const items: Item[] = [
    ...(results[0].data??[]).map(r=>({...r,category:"content",href:`/library/${r.id}`})),
    ...(results[1].data??[]).map(r=>({...r,title:r.summary,category:"insights",href:`/audience/insights/${r.id}`})),
    ...(results[2].data??[]).map(r=>({...r,title:r.name,category:"email",href:"/email"})),
    ...(results[3].data??[]).map(r=>({...r,category:"pages",href:`/audience/landing-pages/${r.id}`})),
  ];
  const visible=items.filter(item=>filter==="all"||item.category===filter).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const counts=Object.fromEntries(names.map((name,i)=>[name,results[i].count??0]));
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  return <div className="workspace-page">
    <header><p className="dateline">Review & release</p><h1>Approval inbox</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review the oldest requests first. Open an item to check its sources, edit the copy, and record your decision.</p></header>
    <div className="flex items-start gap-3 rounded-lg border bg-secondary/50 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-xs leading-6 text-muted-foreground">AI drafts stay here until a person approves them. Sensitive content and important email campaigns require a separate named reviewer. Approval does not automatically publish or send.</p></div>
    {failures.length>0&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">Could not load {failures.join(", ")}. Refresh to retry; the counts below may be incomplete.</p>}
    <nav aria-label="Filter by approval type">{categories.map(category=><Link key={category} href={category==="all"?"/approvals":`/approvals?type=${category}`} aria-current={filter===category?"page":undefined}>{category==="pages"?"Landing pages":category} <span className="ml-1 tabular-nums text-muted-foreground">{category==="all"?total:counts[category]}</span></Link>)}</nav>
    <section className="workspace-panel overflow-hidden" aria-label="Items awaiting approval"><div className="workspace-panel-heading"><div><h2>{visible.length?"Awaiting a decision":"Review queue"}</h2><p>{visible.length} items shown · up to 100 per type</p></div></div>
      <ul>{visible.map(item=><li key={`${item.category}-${item.id}`}><Link href={item.href} className="workspace-row"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><StatusStamp status={item.status}/><span className="text-xs capitalize text-muted-foreground">{item.category==="pages"?"Landing page":item.category}</span></div><p className="workspace-row-title line-clamp-2">{item.title}</p><p className="workspace-row-meta">Waiting since {formatDay(item.created_at)}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground"/></Link></li>)}</ul>
      {!visible.length&&<div className="workspace-empty"><p className="font-semibold text-foreground">{failures.length?"Some queues are unavailable":"Nothing waiting in this queue"}</p><p className="mt-1">{failures.length?"Refresh before treating this inbox as clear.":"Submit a draft for review from its content, email, or landing-page workspace."}</p></div>}
    </section>
  </div>;
}
