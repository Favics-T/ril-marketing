"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createManualAsset, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ContentCreateForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = await createManualAsset(formData);
    if (result.ok && result.id) router.push(`/library/${result.id}`);
    return result;
  }, null);
  return <form action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
    <label className="flex flex-col gap-2 text-sm font-semibold">Title<Input name="title" required minLength={2} maxLength={200} placeholder="Give this content a clear title" disabled={pending}/></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Channel<select name="channel" required defaultValue="" disabled={pending} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"><option value="" disabled>Select a channel</option>{[["linkedin","LinkedIn"],["instagram","Instagram"],["facebook","Facebook"],["x","X"],["tiktok","TikTok"],["youtube","YouTube"],["threads","Threads"],["bluesky","Bluesky"],["email","Email"],["website","Website"],["other","Other"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Content<Textarea name="body" rows={10} maxLength={20000} placeholder="Write or paste your draft here…" disabled={pending} className="min-h-60 text-sm font-normal leading-6"/><span className="text-xs font-normal text-muted-foreground">You can save a title first and add the copy later.</span></label>
    {state?.ok === false && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <footer className="flex flex-wrap items-center justify-end gap-2 border-t pt-4"><Button asChild variant="outline"><Link href="/library">Cancel</Link></Button><Button type="submit" disabled={pending} className="active:scale-[.97] motion-reduce:active:scale-100">{pending?"Saving draft…":"Save draft"}</Button></footer>
  </form>;
}
