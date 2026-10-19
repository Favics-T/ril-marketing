"use client";

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
import { DisclosureSummary } from "@/components/ui/disclosure-summary";

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
              className="min-h-9 rounded-lg font-semibold"
              disabled={!canManage || busy}
              onClick={() => { setProvider(savedProvider); setModel(saved.model); setTest(null); setEditing(true); }}
            >
              Manage connection
            </Button>
            <form action={disconnectAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="min-h-9 rounded-lg font-semibold text-muted-foreground"
                disabled={!canManage || busy}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form>
          </div>
        </div>
        <form action={testAction}>
          <input type="hidden" name="provider" value={saved.provider} />
          <input type="hidden" name="model" value={saved.model} />
          <Button type="submit" variant="outline" disabled={!canManage || busy}>{testing ? "Testing…" : "Test connection"}</Button>
        </form>
        {test ? <p role={test.ok ? "status" : "alert"} className={test.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{test.ok ? "Connection works. Keep your AI account funded to create drafts." : test.error}</p> : null}
        {justConnected ? (
          <p
            role="status"
            className="text-sm font-semibold text-emerald-700 dark:text-emerald-400"
          >
            Connected. New drafts use {summaryModel} straight away.
          </p>
        ) : null}
        {disconnect?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {disconnect.error}
          </p>
        ) : null}
      </div>
    );
  }

  /* ── Not connected: pick, paste, connect. ── */
  return (
    <form action={connectAction} onReset={event => event.preventDefault()} className="flex flex-col gap-4">
      <fieldset disabled={!canManage || busy}>
        <legend className="text-sm font-semibold tracking-[-0.01em]">Which AI service do you use?</legend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {PROVIDER_KEYS.map((key) => {
            const option = PROVIDERS[key];
            const isSelected = provider === key;
            return (
              <label
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
              </label>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="ai-api-key" className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
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
          className="h-11 rounded-lg font-normal"
        />
        <span className="text-[13px] font-normal leading-5 text-muted-foreground">
          A key lets this workspace use your AI account. It is separate from your password.
        </span>
      </label>
      <details className="text-sm">
        <DisclosureSummary className="min-h-11 cursor-pointer rounded-md py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Need help finding your key?</DisclosureSummary>
        <ol className="list-decimal space-y-2 pb-3 pl-5 text-muted-foreground">
          <li><a href={def.keyUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">{KEY_URL_LABEL} from {def.label}</a> and sign in.</li>
          <li>Create a new API key, copy it, and paste it above.</li>
          <li>Click Connect. We check the key before saving it.</li>
        </ol>
        <p className="pb-3 text-[13px] text-muted-foreground">Your AI service may charge for usage separately from any chat subscription.</p>
      </details>
      <details className="border-t pt-2">
        <DisclosureSummary className="min-h-11 cursor-pointer rounded-md py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Advanced options · {selected.label}</DisclosureSummary>
      <label htmlFor="ai-model-select" className="flex flex-col gap-1.5 pb-3 text-sm font-semibold tracking-[-0.01em]">
        AI model
        <select
          id="ai-model-select"
          name="model"
          value={model}
          onChange={(e) => { setTest(null); setModel(e.target.value); }}
          disabled={!canManage || busy}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm font-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {def.models.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-[13px] font-normal leading-5 text-muted-foreground">
          {selected.hint}
        </span>
      </label>

      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!canManage || busy} className="min-h-10 rounded-lg px-4 font-semibold">
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
            className="text-muted-foreground"
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
        <p role="alert" className="text-sm text-destructive">
          {connect.error}
        </p>
      ) : null}
    </form>
  );
}
