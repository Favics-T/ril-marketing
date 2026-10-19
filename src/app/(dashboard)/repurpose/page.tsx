import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { SourceCreateForm } from "@/components/content/repurposing-workspace";
import { formatDayTime } from "@/lib/format";
export const metadata: Metadata = { title: "Repurpose content" };
export const maxDuration = 300;
export default async function RepurposingPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; attachment?: string }>;
}) {
  const org = await requireOrganizationId();
  const client = await createClient();
  const params = await searchParams;
  const [sources, activities, files] = await Promise.all([
    client
      .from("repurposing_sources")
      .select("id,title,status,error,updated_at,source_kind")
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
  ]);
  if (sources.error || activities.error || files.error)
    throw new Error(
      "Could not load repurposing sources. Check that the workflow migration is installed.",
    );
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
                    {source.source_kind} ·{" "}
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
