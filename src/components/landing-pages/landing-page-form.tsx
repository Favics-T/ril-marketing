"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLandingPage, updateLandingPage, type LandingPageActionResult } from "@/actions/landing-pages";
import type { LandingPage } from "@/lib/landing-pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { LANDING_PAGE_COPY_MAX } from "@/lib/landing-page-url";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";

type Option = { id: string; name: string };
const field = "flex flex-col gap-1.5";
const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export function LandingPageForm({
  page,
  campaigns,
  activities,
  segments,
}: {
  page?: LandingPage;
  campaigns: Option[];
  activities: Option[];
  segments: Option[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<LandingPageActionResult | null, FormData>(
    async (previous, formData) => page
      ? updateLandingPage(page.id, previous, formData)
      : createLandingPage(previous, formData),
    null
  );
  useEffect(() => {
    if (state?.ok && state.id && !page) router.push(`/audience/landing-pages/${state.id}`);
  }, [state, page, router]);

  return (
    <form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-4 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={field}><span className="dateline">Internal page name</span><Input name="title" required minLength={3} maxLength={160} defaultValue={page?.title ?? ""} placeholder="Founder programme applications" /></label>
        <label className={field}><span className="dateline">Page link name</span><Input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} defaultValue={page?.slug ?? ""} placeholder="founder-programme"/><span className="text-xs text-muted-foreground">Use lowercase words separated by hyphens, for example founder-programme. This becomes part of the public link.</span></label>
      </div>
      <label className={field}><span className="dateline">Public headline</span><Input name="headline" required minLength={5} maxLength={200} defaultValue={page?.headline ?? ""} placeholder="Build what comes next." /></label>
      <div className={field}>
        <span className="dateline">Page copy</span>
        <RichTextEditor
          name="body"
          label="Page copy"
          defaultValue={page?.body ?? ""}
          maxLength={LANDING_PAGE_COPY_MAX}
          placeholder="Describe the programme, who it serves, and the opportunity. Use headings, lists and links to make it easy to scan."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={field}><span className="dateline">Button text</span><Input name="cta_label" required minLength={2} maxLength={60} defaultValue={page?.cta_label ?? "Register interest"} /></label>
        <label className={field}><span className="dateline">External registration link (optional)</span><Input name="registration_url" type="url" maxLength={1000} defaultValue={page?.registration_url ?? ""} placeholder="https://…" /><span className="text-xs leading-5 text-muted-foreground">The page always includes an interest form. Add a link if visitors should also continue to registration on another site.</span></label>
      </div>
      <details className="border-t pt-3"><DisclosureSummary>Search description &amp; linked records (optional)</DisclosureSummary><div className="mt-4 flex flex-col gap-4">
      <label className={field}><span className="dateline">Search description</span><Textarea name="meta_description" rows={2} maxLength={320} defaultValue={page?.meta_description ?? ""} placeholder="A short summary for search and sharing." /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { name: "campaign_id", label: "Campaign", items: campaigns },
          { name: "activity_id", label: "Activity", items: activities },
          { name: "audience_segment_id", label: "Audience segment", items: segments },
        ].map((group) => (
          <label key={group.name} className={field}><span className="dateline">{group.label}</span><select name={group.name} defaultValue={page?.[group.name as "campaign_id" | "activity_id" | "audience_segment_id"] ?? ""} className={inputClass}><option value="">None selected</option>{group.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        ))}
      </div>
      </div></details>
      <p className="text-sm leading-6 text-muted-foreground">Saving creates a private draft. Next, submit it for review before publishing a public link.</p>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state?.ok && page ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Draft saved.</p> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => router.push(page ? `/audience/landing-pages/${page.id}` : "/audience/landing-pages")}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : page ? "Save draft" : "Save page draft"}</Button></div>
    </form>
  );
}
