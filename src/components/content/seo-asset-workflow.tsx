"use client";

import { useActionState } from "react";
import { analyzeSeoAsset, applySeoMetadata } from "@/actions/seo";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";

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
type ActionState = { ok: boolean; error?: string; message?: string; audit?: SeoAudit } | null;

function readiness(asset: { title: string; body: string | null; seo: SeoAudit | null }) {
  const title = asset.seo?.seoTitle ?? "";
  const description = asset.seo?.metaDescription ?? "";
  const keywords = asset.seo?.focusKeywords ?? [];
  const body = asset.body ?? "";
  const joinedCopy = `${asset.title} ${body}`.toLowerCase();
  const checks = [
    { label: "Title fits common display length", complete: title.length >= 30 && title.length <= 60 },
    { label: "Meta description is concise", complete: description.length >= 120 && description.length <= 160 },
    { label: "Focus term appears in the draft", complete: keywords.some((term) => joinedCopy.includes(term.toLowerCase())) },
    { label: "Article uses section headings", complete: (body.match(/^#{1,3}\s+.+$/gm) ?? []).length >= 2 },
    { label: "Internal link is in the article", complete: (asset.seo?.internalLinkSuggestions ?? []).some(({ path }) => body.includes(path)) },
  ];
  return { checks, score: Math.round((checks.filter((item) => item.complete).length / checks.length) * 100) };
}

export function SeoAssetWorkflow({ asset }: {
  asset: { id: string; title: string; body: string | null; status: string; topic: string | null; channel: string | null; seo: SeoAudit | null; seoAppliedAt: string | null };
}) {
  const analyzeAction = analyzeSeoAsset.bind(null, asset.id);
  const applyAction = applySeoMetadata.bind(null, asset.id);
  const [analysisState, analyze, analyzing] = useActionState<ActionState, FormData>(analyzeAction, null);
  const [applyState, apply, applying] = useActionState<ActionState, FormData>(applyAction, null);
  const audit = analysisState?.audit ?? asset.seo;
  const readinessState = readiness({ title: asset.title, body: asset.body, seo: audit });
  const canEdit = ["idea", "ai_generated", "editing"].includes(asset.status);

  return <li className="slip overflow-hidden">
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="dateline">{asset.status.replaceAll("_", " ")}</span>{asset.topic ? <span className="text-xs text-muted-foreground">{asset.topic}</span> : null}</div>
          <h3 className="mt-1 font-semibold">{asset.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{asset.channel || "Website"} · updated SEO readiness is an editorial checklist, not a ranking prediction</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 border-l border-border pl-4"><span className="text-2xl font-semibold tabular-nums">{audit ? readinessState.score : "—"}</span><span className="dateline">{audit ? "/ 100 checks" : "Not analysed"}</span></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={analyze}><Button type="submit" size="sm" variant="outline" disabled={analyzing || !canEdit}>{analyzing ? "Analysing…" : audit ? "Refresh suggestions" : "Analyse website draft"}</Button></form>
        {audit ? <form action={apply}><Button type="submit" size="sm" disabled={applying || !canEdit}>{applying ? "Applying…" : asset.seoAppliedAt ? "Apply refreshed metadata" : "Apply title & description"}</Button></form> : null}
        {!canEdit ? <span className="self-center text-xs text-muted-foreground">Move this asset to Editing to change its search metadata.</span> : null}
      </div>

      {analysisState?.error ? <p role="alert" className="text-sm text-destructive">{analysisState.error}</p> : null}
      {analysisState?.message ? <p role="status" className="text-sm text-muted-foreground">{analysisState.message}</p> : null}
      {applyState?.error ? <p role="alert" className="text-sm text-destructive">{applyState.error}</p> : null}
      {applyState?.message ? <p role="status" className="text-sm text-muted-foreground">{applyState.message}</p> : null}

      {audit ? <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
        <section aria-label="Search metadata recommendations" className="space-y-3">
          <div><p className="dateline">Recommended metadata · {audit.searchIntent} intent</p><p className="mt-1 text-sm font-semibold">{audit.seoTitle}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{audit.metaDescription}</p><p className="mt-2 text-xs text-muted-foreground">Focus terms · {audit.focusKeywords.join(" · ")}</p></div>
          <div><p className="dateline">Suggested article structure</p><ol className="mt-1 list-inside list-decimal space-y-1 text-sm">{audit.headingOutline.map((heading, index) => <li key={`${heading}-${index}`}>{heading}</li>)}</ol></div>
          <p className="text-xs text-muted-foreground">Plan from {audit.model} · {new Date(audit.generatedAt).toLocaleDateString("en-GB")}. Suggestions need editorial fact-checking before publication.</p>
        </section>
        <section className="space-y-3">
          <div><p className="dateline">On-page checks · {readinessState.score}%</p><ul className="mt-1 space-y-1.5 text-xs">{readinessState.checks.map((check) => <li key={check.label} className="flex items-start gap-2">{check.complete ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : <Circle aria-hidden="true" className="size-3.5 shrink-0" />}<span className="sr-only">{check.complete ? "Complete: " : "Incomplete: "}</span><span>{check.label}</span></li>)}</ul></div>
          <div><p className="dateline">Internal link opportunities</p>{audit.internalLinkSuggestions.length ? <ul className="mt-1 space-y-1 text-sm">{audit.internalLinkSuggestions.map((link) => <li key={link.path}><a href={link.path} className="underline underline-offset-2">{link.label}</a><span className="ml-2 text-xs text-muted-foreground">{link.path}</span></li>)}</ul> : <p className="mt-1 text-xs leading-5 text-muted-foreground">No published internal pages are available as verified link targets yet.</p>}</div>
          {audit.notes.length ? <ul className="list-inside list-disc space-y-1 text-xs leading-5 text-muted-foreground">{audit.notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : null}
        </section>
      </div> : <p className="border-t border-border pt-3 text-sm text-muted-foreground">Analyse this blog draft for a search intent, focus terms, title, description, heading plan and verified internal link opportunities.</p>}
    </div>
  </li>;
}
