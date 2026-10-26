import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("slip ril-empty flex min-h-64 flex-col justify-center", className)}>
      <span aria-hidden="true" className="mb-5 flex size-12 items-center justify-center rounded-xl border bg-muted/60 text-muted-foreground"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5h16v14H4zM4 14h5l2 2h2l2-2h5" /></svg></span>
      <h3 className="text-balance text-base font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-balance text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button asChild size="sm" className="mt-5 min-h-9 rounded-lg font-semibold">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
