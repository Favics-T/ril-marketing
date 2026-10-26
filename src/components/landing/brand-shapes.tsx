import { BrandMotif, type BrandMotifName } from "@/components/brand-motif";

const shapes: BrandMotifName[] = ["momentum", "community", "flow", "excellence", "productivity"];

export function BrandShapes({ variant = "light" }: { variant?: "light" | "blue" }) {
  return <div aria-hidden="true" className={`ril-brand-pattern ril-brand-pattern-${variant}`}>{shapes.map(name => <BrandMotif key={name} name={name} />)}</div>;
}