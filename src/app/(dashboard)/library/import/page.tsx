import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { sourceConnectionStatus } from "@/lib/integrations/source-connections";
import { ContentImporter } from "@/components/content/content-importer";
export const metadata: Metadata = { title: "Import content" };
export const maxDuration = 300;
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ provider?: string }> }) {
  const org = await requireOrganizationId(), query = await searchParams;
  const [notion, youtube] = await Promise.all([sourceConnectionStatus(org, "notion"), sourceConnectionStatus(org, "youtube")]);
  return <div className="workspace-page flex flex-col gap-6"><header><Link href="/library" className="inline-flex min-h-9 items-center text-sm text-primary underline">Content Library</Link><h1>Import content</h1><p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">Choose a Notion page or one of your YouTube videos. Review the source, save a draft, then use Repurpose content to create new formats. Nothing publishes when you import.</p></header><ContentImporter initialProvider={query.provider === "youtube" ? "youtube" : "notion"} connections={{ notion, youtube }} /></div>;
}
