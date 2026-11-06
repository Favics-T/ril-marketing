import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
export interface EmptyStateProps { title: string; description: string; action?: { label: string; href: string }; className?: string }
export function EmptyState({title, description, action, className}: EmptyStateProps) {
  return <Empty className={cn("ril-empty border", className)}>
    <EmptyHeader><EmptyMedia variant="icon"><Inbox aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>
    {action ? <EmptyContent><Button asChild variant="outline"><Link href={action.href}>{action.label}</Link></Button></EmptyContent> : null}
  </Empty>;
}
