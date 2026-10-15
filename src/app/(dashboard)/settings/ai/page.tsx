import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailIcon, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { getAiIntegration } from "@/lib/ai/provider";
import { defaultModel, isProviderKey } from "@/lib/ai/providers";
import { getBufferStatus } from "@/lib/integrations/buffer";
import { getWordPressConfig } from "@/lib/integrations/wordpress";
import { getResendConfig } from "@/lib/integrations/resend";
import { getUserRole } from "@/lib/audience/access";
import { StatusStamp } from "@/components/ui/status-stamp";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { BufferConnector } from "@/components/settings/buffer-connector";
import { ConnectorCard } from "@/components/settings/connector-card";
import { WordPressSettingsForm } from "@/components/settings/wordpress-settings-form";
import { StrapiSettingsForm } from "@/components/settings/strapi-settings-form";
import { GoogleAnalyticsSettingsForm } from "@/components/settings/google-analytics-settings-form";

export const metadata: Metadata = { title: "AI & Integrations" };

interface IntegrationRow {
  key: string;
  display_name: string | null;
  status: string;
  updated_at: string;
}

/** Keys rendered as their own connector card, so the raw ledger doesn't repeat them. */
const CONNECTOR_KEYS = new Set([
  "ai",
  "buffer",
  "cms_wordpress",
  "cms_strapi",
  "google_analytics",
  "email_resend",
]);

const MANAGER_ROLES = ["owner", "admin", "marketing_manager"];

export default async function AiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string }>;
}) {
  const search = await searchParams;
  const orgId = await getCallerOrganizationId();

  const ai = orgId ? await getAiIntegration(orgId).catch(() => null) : null;

  let integrations: IntegrationRow[] = [];
  let wordpress: { connected: boolean; siteUrl: string; username: string; seoPlugin: string } = {
    connected: false,
    siteUrl: "",
    username: "",
    seoPlugin: "none",
  };
  let googleAnalytics: {
    connected: boolean;
    propertyId: string;
    searchConsoleSiteUrl: string;
  } = { connected: false, propertyId: "", searchConsoleSiteUrl: "" };
  let strapi: {
    connected: boolean;
    baseUrl: string;
    collection: string;
    titleField: string;
    bodyField: string;
    slugField: string;
    excerptField: string;
    seoTitleField: string;
    seoDescriptionField: string;
  } = {
    connected: false,
    baseUrl: "",
    collection: "",
    titleField: "",
    bodyField: "",
    slugField: "",
    excerptField: "",
    seoTitleField: "",
    seoDescriptionField: "",
  };
  let buffer: Awaited<ReturnType<typeof getBufferStatus>> = {
    connected: false,
    channels: [],
    envConfigured: false,
    organizationName: null,
  };
  let resend: Awaited<ReturnType<typeof getResendConfig>> = null;
  let canManageConnectors = false;

  if (orgId) {
    try {
      const supabase = await createClient();
      const [list, wordpressResult, analyticsResult, strapiResult] =
        await Promise.all([
          supabase
            .from("integrations")
            .select("key, display_name, status, updated_at")
            .eq("organization_id", orgId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("integrations")
            .select("status,config")
            .eq("organization_id", orgId)
            .eq("key", "cms_wordpress")
            .maybeSingle<{
              status: string;
              config: { siteUrl?: string; username?: string; seoPlugin?: string };
            }>(),
          supabase
            .from("integrations")
            .select("status,config")
            .eq("organization_id", orgId)
            .eq("key", "google_analytics")
            .maybeSingle<{
              status: string;
              config: { ga4PropertyId?: string; searchConsoleSiteUrl?: string };
            }>(),
          supabase
            .from("integrations")
            .select("status,config")
            .eq("organization_id", orgId)
            .eq("key", "cms_strapi")
            .maybeSingle<{
              status: string;
              config: {
                baseUrl?: string;
                collection?: string;
                titleField?: string;
                bodyField?: string;
                slugField?: string;
                excerptField?: string;
                seoTitleField?: string;
                seoDescriptionField?: string;
              };
            }>(),
        ]);
      integrations = (list.data ?? []) as IntegrationRow[];
      if (wordpressResult.data) {
        wordpress = {
          connected: Boolean(await getWordPressConfig(orgId)),
          siteUrl: wordpressResult.data.config.siteUrl ?? "",
          username: wordpressResult.data.config.username ?? "",
          seoPlugin: wordpressResult.data.config.seoPlugin ?? "none",
        };
      }
      if (analyticsResult.data) {
        googleAnalytics = {
          connected: analyticsResult.data.status === "connected",
          propertyId: analyticsResult.data.config.ga4PropertyId ?? "",
          searchConsoleSiteUrl:
            analyticsResult.data.config.searchConsoleSiteUrl ?? "",
        };
      }
      if (strapiResult.data) {
        strapi = {
          connected: strapiResult.data.status === "connected",
          baseUrl: strapiResult.data.config.baseUrl ?? "",
          collection: strapiResult.data.config.collection ?? "",
          titleField: strapiResult.data.config.titleField ?? "",
          bodyField: strapiResult.data.config.bodyField ?? "",
          slugField: strapiResult.data.config.slugField ?? "",
          excerptField: strapiResult.data.config.excerptField ?? "",
          seoTitleField: strapiResult.data.config.seoTitleField ?? "",
          seoDescriptionField: strapiResult.data.config.seoDescriptionField ?? "",
        };
      }
    } catch {
      /* Keep every connector unconfigured if workspace data cannot be read. */
    }

    [buffer, resend, canManageConnectors] = await Promise.all([
      getBufferStatus(orgId).catch(() => ({
        connected: false,
        channels: [],
        envConfigured: false,
        organizationName: null,
      })),
      getResendConfig(orgId).catch(() => null),
      getUserRole(orgId)
        .then((role) => Boolean(role && MANAGER_ROLES.includes(role)))
        .catch(() => false),
    ]);
  }

  const serverKey = Boolean(process.env.AI_API_KEY);
  const aiConnected = serverKey || Boolean(ai?.hasKey);
  const startProvider = isProviderKey(ai?.provider) ? ai.provider : "openai";
  const resendConnected = Boolean(resend);
  const connectedCount = [buffer.connected, wordpress.connected, strapi.connected, googleAnalytics.connected, resendConnected]
    .filter(Boolean).length;
  const otherIntegrations = integrations.filter(
    (row) => !CONNECTOR_KEYS.has(row.key)
  );

  return (
    <div className="workspace-page settings-page">
      <header>
        <h1>AI &amp; integrations</h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
          Connect the tools you use to write, publish, and track your marketing.
          Start with AI, then add only the services you need.
        </p>
      </header>

      {search.connect_error ? (
        <p
          role="alert"
          className="slip flex items-start gap-3 rounded-lg border-destructive/40 px-5 py-4 text-sm leading-6 text-destructive sm:px-6"
        >
          <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{search.connect_error}</span>
        </p>
      ) : null}
      {search.connected ? (
        <p
          role="status"
          className="slip flex items-start gap-3 px-5 py-4 text-sm font-semibold leading-6 text-emerald-700 dark:text-emerald-400 sm:px-6"
        >
          <CheckCircle2 className="mt-1 size-4 shrink-0" aria-hidden="true" />
          Connected. Your channels are ready to use.
        </p>
      ) : null}

      {/* ── AI provider ───────────────────────────────────────────────── */}
      <nav aria-label="Integration sections" className="flex flex-wrap gap-2"><a href="#ai-provider" className="inline-flex min-h-11 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted">AI writing</a><a href="#connectors" className="inline-flex min-h-11 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted">Connected apps · {connectedCount}</a></nav>
      <section
        id="ai-provider"
        aria-labelledby="ai-provider-heading"
        className="slip scroll-mt-20 px-5 py-5 sm:px-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
                aiConnected
                  ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              <Sparkles />
            </span>
            <div className="min-w-0">
              <h2 id="ai-provider-heading" className="text-[17px] font-bold tracking-[-0.02em]">
                AI writing
              </h2>
              <p className="mt-1 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
                Connect an AI service to help write drafts and power your assistant.
                Your team still approves what gets published.
              </p>
            </div>
          </div>
          <StatusStamp variant={aiConnected ? "approved" : "cold"}>
            {aiConnected ? "Connected" : "Not connected"}
          </StatusStamp>
        </div>

        <div className="mt-4">
          {serverKey ? (
            <p className="max-w-[62ch] text-sm leading-6 text-muted-foreground">
              AI is ready to use. Your workspace administrator manages this connection.
            </p>
          ) : (
            <>
              {!ai?.hasKey ? (
                <p className="mb-4 max-w-[62ch] text-sm leading-6 text-muted-foreground">
                  No AI account yet? You can still create drafts using built-in templates.
                </p>
              ) : null}
              <AiSettingsForm
                canManage={canManageConnectors}
                initial={{
                  provider: startProvider,
                  model: ai?.model ?? defaultModel(startProvider),
                  hasKey: Boolean(ai?.hasKey),
                  last4: ai?.last4 ?? null,
                }}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Connectors ────────────────────────────────────────────────── */}
      <section id="connectors" aria-labelledby="connectors-heading" className="scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h2 id="connectors-heading" className="text-[17px] font-bold tracking-[-0.02em]">
              Your apps
            </h2>
            <p className="mt-1 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
              Choose what you want to do, then connect the matching service.
              Connecting an app does not publish or send anything.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="dateline tabular-nums">
              {connectedCount} of 5 connected
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <h3 className="mt-2 text-sm font-semibold">Publish to social media</h3>
          <BufferConnector
            connected={buffer.connected}
            envConfigured={buffer.envConfigured}
            channels={buffer.channels}
            organizationName={buffer.organizationName}
          />

          <h3 className="mt-4 text-sm font-semibold">Publish to your website</h3>
          <WordPressSettingsForm initial={wordpress} />

          <StrapiSettingsForm initial={strapi} />

          <h3 className="mt-4 text-sm font-semibold">Track website results</h3>
          <GoogleAnalyticsSettingsForm initial={googleAnalytics} />

          <h3 className="mt-4 text-sm font-semibold">Send email campaigns</h3>
          <ConnectorCard
            icon={<MailIcon />}
            title="Resend"
            blurb="Send approved campaigns to contacts who have opted in."
            connected={resendConnected}
            badge={
              resendConnected
                ? `Sending from ${resend?.fromEmail ?? "a verified sender"}`
                : undefined
            }
          >
            {canManageConnectors ? (
              <p className="text-[13px] leading-5 text-muted-foreground">
                {resendConnected ? "Manage your email connection on the " : "Connect Resend on the "}
                <Link
                  href="/email"
                  className="inline-flex min-h-9 items-center rounded-md px-1 text-[13px] font-semibold text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Email page
                </Link>
                . The setup there walks you through choosing a sender.
              </p>
            ) : (
              <p className="text-[13px] leading-5 text-muted-foreground">
                {resendConnected
                  ? "Connected and ready. Only opted-in, unsuppressed contacts are included."
                  : "An owner, admin or marketing manager needs to connect the email provider on the Email page."}
              </p>
            )}
          </ConnectorCard>
        </div>
      </section>

      {otherIntegrations.length > 0 ? (
        <section
          aria-labelledby="other-connections-heading"
          className="slip px-5 py-5 sm:px-6"
        >
          <h2 id="other-connections-heading" className="text-[13px] font-bold tracking-[-0.01em]">
            Other connections
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Workspace services that don&apos;t need setup here.
          </p>
          <ul className="ledger mt-3 border-t border-border/80">
            {otherIntegrations.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-[-0.01em]">
                    {row.display_name || row.key}
                  </p>
                  <p className="dateline mt-0.5 tabular-nums">
                    Updated {new Date(row.updated_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <StatusStamp
                  variant={row.status === "connected" ? "approved" : "cold"}
                >
                  {row.status === "connected" ? "CONNECTED" : "NOT CONNECTED"}
                </StatusStamp>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
