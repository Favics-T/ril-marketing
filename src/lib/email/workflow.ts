/**
 * Pure email-campaign workflow rules, kept free of `server-only` so they can be
 * unit tested and shown in the UI.
 */

/**
 * Where a paused campaign goes when a reviewer resumes it. Only a campaign that
 * was paused while sending, and has a recorded approver, goes back to sending.
 * Campaigns paused before `paused_from` was recorded return to approval.
 */
export function resumeStatus(campaign: { approved_by: string | null; metadata: Record<string, unknown> | null }): "scheduled" | "approved" | "draft" {
  if (!campaign.approved_by) return "draft";
  return campaign.metadata?.paused_from === "scheduled" ? "scheduled" : "approved";
}

/** Delivery statuses that mean a send was attempted and reached an outcome. */
export const ATTEMPTED_DELIVERY_STATUSES = ["sent", "delivered", "opened", "clicked", "bounced", "complained", "failed"] as const;

/** Pause automatically once at least this share of attempted sends failed... */
export const FAILURE_PAUSE_SHARE = 0.5;
/** ...and either this many failed, or nothing is left to send. */
export const FAILURE_PAUSE_MIN = 5;

export type DeliveryProblem = { failed: number; attempted: number; last_error: string | null; detected_at: string };

export function shouldPauseForFailures({ attempted, failed, remaining }: { attempted: number; failed: number; remaining: number }): boolean {
  if (attempted === 0 || failed === 0) return false;
  return failed / attempted >= FAILURE_PAUSE_SHARE && (failed >= FAILURE_PAUSE_MIN || remaining === 0);
}

/** Reads the automatic-pause record from campaign metadata, if any. */
export function readDeliveryProblem(metadata: Record<string, unknown> | null | undefined): DeliveryProblem | null {
  const value = metadata?.delivery_problem;
  if (!value || typeof value !== "object") return null;
  const problem = value as Partial<DeliveryProblem>;
  if (typeof problem.failed !== "number" || typeof problem.attempted !== "number") return null;
  return { failed: problem.failed, attempted: problem.attempted, last_error: typeof problem.last_error === "string" ? problem.last_error : null, detected_at: typeof problem.detected_at === "string" ? problem.detected_at : "" };
}

export function describeDeliveryProblem(problem: DeliveryProblem): string {
  return `Delivery paused automatically: ${problem.failed} of ${problem.attempted} sends failed.${problem.last_error ? ` Last error: ${problem.last_error}` : ""} Fix the cause, then resume delivery.`;
}
