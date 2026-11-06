"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup, FieldSet as ShadcnFieldSet, FieldLegend as ShadcnFieldLegend, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";


import { useActionState, useState } from "react";
import {
  connectAiProvider,
  disconnectAiProvider,
  testAiSettings,
  type ConnectAiResult,
} from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiProviderMark } from "@/components/settings/provider-icons";
import {
  PROVIDERS,
  PROVIDER_KEYS,
  defaultModel,
  getModel,
  isProviderKey,
  isSupportedModel,
  modelLabel,
  type ProviderKey,
} from "@/lib/ai/providers";
import { cn } from "@/lib/utils";

const KEY_URL_LABEL = "Get a connection key";

export function AiSettingsForm({
  initial,
  canManage = true,
}: {
  canManage?: boolean;
  initial: {
    provider: string;
    model: string;
    hasKey: boolean;
    last4: string | null;
  };
}) {
  const startProvider: ProviderKey = isProviderKey(initial.provider)
    ? initial.provider
    : "openai";
  const [provider, setProvider] = useState<ProviderKey>(startProvider);
  const [model, setModel] = useState<string>(() =>
    isSupportedModel(startProvider, initial.model)
      ? initial.model
      : defaultModel(startProvider)
  );
  const [editing, setEditing] = useState(!initial.hasKey);
  const [saved, setSaved] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [test, setTest] = useState<{ ok: boolean; error?: string } | null>(null);

  const [connect, connectAction, connecting] = useActionState<
    ConnectAiResult | null,
    FormData
  >(async (_previous, formData) => {
    setTest(null);
    const result = await connectAiProvider(formData);
    if (result.ok) {
      setSaved({ provider: result.provider ?? provider, model: result.model ?? model, hasKey: true, last4: result.last4 ?? null });
      setEditing(false);
      setApiKey("");
    }
    return result;
  }, null);
  const [disconnect, disconnectAction, disconnecting] = useActionState<
    ConnectAiResult | null,
    FormData
  >(async () => {
    const result = await disconnectAiProvider();
    if (result.ok) {
      setSaved(current => ({ ...current, hasKey: false, last4: null }));
      setEditing(true);
      setTest(null);
      setApiKey("");
    }
    return result;
  }, null);
  const [, testAction, testing] = useActionState<null, FormData>(async (_previous, data) => {
    setTest(await testAiSettings(data));
    return null;
  }, null);
  const busy = connecting || disconnecting || testing;

  const justConnected = connect?.ok === true;
  const connected = saved.hasKey;
  const def = PROVIDERS[provider];
  const selected = getModel(provider, model);

  const savedProvider = isProviderKey(saved.provider) ? saved.provider : startProvider;
  const summaryProvider = PROVIDERS[savedProvider].label;
  const summaryModel = modelLabel(savedProvider, saved.model);
  const summaryLast4 = saved.last4;

  const onProviderChange = (next: ProviderKey) => {
    setTest(null);
    setApiKey("");
    setProvider(next);
    setModel((current) =>
      isSupportedModel(next, current) ? current : defaultModel(next)
    );
  };

  /* ── Connected: one line, plus the two things you might want to do next. ── */
  if (connected && !editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <AiProviderMark
              provider={savedProvider}
              className="size-5 shrink-0 text-foreground"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {summaryProvider} · {summaryModel}
              </p>
              <p className="dateline mt-0.5">
                Key ••••{summaryLast4 || "····"} · ready to use
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              
              disabled={!canManage || busy}
              onClick={() => { setProvider(savedProvider); setModel(saved.model); setTest(null); setEditing(true); }}
            >
              Manage connection
            </Button>
            <ShadcnFieldGroup asChild><form action={disconnectAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                
                disabled={!canManage || busy}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form></ShadcnFieldGroup>
          </div>
        </div>
        <ShadcnFieldGroup asChild><form action={testAction}>
          <input type="hidden" name="provider" value={saved.provider} />
          <input type="hidden" name="model" value={saved.model} />
          <Button type="submit" variant="outline" disabled={!canManage || busy}>{testing ? "Testing…" : "Test connection"}</Button>
        </form></ShadcnFieldGroup>
        {test ? <p role={test.ok ? "status" : "alert"} className={test.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{test.ok ? "Connection works. Keep your AI account funded to create drafts." : test.error}</p> : null}
        {justConnected ? (
          <ShadcnAlert asChild role="status"><p
            role="status"
            className="text-sm font-semibold text-emerald-700 "
          >
            Connected. New drafts use {summaryModel} straight away.
          </p></ShadcnAlert>
        ) : null}
        {disconnect?.error ? (
          <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
            {disconnect.error}
          </p></ShadcnAlert>
        ) : null}
      </div>
    );
  }

  /* ── Not connected: pick, paste, connect. ── */
  return (
    <ShadcnFieldGroup asChild><form action={connectAction} onReset={event => event.preventDefault()} className="flex flex-col gap-4">
      <ShadcnFieldSet disabled={!canManage || busy}>
        <ShadcnFieldLegend className="text-sm font-semibold tracking-[-0.01em]">Which AI service do you use?</ShadcnFieldLegend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {PROVIDER_KEYS.map((key) => {
            const option = PROVIDERS[key];
            const isSelected = provider === key;
            return (
              <ShadcnField asChild orientation="horizontal" key={key}><ShadcnFieldLabel
                key={key}
                className={cn(
                  "cursor-pointer rounded-lg border p-4 outline-none transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-accent"
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  value={key}
                  checked={isSelected}
                  onChange={() => onProviderChange(key)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2">
                  <AiProviderMark
                    provider={key}
                    className="size-5 shrink-0 text-foreground"
                  />
                  <span className="text-sm font-semibold">{option.label}</span>
                </span>
                <span className="mt-1.5 block text-[13px] leading-5 text-muted-foreground">
                  {key === "openai" ? "From the makers of ChatGPT" : key === "anthropic" ? "From Anthropic" : "From Google"}
                </span>
              </ShadcnFieldLabel></ShadcnField>
            );
          })}
        </div>
      </ShadcnFieldSet>

      <ShadcnField asChild><ShadcnFieldLabel htmlFor="ai-api-key" className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
        {saved.hasKey && provider === saved.provider ? "Replace your connection key (optional)" : `Your ${def.label} connection key`}
        <Input
          id="ai-api-key"
          name="apiKey"
          type="password"
          autoComplete="off"
          disabled={!canManage || busy}
          required={!(saved.hasKey && provider === saved.provider)}
          maxLength={500}
          value={apiKey}
          onChange={event => { setApiKey(event.target.value); setTest(null); }}
          placeholder={saved.hasKey && provider === saved.provider ? "Leave blank to keep your saved key" : "Paste your key here"}
          
        />
        <span className="text-[13px] font-normal leading-5 text-muted-foreground">
          A key lets this workspace use your AI account. It is separate from your password.
        </span>
      </ShadcnFieldLabel></ShadcnField>
      <Disclosure className="text-sm" title={<>Need help finding your key?</>} summaryClassName="min-h-11 cursor-pointer rounded-md py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        
        <ol className="list-decimal flex flex-col gap-2 pb-3 pl-5 text-muted-foreground">
          <li><a href={def.keyUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">{KEY_URL_LABEL} from {def.label}</a> and sign in.</li>
          <li>Create a new API key, copy it, and paste it above.</li>
          <li>Click Connect. We check the key before saving it.</li>
        </ol>
        <p className="pb-3 text-[13px] text-muted-foreground">Your AI service may charge for usage separately from any chat subscription.</p>
      </Disclosure>
      <Disclosure className="border-t pt-2" title={<>Advanced options · {selected.label}</>} summaryClassName="min-h-11 cursor-pointer rounded-md py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        
      <ShadcnField asChild><ShadcnFieldLabel htmlFor="ai-model-select" className="flex flex-col gap-1.5 pb-3 text-sm font-semibold tracking-[-0.01em]">
        AI model
        <ShadcnNativeSelect
          id="ai-model-select"
          name="model"
          value={model}
          onChange={(e) => { setTest(null); setModel(e.target.value); }}
          disabled={!canManage || busy}
          className="w-full"
        >
          {def.models.map((option) => (
            <ShadcnNativeSelectOption key={option.id} value={option.id}>
              {option.label}
            </ShadcnNativeSelectOption>
          ))}
        </ShadcnNativeSelect>
        <span className="text-[13px] font-normal leading-5 text-muted-foreground">
          {selected.hint}
        </span>
      </ShadcnFieldLabel></ShadcnField>

      </Disclosure>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!canManage || busy} className="px-4">
          {saved.hasKey
            ? connecting
              ? "Checking your key…"
              : "Save changes"
            : connecting
              ? "Checking your key…"
              : `Connect ${def.label}`}
        </Button>
        {saved.hasKey ? (
          <Button
            type="button"
            variant="ghost"
            
            onClick={() => { setProvider(savedProvider); setModel(saved.model); setApiKey(""); setTest(null); setEditing(false); }}
            disabled={busy}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {!canManage ? <p className="text-sm text-muted-foreground">An owner, admin or marketing manager can manage this connection.</p> : null}
      <p className="text-xs leading-5 text-muted-foreground">Your key is stored securely. You can change or disconnect it at any time.</p>

      {connect?.error ? (
        <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
          {connect.error}
        </p></ShadcnAlert>
      ) : null}
    </form></ShadcnFieldGroup>
  );
}
