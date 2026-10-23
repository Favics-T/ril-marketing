"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotebookPen, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectorCard } from "./connector-card";
import { saveNotionAction, saveYouTubeAppAction, disconnectSourceAction, testSourceAction } from "@/actions/source-integrations";
import type { SourceConnectionStatus, SourceProvider } from "@/lib/integrations/source-connections";

export function SourceConnector({ provider, initial, canManage }: { provider: SourceProvider; initial: SourceConnectionStatus; canManage: boolean }) {
  const router = useRouter(), name = provider === "notion" ? "Notion" : "YouTube";
  const [setup, setSetup] = useState(false), [busy, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [callback, setCallback] = useState("");
  function open() { setSetup(!setup); if (provider === "youtube") setCallback(`${window.location.origin}/api/integrations/youtube/callback`); }
  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => { try { const result = await action(); setFeedback(result); if (result.ok) router.refresh(); } catch { setFeedback({ ok: false, error: "Could not reach your workspace. Check your connection and try again." }); } });
  }
  return <ConnectorCard id={`connection-${provider}`} icon={provider === "notion" ? <NotebookPen /> : <Youtube />} title={name} blurb={provider === "notion" ? "Bring shared pages into your content library, then edit or repurpose them." : "Import videos and captions from your channel. Upload and schedule approved videos directly."} connected={initial.connected} badge={initial.accountName ?? undefined}>
    <div className="flex flex-col gap-4">
      {initial.connected ? <Link href={`/library/import?provider=${provider}`} className="text-sm font-semibold text-primary underline">Import from {name}</Link> : <p className="text-sm leading-6 text-muted-foreground">{provider === "notion" ? "Connect once, then choose which shared pages to import. Your Notion pages stay unchanged." : "Authorize a channel once. You choose what to import or publish each time."}</p>}
      {canManage ? <>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" disabled={busy} aria-expanded={setup} onClick={open}>{setup ? "Close setup" : initial.connected ? "Connection setup" : initial.configured && provider === "youtube" ? "Change app details" : `Set up ${name}`}</Button>
          {provider === "youtube" && initial.configured ? <Button asChild><a href="/api/integrations/youtube/connect">{initial.connected ? "Reconnect YouTube" : "Connect YouTube"}</a></Button> : null}
          {initial.connected ? <><Button type="button" variant="outline" disabled={busy} onClick={() => run(() => testSourceAction(provider))}>{busy ? "Checking…" : "Test connection"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => run(() => disconnectSourceAction(provider))}>Disconnect</Button></> : null}
        </div>
        {setup ? <form className="flex flex-col gap-4 border-t pt-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); run(() => provider === "notion" ? saveNotionAction(form) : saveYouTubeAppAction(form)); }}>
          {provider === "notion" ? <>
            <ol className="list-decimal pl-5 text-sm leading-6 text-muted-foreground"><li>Create an internal connection in <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="text-primary underline">Notion’s developer settings</a> with Read content enabled.</li><li>Copy its internal connection secret here.</li><li>On each source page in Notion, open Connections and add this connection.</li></ol>
            <label className="flex flex-col gap-1.5 text-sm">Notion connection secret<Input type="password" autoComplete="new-password" name="token" required minLength={15} maxLength={2000} disabled={busy} /></label>
          </> : <>
            <p className="text-sm leading-6 text-muted-foreground">One-time administrator setup: in <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-primary underline">Google Cloud</a>, enable YouTube Data API v3, configure the consent screen, and create an OAuth client for a Web application. Add this exact authorized redirect URI:</p>
            <code className="break-all rounded-md bg-muted p-3 text-xs">{callback}</code>
            <label className="flex flex-col gap-1.5 text-sm">Google OAuth client ID<Input name="client_id" defaultValue={initial.clientId} required maxLength={300} disabled={busy} autoComplete="off" /></label>
            <label className="flex flex-col gap-1.5 text-sm">Google OAuth client secret<Input name="client_secret" type="password" autoComplete="new-password" required={!initial.configured} maxLength={1000} disabled={busy} placeholder={initial.configured ? "Leave blank to keep the saved secret" : undefined} /></label>
            <p className="text-xs leading-5 text-muted-foreground">Saving app details disconnects the current channel. Connect YouTube afterwards and select the correct channel. Google requests video-management permission to read captions and upload videos. If your Google app is in testing, add your account as a test user; access may expire until the app is published.</p>
          </>}
          <Button type="submit" className="w-fit" disabled={busy}>{busy ? "Saving…" : provider === "notion" ? "Verify & connect Notion" : "Save Google app details"}</Button>
        </form> : null}
      </> : <p className="text-sm text-muted-foreground">Ask an owner, admin or marketing manager to manage this connection.</p>}
      {feedback ? <p role={feedback.ok ? "status" : "alert"} className={feedback.ok ? "text-sm leading-6 text-muted-foreground" : "text-sm leading-6 text-destructive"}>{feedback.error || feedback.message}</p> : null}
    </div>
  </ConnectorCard>;
}
