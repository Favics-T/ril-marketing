import { isReviewerRole } from "@/lib/audience/guards";

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

export function contentApprovalRestriction({
  actorId, actorRole, authorId, secondReviewerId, secondRequired, signoffs, reviewers,
}: {
  actorId: string | null;
  actorRole: string | null;
  authorId?: string | null;
  secondReviewerId?: string | null;
  secondRequired: boolean;
  signoffs: readonly ContentSignoff[];
  reviewers: readonly ContentReviewer[];
}): string | null {
  if (!actorId) return "Sign in again before recording an approval.";
  if (!isReviewerRole(actorRole)) return "Ask an owner, admin, marketing manager or leader to review this content.";
  if (actorId === authorId) return "You created this content. Ask another reviewer to approve it.";
  const first = signoffs.find(signoff => signoff.tier === 1);
  if (first) {
    if (!secondRequired) return "Approval is already recorded for this revision. Refresh the page to see its current status.";
    if (first.reviewer_id === actorId) return "Your first approval is already recorded. A different named reviewer must complete sensitive-content approval.";
    if (actorId !== secondReviewerId || !["owner", "admin", "leadership"].includes(actorRole ?? "")) {
      const named = reviewers.find(person => person.id === secondReviewerId);
      return `Only ${named?.name ?? "the named second reviewer"} can complete this approval.`;
    }
    return null;
  }
  if (secondRequired && !reviewers.some(person => person.id !== authorId && person.id !== actorId && ["owner", "admin", "leadership"].includes(person.role))) {
    return "A different owner, admin or leader is needed for the second approval. Ask an administrator to arrange a reviewer.";
  }
  return null;
}
