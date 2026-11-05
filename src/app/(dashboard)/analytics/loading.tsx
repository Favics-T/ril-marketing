import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return <div className="workspace-page flex flex-col gap-6" aria-busy="true" aria-label="Loading marketing analytics"><div className="flex flex-col gap-3"><Skeleton className="h-9 w-64" /><Skeleton className="h-5 w-full max-w-lg" /></div><Skeleton className="h-14 w-full" /><Skeleton className="h-96 w-full" /><span role="status" className="sr-only">Loading analytics for this date range.</span></div>;
}
