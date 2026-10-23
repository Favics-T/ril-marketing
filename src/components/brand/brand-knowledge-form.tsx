"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createBrandKnowledge,
  updateBrandKnowledge,
  type BrandActionResult,
} from "@/actions/brand";
import { BRAND_KNOWLEDGE_CATEGORIES } from "@/types/brand";
import type { BrandKnowledgeEntry } from "@/types/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const categoryLabels: Record<(typeof BRAND_KNOWLEDGE_CATEGORIES)[number], string> = {
  brand_voice: "Brand voice",
  organization: "Organization facts",
  program: "Program information",
  audience: "Audience guidance",
  approved_message: "Approved messaging",
  terminology: "Terminology",
  policy: "Policy and claims",
  asset: "Brand asset notes",
};

export function BrandKnowledgeForm({
  entry,
}: {
  entry?: BrandKnowledgeEntry;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<BrandActionResult | null, FormData>(
    async (previous, formData) =>
      entry
        ? updateBrandKnowledge(entry.id, previous, formData)
        : createBrandKnowledge(previous, formData),
    null
  );

  useEffect(() => {
    if (!state?.ok) return;
    if (entry) router.refresh();
    else if (state.id) router.push(`/settings/brand/${state.id}`);
  }, [entry, router, state]);

  return (
    <form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand-title">Entry name</Label>
          <Input
            id="brand-title"
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={entry?.title ?? ""}
            placeholder="e.g. RIL voice and tone"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand-category">Category</Label>
          <select
            id="brand-category"
            name="category"
            defaultValue={entry?.category ?? "brand_voice"}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {BRAND_KNOWLEDGE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="brand-content">Approved guidance</Label>
        <Textarea
          id="brand-content"
          name="content"
          required
          minLength={2}
          maxLength={8000}
          rows={8}
          defaultValue={entry?.content ?? ""}
          placeholder="Add factual, approved material that should guide RIL's drafts. Separate facts from preferences."
        />
        <p className="text-xs text-muted-foreground">
          This is provided to AI as grounding context. It never approves or publishes a draft.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="brand-source">Source URL (optional)</Label>
        <Input
          id="brand-source"
          name="source_url"
          type="url"
          maxLength={1000}
          defaultValue={entry?.source_url ?? ""}
          placeholder="https://"
        />
      </div>
      {state?.ok === false ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {entry && state?.ok ? (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Entry saved.
        </p>
      ) : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : entry ? "Save entry" : "Add to knowledge base"}
      </Button>
    </form>
  );
}
