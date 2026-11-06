import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

export function RecordFilters({ label, items, value }: {
  label: string;
  items: ReadonlyArray<{ value: string; label: string; href: string }>;
  value: string;
}) {
  return <nav aria-label={label} className="record-filter-bar">
    {items.map(item => <Button key={item.value} asChild variant={value === item.value ? "secondary" : "ghost"} size="sm">
      <Link href={item.href} aria-current={value === item.value ? "page" : undefined}>{item.label}</Link>
    </Button>)}
  </nav>;
}

export function RecordPagination({ page, totalPages, previousHref, nextHref }: {
  page: number; totalPages: number; previousHref?: string; nextHref?: string;
}) {
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Pagination" className="record-pagination">
    <PaginationContent className="w-full justify-between">
      <PaginationItem><PaginationPrevious href={previousHref} aria-disabled={!previousHref} tabIndex={previousHref ? undefined : -1} className={!previousHref ? "pointer-events-none opacity-50" : undefined} /></PaginationItem>
      <PaginationItem><p aria-live="polite">Page <strong>{page}</strong> of {totalPages}</p></PaginationItem>
      <PaginationItem><PaginationNext href={nextHref} aria-disabled={!nextHref} tabIndex={nextHref ? undefined : -1} className={!nextHref ? "pointer-events-none opacity-50" : undefined} /></PaginationItem>
    </PaginationContent>
  </Pagination>;
}
