"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusStamp } from "@/components/ui/status-stamp";
import { findLibraryContent, setActivityLibraryLink } from "@/actions/library-attachments";

export type LibraryContentOption = { id: string; title: string; status: string; channel: string | null; source_activity_id: string | null };
export function ActivityLibraryContent({ activityId, linked, recent }: { activityId: string; linked: LibraryContentOption[]; recent: LibraryContentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(recent);
  const [selected, setSelected] = useState("");
  const [busy, start] = useTransition();
  const [operation, setOperation] = useState<"search" | "attach" | "detach" | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  function link(id: string, attach: boolean) {
    setOperation(attach ? "attach" : "detach");
    start(async () => {
      try {
        const result = await setActivityLibraryLink(activityId, id, attach);
        setFailed(!result.ok); setMessage(result.ok ? attach ? "Content attached. Its original source and files are unchanged." : "Content detached. The library item is unchanged." : result.error ?? "Could not update this link.");
        if (result.ok) { setSelected(""); setOpen(false); router.refresh(); }
      } catch { setFailed(true); setMessage("Could not reach the workspace. Check your connection and try again."); }
      finally { setOperation(null); }
    });
  }
  function search() {
    setOperation("search");
    start(async () => {
      try {
        const result = await findLibraryContent(query);
        setFailed(!result.ok); setMessage(result.ok ? "" : result.error); setItems(result.items); setSelected("");
      } catch { setFailed(true); setMessage("Could not search the library. Check your connection and try again."); }
      finally { setOperation(null); }
    });
  }
  const available = items.filter(item => !linked.some(existing => existing.id === item.id));
  return <section className="slip flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="activity-library-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="activity-library-title" className="text-base font-semibold">Content from the library</h2><p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">Attach existing posts, articles or other library items to this activity. This creates a link; it does not copy the item or replace its original source.</p></div><Button type="button" variant="outline" disabled={busy} aria-expanded={open} aria-controls="activity-library-picker" onClick={() => setOpen(!open)}><Paperclip aria-hidden="true" className="size-4" />Attach from Content Library</Button></div>
    {open ? <div id="activity-library-picker" className="flex flex-col gap-4 border-y py-4">
      <form onSubmit={event => { event.preventDefault(); search(); }} className="flex flex-wrap items-end gap-2"><label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">Find content by title<Input value={query} onChange={event => setQuery(event.target.value)} maxLength={200} placeholder="Search the Content Library" disabled={busy} /></label><Button type="submit" variant="outline" disabled={busy}>{busy && operation === "search" ? "Searching…" : "Search"}</Button></form>
      <form onSubmit={event => { event.preventDefault(); if (selected) link(selected, true); }} className="flex flex-wrap items-end gap-2"><label className="flex min-w-0 basis-full flex-col gap-1.5 text-sm sm:flex-1 sm:basis-0">Library item<select value={selected} onChange={event => setSelected(event.target.value)} required disabled={busy} className="h-11 min-w-0 rounded-md border border-input bg-card px-3 text-sm"><option value="">Choose existing content</option>{available.map(item => <option key={item.id} value={item.id}>{item.title} · {item.status.replaceAll("_", " ")}</option>)}</select></label><Button type="submit" disabled={busy || !selected}>{busy && operation === "attach" ? "Attaching…" : "Attach content"}</Button></form>
      {!available.length ? <p className="text-sm text-muted-foreground">No unattached items in these results. Search another title, or <Link href="/library/new" className="font-semibold text-primary underline">add content to the library</Link>.</p> : <p className="text-xs text-muted-foreground">Showing up to 30 recent matches. Search a title to find older content.</p>}
    </div> : null}
    {linked.length ? <ul className="divide-y">{linked.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><Link href={`/library/${item.id}`} className="break-words text-sm font-semibold text-primary underline">{item.title}</Link><div className="mt-1 flex flex-wrap items-center gap-2"><StatusStamp status={item.status} />{item.source_activity_id === activityId ? <span className="text-xs text-muted-foreground">Created from this activity</span> : null}<Link href={`/library/${item.id}#content-files`} className="inline-flex min-h-9 items-center text-xs font-semibold text-primary underline">Open content &amp; files</Link></div></div>{item.source_activity_id !== activityId ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => link(item.id, false)}>Detach</Button> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">No library content attached yet.</p>}
    {message ? <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p> : null}
  </section>;
}
