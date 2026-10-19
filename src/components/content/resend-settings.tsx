"use client";

import { useActionState } from "react";
import { disconnectResend, saveResendSettings } from "@/actions/email-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: boolean; error?: string; message?: string } | null;

export function ResendSettings({ connected, fromEmail, fromName, replyTo, hasWebhook, webhookUrl, canManage }: {
  connected: boolean; fromEmail: string; fromName: string; replyTo: string; hasWebhook: boolean; webhookUrl: string; canManage: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(async (_state, form) => saveResendSettings(form), null);
  if (!canManage) return <section className="slip p-4 sm:p-5"><p className="dateline">Email delivery</p><p className="mt-1 text-sm text-muted-foreground">{connected ? `Resend connected · ${fromEmail}` : "A workspace manager needs to configure the verified email provider."}</p></section>;
  return <section className="slip flex flex-col gap-4 p-4 sm:p-6">
    <div><p className="dateline">Provider setup · human controlled</p><h2 className="mt-1 text-lg font-bold">Resend email delivery</h2><p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">Connect a verified sender and event webhook. Approved campaigns are only sent after a reviewer queues delivery; every recipient’s current consent is checked again at send time.</p></div>
      <div className="rounded-md border border-border p-3 text-sm leading-6"><p className="font-semibold">Configure the Resend webhook</p><p className="mt-1 text-muted-foreground">Add a webhook in Resend pointing to this URL and subscribe to email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained and email.failed. Paste the signing secret below.</p>{webhookUrl ? <code className="mt-2 block break-all text-xs">{webhookUrl}</code> : <p className="mt-2 text-sm text-destructive">A public HTTPS app address is needed before sending. Ask your administrator to configure it so Resend can reach this app and recipients can unsubscribe.</p>}<p className="mt-1 text-xs text-muted-foreground">Webhook status: {hasWebhook ? "Signing secret saved" : "Not configured · sending stays disabled"}.</p></div>
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5"><span className="dateline">Resend API key</span><Input name="apiKey" type="password" autoComplete="new-password" placeholder={connected ? "Leave blank to keep the saved key" : "re_…"} /></label>
      <label className="flex flex-col gap-1.5"><span className="dateline">Verified sender email</span><Input name="fromEmail" type="email" required maxLength={320} defaultValue={fromEmail} placeholder="marketing@your-verified-domain.org" /></label>
      <label className="flex flex-col gap-1.5"><span className="dateline">Sender name</span><Input name="fromName" required maxLength={120} defaultValue={fromName || "Renaissance Innovation Labs"} /></label>
      <label className="flex flex-col gap-1.5"><span className="dateline">Reply-to address · optional</span><Input name="replyTo" type="email" maxLength={320} defaultValue={replyTo} /></label>
      <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="dateline">Webhook signing secret</span><Input name="webhookSecret" type="password" autoComplete="new-password" placeholder={hasWebhook ? "Leave blank to keep the saved secret" : "whsec_…"} /></label>
      <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">Credentials are stored encrypted. Set AI_CONFIG_SECRET and NEXT_PUBLIC_SITE_URL before connecting. API keys are never sent to the browser. Email audiences include only opted-in, unsuppressed leads.</p>
      {state?.ok === false ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p> : state?.ok ? <p role="status" className="text-sm text-muted-foreground sm:col-span-2">{state.message}</p> : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending ? "Verifying…" : "Verify and save provider"}</Button></div>
    </form>
    {connected ? <form action={async () => { await disconnectResend(); }}><Button type="submit" size="sm" variant="outline">Disconnect Resend</Button></form> : null}
  </section>;
}
