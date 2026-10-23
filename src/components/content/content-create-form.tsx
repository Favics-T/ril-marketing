"use client";

import { ChannelSelect } from "@/components/channel-select";
import { useActionState, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createManualAsset, type ActionResult } from "@/actions/content";
import { APPROVAL_CATEGORIES } from "@/lib/content/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import type { ChannelOption } from "@/lib/content/connected-channels";
import { LibraryFilePicker } from "@/components/content/library-files";
import { uploadLibraryFile, type QueuedLibraryFile } from "@/lib/content/library-file-upload";

export function ContentCreateForm({ organizationId, channels, initialChannel = "", initialFormat = "social post", cancelHref = "/library" }: { organizationId: string; channels: ChannelOption[]; initialChannel?: "" | "website"; initialFormat?: "social post" | "blog"; cancelHref?: string }) {
  const router = useRouter();
  const channelId = useId();
  const [files, setFiles] = useState<QueuedLibraryFile[]>([]);
  const createdDraft = useRef<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = createdDraft.current ? { ok: true, id: createdDraft.current } : await createManualAsset(formData);
    if (result.ok && result.id) {
      createdDraft.current = result.id; setSavedId(result.id);
      const remaining: QueuedLibraryFile[] = [];
      const errors: string[] = [];
      for (const item of files) {
        const upload = await uploadLibraryFile(organizationId, result.id, item);
        if (!upload.ok) { remaining.push({ ...item, path: upload.path }); errors.push(`${item.file.name}: ${upload.error}`); }
      }
      setFiles(remaining);
      if (errors.length) return { ok: false, error: `Your draft is saved. Retry the remaining attachments: ${errors.join(" ")}` };
      router.push(`/library/${result.id}`);
    }
    return result;
  }, null);
  return <form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
    <fieldset disabled={pending || Boolean(savedId)} className="flex min-w-0 flex-col gap-5">
    <label className="flex flex-col gap-2 text-sm font-semibold">Title<Input name="title" required minLength={2} maxLength={200} placeholder="Give this content a clear title" disabled={pending}/></label>
    <div className="flex flex-col gap-2"><label htmlFor={channelId} className="text-sm font-semibold">Channel</label><ChannelSelect id={channelId} name="channel" defaultValue={channels.some(([value]) => value === initialChannel) ? initialChannel : ""} disabled={pending} options={[["", "Not set"], ...channels]} /><p className="text-xs text-muted-foreground">{channels.length ? "Channels come from your connected publishing accounts." : "No publishing channels connected. Save an unassigned draft, or connect an account first."} <Link href="/settings/ai" className="font-semibold text-primary underline">Manage connections</Link></p></div>
    <label className="flex flex-col gap-2 text-sm font-semibold">Content type<select name="format" defaultValue={initialFormat} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">{["social post", "blog", "newsletter", "short-form video", "press release", "other"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Approval category<select name="approval_category" defaultValue="standard" className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">{APPROVAL_CATEGORIES.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select><span className="text-xs font-normal text-muted-foreground">Standard content needs one independent reviewer. Sensitive categories need a second named approval.</span></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Content<Textarea name="body" rows={10} maxLength={20000} placeholder="Write or paste your draft here…" disabled={pending} className="min-h-60 text-sm font-normal leading-6"/><span className="text-xs font-normal text-muted-foreground">You can save a title first and add the copy later.</span></label>
    <details className="border-t pt-3"><DisclosureSummary>Save as an idea instead (optional)</DisclosureSummary><label className="mt-3 flex flex-col gap-2 text-sm">Starting status<select name="initial_status" defaultValue="editing" className="h-11 rounded-lg border border-input bg-card px-3"><option value="editing">Editing draft</option><option value="idea">Idea · copy to develop later</option></select></label></details>
    </fieldset>
    <section className="flex flex-col gap-3 border-t pt-4" aria-labelledby="draft-files-heading"><h2 id="draft-files-heading" className="text-sm font-semibold">Files (optional)</h2><p className="text-sm leading-6 text-muted-foreground">Attach images, video, audio, PDF, Word or text files. They upload privately when you save this draft. Up to 100 MB per file.</p><LibraryFilePicker files={files} onChange={setFiles} disabled={pending || Boolean(savedId)} /></section>
    <p className="text-sm text-muted-foreground">Next: open your saved content to edit it and request review. Saving does not publish.</p>
    {state?.ok === false && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <footer className="flex flex-wrap items-center justify-end gap-2 border-t pt-4"><Button asChild variant="outline"><Link href={savedId ? `/library/${savedId}` : cancelHref}>{savedId ? "Open saved draft" : "Cancel"}</Link></Button><Button type="submit" disabled={pending} className="active:scale-[.97] motion-reduce:active:scale-100">{pending ? "Saving draft & files…" : savedId ? "Retry attaching files" : files.length ? "Save draft & attach files" : "Save draft"}</Button></footer>
  </form>;
}
