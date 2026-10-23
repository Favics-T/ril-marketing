"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { publishYouTubeAsset } from "@/actions/youtube-publishing";
import { localSchedule } from "@/lib/content/scheduling";

export function YouTubePublishAction({ assetId, updatedAt, files, connected, accountName, title }: { assetId: string; updatedAt: string; files: { id: string; name: string }[]; connected: boolean; accountName: string | null; title: string }) {
  const router = useRouter();
  const [file, setFile] = useState(""), [privacy, setPrivacy] = useState("unlisted"), [schedule, setSchedule] = useState("");
  const [review, setReview] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  function publish() {
    start(async () => {
      try {
        const fd = new FormData(); fd.set("file_id", file); fd.set("privacy", privacy); fd.set("updated_at", updatedAt); fd.set("scheduled_for", schedule ? localSchedule(schedule) : "");
        const result = await publishYouTubeAsset(assetId, fd); setError(result.error ?? ""); setMessage(result.message ?? ""); setReview(false); router.refresh();
      } catch { setError("Could not confirm the upload. Refresh and check delivery status before sending again."); setReview(false); router.refresh(); }
    });
  }
  return <section className="slip flex flex-col gap-4 p-5 sm:p-6"><h2 className="text-base font-semibold">Publish directly to YouTube</h2>
    {!connected ? <Link href="/settings/ai#connection-youtube" className="text-sm text-primary underline">Connect your YouTube channel</Link> : !files.length ? <p className="text-sm leading-6 text-muted-foreground">Return to Editing, attach a video under Content files, then request approval again. Direct uploads use the approved private attachment.</p> : <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); setError(""); try { if (schedule && Date.parse(localSchedule(schedule)) <= Date.now() + 60000) throw new Error("Choose a publishing time at least one minute from now."); setReview(true); } catch (error) { setError(error instanceof Error ? error.message : "Choose a valid schedule."); } }}>
      <p className="text-sm text-muted-foreground">Destination: {accountName}. Uses the approved title, description and video settings.</p>
      <label className="flex flex-col gap-1.5 text-sm">Approved video attachment<select className="h-11 rounded-md border bg-card px-3" required value={file} disabled={busy} onChange={event => setFile(event.target.value)}><option value="">Choose an attached video</option>{files.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label className="flex flex-col gap-1.5 text-sm">Who can watch?<select className="h-11 rounded-md border bg-card px-3" value={privacy} disabled={busy} onChange={event => { setPrivacy(event.target.value); if (event.target.value !== "public") setSchedule(""); }}><option value="unlisted">Unlisted — anyone with the link</option><option value="public">Public — visible on your channel</option></select></label>
      {privacy === "public" ? <label className="flex flex-col gap-1.5 text-sm">Publish later (optional, WAT)<Input type="datetime-local" value={schedule} onChange={event => setSchedule(event.target.value)} disabled={busy} /><span className="text-xs text-muted-foreground">Leave blank to publish after YouTube finishes processing. Scheduled videos stay private until this time.</span></label> : null}
      <Button type="submit" disabled={busy || !file}>Review YouTube upload</Button>
      <p className="text-xs leading-5 text-muted-foreground">Up to 100 MB. YouTube processes the video before it becomes available. Check delivery status to confirm publication.</p>
    </form>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{message ? <p role="status" className="text-sm">{message}</p> : null}
    <Dialog open={review} onOpenChange={value => { if (!busy) setReview(value); }}><DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}><DialogTitle>Confirm YouTube upload</DialogTitle><DialogDescription>{title} will be uploaded to {accountName}. Visibility: {privacy}. {schedule ? `Publishing time: ${schedule.replace("T", " ")} WAT.` : "Publication starts after processing."} Your approvals and attachment are checked again before sending.</DialogDescription><p className="break-words text-sm">Video: {files.find(item => item.id === file)?.name}</p><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setReview(false)}>Back</Button><Button type="button" disabled={busy} onClick={publish}>{busy ? "Uploading…" : schedule ? "Upload & schedule" : "Upload to YouTube"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
