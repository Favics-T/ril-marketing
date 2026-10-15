"use client";

import { useActionState } from "react";
import { createCampaign, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { CampaignFields } from "@/components/audience/campaign-fields";

export function CampaignCreate({
  segments,
}: {
  segments: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createCampaign, null);
  return (
    <details className="slip p-5">
    <DisclosureSummary>Create a campaign</DisclosureSummary>
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <CampaignFields segments={segments} />
      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className={state?.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>
          {state?.error ?? (state?.ok ? "Campaign created as a draft." : "Campaigns group activities, content, registrations and leads around one objective.")}
        </p>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Creating…" : "Create campaign"}</Button>
      </div>
    </form>
    </details>
  );
}
