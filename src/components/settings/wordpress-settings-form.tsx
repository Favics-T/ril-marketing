"use client";

import { useActionState, useEffect, useState } from "react";
import { FileTextIcon } from "lucide-react";
import { disconnectWordPress, saveWordPressConnection } from "@/actions/wordpress";
import { ConnectorCard } from "@/components/settings/connector-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: boolean; message?: string; error?: string };

/**
 * Connect-first connector: the three fields stay hidden until the user asks to
 * connect, and the saved account is what the card shows afterwards.
 */
export function WordPressSettingsForm({
  initial,
}: {
  initial: { connected: boolean; siteUrl: string; username: string };
}) {
  const [save, saveAction, saving] = useActionState<State | null, FormData>(
    async (_previous, data) => saveWordPressConnection(data),
    null
  );
  const [disconnect, disconnectAction, disconnecting] = useActionState<
    State | null,
    FormData
  >(async () => disconnectWordPress(), null);

  const connected = disconnect?.ok
    ? false
    : save?.ok
      ? true
      : initial.connected;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (save?.ok) setOpen(false);
  }, [save?.ok]);

  const fieldClass =
    "h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <ConnectorCard
      icon={<FileTextIcon />}
      title="WordPress"
      blurb="Send approved blog articles to your own WordPress site."
      connected={connected}
      badge={
        connected
          ? `${initial.siteUrl}${initial.username ? ` · ${initial.username}` : ""}`
          : undefined
      }
    >
      {open ? (
        <form action={saveAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
            Your WordPress address
            <Input
              name="siteUrl"
              type="url"
              required
              autoComplete="url"
              placeholder="https://example.org"
              defaultValue={initial.siteUrl}
              className="h-10 rounded-lg font-normal"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
              WordPress username
              <Input
                name="username"
                required
                autoComplete="username"
                defaultValue={initial.username}
                className="h-10 rounded-lg font-normal"
              />
              <span className="text-[13px] font-normal leading-5 text-muted-foreground">
                The account that will publish the posts.
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
              Application password
              <input
                name="applicationPassword"
                type="password"
                autoComplete="new-password"
                placeholder={
                  connected
                    ? "Leave blank to keep the saved one"
                    : "Paste the password WordPress gives you"
                }
                className={fieldClass}
              />
              <span className="text-[13px] font-normal leading-5 text-muted-foreground">
                Create one in your WordPress profile under{" "}
                <a
                  href="https://wordpress.org/documentation/article/application-passwords/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-9 items-center rounded-md px-1 text-[13px] font-semibold text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Application Passwords
                </a>
                . Not your account password.
              </span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={saving || disconnecting}>
              {saving
                ? "Checking your site…"
                : connected
                  ? "Save changes"
                  : "Connect WordPress"}
            </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
          </div>
        </form>
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
              Connect WordPress
            </Button>
          )}
          {connected ? (
            <form action={disconnectAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form>
          ) : null}
        </div>
      )}

      {save?.message ? (
        <p
          role="status"
          className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
        >
          {save.message}
        </p>
      ) : null}
      {save?.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {save.error}
        </p>
      ) : null}
      {disconnect?.message ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {disconnect.message}
        </p>
      ) : null}
      {disconnect?.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {disconnect.error}
        </p>
      ) : null}
    </ConnectorCard>
  );
}
