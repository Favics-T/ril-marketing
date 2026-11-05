"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { FieldGroup as ShadcnFieldGroup, FieldSet as ShadcnFieldSet, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Card as ShadcnCard, CardFooter as ShadcnCardFooter } from "@/components/ui/card";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { ChannelSelect } from "@/components/channel-select";
import { useActionState, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createManualAsset, type ActionResult } from "@/actions/content";
import { APPROVAL_CATEGORIES } from "@/lib/content/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  return <ShadcnFieldGroup asChild><ShadcnCard asChild><form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
    <ShadcnFieldSet disabled={pending || Boolean(savedId)} className="flex min-w-0 flex-col gap-5">
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-2 text-sm font-semibold">Title<Input name="title" required minLength={2} maxLength={200} placeholder="Give this content a clear title" disabled={pending}/></ShadcnFieldLabel></ShadcnField>
    <div className="flex flex-col gap-2"><ShadcnField asChild><ShadcnFieldLabel htmlFor={channelId} className="text-sm font-semibold">Channel</ShadcnFieldLabel></ShadcnField><ChannelSelect id={channelId} name="channel" defaultValue={channels.some(([value]) => value === initialChannel) ? initialChannel : ""} disabled={pending} options={[["", "Not set"], ...channels]} /><p className="text-xs text-muted-foreground">{channels.length ? "Channels come from your connected publishing accounts." : "No publishing channels connected. Save an unassigned draft, or connect an account first."} <Link href="/settings/ai" className="font-semibold text-primary underline">Manage connections</Link></p></div>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-2 text-sm font-semibold">Content type<ShadcnNativeSelect name="format" defaultValue={initialFormat} className="">{["social post", "blog", "newsletter", "short-form video", "press release", "other"].map(value => <ShadcnNativeSelectOption key={value} value={value}>{value}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-2 text-sm font-semibold">Approval category<ShadcnNativeSelect name="approval_category" defaultValue="standard" className="">{APPROVAL_CATEGORIES.map(([value,text]) => <ShadcnNativeSelectOption key={value} value={value}>{text}</ShadcnNativeSelectOption>)}</ShadcnNativeSelect><span className="text-xs font-normal text-muted-foreground">Standard content needs one independent reviewer. Sensitive categories need a second named approval.</span></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-2 text-sm font-semibold">Content<Textarea name="body" rows={10} maxLength={20000} placeholder="Write or paste your draft here…" disabled={pending} className="leading-6"/><span className="text-xs font-normal text-muted-foreground">You can save a title first and add the copy later.</span></ShadcnFieldLabel></ShadcnField>
    <Disclosure className="border-t pt-3" title={<>Save as an idea instead (optional)</>}><ShadcnField asChild><ShadcnFieldLabel className="mt-3 flex flex-col gap-2 text-sm">Starting status<ShadcnNativeSelect name="initial_status" defaultValue="editing" className=""><ShadcnNativeSelectOption value="editing">Editing draft</ShadcnNativeSelectOption><ShadcnNativeSelectOption value="idea">Idea · copy to develop later</ShadcnNativeSelectOption></ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField></Disclosure>
    </ShadcnFieldSet>
    <section className="flex flex-col gap-3 border-t pt-4" aria-labelledby="draft-files-heading"><h2 id="draft-files-heading" className="text-sm font-semibold">Files (optional)</h2><p className="text-sm leading-6 text-muted-foreground">Attach images, video, audio, PDF, Word or text files. They upload privately when you save this draft. Up to 100 MB per file.</p><LibraryFilePicker files={files} onChange={setFiles} disabled={pending || Boolean(savedId)} /></section>
    <p className="text-sm text-muted-foreground">Next: open your saved content to edit it and request review. Saving does not publish.</p>
    {state?.ok === false && <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert>}
    <ShadcnCardFooter asChild><footer className="flex flex-wrap items-center justify-end gap-2 border-t pt-4"><Button asChild variant="outline"><Link href={savedId ? `/library/${savedId}` : cancelHref}>{savedId ? "Open saved draft" : "Cancel"}</Link></Button><Button type="submit" disabled={pending} >{pending ? "Saving draft & files…" : savedId ? "Retry attaching files" : files.length ? "Save draft & attach files" : "Save draft"}</Button></footer></ShadcnCardFooter>
  </form></ShadcnCard></ShadcnFieldGroup>;
}
