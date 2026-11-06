"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";


import { useActionState, useEffect, useState } from "react";
import { TrendingUpIcon } from "lucide-react";
import {
  disconnectGoogleAnalytics,
  saveGoogleAnalyticsSettings,
} from "@/actions/google-analytics";
import { ConnectorCard } from "@/components/settings/connector-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: boolean; message?: string; error?: string };

/**
 * Google needs a read-only service account rather than a sign-in, so the card
 * leads with the two IDs a user can copy out of their dashboards and keeps the
 * key file behind an "Advanced" step with plain instructions.
 */
export function GoogleAnalyticsSettingsForm({
  initial,
}: {
  initial: {
    connected: boolean;
    propertyId: string;
    searchConsoleSiteUrl: string;
  };
}) {
  const [save, saveAction, saving] = useActionState<State | null, FormData>(
    async (_previous, data) => saveGoogleAnalyticsSettings(data),
    null
  );
  const [disconnect, disconnectAction, disconnecting] = useActionState<
    State | null,
    FormData
  >(async () => disconnectGoogleAnalytics(), null);

  const connected = disconnect?.ok
    ? false
    : save?.ok
      ? true
      : initial.connected;
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState("");
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    if (save?.ok) { setOpen(false); setCredentials(""); setFileError(""); }
  }, [save?.ok]);

  return (
    <ConnectorCard
      id="connection-google_analytics"
      icon={<TrendingUpIcon />}
      title="Google Analytics & Search Console"
      blurb="Add website traffic and search performance to your reports."
      connected={connected}
      badge={connected ? `GA4 property ${initial.propertyId}` : undefined}
    >
      {open ? (
        <ShadcnFieldGroup asChild><form action={saveAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
              GA4 property ID
              <Input
                name="ga4PropertyId"
                inputMode="numeric"
                required
                pattern="[0-9]{4,20}"
                placeholder="123456789"
                defaultValue={initial.propertyId}
                
              />
              <span className="text-[13px] font-normal leading-5 text-muted-foreground">
                In Analytics, open Admin then Property settings. It&apos;s the
                number at the top.
              </span>
            </ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
              Search Console property
              <Input
                name="searchConsoleSiteUrl"
                required
                placeholder="https://example.org/"
                defaultValue={initial.searchConsoleSiteUrl}
                
              />
              <span className="text-[13px] font-normal leading-5 text-muted-foreground">
                Copy it exactly as Search Console shows it — a URL prefix or a
                domain property like sc-domain:example.org.
              </span>
            </ShadcnFieldLabel></ShadcnField>
          </div>

          <Disclosure initiallyOpen={!connected} className="rounded-lg border border-border" title={<>
              {connected
                ? "Replace your Google access key (optional)"
                : "Set up Google access"}
            </>} summaryClassName="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-semibold tracking-[-0.01em] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            
            <div className="border-t border-border/80 px-3 py-3">
              <ol className="list-decimal flex flex-col gap-1 pl-4 text-[13px] leading-5 text-muted-foreground">
                <li>
                  In Google Cloud, create a service account and download its
                  JSON key file.
                </li>
                <li>
                  Turn on the Analytics Data API and the Search Console API for
                  that project.
                </li>
                <li>
                  Give the service account&apos;s email address Viewer access to
                  your GA4 property, and add it as a user in Search Console.
                </li>
                <li>Upload the downloaded key file below.</li>
              </ol>
              <ShadcnField asChild><ShadcnFieldLabel className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
                Upload the Google key file
                <Input type="file" accept=".json,application/json" disabled={saving || disconnecting} onChange={async event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setFileError(""); setCredentials("");
                  if (file.size > 12000) { setFileError("Choose the Google JSON key file, up to 12 KB."); return; }
                  try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    if (parsed.type !== "service_account" || !parsed.client_email || !parsed.private_key) throw new Error();
                    setCredentials(text);
                  } catch { setFileError("This does not look like a Google service-account key. Download its JSON key file and try again."); }
                }} />
              </ShadcnFieldLabel></ShadcnField>
              {fileError ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p></ShadcnAlert> : null}
              {credentials ? <ShadcnAlert asChild role="status"><p role="status" className="mt-2 text-sm text-emerald-700">Key added. Connect below to check access and save it.</p></ShadcnAlert> : null}
              <Disclosure className="mt-3" title={<>Paste the key manually instead</>} summaryClassName="min-h-11 cursor-pointer py-2 text-sm font-semibold">
              
              <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
                Key file contents
                <ShadcnTextarea
                  name="credentialsJson"
                  value={credentials}
                  onChange={event => { setCredentials(event.target.value); setFileError(""); }}
                  autoComplete="off"
                  spellCheck={false}
                  rows={5}
                  maxLength={12000}
                  placeholder={
                    connected
                      ? "Leave blank to keep the saved key"
                      : "Paste the complete JSON key file"
                  }
                  className="w-full"
                />
              </ShadcnFieldLabel></ShadcnField>
              </Disclosure>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                The key is encrypted before storage. It is never included in
                reports and never sent to your AI provider. Use a dedicated,
                read-only account.
              </p>
            </div>
          </Disclosure>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={saving || disconnecting}>
              {saving
                ? "Checking access…"
                : connected
                  ? "Save changes"
                  : "Connect Google Analytics"}
            </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                
                onClick={() => { setOpen(false); setCredentials(""); setFileError(""); }}
                disabled={saving}
              >
                Cancel
              </Button>
          </div>
        </form></ShadcnFieldGroup>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
            >
              Update details
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={saving}
            >
              Connect Google Analytics
            </Button>
          )}
          {connected ? (
            <ShadcnFieldGroup asChild><form action={disconnectAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form></ShadcnFieldGroup>
          ) : null}
        </div>
      )}

      {save?.message ? (
        <ShadcnAlert asChild role="status"><p
          role="status"
          className="mt-2 text-sm font-semibold text-emerald-700 "
        >
          {save.message}
        </p></ShadcnAlert>
      ) : null}
      {save?.error ? (
        <ShadcnAlert asChild variant="destructive"><p role="alert" className="mt-2 text-sm text-destructive">
          {save.error}
        </p></ShadcnAlert>
      ) : null}
      {disconnect?.message ? (
        <ShadcnAlert asChild role="status"><p role="status" className="mt-2 text-sm text-muted-foreground">
          {disconnect.message}
        </p></ShadcnAlert>
      ) : null}
      {disconnect?.error ? (
        <ShadcnAlert asChild variant="destructive"><p role="alert" className="mt-2 text-sm text-destructive">
          {disconnect.error}
        </p></ShadcnAlert>
      ) : null}
    </ConnectorCard>
  );
}
