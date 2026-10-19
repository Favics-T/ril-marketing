"use client";

import { ContentChannels } from "@/components/channel-identity";
import { ChannelSelect } from "@/components/channel-select";
import { channelLabel } from "@/lib/channels";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarClock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusStamp } from "@/components/ui/status-stamp";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ASSET_STATUSES } from "@/lib/content/transitions";
import { calendarDays, shiftDay, type CalendarView } from "@/lib/content/calendar";
import { dateToZonedInput, formatInZone, zonedDayKey, zonedWallTimeToDate } from "@/lib/time";
import { changeCalendarSchedule, recoverCalendarSchedule, suggestContentTimes } from "@/actions/content-workflow";

export type CalendarAsset = { id: string; title: string; status: string; channel: string | null; platform: string | null; format: string | null; campaign_id: string | null; scheduled_for: string | null; published_at: string | null; updated_at: string; metadata: Record<string, unknown>; review_required?: boolean };
const selectClass = "h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm";
const label = (value: string) => value.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
const when = (asset: CalendarAsset) => asset.scheduled_for ?? asset.published_at ?? (typeof asset.metadata?.suggested_publish_at === "string" ? asset.metadata.suggested_publish_at : null);
const dayName = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

export function ContentCalendar({ assets, campaigns, canSchedule, initialDay, today = initialDay, wordpressConnected, truncated = false }: { assets: CalendarAsset[]; campaigns: Array<{ id: string; name: string }>; canSchedule: boolean; initialDay: string; today?: string; wordpressConnected: boolean; truncated?: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("month");
  const [day, setDay] = useState(initialDay);
  const [campaign, setCampaign] = useState("");
  const [platform, setPlatform] = useState("");
  const [format, setFormat] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<CalendarAsset | null>(null);
  const [time, setTime] = useState("");
  const [wordpress, setWordpress] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [slots, setSlots] = useState<Array<{ at: string; reason: string }>>([]);
  const days = calendarDays(day, view);
  const rangeLabel = view === "week" ? `${dayName(days[0], {day: "numeric", month: "short"})} – ${dayName(days[6], {day: "numeric", month: "short", year: "numeric"})}` : dayName(day, view === "month" ? {month: "long", year: "numeric"} : {day: "numeric", month: "short", year: "numeric"});
  const filtered = useMemo(() => assets.filter(a => (!campaign || a.campaign_id === campaign) && (!platform || (a.platform || a.channel) === platform) && (!format || a.format === format) && (!status || a.status === status)), [assets, campaign, platform, format, status]);
  const byDay = new Map<string, CalendarAsset[]>();
  const backlog: CalendarAsset[] = [];
  for (const asset of filtered) {
    const at = when(asset);
    if (!at || !Number.isFinite(Date.parse(at))) { backlog.push(asset); continue; }
    const key = zonedDayKey(new Date(at));
    byDay.set(key, [...(byDay.get(key) ?? []), asset]);
  }
  const options = (key: "format" | "platform") => [...new Set(assets.map(a => key === "platform" ? a.platform || a.channel : a.format).filter((s): s is string => Boolean(s)))].sort();
  function open(asset: CalendarAsset, targetDay?: string) {
    setSelected(asset); setError(""); setMessage(""); setSlots([]); setWordpress(false);
    const current = dateToZonedInput(asset.scheduled_for);
    setTime(targetDay ? `${targetDay}T${current?.slice(11, 16) || "10:00"}` : current || `${shiftDay(today, 1)}T10:00`);
  }
  function moveRange(amount: number) {
    if (view !== "month") return setDay(shiftDay(day, amount * (view === "week" ? 7 : 1)));
    const date = new Date(`${day.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); setDay(date.toISOString().slice(0, 10));
  }
  function save(remove = false) {
    if (!selected) return;
    const at = remove ? null : zonedWallTimeToDate(time);
    if (!remove && !at) { setError("Choose a valid date and time."); return; }
    startTransition(async () => {
      setError("");
      const result = await changeCalendarSchedule({ assetId: selected.id, expected: selected.updated_at, at: at?.toISOString() ?? null, wordpress });
      if (!result.ok) { setError(result.error ?? "Could not save the time."); if (result.pending) router.refresh(); return; }
      setSelected(null); setMessage(result.message ?? "Schedule saved."); router.refresh();
    });
  }
  function item(asset: CalendarAsset) {
    const editable = canSchedule && ["approved", "scheduled"].includes(asset.status);
    const at = when(asset);
    return <li key={asset.id} draggable={editable && !asset.metadata?.schedule_change} onDragStart={event => { event.dataTransfer.setData("text/plain", asset.id); event.dataTransfer.effectAllowed = "move"; }} className="rounded-md border border-border bg-background p-2.5 text-sm hover:border-primary/40">
      <div className="flex flex-wrap items-center justify-between gap-1"><StatusStamp status={asset.status} />{at ? <time className="text-xs tabular-nums text-muted-foreground" dateTime={at}>{formatInZone(at, "time")}</time> : null}</div>
      <Link href={`/library/${asset.id}`} title={asset.title} className={`mt-2 block break-words font-semibold hover:text-primary hover:underline ${view === "month" && at ? "line-clamp-2" : ""}`}>{asset.title}</Link>
      <p className="mt-1 truncate text-xs text-muted-foreground"><ContentChannels channel={asset.platform || asset.channel} format={view === "month" && at ? null : asset.format} /></p>
      {asset.status === "scheduled" && asset.scheduled_for && Date.parse(asset.scheduled_for) < Date.now() ? <p className="mt-1 text-xs font-semibold text-destructive">Overdue</p> : null}
      {!asset.scheduled_for && !asset.published_at && at ? <p className="mt-1 text-xs text-muted-foreground">Suggested</p> : null}
      {editable ? <button type="button" onClick={() => open(asset)} className="mt-1 min-h-9 rounded text-xs font-semibold text-primary underline underline-offset-4">{asset.metadata?.schedule_change ? "Recover schedule" : asset.status === "scheduled" ? "Reschedule" : "Schedule"}</button> : null}
    </li>;
  }
  return <div className="flex min-w-0 flex-col gap-5">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1>Content Calendar</h1><p className="mt-2 text-sm text-muted-foreground">Plan every channel, track approvals and choose publishing times. All times are WAT.</p></div><Button asChild><Link href="/library/new">Add content</Link></Button></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label={`Previous ${view}`} onClick={() => moveRange(-1)}><ChevronLeft className="size-4" /></Button><Button variant="outline" onClick={() => setDay(today)}>Today</Button><Button variant="outline" size="icon" aria-label={`Next ${view}`} onClick={() => moveRange(1)}><ChevronRight className="size-4" /></Button><h2 aria-live="polite" className="ml-2 text-base font-semibold">{rangeLabel}</h2></div><div aria-label="Calendar view" role="group" className="flex gap-1 rounded-lg bg-muted p-1">{(["day", "week", "month"] as const).map(value => <Button key={value} size="sm" variant={view === value ? "default" : "ghost"} aria-pressed={view === value} onClick={() => setView(value)}>{label(value)}</Button>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([{ text: "Campaign", value: campaign, set: setCampaign, choices: campaigns.map(c => [c.id, c.name]) }, { text: "Platform", value: platform, set: setPlatform, choices: options("platform").map(v => [v, label(v)]) }, { text: "Content type", value: format, set: setFormat, choices: options("format").map(v => [v, label(v)]) }, { text: "Status", value: status, set: setStatus, choices: ASSET_STATUSES.map(v => [v, label(v)]) }]).map(filter => <label key={filter.text} className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">{filter.text}{filter.text === "Platform" ? <ChannelSelect value={filter.value} onValueChange={filter.set} className="h-10 font-normal" options={[["", "All platforms"], ...filter.choices.map(([value]) => [value, channelLabel(value)] as const)]} /> : <select className={selectClass} value={filter.value} onChange={e => filter.set(e.target.value)}><option value="">All {filter.text === "Status" ? "statuses" : filter.text.toLowerCase() + "s"}</option>{filter.choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>}</label>)}</div>
    {message ? <p role="status" className="text-sm text-primary">{message}</p> : null}
    {truncated ? <p role="status" className="text-sm text-destructive">This calendar shows a limited set of recent items. Use the content library to find older content.</p> : null}
    <p className="text-xs text-muted-foreground">{canSchedule ? "Drag an approved or scheduled item onto a day, or use its Schedule button. A confirmation keeps accidental drops from changing a post." : "You can browse the calendar. Ask a reviewer to approve and schedule content."}</p>
    <section aria-label={`${label(view)} calendar`} className={`grid overflow-hidden rounded-xl border border-border bg-card ${view === "day" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-7"}`}>
      {!days.some(date => byDay.has(date)) ? <p className="p-4 text-sm text-muted-foreground md:col-span-7">No dated content matches this range and these filters.</p> : null}
      {days.map(date => <section key={date} aria-label={dayName(date, { weekday: "long", day: "numeric", month: "long" })} onDragOver={event => { if (canSchedule) event.preventDefault(); }} onDrop={event => { event.preventDefault(); const asset = assets.find(a => a.id === event.dataTransfer.getData("text/plain")); if (asset && canSchedule && ["approved", "scheduled"].includes(asset.status)) open(asset, date); }} className={`min-w-0 border-b border-border p-2.5 md:min-h-40 md:border-r ${view !== "day" && !byDay.has(date) ? "hidden md:block" : ""} ${view === "month" && date.slice(0, 7) !== day.slice(0, 7) ? "bg-muted/40" : ""}`}>
        <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${date === today ? "text-primary" : "text-muted-foreground"}`}><span>{dayName(date, { weekday: "short" })}</span><span className={date === today ? "rounded bg-primary px-1.5 py-1 text-primary-foreground" : ""}>{dayName(date, { day: "numeric", month: "short" })}</span></h3>
        <ul className="flex flex-col gap-2">{(byDay.get(date) ?? []).sort((a, b) => (when(a) ?? "").localeCompare(when(b) ?? "")).map(item)}</ul>{!byDay.has(date) ? <p className="py-2 text-xs text-muted-foreground">No content</p> : null}
      </section>)}
    </section>
    <section aria-labelledby="unscheduled-title"><h2 id="unscheduled-title" className="text-lg font-semibold">Unscheduled <span className="text-sm font-normal text-muted-foreground">{backlog.length} items</span></h2><p className="mt-1 text-sm text-muted-foreground">Ideas, drafts and approved content without a publishing time.</p>{backlog.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{backlog.map(item)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No unscheduled content matches these filters.</p>}</section>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !pending) setSelected(null); }}><DialogContent><DialogTitle>{selected?.metadata?.schedule_change ? "Recover schedule" : "Choose a publishing time"}</DialogTitle><DialogDescription>{selected?.title}. Changes apply to this approved revision.</DialogDescription>
      {selected?.metadata?.schedule_change ? <><p className="text-sm">The last WordPress update needs confirmation. Recovery checks the same post and saves its verified schedule.</p><Button disabled={pending} onClick={() => startTransition(async () => { const result = await recoverCalendarSchedule(selected.id); if (result.ok) { setSelected(null); setMessage(result.message ?? "Schedule recovered."); router.refresh(); } else setError(result.error ?? "Could not recover."); })}>{pending ? "Checking WordPress…" : "Recover schedule"}</Button></> : <><label className="flex flex-col gap-2 text-sm font-semibold">Date and time (WAT)<Input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} required /></label><p className="text-xs text-muted-foreground">{selected?.scheduled_for ? `Currently ${formatInZone(selected.scheduled_for, "dateTime")}.` : "A calendar reservation does not publish automatically."}</p>
      {selected?.review_required ? <p role="status" className="text-sm text-destructive">This older item needs fresh recorded approval before scheduling. <Link href={`/library/${selected.id}`} className="font-semibold underline underline-offset-4">Open content</Link> to return it to Editing and request review. You can still remove its current reservation.</p> : null}
      {wordpressConnected && selected?.status === "approved" && !selected.review_required && (selected.channel === "website" || selected.format === "blog") ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={wordpress} onChange={e => setWordpress(e.target.checked)} className="mt-1" />Also schedule this article on WordPress</label> : null}
      <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { if (!selected) return; const result = await suggestContentTimes(selected.id); setSlots(result.slots); setMessage(result.message ?? ""); setError(result.error ?? ""); })}><Sparkles className="size-4" />{pending ? "Working…" : "Suggest times for this item"}</Button>
      {slots.length ? <ul className="flex flex-col gap-2">{slots.map(slot => <li key={slot.at}><button type="button" onClick={() => setTime(dateToZonedInput(slot.at))} className="w-full rounded-md border border-border p-3 text-left text-sm hover:bg-muted"><strong>{formatInZone(slot.at, "dateTime")}</strong><span className="mt-1 block text-xs text-muted-foreground">{slot.reason}</span></button></li>)}</ul> : null}
      <div className="flex flex-wrap gap-2"><Button disabled={pending || selected?.review_required} onClick={() => save()}><CalendarClock className="size-4" />{pending ? "Saving…" : "Save schedule"}</Button>{selected?.status === "scheduled" ? <Button variant="outline" disabled={pending} onClick={() => save(true)}>Unschedule</Button> : null}</div></>}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </DialogContent></Dialog>
  </div>;
}
