"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";


import { useActionState } from "react";
import { updateCampaign, type ActionResult } from "@/actions/content";
import type { Campaign } from "@/types/audience";
import { Button } from "@/components/ui/button";
import { CampaignFields } from "@/components/audience/campaign-fields";

export function CampaignEditor({ campaign, segments }: { campaign: Campaign; segments: Array<{id:string;name:string}> }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    (previous, formData) => updateCampaign(campaign.id, previous, formData),
    null,
  );
  return <Disclosure className="border-t border-border pt-3" title={<>Edit campaign plan</>} summaryClassName="cursor-pointer text-sm font-semibold">
    
    <ShadcnFieldGroup asChild><form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <CampaignFields segments={segments} initial={campaign} />
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-3"><p aria-live="polite" className={state?.error ? "text-sm text-destructive" : "text-sm text-emerald-700 "}>{state?.error ?? (state?.ok ? "Campaign plan saved." : "Update the objective, audience, timing and channels." )}</p><Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save campaign plan"}</Button></div>
    </form></ShadcnFieldGroup>
  </Disclosure>;
}
