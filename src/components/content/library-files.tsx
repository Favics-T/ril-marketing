"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Paperclip, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { setLibraryFileRemoved } from "@/actions/library-attachments";
import { LIBRARY_FILE_ACCEPT, LIBRARY_FILE_COUNT, libraryFileProblem, type LibraryFileView } from "@/lib/content/library-files";
import { uploadLibraryFile, type QueuedLibraryFile } from "@/lib/content/library-file-upload";
import { useDraftSession } from "@/components/content/draft-session";

const sizeLabel = (size: number) => size < 1048576 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1048576).toFixed(1)} MB`;

export function LibraryFilePicker({ files, onChange, disabled = false, remaining = LIBRARY_FILE_COUNT }: { files: QueuedLibraryFile[]; onChange: (files: QueuedLibraryFile[]) => void; disabled?: boolean; remaining?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  function choose(list: FileList | null) {
    if (!list) return;
    const added = Array.from(list);
    if (files.length + added.length > remaining) { setError(`You can attach ${remaining} more file${remaining === 1 ? "" : "s"}.`); return; }
    const invalid = added.find(file => libraryFileProblem(file));
    if (invalid) { setError(`${invalid.name}: ${libraryFileProblem(invalid)}`); return; }
    setError(""); onChange([...files, ...added.map(file => ({ id: crypto.randomUUID(), file }))]);
    if (input.current) input.current.value = "";
  }
  return <div className="flex flex-col gap-3">
    <input ref={input} type="file" multiple accept={LIBRARY_FILE_ACCEPT} tabIndex={-1} className="sr-only" aria-label="Choose Content Library files" disabled={disabled} onChange={event => choose(event.target.files)} />
    <Button type="button" variant="outline" className="w-fit" disabled={disabled || remaining <= files.length} onClick={() => input.current?.click()}><Paperclip aria-hidden="true" className="size-4" />Attach files</Button>
    {files.length ? <ul className="divide-y rounded-lg border px-3">{files.map(item => <li key={item.id} className="flex min-w-0 items-center gap-3 py-3"><FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.file.name}</p><p className="text-xs text-muted-foreground">{sizeLabel(item.file.size)} · ready to attach</p></div><Button type="button" variant="ghost" size="icon" disabled={disabled || Boolean(item.path)} aria-label={`Remove ${item.file.name} from upload`} onClick={() => onChange(files.filter(file => file.id !== item.id))}><X aria-hidden="true" className="size-4" /></Button></li>)}</ul> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>;
}

export function LibraryFiles({ organizationId, assetId, files, editable }: { organizationId: string; assetId: string; files: LibraryFileView[]; editable: boolean }) {
  const router = useRouter();
  const { dirty } = useDraftSession();
  const [queue, setQueue] = useState<QueuedLibraryFile[]>([]);
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const active = files.filter(file => !file.removedAt);
  const removed = files.filter(file => file.removedAt);
  function upload() {
    if (dirty) return;
    start(async () => {
      setMessage(""); setFailed(false);
      const remaining: QueuedLibraryFile[] = [];
      const errors: string[] = [];
      for (const item of queue) {
        const result = await uploadLibraryFile(organizationId, assetId, item);
        if (!result.ok) { remaining.push({ ...item, path: result.path }); errors.push(`${item.file.name}: ${result.error}`); }
      }
      setQueue(remaining); setFailed(Boolean(errors.length));
      setMessage(errors.length ? errors.join(" ") : "Files attached. They stay private in your workspace."); router.refresh();
    });
  }
  function remove(id: string, removed: boolean) {
    if (dirty) return;
    start(async () => {
      try {
        const result = await setLibraryFileRemoved(assetId, id, removed);
        setFailed(!result.ok); setMessage(result.ok ? removed ? "Attachment removed. You can restore it below." : "Attachment restored." : result.error ?? "Could not update this file."); router.refresh();
      } catch { setFailed(true); setMessage("Could not reach the workspace. Check your connection and try again."); }
    });
  }
  return <section id="content-files" className="slip flex scroll-mt-6 flex-col gap-4 p-5 sm:p-6" aria-labelledby="content-files-title">
    <div><h2 id="content-files-title" className="text-base font-semibold">Content files</h2><p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">Attach images, recordings, PDF, Word or text files directly to this item. Source files stay private; they are not sent with a published post automatically.</p></div>
    {active.length ? <ul className="divide-y">{active.map(file => <li key={file.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1">{file.signedUrl ? <a href={file.signedUrl} target="_blank" rel="noreferrer" className="break-words text-sm font-semibold text-primary underline">{file.name}</a> : <p className="break-words text-sm font-medium">{file.name} · refresh to open</p>}<p className="mt-1 text-xs text-muted-foreground">{sizeLabel(file.size)}</p><Link href={`/repurpose?asset=${assetId}&file=${file.id}`} className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-primary underline">Repurpose this file</Link></div>{editable ? <Button type="button" variant="ghost" size="sm" disabled={busy || dirty} onClick={() => remove(file.id, true)}>Remove</Button> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">No files attached yet.</p>}
    {editable ? <>{dirty ? <p role="status" className="text-sm leading-6 text-muted-foreground"><a href="#draft-editor" className="font-semibold text-primary underline">Save your draft text</a> before changing attachments. Your unsaved copy is still in the editor.</p> : null}<LibraryFilePicker files={queue} onChange={setQueue} disabled={busy || dirty} remaining={LIBRARY_FILE_COUNT - files.length} /><p className="text-xs leading-5 text-muted-foreground">Up to 100 MB per file. Repurposing supports documents and images up to 8 MB and recordings up to 14 MB. You choose when to run AI.</p>{queue.length ? <Button type="button" className="w-fit" disabled={busy || dirty} onClick={upload}>{busy ? "Attaching files…" : "Upload & attach files"}</Button> : null}</> : <p className="text-sm text-muted-foreground">Return this content to Editing to add, remove or restore files.</p>}
    {removed.length ? <details><DisclosureSummary>Removed files ({removed.length})</DisclosureSummary><p className="mt-2 text-xs leading-5 text-muted-foreground">Files are kept privately so existing sources can still be read and attachments can be restored.</p><ul className="mt-2 divide-y">{removed.map(file => <li key={file.id} className="flex items-center gap-3 py-2"><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>{editable ? <Button type="button" variant="outline" size="sm" disabled={busy || dirty} onClick={() => remove(file.id, false)}>Restore</Button> : null}</li>)}</ul></details> : null}
    {message ? <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p> : null}
  </section>;
}
