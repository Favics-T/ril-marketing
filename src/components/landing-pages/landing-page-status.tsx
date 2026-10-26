"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLandingPageStatus } from "@/actions/landing-pages";
import { Button } from "@/components/ui/button";

const actions: Record<string, Array<{ status: "review" | "draft" | "approved" | "published" | "paused"; label: string }>> = {
  draft: [{ status: "review", label: "Submit for review" }],
  review: [{ status: "draft", label: "Return to draft" }, { status: "approved", label: "Approve page" }],
  approved: [{ status: "review", label: "Return to review" }, { status: "published", label: "Publish page" }],
  published: [{ status: "paused", label: "Unpublish" }],
  paused: [{ status: "draft", label: "Edit this page" }, { status: "published", label: "Publish again" }],
};

export function LandingPageStatus({ pageId, status, updatedAt, disabled = false }: { pageId: string; status: string; updatedAt: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {(actions[status] ?? []).map((item) => <Button key={item.status} type="button" size="sm" variant={item.status === "published" ? "default" : "outline"} disabled={busy || disabled} onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const result = await setLandingPageStatus(pageId, item.status, updatedAt);
              if (!result.ok) setError(result.error ?? "Could not change page status.");
              else router.refresh();
            } catch { setError("The page could not be updated. Check your connection and try again."); }
          });
        }}>{busy ? "Saving…" : item.label}</Button>)}
      </div>
      {status === "approved" ? <p className="text-xs text-muted-foreground">Publishing requires a different owner, admin or leadership approver.</p> : null}
    </div>
  );
}
