import { NextResponse } from "next/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { finishBufferHandshake } from "@/lib/integrations/buffer";
import { getUserRole } from "@/lib/audience/access";

/**
 * GET /api/integrations/[key]/callback?code=…&state=… — finish OAuth.
 * Consumes the single-use handshake, stores tokens, returns to Settings.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const settings = new URL("/settings/ai", request.url);
  try {
    if (key !== "buffer") {
      throw new Error(`${key} is not a supported connector yet.`);
    }
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const providerError =
      url.searchParams.get("error_description") ?? url.searchParams.get("error");
    if (providerError) throw new Error(`Buffer said: ${providerError}`);
    if (!code || !state) throw new Error("Missing code or state. Start over from Settings.");

    const organizationId = await getCallerOrganizationId();
    if (!organizationId) throw new Error("Session expired. Sign in and try again.");
    const role = await getUserRole(organizationId);
    if (!role || !["owner", "admin", "marketing_manager"].includes(role)) throw new Error("Connection settings require an owner, admin or marketing manager.");
    const redirectUri = new URL(`/api/integrations/${key}/callback`, request.url).toString();
    await finishBufferHandshake(organizationId, state, code, redirectUri);
    settings.searchParams.set("connected", key);
    return NextResponse.redirect(settings);
  } catch (err) {
    settings.searchParams.set(
      "connect_error",
      err instanceof Error ? err.message : "Connect failed."
    );
    return NextResponse.redirect(settings);
  }
}
