import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { checkProviderModel } from "@/lib/ai/connection-check";
import { getProvider, isProviderKey, isSupportedModel } from "@/lib/ai/providers";
import { getBufferChannels, getBufferStatus } from "./buffer";
import { getWordPressConfig, verifyWordPressConnection, verifyWordPressSeoPlugin } from "./wordpress";
import { getStrapiConfig, verifyStrapiConnection } from "./strapi";
import { getGoogleAnalyticsConfig, verifyGoogleAnalyticsConnection } from "./google-analytics";
import { getResendConfig, verifyResendSender } from "./resend";
import { publicAppOrigin } from "./public-app-origin";
import { listNotionPages, youtubeRequest } from "./content-import";

export type ConnectionHealth = {
  key: string;
  name: string;
  state: "ready" | "needs_setup" | "needs_attention";
  message: string;
  href: string;
};
type Stored = { key: string; status: string; config: Record<string, string> };

/** Read-only provider calls; Buffer may refresh its token and channel cache. */
export async function inspectProviderConnections(organizationId: string): Promise<ConnectionHealth[]> {
  const { data, error } = await createAdminClient().from("integrations").select("key,status,config").eq("organization_id", organizationId);
  if (error) throw new Error("Could not read your saved connections. Refresh and try again.");
  const saved = new Map<string, Stored>((data ?? []).map(row => [row.key, row as Stored]));
  const definitions = [
    { key: "ai", name: "AI writing", href: "/settings/ai#ai-provider-heading", setup: "Choose your AI provider and add its connection key." },
    { key: "buffer", name: "Buffer", href: "/settings/ai#connection-buffer", setup: "Add a Buffer API key, then link your social accounts inside Buffer." },
    { key: "notion", name: "Notion", href: "/settings/ai#connection-notion", setup: "Add a Notion connection secret and share your source pages with that connection." },
    { key: "youtube", name: "YouTube", href: "/settings/ai#connection-youtube", setup: "Save your Google app details, then authorize your YouTube channel." },
    { key: "cms_wordpress", name: "WordPress", href: "/settings/ai#connection-cms_wordpress", setup: "Add your WordPress address, username and application password." },
    { key: "cms_strapi", name: "Strapi", href: "/settings/ai#connection-cms_strapi", setup: "Add your Strapi address, API token and article collection." },
    { key: "google_analytics", name: "Google Analytics & Search Console", href: "/settings/ai#connection-google_analytics", setup: "Add your Google service-account key and give it access to both properties." },
    { key: "email_resend", name: "Resend", href: "/email", setup: "Add a Resend key and a verified sender on the Email page." },
  ];
  return Promise.all(definitions.map(async definition => {
    const row = saved.get(definition.key);
    const base = { key: definition.key, name: definition.name, href: definition.href };
    const result = (state: ConnectionHealth["state"], message: string): ConnectionHealth => ({ ...base, state, message });
    const envAi = definition.key === "ai" && Boolean(process.env.AI_API_KEY);
    if (!envAi && row?.status !== "connected") return result("needs_setup", definition.setup);
    try {
      switch (definition.key) {
        case "notion": {
          const pages = await listNotionPages(organizationId, "");
          return result("ready", pages.items.length ? "Notion returned shared pages. Nothing was imported." : "Notion accepts the connection. Share pages with it before importing content.");
        }
        case "youtube": {
          const response = await youtubeRequest(organizationId, "channels?part=snippet&mine=true");
          const payload = await response.json();
          return payload.items?.length ? result("ready", "YouTube returned your channel. Nothing was uploaded or published.") : result("needs_attention", "No YouTube channel was returned. Reconnect the correct channel.");
        }
        case "ai": {
          const providerValue = envAi ? process.env.AI_PROVIDER ?? "openai" : row?.config.provider;
          if (!isProviderKey(providerValue)) return result("needs_attention", "Choose a supported AI provider and save its key again.");
          const provider = getProvider(providerValue);
          const apiKey = envAi ? process.env.AI_API_KEY! : decryptSecret(row?.config.apiKey ?? "");
          if (!apiKey) return result("needs_attention", "Your saved AI key cannot be read. Enter the key again.");
          const model = (envAi ? process.env.AI_MODEL : row?.config.model) || provider.defaultModel;
          if (!isSupportedModel(provider.key, model)) return result("needs_attention", "Choose an available model in AI settings and save again.");
          const check = await checkProviderModel(provider.key, model, apiKey);
          return check.ok ? result("ready", `${provider.label} accepts the key and selected model. No generation was requested.`) : result("needs_attention", check.error ?? "The AI connection could not be verified.");
        }
        case "buffer": {
          const status = await getBufferStatus(organizationId);
          if (!status.connected) return result("needs_attention", "The saved Buffer key cannot be read. Reconnect Buffer.");
          const channels = await getBufferChannels(organizationId);
          if (!channels.length) return result("needs_attention", "Buffer accepts the key, but no social accounts are linked. Add accounts in Buffer, then refresh channels.");
          const usable = channels.filter(channel => !channel.isDisconnected && !channel.isLocked && !channel.isQueuePaused);
          return result(usable.length ? "ready" : "needs_attention", usable.length ? `${usable.length} linked social ${usable.length === 1 ? "account is" : "accounts are"} available. No posts were sent.` : "All linked channels are disconnected, paused or locked. Fix them in Buffer, then refresh channels.");
        }
        case "cms_wordpress": {
          const config = await getWordPressConfig(organizationId);
          if (!config) return result("needs_attention", "Enter your real public WordPress address and a readable application password.");
          await verifyWordPressConnection(config);
          await verifyWordPressSeoPlugin(config);
          return result("ready", "WordPress login, publishing permissions and selected SEO setup verified. Nothing was published.");
        }
        case "cms_strapi": {
          const config = await getStrapiConfig(organizationId);
          if (!config) return result("needs_attention", "Enter your real public Strapi address and a readable API token.");
          await verifyStrapiConnection(config);
          return result("ready", "Strapi accepts the token and article collection. Create permission is checked when you publish.");
        }
        case "google_analytics": {
          const config = await getGoogleAnalyticsConfig(organizationId);
          if (!config) return result("needs_attention", "Re-enter the Google service-account file and both property details.");
          await verifyGoogleAnalyticsConnection(config);
          return result("ready", "Google Analytics and Search Console both returned reports. No settings were changed.");
        }
        default: {
          const config = await getResendConfig(organizationId);
          if (!config) return result("needs_attention", "Re-enter the Resend API key on the Email page.");
          const check = await verifyResendSender(config.apiKey, config.fromEmail);
          if (!check.ok) return result("needs_attention", check.error ?? "Resend could not verify this sender.");
          if (!config.webhookSecret) return result("needs_attention", "Sender verified. Add the Resend webhook signing secret to record delivery events.");
          if (!publicAppOrigin(process.env.NEXT_PUBLIC_SITE_URL)) return result("needs_attention", "Sender verified. Set the public HTTPS app address before sending, so delivery webhooks and unsubscribe links work. Localhost is only for development.");
          return result("ready", "Resend accepts the key and verified sender. A webhook secret is saved; actual delivery events are confirmed after sending.");
        }
      }
    } catch {
      const recovery: Record<string, string> = {
        ai: "Recheck your AI provider, key and model.",
        buffer: "Reconnect the Buffer key and refresh linked accounts.",
        notion: "Reconnect Notion and share the source pages with your connection.",
        youtube: "Reconnect YouTube, enable YouTube Data API v3, and check the Google app's quota and consent setup.",
        cms_wordpress: "Use Test connection in WordPress setup to check the address, application password and publishing permissions.",
        cms_strapi: "Check the Strapi address, token and collection permissions, then save again.",
        google_analytics: "Check the Google key file, enable both APIs, and grant the service account access to GA4 and Search Console.",
        email_resend: "Check the Resend key and verified sender domain on the Email page.",
      };
      return result("needs_attention", `${definition.name} could not be verified. ${recovery[definition.key]}`);
    }
  }));
}
