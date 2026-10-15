"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeadFormPage } from "@/lib/landing-page-url";

export function LeadCaptureForm({ page, pageKey }: {
  page: LeadFormPage;
  pageKey: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage(""); setError(false); setSuccess(false);
    startTransition(async () => {
      try {
        const response = await fetch("/api/capture/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: pageKey,
            email: data.get("email"),
            name: data.get("name"),
            organisation: data.get("organisation"),
            interest: data.get("interest"),
            marketingConsent: data.get("marketing_consent") === "on",
          }),
        });
        const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; duplicate?: boolean } | null;
        if (!response.ok || !result?.ok) {
          setError(true); setMessage(result?.error ?? "Could not submit your details. Please try again."); return;
        }
        setSuccess(true);
        setMessage(result.duplicate ? "We already have your details. Thanks for your interest." : "Thank you. Your interest has been recorded.");
        form.reset();
      } catch {
        setError(true);
        setMessage("Could not submit your details. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Name</span><Input name="name" maxLength={200} autoComplete="name" /></label>
      <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Email</span><Input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
      <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Organisation</span><Input name="organisation" maxLength={200} autoComplete="organization" /></label>
      <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">What are you interested in?</span><Input name="interest" maxLength={500} /></label>
      <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><input name="marketing_consent" type="checkbox" className="mt-1" /><span>Send me occasional updates about RIL programmes and events. This is optional and separate from this enquiry.</span></label>
      <p className="text-xs leading-5 text-muted-foreground">RIL will use your details to respond to this enquiry. Contact details are not sent to the AI content assistant.</p>
      {message ? <p role={error ? "alert" : "status"} className={error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{message}</p> : null}
      {success && page.registration_url ? <a href={page.registration_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline">Continue to registration ↗</a> : null}
      <Button type="submit" disabled={busy}>{busy ? "Sending…" : page.cta_label}</Button>
    </form>
  );
}
