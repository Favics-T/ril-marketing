import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryPost } from "@/lib/content/publishing";
import { decryptSecret, encryptSecret, isEncryptionEnabled } from "@/lib/crypto/secret-box";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";
import {
  codeChallengeFor,
  getOAuthProvider,
  newCodeVerifier,
  newStateToken,
} from "@/lib/integrations/oauth";

/**
 * Buffer connector, targeting the GraphQL API.
 *
 * Uses Buffer's GraphQL endpoint. Key differences that shape this module:
 *   - One endpoint, always POST, body is `{ query, variables }`.
 *   - Auth is a Bearer token (OAuth access token here; personal API keys also work).
 *   - Buffer's "profiles" are now "channels".
 *   - Errors come back as typed unions in the response body (`MutationError`),
 *     not as HTTP status codes.
 */

const GRAPHQL_ENDPOINT = "https://api.buffer.com";

export interface BufferChannel {
  id: string;
  /** The handle, e.g. "renaissancelabs". */
  name: string;
  displayName: string | null;
  /** Lowercase service key, e.g. "linkedin", "instagram", "tiktok". */
  service: string;
  /** Page / Profile / Business / Group / Account. */
  type: string;
  /** Human label Buffer builds for us, e.g. "LinkedIn Page". */
  descriptor: string;
  avatar: string | null;
  /** A paused queue silently stops scheduled posts from publishing. */
  isQueuePaused: boolean;
  isDisconnected: boolean;
  isLocked: boolean;
}

interface StoredConfig {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  pending?: { state: string; createdAt: string; codeVerifier?: string };
  channels?: BufferChannel[];
  bufferOrganizationId?: string | null;
  bufferOrganizationName?: string | null;
}

async function readConfig(
  organizationId: string
): Promise<{ rowId: string | null; config: StoredConfig }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("id, config")
    .eq("organization_id", organizationId)
    .eq("key", "buffer")
    .maybeSingle<{ id: string; config: StoredConfig }>();
  const config = data?.config ?? {};
  return { rowId: data?.id ?? null, config: { ...config, accessToken: decryptSecret(config.accessToken ?? ""), refreshToken: decryptSecret(config.refreshToken ?? "") } };
}

async function writeConfig(
  organizationId: string,
  rowId: string | null,
  config: StoredConfig,
  status: "connected" | "not_connected" | "error"
): Promise<void> {
  const admin = createAdminClient();
  const stored = { ...config, accessToken: encryptSecret(config.accessToken ?? ""), refreshToken: encryptSecret(config.refreshToken ?? "") };
  if (rowId) {
    const { error } = await admin.from("integrations").update({ config: stored, status }).eq("id", rowId).eq("organization_id", organizationId);
    if (error) throw new Error("Could not save the Buffer connection.");
  } else {
    const { error } = await admin.from("integrations").insert({
      organization_id: organizationId,
      key: "buffer",
      display_name: "Buffer",
      status,
      config: stored,
    });
    if (error) throw new Error("Could not save the Buffer connection.");
  }
}

/**
 * A client secret is optional: confidential clients (a server app that can
 * keep a secret) get one, public clients authenticate with PKCE alone.
 */
export function bufferEnv(): { clientId: string; clientSecret: string | null } | null {
  const clientId = process.env.BUFFER_CLIENT_ID ?? "";
  if (!clientId) return null;
  return { clientId, clientSecret: process.env.BUFFER_CLIENT_SECRET || null };
}

interface GraphQlError {
  message?: string;
}

/**
 * One POST per call. Buffer returns 401 for a bad token and otherwise reports
 * problems inside `errors`, so both paths have to be checked.
 */
async function bufferGraphQl<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Could not reach Buffer. Check the connection and try again.");
  }

  if (response.status === 401) {
    throw new DeliveryRejected("Buffer didn't accept the connection. Reconnect in Settings.");
  }
  if (response.status === 429) {
    throw new DeliveryRejected("Buffer is rate limiting this account. Try again shortly.");
  }
  if (response.status === 400 || response.status === 403) throw new DeliveryRejected(`Buffer rejected the request (HTTP ${response.status}).`);

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; errors?: GraphQlError[] }
    | null;

  if (!response.ok) {
    throw new Error(`Buffer returned HTTP ${response.status}.`);
  }
  const firstError = payload?.errors?.[0]?.message;
  if (firstError) throw new Error(`Buffer rejected the request: ${firstError}`);
  if (!payload?.data) throw new Error("Buffer returned an empty response.");
  return payload.data;
}

const ACCOUNT_QUERY = `
  query GetAccount {
    account {
      id
      email
      name
      organizations {
        id
        name
      }
    }
  }
`;

/**
 * The organization ID is inlined rather than passed as a variable: Buffer types
 * that field as its own `OrganizationId` scalar, and a `String!` variable would
 * fail validation against it. This matches Buffer's own "Your First Post"
 * guide, which also inlines the ID.
 */
function channelsQuery(organizationId: string): string {
  return `
  query GetChannels {
    channels(input: { organizationId: ${JSON.stringify(organizationId)} }) {
      id
      name
      displayName
      service
      type
      descriptor
      avatar
      isQueuePaused
      isDisconnected
      isLocked
    }
  }
`;
}

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess {
        post {
          id
          text
          dueAt
          status
          sentAt
          channelId
          externalLink
          error { message }
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

interface BufferOrganization {
  id: string;
  name: string;
}

async function fetchOrganizations(
  accessToken: string
): Promise<BufferOrganization[]> {
  const data = await bufferGraphQl<{
    account: { organizations: BufferOrganization[] };
  }>(accessToken, ACCOUNT_QUERY);
  return data.account?.organizations ?? [];
}

/**
 * Channels are listed per Buffer organization, and a Buffer account can hold
 * several. The chosen organization is cached on the row so Settings loads
 * without an extra round trip.
 */
async function resolveOrganization(
  organizationId: string,
  rowId: string | null,
  config: StoredConfig,
  accessToken: string
): Promise<BufferOrganization> {
  const organizations = await fetchOrganizations(accessToken);
  if (organizations.length === 0) {
    throw new Error("This Buffer account has no organization to connect.");
  }
  const cached = organizations.find((org) => org.id === config.bufferOrganizationId);
  const chosen = cached ?? organizations[0];
  if (chosen.id !== config.bufferOrganizationId) {
    await writeConfig(
      organizationId,
      rowId,
      {
        ...config,
        bufferOrganizationId: chosen.id,
        bufferOrganizationName: chosen.name,
      },
      "connected"
    );
  }
  return chosen;
}

/** Step 1 of connect: stage a single-use handshake, return state + PKCE challenge. */
export async function stageBufferHandshake(
  organizationId: string
): Promise<{ state: string; codeChallenge: string }> {
  const state = newStateToken();
  const codeVerifier = newCodeVerifier();
  const { rowId, config } = await readConfig(organizationId);
  await writeConfig(
    organizationId,
    rowId,
    {
      ...config,
      pending: { state, createdAt: new Date().toISOString(), codeVerifier },
    },
    "not_connected"
  );
  return { state, codeChallenge: codeChallengeFor(codeVerifier) };
}

/** Step 2 (callback): verify state once, exchange code + verifier, store tokens. */
export async function finishBufferHandshake(
  organizationId: string,
  state: string,
  code: string,
  redirectUri: string
): Promise<void> {
  const env = bufferEnv();
  if (!env) {
    throw new Error(
      "Social publishing isn't switched on yet. Ask whoever set up your workspace to connect Buffer."
    );
  }
  const { rowId, config } = await readConfig(organizationId);
  const pending = config.pending;
  const fresh =
    pending?.state === state &&
    Number.isFinite(new Date(pending.createdAt).getTime()) &&
    Date.now() - new Date(pending.createdAt).getTime() <= 10 * 60_000;
  if (!fresh) throw new Error("Connect session expired. Start over from Settings.");
  if (!pending?.codeVerifier) {
    throw new Error("Connect session is incomplete. Start over from Settings.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: pending.codeVerifier,
  });
  if (env.clientSecret) body.set("client_secret", env.clientSecret);

  const res = await fetch(getOAuthProvider("buffer")!.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tokens = (await res.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;
  if (!res.ok || !tokens?.access_token) {
    const detail = tokens?.error_description ?? tokens?.error ?? `HTTP ${res.status}`;
    throw new Error(`Buffer refused the connection (${detail}).`);
  }

  const { pending: _drop, ...rest } = config;
  void _drop;
  await writeConfig(
    organizationId,
    rowId,
    {
      ...rest,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      // A reconnect must not reuse the previous account's organization.
      bufferOrganizationId: null,
      bufferOrganizationName: null,
      channels: [],
    },
    "connected"
  );
}

async function refreshIfNeeded(
  organizationId: string,
  rowId: string | null,
  config: StoredConfig
): Promise<string> {
  const valid =
    config.accessToken &&
    (!config.expiresAt || new Date(config.expiresAt).getTime() - Date.now() > 60_000);
  if (valid) return config.accessToken as string;

  const env = bufferEnv();
  if (!config.refreshToken) {
    throw new Error("Buffer connection expired. Reconnect in Settings.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });
  if (env?.clientId) body.set("client_id", env.clientId);
  if (env?.clientSecret) body.set("client_secret", env.clientSecret);

  const res = await fetch(getOAuthProvider("buffer")!.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tokens = (await res.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string; expires_in?: number }
    | null;
  if (!res.ok || !tokens?.access_token) {
    throw new Error("Buffer connection expired. Reconnect in Settings.");
  }
  await writeConfig(
    organizationId,
    rowId,
    {
      ...config,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? config.refreshToken,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : config.expiresAt ?? null,
    },
    "connected"
  );
  return tokens.access_token;
}

function toChannel(raw: Partial<BufferChannel> & { id: string }): BufferChannel {
  return {
    id: raw.id,
    name: raw.name ?? "",
    displayName: raw.displayName ?? null,
    service: raw.service ?? "unknown",
    type: raw.type ?? "",
    descriptor: raw.descriptor ?? raw.service ?? "Channel",
    avatar: raw.avatar ?? null,
    isQueuePaused: Boolean(raw.isQueuePaused),
    isDisconnected: Boolean(raw.isDisconnected),
    isLocked: Boolean(raw.isLocked),
  };
}

/** Connected channels, cached on the row so Settings loads instantly. */
export async function getBufferChannels(
  organizationId: string
): Promise<BufferChannel[]> {
  const { rowId, config } = await readConfig(organizationId);
  if (!config.accessToken) throw new Error("Buffer is not connected.");
  const accessToken = await refreshIfNeeded(organizationId, rowId, config);
  const organization = await resolveOrganization(
    organizationId,
    rowId,
    { ...config, accessToken },
    accessToken
  );
  const data = await bufferGraphQl<{ channels: BufferChannel[] }>(
    accessToken,
    channelsQuery(organization.id)
  );
  const channels = (data.channels ?? []).map(toChannel);
  await writeConfig(organizationId, rowId, { ...config, accessToken, channels, bufferOrganizationId: organization.id, bufferOrganizationName: organization.name }, "connected");
  return channels;
}

export function cachedBufferChannels(config: StoredConfig): BufferChannel[] {
  return config.channels ?? [];
}

/**
 * Submit text to one channel. Acceptance is not proof of delivery.
 * `mode` maps onto Buffer's sharing modes; the default publishes immediately
 * rather than dropping the post into the channel's queue.
 */
export async function publishToBuffer(
  organizationId: string,
  channelId: string,
  text: string,
  scheduledFor?: string
): Promise<DeliveryPost> {
  const { rowId, config } = await readConfig(organizationId);
  if (!config.accessToken) throw new Error("Buffer is not connected.");
  const accessToken = await refreshIfNeeded(organizationId, rowId, config);

  const data = await bufferGraphQl<{
    createPost: { post?: BufferPost; message?: string };
  }>(accessToken, CREATE_POST_MUTATION, {
    input: {
      text,
      channelId,
      schedulingType: "automatic",
      mode: scheduledFor ? "customScheduled" : "shareNow",
      ...(scheduledFor ? { dueAt: scheduledFor } : {}),
    },
  });

  // Buffer reports failures as a union member, not an HTTP status.
  const failure = data.createPost?.message;
  if (failure) throw new DeliveryRejected(`Buffer rejected the post: ${failure}`);
  return bufferDelivery(data.createPost?.post);
}

type BufferPost = { id: string; status: string; text?: string; dueAt?: string | null; sentAt?: string | null; channelId?: string; externalLink?: string | null; error?: { message?: string } | null };

export function bufferDelivery(post?: BufferPost): DeliveryPost {
  if (!post?.id) throw new Error("Buffer returned no post receipt. Check Buffer before retrying.");
  let url: string | undefined;
  try { const parsed = new URL(post.externalLink ?? ""); if (parsed.protocol === "https:" && !parsed.username && !parsed.password) url = parsed.href; } catch { /* No public link is available yet. */ }
  const receipt = { id: post.id, scheduledFor: post.dueAt, sourceText: post.text, sourceChannelId: post.channelId, url };
  if (post.status === "sent") return { ...receipt, status: "published", publishedAt: post.sentAt };
  if (["error", "draft", "needs_approval"].includes(post.status)) return { ...receipt, status: "failed", error: post.error?.message || `Buffer post status: ${post.status}. Review it in Buffer.` };
  return { ...receipt, status: "queued" };
}

export async function getBufferPost(organizationId: string, id: string): Promise<DeliveryPost> {
  const { rowId, config } = await readConfig(organizationId);
  const token = await refreshIfNeeded(organizationId, rowId, config);
  const data = await bufferGraphQl<{ post: BufferPost }>(token, `query GetPost($input: PostInput!) { post(input: $input) { id text status dueAt sentAt channelId externalLink error { message } } }`, { input: { id } });
  return bufferDelivery(data.post);
}

export async function connectBufferApiKey(organizationId: string, apiKey: string) {
  if (!isEncryptionEnabled()) throw new Error("Set AI_CONFIG_SECRET before storing a Buffer API key.");
  const organizations = await fetchOrganizations(apiKey);
  const organization = organizations[0];
  if (!organization) throw new Error("This Buffer key has no accessible organization.");
  const data = await bufferGraphQl<{ channels: BufferChannel[] }>(apiKey, channelsQuery(organization.id));
  const channels = (data.channels ?? []).map(toChannel);
  const { rowId } = await readConfig(organizationId);
  await writeConfig(organizationId, rowId, { accessToken: apiKey, channels, bufferOrganizationId: organization.id, bufferOrganizationName: organization.name }, "connected");
  return channels;
}

export async function disconnectBuffer(organizationId: string): Promise<void> {
  const { rowId, config } = await readConfig(organizationId);
  const {
    accessToken: _a,
    refreshToken: _r,
    expiresAt: _e,
    channels: _c,
    bufferOrganizationId: _o,
    bufferOrganizationName: _n,
    ...rest
  } = config;
  void _a;
  void _r;
  void _e;
  void _c;
  void _o;
  void _n;
  await writeConfig(organizationId, rowId, rest, "not_connected");
}

export async function getBufferStatus(organizationId: string): Promise<{
  connected: boolean;
  channels: BufferChannel[];
  envConfigured: boolean;
  organizationName: string | null;
}> {
  const { config } = await readConfig(organizationId);
  return {
    connected: Boolean(config.accessToken),
    channels: cachedBufferChannels(config),
    envConfigured: bufferEnv() !== null,
    organizationName: config.bufferOrganizationName ?? null,
  };
}
