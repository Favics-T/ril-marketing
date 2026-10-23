import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { SourceCreateForm } from "@/components/content/repurposing-workspace";
import { formatDayTime } from "@/lib/format";
import { notFound } from "next/navigation";
import { z } from "zod";
import { libraryFiles } from "@/lib/content/library-files";
export const metadata: Metadata = { title: "Repurpose content" };
export const maxDuration = 300;
export default async function RepurposingPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; attachment?: string; asset?: string; file?: string }>;
}) {
  const org = await requireOrganizationId();
  const client = await createClient();
  const params = await searchParams;
  if (params.asset && !z.uuid().safeParse(params.asset).success) notFound();
  if (params.file && (!params.asset || !z.uuid().safeParse(params.file).success)) notFound();
  const [sources, activities, files, library, selectedAsset] = await Promise.all([
    client
      .from("repurposing_sources")
      .select("id,title,status,error,updated_at,source_kind,options")
      .eq("organization_id", org)
      .order("updated_at", { ascending: false })
      .limit(30),
    client
      .from("activities")
      .select("id,title")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("activity_attachments")
      .select("id,activity_id,file_name")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(500),
    client.from("content_assets").select("id,title,metadata").eq("organization_id", org).order("created_at", { ascending: false }).limit(100),
    params.asset ? client.from("content_assets").select("id,title,body,metadata").eq("organization_id", org).eq("id", params.asset).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (sources.error || activities.error || files.error || library.error || selectedAsset.error)
    throw new Error(
      "Could not load repurposing sources. Check that the workflow migration is installed.",
    );
  const chosenAsset = selectedAsset.data;
  if (params.asset && !chosenAsset) notFound();
  const items = chosenAsset && !library.data?.some(item => item.id === chosenAsset.id) ? [chosenAsset, ...(library.data ?? [])] : library.data ?? [];
  const libraryFileOptions = items.flatMap(item => libraryFiles(item.metadata, org, item.id).map(file => ({ id: file.id, assetId: item.id, name: file.name })));
  if (params.file && !libraryFileOptions.some(file => file.id === params.file && file.assetId === chosenAsset?.id)) notFound();
  const initialFile = params.file ?? (chosenAsset && !chosenAsset.body?.trim() ? libraryFileOptions.find(file => file.assetId === chosenAsset.id)?.id : undefined);
  return (
    <div className="workspace-page flex flex-col gap-6">
      <header>
        <h1>Repurpose content</h1>
        <p className="mt-2 max-w-[70ch] text-sm leading-6 text-muted-foreground">
          Turn a recording, document, image, URL or activity into source-linked
          drafts. AI interpretation stays separate from source evidence. Your
          team approves every public step.
        </p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SourceCreateForm
          activities={activities.data || []}
          files={files.data || []}
          initialActivity={params.activity}
          initialAttachment={params.attachment}
          library={items.map(({ id, title }) => ({ id, title }))}
          libraryFiles={libraryFileOptions}
          initialFile={initialFile}
          initialAsset={chosenAsset?.id}
        />
        <section className="slip flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Recent sources</h2>
          {sources.data?.length ? (
            <ul className="divide-y divide-border">
              {sources.data.map((source) => (
                <li key={source.id} className="py-4">
                  <Link
                    href={`/repurpose/${source.id}`}
                    className="break-words text-sm font-semibold text-primary underline"
                  >
                    {source.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {source.options?.sourceAssetId ? "Content Library" : source.source_kind} ·{" "}
                    {source.status === "idea"
                      ? "Idea"
                      : source.status === "processing"
                        ? "Processing"
                        : "Drafts generated"}{" "}
                    · {formatDayTime(source.updated_at)}
                  </p>
                  {source.error ? (
                    <p className="mt-2 text-xs text-destructive">
                      Needs attention. Retry or add a manual summary.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No sources saved yet. Start with an activity or paste material you
              want to reuse.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
