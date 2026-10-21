/**
 * Pure rules for sensitive email campaigns (REN-414), kept free of
 * `server-only` so they can be unit tested and shown in the UI. The database
 * trigger `email_campaigns_signoff_guard` enforces the same rules; these give
 * a clear message before a write is attempted.
 */

export const WORKSPACE_ROLES = ["owner", "admin", "marketing_manager", "leadership", "member"] as const;

export type SensitivitySettings = { canFlagSensitive: string[]; sensitiveApproverRoles: string[] };

/** Used when a workspace has no settings row. Keep in step with the migration. */
export const DEFAULT_SENSITIVITY_SETTINGS: SensitivitySettings = {
  canFlagSensitive: ["owner", "admin", "marketing_manager", "leadership"],
  sensitiveApproverRoles: ["owner", "admin"],
};

export type SignoffCampaign = {
  status: string;
  created_by: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  is_sensitive: boolean;
  sensitive_approved_by: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SignoffActor = { id: string | null; role: string | null };

const validRoles = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const roles = value.filter((role): role is string => (WORKSPACE_ROLES as readonly string[]).includes(role));
  return roles.length ? roles : null;
};

/** Settings from a `workspace_settings` row, falling back to the defaults. */
export function readSensitivitySettings(row: { can_flag_sensitive?: unknown; sensitive_approver_roles?: unknown } | null): SensitivitySettings {
  return {
    canFlagSensitive: validRoles(row?.can_flag_sensitive) ?? DEFAULT_SENSITIVITY_SETTINGS.canFlagSensitive,
    sensitiveApproverRoles: validRoles(row?.sensitive_approver_roles) ?? DEFAULT_SENSITIVITY_SETTINGS.sensitiveApproverRoles,
  };
}

/** The submitter column, or the metadata field older campaigns used. */
export function submitterOf(campaign: Pick<SignoffCampaign, "submitted_by" | "metadata">): string | null {
  if (campaign.submitted_by) return campaign.submitted_by;
  const legacy = campaign.metadata?.submitted_by;
  return typeof legacy === "string" ? legacy : null;
}

const ROLE_LABELS: Record<string, string> = { owner: "owner", admin: "admin", marketing_manager: "marketing manager", leadership: "leadership", member: "member" };

/** "owner or admin", "owner, admin or leadership". */
export function describeRoles(roles: readonly string[]): string {
  const labels = roles.map((role) => ROLE_LABELS[role] ?? role);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}` : labels[0] ?? "";
}

export function awaitingSeniorSignoff(campaign: Pick<SignoffCampaign, "is_sensitive" | "sensitive_approved_by">): boolean {
  return campaign.is_sensitive && !campaign.sensitive_approved_by;
}

export function seniorSignoffMessage(settings: SensitivitySettings): string {
  return `Awaiting senior sign-off from ${describeRoles(settings.sensitiveApproverRoles)}. A sensitive campaign can't be queued or sent until then.`;
}

/** Why this person can't flag or unflag the campaign, or null if they can. */
export function flagRefusal(campaign: SignoffCampaign, actor: SignoffActor, settings: SensitivitySettings): string | null {
  if (!actor.id) return "Sign in again to change this email campaign.";
  if (!actor.role || !settings.canFlagSensitive.includes(actor.role)) {
    return `Only ${describeRoles(settings.canFlagSensitive)} roles can flag or unflag sensitive campaigns.`;
  }
  if (actor.id === campaign.created_by || actor.id === submitterOf(campaign)) return "The campaign's author or submitter can't flag or unflag it.";
  if (campaign.status === "sent") return "A sent campaign can't be flagged or unflagged.";
  return null;
}

/** Why this person can't give the senior sign-off, or null if they can. */
export function seniorApprovalRefusal(campaign: SignoffCampaign, actor: SignoffActor, settings: SensitivitySettings): string | null {
  if (!actor.id) return "Sign in again to change this email campaign.";
  if (!campaign.is_sensitive) return "Only a sensitive campaign takes a senior sign-off.";
  if (campaign.sensitive_approved_by) return "This campaign already has its senior sign-off.";
  if (!campaign.approved_by || !["approved", "paused"].includes(campaign.status)) return "Give the senior sign-off after the campaign's first approval.";
  if (!actor.role || !settings.sensitiveApproverRoles.includes(actor.role)) {
    return `The senior sign-off needs ${describeRoles(settings.sensitiveApproverRoles)} role.`;
  }
  if ([campaign.created_by, submitterOf(campaign), campaign.approved_by].includes(actor.id)) {
    return "The senior sign-off must come from someone other than the author, submitter and first approver.";
  }
  return null;
}
