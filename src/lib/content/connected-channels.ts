import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CHANNELS } from "./channels";

export type ChannelOption = readonly [string, string];
type Connection = { key: string; status: string; config: Record<string, unknown> | null };

export function channelsFromConnections(connections: Connection[]): ChannelOption[] {
  const values = new Set<string>();
  for (const connection of connections) {
    if (connection.status !== "connected") continue;
    if (connection.key === "buffer" && Array.isArray(connection.config?.channels)) {
      for (const channel of connection.config.channels) {
        if (!channel || typeof channel !== "object") continue;
        const item = channel as Record<string, unknown>;
        if (!item.id || item.isDisconnected || item.isLocked || typeof item.service !== "string") continue;
        const service = item.service.toLowerCase().trim();
        values.add(service === "twitter" ? "x" : service);
      }
    }
    if (["cms_wordpress", "cms_strapi"].includes(connection.key)) values.add("website");
    if (connection.key === "email_resend") values.add("email");
    if (connection.key === "youtube") values.add("youtube");
  }
  return CHANNELS.filter(channel => values.has(channel.value)).map(channel => [channel.value, channel.label] as const);
}

export async function getConnectedChannelOptions(organizationId: string): Promise<ChannelOption[]> {
  const client = await createClient();
  const { data, error } = await client.from("integrations").select("key,status,config")
    .eq("organization_id", organizationId).eq("status", "connected")
    .in("key", ["buffer", "cms_wordpress", "cms_strapi", "email_resend", "youtube"]);
  if (error) throw new Error("Could not load connected channels. Refresh and try again.");
  // Only slugs and labels leave this server module; connector credentials stay here.
  return channelsFromConnections((data ?? []) as Connection[]);
}
