import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { SourceRunControls } from "@/components/content/repurposing-workspace";
import type { RepurposingSource } from "@/lib/content/repurposing-source";
import { RichText } from "@/components/ui/rich-text";
export const metadata: Metadata = { title: "Repurposing source" };
export const maxDuration = 300;
export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganizationId();
  const client = await createClient();
  const { data, error } = await client
    .from("repurposing_sources")
    .select("*")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load this source.");
  if (!data) notFound();
  const source = data as RepurposingSource;
  const { data: outputs, error: outputsError } = await client
    .from("repurposing_outputs")
    .select("revision,asset:content_assets(id,title,status,format,platform)")
    .eq("organization_id", org)
    .eq("source_id", id)
    .order("revision", { ascending: false })
    .limit(100);
  if (outputsError) throw new Error("Could not load generated outputs.");
  return (
    <div className="workspace-page flex flex-col gap-6">
      <header>
        <Link href="/repurpose" className="text-sm text-primary underline">
          All sources
        </Link>
        <h1 className="mt-2">{source.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {source.source_kind} · Revision {source.revision} ·{" "}
          {source.status === "idea"
            ? "Idea"
            : source.status === "completed"
              ? "Drafts generated"
              : "Processing"}
        </p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <SourceRunControls key={source.updated_at} source={source} />
          <section className="slip flex flex-col gap-3 p-5 sm:p-6">
            <h2 className="text-base font-semibold">Generated assets</h2>
            {outputs?.length ? (
              <ul className="flex flex-col gap-3">
                {outputs.map((row, index) => {
                  const asset = (
                    Array.isArray(row.asset) ? row.asset[0] : row.asset
                  ) as {
                    id: string;
                    title: string;
                    status: string;
                    format: string;
                    platform: string;
                  } | null;
                  return asset ? (
                    <li key={`${asset.id}-${index}`}>
                      <Link
                        className="text-sm font-semibold text-primary underline"
                        href={`/library/${asset.id}`}
                      >
                        {asset.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Source revision {row.revision} · {asset.format} ·{" "}
                        {asset.platform || "website / email"} ·{" "}
                        {asset.status.replaceAll("_", " ")}
                      </p>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No drafts yet. Failed extraction keeps the source as an Idea,
                with retry and manual recovery available above.
              </p>
            )}
            {source.analysis.warnings?.length ? (
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {source.analysis.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
        <section className="slip flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold">Source evidence</h2>
          {source.source_url ? (
            <a
              href={source.source_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm text-primary underline"
            >
              Original URL
            </a>
          ) : null}
          {source.analysis.summary ? (
            <RichText>{source.analysis.summary}</RichText>
          ) : (
            <p className="text-sm text-muted-foreground">
              Evidence appears after extraction. Nothing has been invented to
              fill this space.
            </p>
          )}
          {["topics", "quotes", "statistics", "angles", "callsToAction"].map(
            (key) => {
              const rows = source.analysis[key as keyof typeof source.analysis];
              return Array.isArray(rows) && rows.length ? (
                <div key={key}>
                  <h3 className="text-sm font-semibold">
                    {
                      {
                        topics: "Topics",
                        quotes: "Source quotes",
                        statistics: "Source statistics",
                        angles: "Possible AI angles",
                        callsToAction: "Source calls to action",
                      }[key]
                    }
                  </h3>
                  <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-muted-foreground">
                    {rows
                      .filter((row): row is string => typeof row === "string")
                      .map((row, index) => (
                        <li key={index}>{row}</li>
                      ))}
                  </ul>
                </div>
              ) : null;
            },
          )}
          {source.analysis.transcript ? (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                Transcript / extracted text
              </summary>
              <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6">
                {source.analysis.transcript}
              </p>
            </details>
          ) : source.manual_summary || source.input_text ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {source.manual_summary || source.input_text}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
