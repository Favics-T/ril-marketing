"use client";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBrandKnowledgeActive } from "@/actions/brand";
import { Button } from "@/components/ui/button";

export function BrandKnowledgeToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => {
        setError("");
        startTransition(async () => {
          const result = await setBrandKnowledgeActive(id, !active);
          if (!result.ok) setError(result.error ?? "Could not change state.");
          else router.refresh();
        });
      }}>{busy ? "Saving…" : active ? "Pause" : "Activate"}</Button>
      {error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="max-w-32 text-right text-xs text-destructive">{error}</p></ShadcnAlert> : null}
    </div>
  );
}
