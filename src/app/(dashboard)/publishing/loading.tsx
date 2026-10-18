import { Skeleton } from "@/components/ui/skeleton";

export default function PublishingLoading() {
  return <div className="workspace-page flex flex-col gap-6" role="status" aria-label="Loading social posts"><Skeleton className="h-10 w-64" /><Skeleton className="h-24 w-full" /><Skeleton className="h-80 w-full" /></div>;
}
