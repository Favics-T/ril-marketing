"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/audience/access";
import { disconnectSource, saveNotionConnection, saveYouTubeApp, sourceAccess, type SourceProvider } from "@/lib/integrations/source-connections";
import { importAssetId, listNotionPages, listYouTubeVideos, readNotionPage, readYouTubeVideo, type ImportedContent, type ImportItem } from "@/lib/integrations/content-import";

const provider = z.enum(["notion", "youtube"]);
const message = (error: unknown) => error instanceof z.ZodError ? "Check the connection details and try again." : error instanceof Error ? error.message : "Could not reach the connection. Try again.";
async function manager() {
  const org = await requireOrganizationId(), role = await getUserRole(org);
  if (!role || !["owner", "admin", "marketing_manager"].includes(role)) throw new Error("An owner, admin or marketing manager must manage connections.");
  return org;
}
export async function saveNotionAction(form: FormData) {
  try { const org = await manager(); const token = z.string().trim().min(15).max(2000).parse(form.get("token")); await saveNotionConnection(org, token); revalidatePath("/settings/ai"); return { ok: true, message: "Notion connected. Share the pages you want to import with this connection in Notion." }; }
  catch (error) { return { ok: false, error: message(error) }; }
}
export async function saveYouTubeAppAction(form: FormData) {
  try {
    const org = await manager();
    const fields = z.object({ clientId: z.string().trim().min(10).max(300).regex(/\.apps\.googleusercontent\.com$/), secret: z.string().trim().max(1000) }).parse({ clientId: form.get("client_id"), secret: form.get("client_secret") ?? "" });
    await saveYouTubeApp(org, fields.clientId, fields.secret); revalidatePath("/settings/ai"); revalidatePath("/library/new");
    return { ok: true, message: "App details saved. Choose Connect YouTube to authorize your channel." };
  } catch (error) { return { ok: false, error: message(error) }; }
}
export async function disconnectSourceAction(key: SourceProvider) {
  try { const org = await manager(); await disconnectSource(org, provider.parse(key)); revalidatePath("/settings/ai"); revalidatePath("/library/new"); return { ok: true, message: "Disconnected from this workspace. Imported drafts are kept. You can also remove access in the provider's account settings." }; }
  catch (error) { return { ok: false, error: message(error) }; }
}
export async function testSourceAction(key: SourceProvider) {
  try {
    const org = await manager(); provider.parse(key);
    if (key === "notion") { const result = await listNotionPages(org, ""); return { ok: true, message: `Notion is reachable. ${result.items.length ? "Shared pages are available to import." : "No shared pages found. Add this connection to a page in Notion first."}` }; }
    const access = await sourceAccess(org, "youtube");
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${access.accessToken}` }, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!response.ok || !(await response.json()).items?.some((item: { id: string }) => item.id === access.accountId)) throw new Error("YouTube access could not be verified. Reconnect the channel.");
    return { ok: true, message: "YouTube channel access verified. Nothing was uploaded or published." };
  } catch (error) { return { ok: false, error: message(error) }; }
}
export async function listImportItems(key: SourceProvider, query = "", cursor?: string): Promise<{ ok: boolean; items: ImportItem[]; cursor: string | null; error?: string }> {
  try { const org = await requireOrganizationId(); provider.parse(key); z.string().max(200).parse(query); if (cursor) z.string().max(1000).parse(cursor); return { ok: true, ...(key === "notion" ? await listNotionPages(org, query, cursor) : await listYouTubeVideos(org, cursor)) }; }
  catch (error) { return { ok: false, items: [], cursor: null, error: message(error) }; }
}
export async function previewImportItem(key: SourceProvider, id: string): Promise<{ ok: boolean; content?: ImportedContent; error?: string }> {
  try { const org = await requireOrganizationId(); provider.parse(key); return { ok: true, content: await (key === "notion" ? readNotionPage(org, id) : readYouTubeVideo(org, id)) }; }
  catch (error) { return { ok: false, error: message(error) }; }
}
export async function importContentItem(key: SourceProvider, id: string, transcript = ""): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const org = await requireOrganizationId(); provider.parse(key); z.string().max(18000).parse(transcript);
    // Re-read the provider; never accept browser-supplied title, page URL or source text as verified source.
    const content = await (key === "notion" ? readNotionPage(org, id) : readYouTubeVideo(org, id));
    const body = `${content.body}${key === "youtube" && transcript.trim() ? `\n\n## Supplied transcript\n\n${transcript.trim()}` : ""}`.trim();
    if (body.length > 20000) throw new Error("This content exceeds 20,000 characters. Shorten the supplied transcript or source page.");
    const assetId = importAssetId(org, key, content.id), client = await createClient();
    const { data: existing, error: readError } = await client.from("content_assets").select("id").eq("organization_id", org).eq("id", assetId).maybeSingle();
    if (readError) throw new Error("Could not check previously imported content.");
    if (!existing) {
      const { error } = await client.from("content_assets").insert({ id: assetId, organization_id: org, title: content.title.slice(0,200), body: body || null, status: "editing", format: key === "notion" ? "article" : "video transcript", channel: key === "youtube" ? "youtube" : null, platform: key === "youtube" ? "youtube" : null, metadata: { external_import: { provider: key, external_id: content.id, source_url: content.url, imported_at: new Date().toISOString(), source_updated_at: content.updatedAt ?? null, transcript_available: content.transcriptAvailable ?? null, supplied_transcript: Boolean(transcript.trim()), warning: content.warning ?? null } } });
      if (error) {
        // Deterministic IDs also prevent duplicates from concurrent import clicks.
        const check = await client.from("content_assets").select("id").eq("organization_id", org).eq("id", assetId).maybeSingle();
        if (check.error || !check.data) throw new Error("Could not save the imported draft. Try again.");
      }
    }
    revalidatePath("/library"); return { ok: true, id: assetId };
  } catch (error) { return { ok: false, error: message(error) }; }
}
