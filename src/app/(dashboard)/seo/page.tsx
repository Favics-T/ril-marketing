import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { EmptyState } from "@/components/ui/empty-state";
import { SeoAssetWorkflow } from "@/components/content/seo-asset-workflow";
import { todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "SEO Workspace" };

type SeoAudit = {
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  focusKeywords: string[];
  seoTitle: string;
  metaDescription: string;
  headingOutline: string[];
  internalLinkSuggestions: Array<{ label: string; path: string }>;
  notes: string[];
  generatedAt: string;
  model: string;
};

const seoAuditSchema = z.object({
  searchIntent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  focusKeywords: z.array(z.string()), seoTitle: z.string(), metaDescription: z.string(),
  headingOutline: z.array(z.string()), internalLinkSuggestions: z.array(z.object({ label: z.string(), path: z.string() })),
  notes: z.array(z.string()), generatedAt: z.string(), model: z.string(),
});

function readSeo(metadata: Record<string, unknown> | null) {
  const seo = metadata?.seo && typeof metadata.seo === "object" ? metadata.seo as Record<string, unknown> : {};
  const parsedAudit = seoAuditSchema.safeParse(seo.audit);
  const audit: SeoAudit | null = parsedAudit.success ? parsedAudit.data : null;
  return { audit, appliedAt: typeof seo.appliedAt === "string" ? seo.appliedAt : null };
}

export default async function SeoWorkspacePage() {
  const organizationId = await getCallerOrganizationId();
  const supabase = await createClient();
  const { data, error } = organizationId ? await supabase.from("content_assets")
    .select("id,title,body,status,topic,channel,format,metadata,updated_at")
    .eq("organization_id", organizationId).in("status", ["idea", "ai_generated", "editing"]).not("body", "is", null)
    .or("format.eq.blog,channel.eq.website")
    .order("updated_at", { ascending: false }).limit(200) : { data: [], error: null };
  const assets = (data ?? []).map((asset) => ({
    ...asset,
    ...readSeo(asset.metadata as Record<string, unknown> | null),
  }));
  const analysisCount = assets.filter((asset) => Boolean(asset.audit)).length;
  const appliedCount = assets.filter((asset) => Boolean(asset.appliedAt)).length;

  return <div className="workspace-page flex flex-col gap-5 md:gap-7">
    <header>
      <p className="dateline">{todayDateline()} · content discoverability</p>
      <h1>SEO Workspace</h1>
      <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Improve RIL blog and website drafts with topic-grounded search suggestions. People review every recommendation; readiness checks describe the page, not its likely rank.</p>
    </header>

    {error ? <p role="alert" className="slip border-destructive p-5 text-sm text-destructive">SEO drafts could not be loaded. Refresh the page or check the database connection.</p> : null}

    <dl className="workspace-stat-strip">
      {[{ label: "Website drafts", value: assets.length }, { label: "Analysed", value: analysisCount }, { label: "Metadata applied", value: appliedCount }].map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{error ? "Unavailable" : item.value}</dd></div>)}
    </dl>

    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4"><div><p className="dateline">Editorial queue · {assets.length} drafts</p><h2 className="mt-1 text-lg font-bold">Website content</h2></div><Link href="/library?channel=website" className="inline-flex min-h-9 items-center rounded-md py-2 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">Open Content Library</Link></div>
      {!assets.length ? <EmptyState title="No website drafts to review" description="Create a blog draft with body copy. Editable website articles appear here for search checks before review." action={{ label: "Create a blog draft", href: "/library/new?channel=website&format=blog" }} /> : <ul className="flex flex-col gap-3">{assets.map((asset) => <SeoAssetWorkflow key={asset.id} asset={{ id: asset.id, title: asset.title, body: asset.body, status: asset.status, topic: asset.topic, channel: asset.channel, seo: asset.audit, seoAppliedAt: asset.appliedAt }} />)}</ul>}
    </section>

    <section className="slip p-5">
      <h2 className="text-[13px] font-bold tracking-[-0.01em]">Evidence boundary</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">This workspace reviews copy, metadata, structure and links to published RIL landing pages. It does not measure keyword volume, search rankings, crawl errors, backlinks, or page-speed scores. Connect verified Search Console and web analytics data before interpreting organic performance.</p>
    </section>
  </div>;
}
