import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, isEncryptionEnabled } from "@/lib/crypto/secret-box";
import { codeChallengeFor, newCodeVerifier, newStateToken, isFreshHandshake } from "./oauth";

export type SourceProvider = "notion" | "youtube";
type Pending = { state: string; createdAt: string; actor: string; redirectUri: string; codeVerifier: string };
type Config = { accessToken?: string; refreshToken?: string; expiresAt?: string; clientId?: string; clientSecret?: string; accountName?: string; accountId?: string; uploadsPlaylist?: string; pending?: Pending };
export type SourceConnectionStatus = { connected: boolean; configured: boolean; accountName: string | null; clientId: string };

async function read(org: string, key: SourceProvider) {
  const { data, error } = await createAdminClient().from("integrations").select("id,status,config,updated_at").eq("organization_id", org).eq("key", key).maybeSingle();
  if (error) throw new Error("Could not read this connection. Try again.");
  return data as { id: string; status: string; config: Config; updated_at: string } | null;
}
async function store(org: string, key: SourceProvider, config: Config, status: string) {
  const { error } = await createAdminClient().from("integrations").upsert({ organization_id: org, key, display_name: key === "notion" ? "Notion" : "YouTube", status, config }, { onConflict: "organization_id,key" });
  if (error) throw new Error("Could not save the connection.");
}
export async function sourceConnectionStatus(org: string, key: SourceProvider): Promise<SourceConnectionStatus> {
  const row = await read(org, key);
  return { connected: row?.status === "connected" && Boolean(decryptSecret(row.config.accessToken ?? "")), configured: Boolean(row?.config.clientId && decryptSecret(row.config.clientSecret ?? "")), accountName: row?.config.accountName ?? null, clientId: row?.config.clientId ?? "" };
}
export function requireConnectionEncryption() {
  if (!isEncryptionEnabled()) throw new Error("Ask your administrator to set AI_CONFIG_SECRET before saving account credentials.");
}
export async function saveNotionConnection(org: string, token: string) {
  requireConnectionEncryption();
  const response = await fetch("https://api.notion.com/v1/users/me", { headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2025-09-03" }, signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Notion did not accept this connection secret." : "Notion could not verify the connection. Check its read-content permissions.");
  const user = await response.json();
  await store(org, "notion", { accessToken: encryptSecret(token), accountName: user.bot?.workspace_name || user.name || "Notion workspace", accountId: user.id }, "connected");
}
export async function saveYouTubeApp(org: string, clientId: string, secret: string) {
  requireConnectionEncryption();
  const row = await read(org, "youtube");
  const previous = row?.config ?? {};
  const clientSecret = secret ? encryptSecret(secret) : previous.clientSecret;
  if (!clientSecret || !decryptSecret(clientSecret)) throw new Error("Enter the Google OAuth client secret.");
  if (!secret && previous.clientId !== clientId) throw new Error("Enter the matching secret when changing the client ID.");
  await store(org, "youtube", { clientId, clientSecret }, "not_connected");
}
export async function stageYouTubeHandshake(org: string, actor: string, redirectUri: string) {
  const row = await read(org, "youtube");
  if (!row?.config.clientId || !decryptSecret(row.config.clientSecret ?? "")) throw new Error("Save the Google app details in YouTube setup first.");
  requireConnectionEncryption();
  const pending = { state: newStateToken(), codeVerifier: newCodeVerifier(), createdAt: new Date().toISOString(), actor, redirectUri };
  const staged = await createAdminClient().from("integrations").update({ config: { ...row.config, pending: { ...pending, codeVerifier: encryptSecret(pending.codeVerifier) } } }).eq("organization_id", org).eq("id", row.id).eq("updated_at", row.updated_at).select("id").maybeSingle();
  if (staged.error || !staged.data) throw new Error("Connection settings changed. Try connecting again.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: row.config.clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/youtube.force-ssl", access_type: "offline", prompt: "consent", state: pending.state, code_challenge: codeChallengeFor(pending.codeVerifier), code_challenge_method: "S256" }).toString();
  return url.toString();
}
async function tokenRequest(config: Config, fields: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId ?? "", client_secret: decryptSecret(config.clientSecret ?? ""), ...fields }), cache: "no-store", signal: AbortSignal.timeout(20000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) throw new Error("Google could not authorize this connection. Check the app details and reconnect YouTube.");
  return payload as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}
export async function finishYouTubeHandshake(org: string, actor: string, state: string, code: string, redirectUri: string) {
  const row = await read(org, "youtube"), pending = row?.config.pending;
  if (!row || !pending || !isFreshHandshake(pending) || pending.state !== state || pending.actor !== actor || pending.redirectUri !== redirectUri) throw new Error("This connection request expired or does not belong to you. Start again from Settings.");
  const { pending: _pending, ...config } = row.config;
  void _pending;
  // Consume the actor-bound request before exchanging its code, including concurrent callbacks.
  const { data, error } = await createAdminClient().from("integrations").update({ config }).eq("organization_id", org).eq("id", row.id).eq("updated_at", row.updated_at).select("id,updated_at").maybeSingle();
  if (error || !data) throw new Error("This connection request was already used. Start again from Settings.");
  const token = await tokenRequest(config, { grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: decryptSecret(pending.codeVerifier) });
  if (token.scope && !token.scope.split(" ").includes("https://www.googleapis.com/auth/youtube.force-ssl")) throw new Error("Allow the requested YouTube permissions to import captions and publish videos.");
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const channel = response.ok ? (await response.json()).items?.[0] : null;
  if (!channel?.id) throw new Error("No YouTube channel was returned. Choose a Google account with a YouTube channel and reconnect.");
  if (!token.refresh_token && (!config.refreshToken || config.accountId !== channel.id)) throw new Error("Google did not grant continuing access to this channel. Reconnect and allow the requested permissions.");
  // A disconnect or new setup while Google was responding must win over this callback.
  const updated = { ...config, accessToken: encryptSecret(token.access_token), refreshToken: encryptSecret(token.refresh_token ?? decryptSecret(config.refreshToken ?? "")), expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(), accountId: channel.id, accountName: channel.snippet?.title ?? "YouTube channel", uploadsPlaylist: channel.contentDetails?.relatedPlaylists?.uploads };
  const saved = await createAdminClient().from("integrations").update({ config: updated, status: "connected" }).eq("id", row.id).eq("organization_id", org).eq("updated_at", data.updated_at).select("id").maybeSingle();
  if (saved.error || !saved.data) throw new Error("Connection settings changed. Reconnect YouTube.");
}
export async function sourceAccess(org: string, key: SourceProvider) {
  const row = await read(org, key);
  if (row?.status !== "connected") throw new Error(`Connect ${key === "notion" ? "Notion" : "YouTube"} in AI & Integrations first.`);
  let accessToken = decryptSecret(row.config.accessToken ?? "");
  if (key === "youtube" && (!row.config.expiresAt || Date.parse(row.config.expiresAt) < Date.now() + 60000)) {
    const refresh = decryptSecret(row.config.refreshToken ?? "");
    if (!refresh) throw new Error("YouTube access expired. Reconnect in Settings.");
    const token = await tokenRequest(row.config, { grant_type: "refresh_token", refresh_token: refresh });
    const config = { ...row.config, accessToken: encryptSecret(token.access_token), refreshToken: encryptSecret(token.refresh_token ?? refresh), expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString() };
    const result = await createAdminClient().from("integrations").update({ config }).eq("organization_id", org).eq("id", row.id).eq("updated_at", row.updated_at).select("id").maybeSingle();
    if (result.error || !result.data) throw new Error("Connection changed while refreshing access. Try again.");
    accessToken = token.access_token;
  }
  if (!accessToken) throw new Error("This connection cannot be read. Reconnect in Settings.");
  return { accessToken, accountId: row.config.accountId, uploadsPlaylist: row.config.uploadsPlaylist };
}
export async function disconnectSource(org: string, key: SourceProvider) {
  const row = await read(org, key);
  if (!row) return;
  // Remove local access without revoking unrelated tools authorized to the same Google app.
  await store(org, key, key === "youtube" ? { clientId: row.config.clientId, clientSecret: row.config.clientSecret } : {}, "not_connected");
}
