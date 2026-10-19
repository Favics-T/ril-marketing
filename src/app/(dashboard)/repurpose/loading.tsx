import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      className="workspace-page flex flex-col gap-6"
      role="status"
      aria-label="Loading repurposing workspace"
    >
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
