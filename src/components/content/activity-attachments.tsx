"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerActivityAttachment, deleteActivityAttachment } from "@/actions/attachments";
import { analyzeActivityAudioVideo, analyzeActivityImage, repurposeActivityDocument, type ImageAnalysisResult } from "@/actions/media";
import type { ActivityAttachment } from "@/lib/content/attachments";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";

const accept = [
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/heic",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
  "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown",
].join(",");

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function ImageAnalysisControl({ file, activityId }: { file: ActivityAttachment; activityId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const supported = ["image/jpeg", "image/png", "image/webp"].includes(file.mime_type);
  const analysis = file.image_analysis;
  const details = analysis?.analysis as {
    sceneSummary?: string; altText?: string; qualityNotes?: string[];
  } | undefined;

  function analyze() {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result: ImageAnalysisResult = await analyzeActivityImage(file.id, activityId);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Image analysis failed."); return; }
      setMessage(result.message ?? "Caption drafts saved to the Content Library for review.");
      router.refresh();
    });
  }

  if (!supported) return null;
  return (
    <div className="mt-2 space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={busy || analysis?.status === "processing"} onClick={analyze}>
        {busy || analysis?.status === "processing" ? "Analysing…" : analysis?.status === "completed" ? "Analyse again" : analysis?.status === "failed" ? "Retry analysis" : "Analyse image & draft captions"}
      </Button>
      {message ? <p role={error ? "alert" : "status"} className={error ? "max-w-[48ch] text-xs text-destructive" : "max-w-[48ch] text-xs text-muted-foreground"}>{message}</p> : null}
      {analysis?.status === "completed" && details ? (
        <div className="max-w-[60ch] border-l-2 border-border pl-3 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Image notes:</span> {details.sceneSummary}</p>
          {details.altText ? <p className="mt-1"><span className="font-medium text-foreground">Alt text:</span> {details.altText}</p> : null}
          {details.qualityNotes?.length ? <p className="mt-1">Review: {details.qualityNotes.join("; ")}</p> : null}
          <p className="mt-1">Caption drafts are in the Content Library · {analysis.model}</p>
        </div>
      ) : null}
      {analysis?.status === "failed" && !message && analysis.error ? <p role="alert" className="max-w-[48ch] text-xs text-destructive">{analysis.error}</p> : null}
    </div>
  );
}

function DocumentRepurposeControl({ file, activityId }: { file: ActivityAttachment; activityId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const supported = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"].includes(file.mime_type);
  function repurpose() {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result = await repurposeActivityDocument(file.id, activityId);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Document repurposing failed."); return; }
      setMessage(result.message ?? "Drafts saved to the Content Library for review.");
      router.refresh();
    });
  }
  if (!supported) return null;
  return <div className="mt-2 space-y-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={repurpose}>{busy ? "Reading & drafting…" : "Repurpose document into drafts"}</Button>{message ? <p role={error ? "alert" : "status"} className={error ? "max-w-[48ch] text-xs text-destructive" : "max-w-[48ch] text-xs text-muted-foreground"}>{message}</p> : null}</div>;
}

function AudioVideoAnalysisControl({ file, activityId }: { file: ActivityAttachment; activityId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const supported = ["video/mp4", "video/quicktime", "video/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm"].includes(file.mime_type);
  const analysis = file.image_analysis;
  const details = analysis?.analysis as {
    transcript?: string; summary?: string; language?: string;
    keyMoments?: Array<{ time: string; note: string }>;
    suggestedClips?: Array<{ start: string; end: string; title: string; reason: string }>;
  } | undefined;

  function analyze() {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result = await analyzeActivityAudioVideo(file.id, activityId);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Media analysis failed."); return; }
      setMessage(result.message ?? "Transcript and drafts saved for review.");
      router.refresh();
    });
  }

  if (!supported) return null;
  return (
    <div className="mt-2 space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={busy || analysis?.status === "processing"} onClick={analyze}>
        {busy || analysis?.status === "processing" ? "Analysing…" : analysis?.status === "completed" ? "Check repurposing drafts" : analysis?.status === "failed" ? "Retry analysis" : "Transcribe & create drafts"}
      </Button>
      {message ? <p role={error ? "alert" : "status"} className={error ? "max-w-[48ch] text-xs text-destructive" : "max-w-[48ch] text-xs text-muted-foreground"}>{message}</p> : null}
      {analysis?.status === "completed" && details ? (
        <div className="max-w-[60ch] space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
          {details.summary ? <p><span className="font-medium text-foreground">Summary:</span> {details.summary}</p> : null}
          {details.language ? <p><span className="font-medium text-foreground">Language:</span> {details.language}</p> : null}
          {details.transcript ? <details><DisclosureSummary className="cursor-pointer font-medium text-foreground">Transcript</DisclosureSummary><p className="mt-1 whitespace-pre-wrap">{details.transcript}</p></details> : <p>No speech transcript was returned.</p>}
          {details.keyMoments?.length ? <p><span className="font-medium text-foreground">Highlights:</span> {details.keyMoments.map((moment) => `${moment.time} ${moment.note}`).join(" · ")}</p> : null}
          {details.suggestedClips?.length ? <div><p className="font-medium text-foreground">Suggested clips</p><ul className="list-inside list-disc">{details.suggestedClips.map((clip, index) => <li key={`${clip.start}-${index}`}>{clip.start}–{clip.end}: {clip.title} — {clip.reason}</li>)}</ul></div> : null}
          <p>Clip ranges are editorial suggestions; no media has been edited. Blog, newsletter, social copy and short-form scripts are saved as drafts for review in the Content Library · {analysis.model}</p>
        </div>
      ) : null}
      {analysis?.status === "failed" && !message && analysis.error ? <p role="alert" className="max-w-[48ch] text-xs text-destructive">{analysis.error}</p> : null}
    </div>
  );
}

export function ActivityAttachments({
  organizationId,
  activityId,
  attachments,
}: {
  organizationId: string;
  activityId: string;
  attachments: ActivityAttachment[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setMessage("");
    setError(false);
    if (!file.type || !accept.split(",").includes(file.type)) {
      setError(true); setMessage("Choose an image, video, audio, PDF, Word or text file."); return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError(true); setMessage("Files must be 100 MB or smaller."); return;
    }
    startTransition(async () => {
      try {
        const supabase = createClient();
        const cleanedName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180);
        const path = `${organizationId}/${activityId}/${crypto.randomUUID()}/${cleanedName}`;
        const { error: uploadError } = await supabase.storage.from("ril-activity-media").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message);
        const result = await registerActivityAttachment({
          activityId,
          path,
          fileName: cleanedName,
          mimeType: file.type,
          byteSize: file.size,
        });
        if (!result.ok) {
          await supabase.storage.from("ril-activity-media").remove([path]);
          throw new Error(result.error ?? "Could not register file.");
        }
        setMessage("File attached to this activity.");
        router.refresh();
      } catch (cause) {
        setError(true);
        setMessage(cause instanceof Error ? cause.message : "Upload failed. Try again.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function remove(id: string) {
    setMessage(""); setError(false);
    startTransition(async () => {
      const result = await deleteActivityAttachment(id, activityId);
      if (!result.ok) { setError(true); setMessage(result.error ?? "Could not remove the file."); }
      else { setMessage("File removed."); router.refresh(); }
    });
  }

  return (
    <section className="slip flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="dateline">Source material</p><h2 className="mt-1 text-base font-bold">Activity files</h2><p className="mt-1 max-w-[55ch] text-sm text-muted-foreground">Private files stay attached to this activity. Analyse JPEG, PNG and WebP images up to 8 MB for captions; transcribe audio/video up to 14 MB with Gemini; or turn PDF, Word, text and Markdown sources up to 8 MB into reviewable content drafts.</p></div>
        <div>
          <input ref={inputRef} type="file" accept={accept} className="sr-only" aria-label="Choose activity file" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Working…" : "Attach file"}</Button>
        </div>
      </div>
      {message ? <p role={error ? "alert" : "status"} className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p> : null}
      {attachments.length ? (
        <ul className="ledger divide-y divide-border">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                {file.signed_url ? <a href={file.signed_url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary hover:underline">{file.file_name}</a> : <p className="truncate text-sm font-medium">{file.file_name}</p>}
                <p className="dateline mt-0.5">{file.mime_type} · {formatSize(file.byte_size)}</p>
                <ImageAnalysisControl file={file} activityId={activityId} />
                <AudioVideoAnalysisControl file={file} activityId={activityId} />
                <DocumentRepurposeControl file={file} activityId={activityId} />
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove(file.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">No source files attached yet.</p>}
    </section>
  );
}
