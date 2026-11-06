"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Card as ShadcnCard } from "@/components/ui/card";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";


import { useActionState } from "react";
import { createCampaign, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { CampaignFields } from "@/components/audience/campaign-fields";

export function CampaignCreate({
  segments,
  initiallyOpen = false,
}: {
  segments: Array<{ id: string; name: string }>;
  initiallyOpen?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createCampaign, null);
  return (
    <ShadcnCard asChild><Disclosure className="slip p-5" initiallyOpen={initiallyOpen} title={<>Create a campaign</>}>
    
    <ShadcnFieldGroup asChild><form onReset={event => event.preventDefault()} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <p className="text-sm leading-6 text-muted-foreground sm:col-span-2 lg:col-span-4">Start with a name and the result you want. Only the name is required. Add planning details now or later.</p>
      <CampaignFields segments={segments} />
      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className={state?.ok ? "text-sm text-emerald-700 " : "text-sm text-destructive"}>
          {state?.error ?? (state?.ok ? "Campaign created as a draft." : "Campaigns group activities, content, registrations and leads around one objective.")}
        </p>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Creating…" : "Create campaign"}</Button>
      </div>
    </form></ShadcnFieldGroup>
    </Disclosure></ShadcnCard>
  );
}
