"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Card as ShadcnCard } from "@/components/ui/card";
import { Alert as ShadcnAlert } from "@/components/ui/alert";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";


import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLandingPage, updateLandingPage, type LandingPageActionResult } from "@/actions/landing-pages";
import type { LandingPage } from "@/lib/landing-pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { LANDING_PAGE_COPY_MAX } from "@/lib/landing-page-url";
import { Eye, Pencil, Sparkles } from "lucide-react";
import { landingPageContentSchema, pageContent, pageCopySuggestions } from "@/lib/landing-page-content";
import { SectionEditor } from "./section-editor";
import { LandingPageContent } from "./page-content";
import { suggestLandingPageCopy, applyLandingPageCopy } from "@/actions/landing-page-copy";
import { LandingPageStatus } from "./landing-page-status";
import { LeadCaptureForm } from "./lead-capture-form";

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
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState(() => pageContent(page?.metadata));
  const [preview, setPreview] = useState<{ headline: string; body: string; cta: string } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [dirty, setDirty] = useState(false);
  const pageId = page?.id;
  const [state, action, pending] = useActionState<LandingPageActionResult | null, FormData>(
    async (previous, formData) => page
      ? updateLandingPage(page.id, previous, formData)
      : createLandingPage(previous, formData),
    null
  );
  useEffect(() => {
    if (state?.ok && state.id) {
      if (!pageId) router.push(`/audience/landing-pages/${state.id}`);
      else router.refresh();
    }
  }, [state, pageId, router]);

  function openPreview() {
    const parsed = landingPageContentSchema.safeParse(content);
    if (!parsed.success) { setPreviewError(parsed.error.issues[0]?.message ?? "Complete or remove unfinished sections before previewing."); return; }
    setPreviewError("");
    const data = new FormData(formRef.current!);
    setPreview({ headline: String(data.get("headline") ?? ""), body: String(data.get("body") ?? ""), cta: String(data.get("cta_label") ?? "Register interest") });
  }

  return (
    <ShadcnCard asChild><div className="slip min-w-0 p-5 sm:p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><h2 className="text-lg font-bold">{preview ? "Page preview" : "Build your page"}</h2><p className="mt-1 text-sm text-muted-foreground">{preview ? "Only you can see this preview. Nothing has been published." : "Start with your message, then add the sections you need."}</p></div><Button type="button" variant="outline" onClick={() => preview ? setPreview(null) : openPreview()}>{preview ? <Pencil className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}{preview ? "Back to editing" : "Preview page"}</Button></div>
    {previewError ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="mb-4 text-sm text-destructive">{previewError}</p></ShadcnAlert> : null}
    {preview ? <div className="grid gap-10 py-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))" }}><LandingPageContent headline={preview.headline} body={preview.body} metadata={{ builder: content }} ctaLabel={preview.cta} preview /><aside id="register-interest" className="h-fit scroll-mt-24 rounded-xl border bg-muted/30 p-5"><h3 className="text-lg font-bold">{preview.cta}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Share your details and the RIL team can follow up.</p><div className="mt-5"><LeadCaptureForm page={{ cta_label: preview.cta, registration_url: null }} pageKey="" preview /></div><p className="mt-4 text-xs text-muted-foreground">Preview only · submissions are disabled.</p></aside></div> : null}
    <ShadcnFieldGroup asChild><form ref={formRef} hidden={Boolean(preview)} onInput={() => setDirty(true)} onChange={() => setDirty(true)} onReset={event => event.preventDefault()} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="builder" value={JSON.stringify(content)} />
      <input type="hidden" name="updated_at" value={page?.updated_at ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Internal page name</span><Input name="title" required minLength={3} maxLength={160} defaultValue={page?.title ?? ""} placeholder="Founder programme applications" /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Page link name</span><Input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} defaultValue={page?.slug ?? ""} placeholder="founder-programme"/><span className="text-xs text-muted-foreground">Use lowercase words separated by hyphens, for example founder-programme. This becomes part of the public link.</span></ShadcnFieldLabel></ShadcnField>
      </div>
      <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Public headline</span><Input name="headline" required minLength={5} maxLength={200} defaultValue={page?.headline ?? ""} placeholder="Build what comes next." /></ShadcnFieldLabel></ShadcnField>
      <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Short description</span><Textarea value={content.description} maxLength={600} rows={3} onChange={e => { setContent({ ...content, description: e.target.value }); setDirty(true); }} placeholder="Explain the offer and who it is for in a few sentences." /></ShadcnFieldLabel></ShadcnField>
      <div className={field}>
        <span className="dateline">Page copy</span>
        <RichTextEditor
          name="body"
          label="Page copy"
          defaultValue={page?.body ?? ""}
          maxLength={LANDING_PAGE_COPY_MAX}
          onValueChange={() => setDirty(true)}
          placeholder="Describe the programme, who it serves, and the opportunity. Use headings, lists and links to make it easy to scan."
        />
      </div>
      <section className="flex flex-col gap-3"><h3 className="font-semibold">Add to your page</h3><p className="text-sm text-muted-foreground">Optional sections appear only when you fill them in.</p><SectionEditor content={content} onChange={value => { setContent(value); setDirty(true); }} /></section>
      <CopySuggestions page={page} dirty={dirty} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >Button text</span><Input name="cta_label" required minLength={2} maxLength={60} defaultValue={page?.cta_label ?? "Register interest"} /></ShadcnFieldLabel></ShadcnField>
        <ShadcnField asChild><ShadcnFieldLabel className={field}><span >External registration link (optional)</span><Input name="registration_url" type="url" maxLength={1000} defaultValue={page?.registration_url ?? ""} placeholder="https://…" /><span className="text-xs leading-5 text-muted-foreground">The page always includes an interest form. Add a link if visitors should also continue to registration on another site.</span></ShadcnFieldLabel></ShadcnField>
      </div>
      <section className="flex flex-col gap-4 border-t pt-5"><div><h3 className="font-semibold">Connect your campaign</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Choose a campaign before review. Form submissions will appear in Leads with this page and campaign attached. Email updates need the visitor’s separate consent.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { name: "campaign_id", label: "Campaign", items: campaigns },
          { name: "activity_id", label: "Activity", items: activities },
          { name: "audience_segment_id", label: "Audience segment", items: segments },
        ].map((group) => (
          <ShadcnField asChild key={group.name}><ShadcnFieldLabel key={group.name} className={field}><span >{group.label}</span><ShadcnNativeSelect name={group.name} defaultValue={page?.[group.name as "campaign_id" | "activity_id" | "audience_segment_id"] ?? ""} className={inputClass}><ShadcnNativeSelectOption value="">None selected</ShadcnNativeSelectOption>{group.items.map((item) => <ShadcnNativeSelectOption key={item.id} value={item.id}>{item.name}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
        ))}
      </div>
      </section>
      <Disclosure className="border-t pt-3" title={<>Search &amp; sharing</>}><ShadcnField asChild><ShadcnFieldLabel className={`${field} mt-4`}><span >Search description</span><Textarea name="meta_description" rows={2} maxLength={320} defaultValue={page?.meta_description ?? ""} placeholder="A short summary for search and sharing." /></ShadcnFieldLabel></ShadcnField></Disclosure>
      <p className="text-sm leading-6 text-muted-foreground">Saving creates a private draft. Next, submit it for review before publishing a public link.</p>
      {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
      {state?.ok && page ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm text-emerald-700 ">Draft saved.</p></ShadcnAlert> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => router.push(page ? `/audience/landing-pages/${page.id}` : "/audience/landing-pages")}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : page ? "Save draft" : "Save page draft"}</Button></div>
      {page ? <div className="flex flex-col gap-3 border-t pt-4"><h3 className="font-semibold">Ready for someone to check it?</h3><p className="text-sm leading-6 text-muted-foreground">{dirty ? "Save your changes before sending this page for review." : "Submit your saved draft for a different reviewer to check. It will stay private until approved and published."}</p><LandingPageStatus pageId={page.id} status="draft" updatedAt={page.updated_at} disabled={dirty || pending} /></div> : null}
    </form></ShadcnFieldGroup>
    </div></ShadcnCard>
  );
}

function CopySuggestions({ page, dirty }: { page?: LandingPage; dirty: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const suggestions = pageCopySuggestions(page?.metadata);
  function run(operation: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      try { const result = await operation(); if (!result.ok) setError(result.error ?? "Could not update the draft."); else router.refresh(); }
      catch { setError("Check your connection and try again. Your saved draft is unchanged."); }
    });
  }
  return <section className="flex flex-col gap-4 border-y py-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" aria-hidden="true" />Try another way to say it</h3><p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">AI offers three headline, description and button variations using your saved copy and Brand Knowledge. Review the facts before using one.</p></div><Button type="button" variant="outline" disabled={!page || dirty || busy} onClick={() => {
      run(() => suggestLandingPageCopy(page!.id, page!.updated_at));
    }}>{busy ? "Working…" : suggestions ? "Generate new options" : "Suggest copy"}</Button></div>
    {!page || dirty ? <p className="text-xs text-muted-foreground">Save your draft before generating or applying suggestions.</p> : null}
    {page?.metadata?.ai_copy ? <p className="text-sm font-medium text-primary">AI-generated copy · human review required before publishing.</p> : null}
    {error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{error}</p></ShadcnAlert> : null}
    {suggestions ? <div className="divide-y">{suggestions.variations.map((option, i) => <div key={i} className="flex flex-col gap-2 py-4"><p className="text-xs font-medium text-primary">AI suggestion {i + 1} · {suggestions.model}</p><h4 className="font-semibold">{option.headline}</h4><p className="text-sm leading-6 text-muted-foreground">{option.description}</p><p className="text-sm">Button: {option.cta_label}</p><Button type="button" variant="outline" size="sm" disabled={dirty || busy} onClick={() => run(() => applyLandingPageCopy(page!.id, i, page!.updated_at))}>Use option {i + 1}</Button></div>)}<p className="pt-3 text-xs text-muted-foreground">Brand sources: {suggestions.brandSources.join(", ") || "Workspace brand guidance"}. Applying an option changes this private draft only.</p></div> : null}
  </section>;
}
