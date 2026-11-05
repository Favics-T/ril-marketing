import type { HTMLAttributes } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
type StatusVariant = "pending" | "review" | "ai_generated" | "active" | "approved" | "published" | "qualified" | "scheduled" | "editing" | "converted" | "completed" | "hot" | "failed" | "missed" | "warm" | "cold" | "paused" | "idea" | "suppressed" | "cancelled";
export interface StatusStampProps extends HTMLAttributes<HTMLSpanElement> { variant?: StatusVariant; status?: string }
export function StatusStamp({ className, variant, status, ...props }: StatusStampProps) {
  const state = status ? mapStatusToVariant(status) : variant ?? "pending";
  const tone: BadgeProps["variant"] = ["hot", "failed", "missed"].includes(state ?? "") ? "destructive" : ["pending", "review", "ai_generated", "active"].includes(state ?? "") ? "default" : ["approved", "published", "qualified", "converted", "completed"].includes(state ?? "") ? "outline" : "secondary";
  return <Badge variant={tone} data-status={(status ?? state ?? "pending").toLowerCase().replaceAll(" ", "_")} className={className} {...props}>{status ? formatStatusText(status) : props.children}</Badge>;
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
