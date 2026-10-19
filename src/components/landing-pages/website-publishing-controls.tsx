"use client";

import { useActionState, useState } from "react";
import { RefreshCw } from "lucide-react";
import { checkWebsiteDeliveries, saveWebsiteSeo, testWebsiteConnection } from "@/actions/website-publishing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export function WebsiteConnectionCheck({ provider }: { provider: "wordpress" | "strapi" }) {
  const [result, action, pending] = useActionState(async () => testWebsiteConnection(provider), null);
  return <form action={action} className="flex flex-col items-start gap-3">
    <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? "Testing…" : "Test connection"}<span className="sr-only"> to {provider === "wordpress" ? "WordPress" : "Strapi"}</span></Button>
    {result ? <div role={result.ok ? "status" : "alert"} className="flex w-full flex-col gap-2 text-sm">
      <p className={result.ok ? "text-foreground" : "text-destructive"}>{result.error || result.message}</p>
      {result.checks ? <ul className="flex flex-col gap-2">{result.checks.map(check => <li key={check.label} className="text-muted-foreground"><span className="font-semibold text-foreground">{check.label}: {check.status === "pass" ? "Passed" : check.status === "fail" ? "Needs attention" : check.status === "warn" ? "Warning" : "Not checked"}.</span> {check.detail}</li>)}</ul> : null}
    </div> : null}
  </form>;
}

export function WebsiteDeliveryCheck() {
  const [result, action, pending] = useActionState(checkWebsiteDeliveries, null);
  return <form action={action} className="flex flex-col items-start gap-2">
    <Button type="submit" variant="outline" disabled={pending}><RefreshCw data-icon="inline-start" aria-hidden="true" />{pending ? "Checking deliveries…" : "Check website deliveries"}</Button>
    {result ? <p role={result.ok ? "status" : "alert"} className={`max-w-prose text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>{result.error || result.message}</p> : null}
  </form>;
}

export function WebsiteSeoForm({ assetId, updatedAt, title, description }: { assetId: string; updatedAt: string; title: string; description: string }) {
  const [seoTitle, setSeoTitle] = useState(title);
  const [seoDescription, setSeoDescription] = useState(description);
  const { toast } = useToast();
  const [result, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof saveWebsiteSeo>> | null, form: FormData) => {
    const next = await saveWebsiteSeo(assetId, previous, form);
    if (next.ok) toast({ title: "Search metadata saved", description: "The article still needs human approval before publishing." });
    return next;
  }, null);
  return <form action={action} className="flex flex-col gap-4">
    <input type="hidden" name="expected_updated_at" value={updatedAt} />
    <label className="flex flex-col gap-1.5 text-sm font-semibold">SEO title<Input name="seo_title" maxLength={70} value={seoTitle} onChange={event => setSeoTitle(event.target.value)} disabled={pending} placeholder="A clear title for search results" /><span className="text-xs font-normal text-muted-foreground">{seoTitle.length}/60 characters recommended</span></label>
    <label className="flex flex-col gap-1.5 text-sm font-semibold">Meta description<Textarea name="seo_description" maxLength={320} rows={3} value={seoDescription} onChange={event => setSeoDescription(event.target.value)} disabled={pending} placeholder="Summarise what readers will find in this article" /><span className="text-xs font-normal text-muted-foreground">{seoDescription.length}/160 characters recommended</span></label>
    <p className="max-w-prose text-xs leading-5 text-muted-foreground">Save search metadata before review. Changing approved copy or metadata requires returning the article to Editing and approving it again.</p>
    {result ? <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>{result.error || result.message}</p> : null}
    <Button type="submit" size="sm" disabled={pending} className="self-start">{pending ? "Saving metadata…" : "Save search metadata"}</Button>
  </form>;
}
