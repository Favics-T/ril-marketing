
import { Skeleton } from "@/components/ui/skeleton";
import { Card as ShadcnCard } from "@/components/ui/card";
export default function WorkspaceLoading() {
  return <div className="workspace-page" role="status" aria-label="Loading workspace page" aria-busy="true"><div className="flex flex-col gap-3 border-b pb-6" aria-hidden="true"><Skeleton className="h-3 w-40" /><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div><ShadcnCard asChild><div className="workspace-panel p-6" aria-hidden="true"><Skeleton className="mb-6 h-10" />{[0,1,2,3].map(i=><div key={i} className="border-t py-5"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-3 h-3 w-1/3" /></div>)}</div></ShadcnCard><span className="sr-only">Loading your workspace…</span></div>;
}
