export const APPROVAL_CATEGORIES = [
  ["standard", "Standard content"],
  ["paid_advertising", "Paid advertising"],
  ["external_communications", "External communications"],
  ["partnership_announcement", "Partnership announcement"],
  ["leadership_communications", "Leadership communications"],
  ["crisis", "Crisis content"],
] as const;
export type ApprovalCategory = typeof APPROVAL_CATEGORIES[number][0];
export type ContentSignoff = { id: string; approval_revision: number; tier: number; reviewer_id: string; reviewer_name: string; reviewer_role: string; note: string | null; created_at: string };
export type ContentReviewer = { id: string; name: string; role: string };
export function needsSecondApproval(category: string, sensitivity?: string) { return category !== "standard" || sensitivity === "high"; }
export function categoryLabel(category: string) { return APPROVAL_CATEGORIES.find(([key]) => key === category)?.[1] ?? "Standard content"; }
