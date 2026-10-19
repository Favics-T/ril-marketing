"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleCheck, CircleMinus, CircleX, FileTextIcon, TriangleAlert } from "lucide-react";
import { disconnectWordPress, saveWordPressConnection, testWordPressConnection, type ConnectionTestResult } from "@/actions/wordpress";
import { ConnectorCard } from "@/components/settings/connector-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: boolean; message?: string; error?: string };

const YOAST_SNIPPET = `add_action('init', function () {
  foreach (['_yoast_wpseo_title', '_yoast_wpseo_metadesc'] as $key) {
    register_post_meta('post', $key, [
      'show_in_rest'  => true,
      'single'        => true,
      'type'          => 'string',
      'auth_callback' => fn () => current_user_can('edit_posts'),
    ]);
  }
});`;

const CHECK_ICONS = {
  pass: { Icon: CircleCheck, className: "text-emerald-700 dark:text-emerald-400", label: "Passed" },
  warn: { Icon: TriangleAlert, className: "text-amber-700 dark:text-amber-400", label: "Warning" },
  fail: { Icon: CircleX, className: "text-destructive", label: "Failed" },
  skip: { Icon: CircleMinus, className: "text-muted-foreground", label: "Not checked" },
} as const;

/** Result of "Test connection": one row per check, in the order they ran. */
function ConnectionChecklist({ result }: { result: ConnectionTestResult }) {
  if (result.error) {
    return <p role="alert" className="mt-2 text-sm text-destructive">{result.error}</p>;
  }
  return (
    <div role="status" className="mt-3 rounded-lg border border-border px-3 py-2">
      <p className="text-sm font-semibold tracking-[-0.01em]">
        {result.ok ? "Connection test passed. Nothing was saved." : "Connection test found a problem. Nothing was saved."}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {result.checks?.map((check) => {
          const { Icon, className, label } = CHECK_ICONS[check.status];
          return (
            <li key={check.id} className="flex gap-2 text-[13px] leading-5">
              <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-label={label} />
              <span className="min-w-0 break-words">
                <span className="font-semibold text-foreground">{check.label}</span>
                <span className="text-muted-foreground"> · {check.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Connect-first connector: the fields stay hidden until the user asks to
 * connect, and the saved account is what the card shows afterwards.
 */
export function WordPressSettingsForm({
  initial,
}: {
  initial: { connected: boolean; siteUrl: string; username: string; seoPlugin: string };
}) {
  const [save, saveAction, saving] = useActionState<State | null, FormData>(
    async (_previous, data) => saveWordPressConnection(data),
    null
  );
  const [disconnect, disconnectAction, disconnecting] = useActionState<
    State | null,
    FormData
  >(async () => disconnectWordPress(), null);
  const [test, testAction, testing] = useActionState<ConnectionTestResult | null, FormData>(
    async (_previous, data) => testWordPressConnection(data),
    null
  );

  const connected = disconnect?.ok
    ? false
    : save?.ok
      ? true
      : initial.connected;
  const [open, setOpen] = useState(false);
  const [seoPlugin, setSeoPlugin] = useState(initial.seoPlugin || "none");
  useEffect(() => {
    if (save?.ok) setOpen(false);
  }, [save?.ok]);

  const fieldClass =
    "h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <ConnectorCard
      id="connection-cms_wordpress"
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
          <label className="flex flex-col gap-1.5 text-sm font-semibold tracking-[-0.01em]">
            SEO plugin
            <select
              name="seoPlugin"
              value={seoPlugin}
              onChange={(event) => setSeoPlugin(event.target.value)}
              className={`${fieldClass} font-normal sm:max-w-xs`}
            >
              <option value="none">None</option>
              <option value="yoast">Yoast SEO</option>
              <option value="rankmath">Rank Math</option>
            </select>
            <span className="text-[13px] font-normal leading-5 text-muted-foreground">
              Sends each article&apos;s SEO title and meta description to this plugin. The meta description is always used as the post excerpt.
            </span>
          </label>
          {seoPlugin === "yoast" ? (
            <details className="rounded-lg border border-border px-3 py-2 text-[13px] leading-5 text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">
                Yoast needs one snippet on your site
              </summary>
              <p className="mt-2">
                Yoast does not let the API write its SEO fields by default. Ask whoever manages the site to add this to the theme&apos;s functions.php or a code-snippets plugin:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs text-foreground">{YOAST_SNIPPET}</pre>
            </details>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={saving || disconnecting || testing}>
              {saving
                ? "Checking your site…"
                : connected
                  ? "Save changes"
                  : "Connect WordPress"}
            </Button>
            <Button
              type="submit"
              formAction={testAction}
              variant="outline"
              size="sm"
              disabled={saving || testing}
            >
              {testing ? "Testing…" : "Test connection"}
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
          ) : null}
          {connected ? (
            <form action={testAction}>
              <input type="hidden" name="siteUrl" value={initial.siteUrl} />
              <input type="hidden" name="username" value={initial.username} />
              <input type="hidden" name="seoPlugin" value={initial.seoPlugin || "none"} />
              <Button type="submit" variant="outline" size="sm" disabled={testing}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
            </form>
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

      <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
        Scheduled posts are published by WordPress itself (WP-Cron), which only runs when someone visits the site, so on a quiet site a post can go out a little after its time.
      </p>
      {test ? <ConnectionChecklist result={test} /> : null}
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
