export type BrandMotifName = "momentum" | "community" | "flow" | "excellence" | "productivity";

export function BrandMotif({ name, className = "" }: { name: BrandMotifName; className?: string }) {
  return <svg viewBox="0 0 64 64" className={`ril-brand-motif ${className}`} aria-hidden="true" focusable="false" fill="currentColor">
    {name === "momentum" ? <path d="M8 8h24l24 24-24 24H8l24-24Z" /> : null}
    {name === "community" ? <circle cx="32" cy="32" r="24" /> : null}
    {name === "flow" ? <path d="M4 21h56v22H4Z" /> : null}
    {name === "excellence" ? <path d="m32 3 6 9 10-4 1 11 11 2-5 10 7 8-11 5-1 11-11-2-7 8-7-8-11 2-1-11L2 39l7-8-5-10 11-2 1-11 10 4Z" /> : null}
    {name === "productivity" ? <path d="M23 7h18v16h16v18H41v16H23V41H7V23h16Z" /> : null}
  </svg>;
}
