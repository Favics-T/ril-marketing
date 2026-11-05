
import { Alert as ShadcnAlert } from "@/components/ui/alert";
import { Card as ShadcnCard } from "@/components/ui/card";
import "./command-centre.css";

export default function CommandCentreLoading() {
  return <ShadcnAlert asChild role="status"><div className="workspace-page command-workspace" role="status" aria-label="Loading Command Centre" aria-busy="true">
    <div className="flex flex-col gap-3 pb-4" aria-hidden="true"><div className="skeleton-sweep h-8 w-64 max-w-full"/><div className="skeleton-sweep h-4 w-96 max-w-full"/></div>
    <div className="command-metrics" aria-hidden="true">{[0,1,2,3].map(index=><div key={index} className="flex flex-col gap-3 p-5"><div className="h-3 w-24 rounded bg-white/10"/><div className="h-8 w-12 rounded bg-white/10"/></div>)}</div>
    <div className="command-layout" aria-hidden="true"><ShadcnCard asChild><div className="workspace-panel p-6"><div className="skeleton-sweep mb-6 h-6 w-48"/>{[0,1,2].map(index=><div key={index} className="flex flex-col gap-3 border-t py-6"><div className="skeleton-sweep h-3 w-32"/><div className="skeleton-sweep h-5 w-full"/><div className="skeleton-sweep h-3 w-2/3"/></div>)}</div></ShadcnCard><ShadcnCard asChild><div className="workspace-panel flex flex-col gap-4 p-6"><div className="skeleton-sweep h-5 w-48"/><div className="skeleton-sweep h-32 w-full"/></div></ShadcnCard></div>
    <span className="sr-only">Loading your review queue and workspace progress…</span>
  </div></ShadcnAlert>;
}
