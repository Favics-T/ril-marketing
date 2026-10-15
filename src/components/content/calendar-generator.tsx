"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCalendarProposals } from "@/actions/content";

export function CalendarGenerator() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function generate() {
    setMessage("");
    startTransition(async () => {
      const result = await generateCalendarProposals();
      setMessage(result.ok
        ? `${result.id} audience-informed draft${result.id === "1" ? "" : "s"} added to the Content Library. Review each before scheduling.`
        : result.error ?? "Could not generate proposals.");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" variant="outline" onClick={generate} disabled={busy}>
        {busy ? <LoaderCircle data-icon="inline-start" aria-hidden="true" className="animate-spin" /> : <CalendarClock data-icon="inline-start" aria-hidden="true" />}
        {busy ? "Building proposals…" : "Generate calendar proposals"}
      </Button>
      <p aria-live="polite" className="max-w-sm text-xs text-muted-foreground sm:text-right">
        {message || "Uses upcoming activities, audience preferences and approved insights. Drafts still need review and approval."}
      </p>
    </div>
  );
}
