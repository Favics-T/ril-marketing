"use client";

import { useActionState, useState } from "react";
import { updateEmailDraft, type EmailDraftActionResult } from "@/actions/email-from-newsletter";
import { CUSTOM_SUBJECT_CHOICE, EMAIL_LIMITS } from "@/lib/email/from-newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  emailId: string;
  subject: string;
  subjectOptions: string[];
  previewText: string;
  body: string;
  audienceSegmentId: string | null;
  allContactsCount: number;
  segments: Array<{ id: string; name: string; count: number }>;
};

export function EmailDraftForm({ emailId, subject, subjectOptions, previewText, body, audienceSegmentId, allContactsCount, segments }: Props) {
  const [state, action, pending] = useActionState<EmailDraftActionResult | null, FormData>((previous, formData) => updateEmailDraft(emailId, previous, formData), null);
  const [choice, setChoice] = useState(subjectOptions.includes(subject) ? subject : CUSTOM_SUBJECT_CHOICE);
  return <form action={action} className="flex flex-col gap-4">
    <fieldset className="flex flex-col gap-2">
      <legend className="dateline mb-1.5">Subject line</legend>
      {subjectOptions.map((option) => <label key={option} className="flex items-start gap-2 text-sm leading-5"><input type="radio" name="subject_choice" value={option} checked={choice === option} onChange={() => setChoice(option)} className="mt-0.5" />{option}</label>)}
      <label className="flex items-start gap-2 text-sm leading-5"><input type="radio" name="subject_choice" value={CUSTOM_SUBJECT_CHOICE} checked={choice === CUSTOM_SUBJECT_CHOICE} onChange={() => setChoice(CUSTOM_SUBJECT_CHOICE)} className="mt-0.5" />Write my own</label>
      {choice === CUSTOM_SUBJECT_CHOICE ? <Input name="subject_custom" aria-label="Your subject line" required maxLength={EMAIL_LIMITS.subject} defaultValue={subjectOptions.includes(subject) ? "" : subject} /> : null}
    </fieldset>
    <label className="flex flex-col gap-1.5"><span className="dateline">Preview text</span><Input name="preview_text" maxLength={EMAIL_LIMITS.previewText} defaultValue={previewText} placeholder="A short line shown beside the subject in the inbox" /></label>
    <label className="flex flex-col gap-1.5"><span className="dateline">Audience</span><select name="audience_segment_id" defaultValue={audienceSegmentId ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All opted-in contacts ({allContactsCount})</option>{segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({segment.count})</option>)}</select></label>
    <label className="flex flex-col gap-1.5"><span className="dateline">Email copy</span><textarea name="body" required minLength={EMAIL_LIMITS.bodyMin} maxLength={EMAIL_LIMITS.body} rows={16} defaultValue={body} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-1 focus-visible:ring-ring" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button>
      {state?.message ? <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{state.message}</p> : null}
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    </div>
  </form>;
}
