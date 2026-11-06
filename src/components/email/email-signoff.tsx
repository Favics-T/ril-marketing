import { StatusStamp } from "@/components/ui/status-stamp";
import { awaitingSeniorSignoff, describeRoles, type SignoffCampaign } from "@/lib/email/sensitivity";

/** "Sensitive" stamp, plus where its senior sign-off stands. Renders nothing for other campaigns. */
export function SensitiveSignoffNote({ campaign, approverRoles }: { campaign: Pick<SignoffCampaign, "is_sensitive" | "sensitive_approved_by">; approverRoles: string[] }) {
  if (!campaign.is_sensitive) return null;
  return <span className="inline-flex flex-wrap items-center gap-2">
    <StatusStamp status="sensitive" />
    <span className="text-[13px] leading-5 text-muted-foreground">
      {awaitingSeniorSignoff(campaign) ? `Awaiting senior sign-off · ${describeRoles(approverRoles)}` : "Senior sign-off given"}
    </span>
  </span>;
}
