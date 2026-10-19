"use client";

import { ChannelSelect } from "@/components/channel-select";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createManualAsset, type ActionResult } from "@/actions/content";
import { APPROVAL_CATEGORIES } from "@/lib/content/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ContentCreateForm({ initialChannel = "", initialFormat = "social post", cancelHref = "/library" }: { initialChannel?: "" | "website"; initialFormat?: "social post" | "blog"; cancelHref?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = await createManualAsset(formData);
    if (result.ok && result.id) router.push(`/library/${result.id}`);
    return result;
  }, null);
  return <form action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
    <label className="flex flex-col gap-2 text-sm font-semibold">Title<Input name="title" required minLength={2} maxLength={200} placeholder="Give this content a clear title" disabled={pending}/></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Channel<ChannelSelect name="channel" required defaultValue={initialChannel} disabled={pending} className="font-normal" options={[["linkedin","LinkedIn"],["instagram","Instagram"],["facebook","Facebook"],["x","X"],["tiktok","TikTok"],["youtube","YouTube"],["threads","Threads"],["bluesky","Bluesky"],["email","Email"],["website","Website"],["other","Other"]]} /></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Start as<select name="initial_status" defaultValue="editing" className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"><option value="editing">Editing draft</option><option value="idea">Idea</option></select></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Content type<select name="format" defaultValue={initialFormat} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">{["social post", "blog", "newsletter", "short-form video", "press release", "other"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Approval category<select name="approval_category" defaultValue="standard" className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">{APPROVAL_CATEGORIES.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select><span className="text-xs font-normal text-muted-foreground">Standard content needs one independent reviewer. Sensitive categories need a second named approval.</span></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Content<Textarea name="body" rows={10} maxLength={20000} placeholder="Write or paste your draft here…" disabled={pending} className="min-h-60 text-sm font-normal leading-6"/><span className="text-xs font-normal text-muted-foreground">You can save a title first and add the copy later.</span></label>
    {state?.ok === false && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <footer className="flex flex-wrap items-center justify-end gap-2 border-t pt-4"><Button asChild variant="outline"><Link href={cancelHref}>Cancel</Link></Button><Button type="submit" disabled={pending} className="active:scale-[.97] motion-reduce:active:scale-100">{pending?"Saving draft…":"Save draft"}</Button></footer>
  </form>;
}
