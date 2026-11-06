"use client";
import { FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";


import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateFromTrend, setTrendStatus } from "@/actions/content";
import { Button } from "@/components/ui/button";

type SegmentOption = { id: string; name: string };
export function TrendWorkflowActions({ trendId, status, segments }: { trendId: string; status: string; segments: SegmentOption[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [segmentId, setSegmentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  function updateStatus(next: "approved" | "dismissed") {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result = await setTrendStatus(trendId, next);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Could not update trend."); return; }
      setMessage(next === "approved" ? "Approved for content development." : "Trend dismissed.");
      router.refresh();
    });
  }
  function generate() {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result = await generateFromTrend(trendId, segmentId);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Could not create content drafts."); return; }
      setMessage(result.message ?? "Drafts saved to the Content Library for review.");
      router.refresh();
    });
  }
  return <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
    {status === "new" || status === "dismissed" ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("approved")}>{status === "new" ? "Approve opportunity" : "Reconsider"}</Button> : null}
    {status !== "dismissed" ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => updateStatus("dismissed")}>Dismiss</Button> : null}
    {status === "approved" ? <>
      {segments.length ? <ShadcnField asChild><ShadcnFieldLabel className="sr-only" htmlFor={`trend-segment-${trendId}`}>Audience for trend drafts</ShadcnFieldLabel></ShadcnField> : null}
      {segments.length ? <ShadcnNativeSelect id={`trend-segment-${trendId}`} value={segmentId} onChange={(event) => setSegmentId(event.target.value)} className="max-w-56"><ShadcnNativeSelectOption value="">Use suggested audience</ShadcnNativeSelectOption>{segments.map((segment) => <ShadcnNativeSelectOption key={segment.id} value={segment.id}>{segment.name}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect> : null}
      <Button type="button" size="sm" disabled={busy} onClick={generate}>{busy ? "Working…" : "Create content drafts"}</Button>
    </> : null}
    {message ? <p role={error ? "alert" : "status"} className={error ? "basis-full text-xs text-destructive" : "basis-full text-xs text-muted-foreground"}>{message}</p> : null}
  </div>;
}
