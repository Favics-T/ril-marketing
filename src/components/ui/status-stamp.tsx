import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Flatplan status stamp: a tracked uppercase word that names the gate state.
 * Colour carries meaning, not decoration — blue fields await a decision,
 * ink outlines are settled, red is reserved for what needs action.
 */
const stampVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-[3px] border px-1.5 py-1 font-sans text-[0.625rem] font-bold uppercase leading-none tracking-[0.09em] transition-colors",
  {
    variants: {
      variant: {
        // Awaiting decision — the committed blue field.
        pending: "border-transparent bg-flag text-flag-foreground",
        review: "border-transparent bg-flag text-flag-foreground",
        ai_generated: "border-transparent bg-flag text-flag-foreground",
        active: "border-transparent bg-flag text-flag-foreground",
        // Settled — ink outline on paper.
        approved: "border-foreground/60 bg-card text-foreground",
        published: "border-foreground/60 bg-card text-foreground",
        qualified: "border-foreground/60 bg-card text-foreground",
        scheduled: "border-foreground/30 bg-card text-foreground",
        editing: "border-border bg-card text-foreground",
        converted: "border-foreground/60 bg-card text-foreground",
        completed: "border-foreground/60 bg-card text-foreground",
        // Urgent — the reserved red field.
        hot: "border-transparent bg-destructive text-destructive-foreground",
        failed: "border-transparent bg-destructive text-destructive-foreground",
        missed: "border-transparent bg-destructive text-destructive-foreground",
        // Needs extra care, not action — red outline rather than the red field.
        sensitive: "border-destructive/70 bg-card text-destructive",
        // Intermediate and inactive — quiet paper.
        warm: "border-foreground/35 bg-card text-foreground/85",
        cold: "border-border bg-transparent text-muted-foreground",
        paused: "border-border bg-transparent text-muted-foreground",
        idea: "border-border bg-transparent text-muted-foreground",
        suppressed: "border-border bg-transparent text-muted-foreground",
        cancelled: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "pending",
    },
  }
);

export interface StatusStampProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof stampVariants> {
  status?: string;
}

export function StatusStamp({ className, variant, status, ...props }: StatusStampProps) {
  // Map status strings to variants
  const mappedVariant = status ? mapStatusToVariant(status) : variant;
  const displayText = status ? formatStatusText(status) : props.children;

  return (
    <span
      data-status={(status ?? mappedVariant ?? "pending").toLowerCase().replaceAll(" ", "_")}
      className={cn(stampVariants({ variant: mappedVariant }), className)}
      {...props}
    >
      {displayText || props.children}
    </span>
  );
}

function mapStatusToVariant(status: string): StatusStampProps["variant"] {
  const normalized = status.toLowerCase().replace(/[_\s]+/g, "_");

  switch (normalized) {
    case "pending_review":
    case "pending":
      return "pending";
    case "approved":
      return "approved";
    case "hot":
      return "hot";
    case "warm":
      return "warm";
    case "cold":
      return "cold";
    case "failed":
      return "failed";
    case "scheduled":
      return "scheduled";
    case "missed":
      return "missed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "published":
      return "published";
    case "review":
      return "review";
    case "editing":
      return "editing";
    case "analysing":
      return "scheduled";
    case "idea":
      return "idea";
    case "ai_generated":
      return "ai_generated";
    case "qualified":
      return "qualified";
    case "converted":
      return "converted";
    case "suppressed":
    case "dismissed":
      return "suppressed";
    case "draft":
      return "idea";
    case "paused":
      return "cold";
    case "completed":
      return "completed";
    case "active":
      return "active";
    case "sensitive":
      return "sensitive";
    default:
      return "pending";
  }
}

function formatStatusText(status: string): string {
  return status
    .replace(/[_\s]+/g, " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace(/^Ai /, "AI ");
}
