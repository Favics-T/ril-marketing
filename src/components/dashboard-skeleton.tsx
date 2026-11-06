
import { Card as ShadcnCard } from "@/components/ui/card";
export function DashboardSkeleton() {
  return <div className="workspace-page" aria-busy="true" aria-label="Loading Command Centre"><div className="flex flex-col gap-3"><div className="skeleton-sweep h-3 w-40 rounded"/><div className="skeleton-sweep h-8 w-64 max-w-full rounded"/><div className="skeleton-sweep h-4 w-96 max-w-full rounded"/></div><div className="workspace-metrics h-40" aria-hidden="true"/>{[0,1].map(row=><div key={row} className="workspace-dashboard-grid" aria-hidden="true">{[0,1].map(col=><ShadcnCard asChild key={col}><div key={col} className="workspace-panel p-5"><div className="skeleton-sweep mb-6 h-5 w-40 rounded"/>{[0,1,2].map(i=><div key={i} className="skeleton-sweep mt-4 h-12 w-full rounded"/>)}</div></ShadcnCard>)}</div>)}</div>;
}
