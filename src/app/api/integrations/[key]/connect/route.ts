import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import {
  buildAuthorizeUrl,
  getOAuthProvider,
} from "@/lib/integrations/oauth";
import { bufferEnv, stageBufferHandshake } from "@/lib/integrations/buffer";
import { getUserRole } from "@/lib/audience/access";

/**
 * GET /api/integrations/[key]/connect — start OAuth.
 * Verifies session + org, stages a single-use handshake, redirects out.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const settings = new URL("/settings/ai", request.url);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const def = getOAuthProvider(key);
    if (!def || key !== "buffer") {
      return NextResponse.json(
        { error: `${key} is not a supported connector yet.` },
        { status: 400 }
      );
    }
    const env = bufferEnv();
    if (!env) {
      settings.searchParams.set(
        "connect_error",
        "Social publishing isn't switched on for this workspace yet. Ask a workspace owner to register the Buffer app (BUFFER_CLIENT_ID)."
      );
      return NextResponse.redirect(settings);
    }
    const organizationId = await getCallerOrganizationId();
    if (!organizationId) {
      return NextResponse.json({ error: "No organization membership." }, { status: 403 });
    }
    const role = await getUserRole(organizationId);
    if (!role || !["owner", "admin", "marketing_manager"].includes(role)) return NextResponse.json({ error: "Connection settings require an owner, admin or marketing manager." }, { status: 403 });
    const { state, codeChallenge } = await stageBufferHandshake(organizationId);
    const redirectUri = new URL(`/api/integrations/${key}/callback`, request.url).toString();
    return NextResponse.redirect(
      buildAuthorizeUrl(def, { clientId: env.clientId, redirectUri, state, codeChallenge })
    );
  } catch (err) {
    settings.searchParams.set(
      "connect_error",
      err instanceof Error ? err.message : "Connect failed."
    );
    return NextResponse.redirect(settings);
  }
}
