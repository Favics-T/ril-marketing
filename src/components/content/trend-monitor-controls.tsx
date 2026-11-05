"use client";
import { Card as ShadcnCard } from "@/components/ui/card";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState } from "react";
import { saveTrendMonitoringSettings, syncTrendsNow, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";

export function TrendMonitorControls({ enabled, lastSyncedAt }: { enabled: boolean; lastSyncedAt: string | null }) {
  const [settingsState, settingsAction, settingsPending] = useActionState<ActionResult | null, FormData>(async (_state, form) => saveTrendMonitoringSettings(form), null);
  const [syncState, syncAction, syncPending] = useActionState<ActionResult | null, FormData>(async () => syncTrendsNow(), null);
  return (
    <ShadcnCard asChild><section className="slip flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0"><p className="dateline">Source monitoring · curated public RSS</p><p className="mt-1 text-sm text-muted-foreground">TechCabal and Disrupt Africa · daily sync · all imported stories wait for editorial review.</p><p className="mt-1 text-xs text-muted-foreground">{enabled ? "Daily monitoring is on." : "Monitoring is paused until an authorised manager enables it."} AI enrichment uses the connected workspace model.{lastSyncedAt ? ` Last sync: ${formatDay(lastSyncedAt)}.` : " Not synced yet."}</p></div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <ShadcnFieldGroup asChild><form action={settingsAction}><input type="hidden" name="enabled" value={enabled ? "false" : "true"} /><Button type="submit" size="sm" variant="outline" disabled={settingsPending}>{settingsPending ? "Saving…" : enabled ? "Pause daily sync" : "Enable daily sync"}</Button></form></ShadcnFieldGroup>
        <ShadcnFieldGroup asChild><form action={syncAction}><Button type="submit" size="sm" disabled={!enabled || syncPending}>{syncPending ? "Checking feeds…" : "Sync now"}</Button></form></ShadcnFieldGroup>
      </div>
      <div className="w-full sm:basis-full">
        {settingsState?.ok === false ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-xs text-destructive">{settingsState.error}</p></ShadcnAlert> : settingsState?.ok ? <ShadcnAlert asChild role="status"><p role="status" className="text-xs text-muted-foreground">Monitoring setting saved.</p></ShadcnAlert> : null}
        {syncState?.ok === false ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-xs text-destructive">{syncState.error}</p></ShadcnAlert> : syncState?.ok ? <ShadcnAlert asChild role="status"><p role="status" className="text-xs text-muted-foreground">{syncState.message}</p></ShadcnAlert> : null}
      </div>
    </section></ShadcnCard>
  );
}
