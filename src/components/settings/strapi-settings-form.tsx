"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState, useEffect, useState } from "react";
import { LayersIcon } from "lucide-react";
import { disconnectStrapi, saveStrapiConnection } from "@/actions/strapi";
import { ConnectorCard } from "@/components/settings/connector-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: boolean; message?: string; error?: string };

type StrapiInitial = {
  connected: boolean;
  baseUrl: string;
  collection: string;
  titleField: string;
  bodyField: string;
  slugField: string;
  excerptField: string;
  seoTitleField: string;
  seoDescriptionField: string;
};

/**
 * Connect-first connector mirroring WordPress: the fields stay hidden until the
 * user asks to connect. Strapi content types are user-defined, so the field
 * names that hold the title, body and slug are part of the connection.
 */
export function StrapiSettingsForm({ initial }: { initial: StrapiInitial }) {
  const [save, saveAction, saving] = useActionState<State | null, FormData>(
    async (_previous, data) => saveStrapiConnection(data),
    null
  );
  const [disconnect, disconnectAction, disconnecting] = useActionState<State | null, FormData>(
    async () => disconnectStrapi(),
    null
  );

  const connected = disconnect?.ok ? false : save?.ok ? true : initial.connected;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (save?.ok) setOpen(false);
  }, [save?.ok]);

  const fieldClass =
    "h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <ConnectorCard
      id="connection-cms_strapi"
      icon={<LayersIcon />}
      title="Strapi"
      blurb="Send approved blog articles to your own Strapi collection."
      connected={connected}
      badge={connected ? `${initial.baseUrl} · ${initial.collection}` : undefined}
    >
      {open ? (
        <ShadcnFieldGroup asChild><form action={saveAction} className="flex flex-col gap-3">
          <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
            Your Strapi address
            <Input name="baseUrl" type="url" required autoComplete="url" placeholder="https://cms.example.org" defaultValue={initial.baseUrl}  />
          </ShadcnFieldLabel></ShadcnField>
          <div className="grid gap-3 sm:grid-cols-2">
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
              Collection API ID
              <Input name="collection" required defaultValue={initial.collection || "articles"} placeholder="articles"  />
              <span className="text-[13px] font-normal leading-5 text-muted-foreground">The plural API ID from the Content-Type Builder, e.g. articles.</span>
            </ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
              API token
              <Input name="apiToken" type="password" autoComplete="new-password" placeholder={connected ? "Leave blank to keep the saved one" : "Paste a full-access or custom API token"} className={fieldClass} />
              <span className="text-[13px] font-normal leading-5 text-muted-foreground">
                Create one in Strapi under{" "}
                <a href="https://docs.strapi.io/user-docs/settings/API-tokens" target="_blank" rel="noreferrer noopener" className="inline-flex min-h-9 items-center rounded-md px-1 text-[13px] font-semibold text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring">Settings → API Tokens</a>
                , with find and create permission for the collection.
              </span>
            </ShadcnFieldLabel></ShadcnField>
          </div>
          <Disclosure className="border-t pt-2" title={<>Advanced: match your website fields</>} summaryClassName="min-h-11 cursor-pointer py-2 text-sm font-semibold">
          
          <p className="mb-3 text-[13px] text-muted-foreground">The standard names are filled in. Change these only if your Strapi site uses different field names.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">Title field<Input name="titleField" required defaultValue={initial.titleField || "title"} placeholder="title"  /></ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">Body field<Input name="bodyField" required defaultValue={initial.bodyField || "content"} placeholder="content"  /></ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">Slug field<Input name="slugField" required defaultValue={initial.slugField || "slug"} placeholder="slug"  /></ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">Excerpt field<Input name="excerptField" defaultValue={initial.excerptField} placeholder="optional"  /></ShadcnFieldLabel></ShadcnField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">SEO title field<Input name="seoTitleField" defaultValue={initial.seoTitleField} placeholder="optional, e.g. seo.metaTitle"  /></ShadcnFieldLabel></ShadcnField>
            <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">SEO description field<Input name="seoDescriptionField" defaultValue={initial.seoDescriptionField} placeholder="optional, e.g. seo.metaDescription"  /></ShadcnFieldLabel></ShadcnField>
            <span className="text-[13px] leading-5 text-muted-foreground sm:col-span-2">Where the article&apos;s SEO title and meta description go. Use <code>component.field</code> when they live in a component such as Strapi&apos;s SEO component.</span>
          </div>
          </Disclosure>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={saving || disconnecting}>{saving ? "Checking your collection…" : connected ? "Save changes" : "Connect Strapi"}</Button>
            <Button type="button" variant="ghost" size="sm"  onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </form></ShadcnFieldGroup>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {connected ? (<Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Update details</Button>) : (<Button type="button" size="sm" onClick={() => setOpen(true)} disabled={saving}>Connect Strapi</Button>)}
          {connected ? (<ShadcnFieldGroup asChild><form action={disconnectAction}><Button type="submit" variant="ghost" size="sm"  disabled={disconnecting}>{disconnecting ? "Disconnecting…" : "Disconnect"}</Button></form></ShadcnFieldGroup>) : null}
        </div>
      )}
      {save?.message ? <ShadcnAlert asChild role="status"><p role="status" className="mt-2 text-sm font-semibold text-emerald-700 ">{save.message}</p></ShadcnAlert> : null}
      {save?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="mt-2 text-sm text-destructive">{save.error}</p></ShadcnAlert> : null}
      {disconnect?.message ? <ShadcnAlert asChild role="status"><p role="status" className="mt-2 text-sm text-muted-foreground">{disconnect.message}</p></ShadcnAlert> : null}
      {disconnect?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="mt-2 text-sm text-destructive">{disconnect.error}</p></ShadcnAlert> : null}
    </ConnectorCard>
  );
}
