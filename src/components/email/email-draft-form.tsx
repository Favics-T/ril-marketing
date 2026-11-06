"use client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldGroup as ShadcnFieldGroup, FieldSet as ShadcnFieldSet, FieldLegend as ShadcnFieldLegend, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


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
  return <ShadcnFieldGroup asChild><form action={action} className="flex flex-col gap-4">
    <ShadcnFieldSet className="flex flex-col gap-2">
      <ShadcnFieldLegend className="dateline mb-1.5">Subject line</ShadcnFieldLegend>
      <RadioGroup name="subject_choice" value={choice} onValueChange={setChoice} aria-label="Subject line">
      {subjectOptions.map((option) => <ShadcnField asChild orientation="horizontal" key={option}><ShadcnFieldLabel key={option} className="flex items-start gap-2 text-sm leading-5"><RadioGroupItem value={option} />{option}</ShadcnFieldLabel></ShadcnField>)}
      <ShadcnField asChild orientation="horizontal"><ShadcnFieldLabel className="flex items-start gap-2 text-sm leading-5"><RadioGroupItem value={CUSTOM_SUBJECT_CHOICE} />Write my own</ShadcnFieldLabel></ShadcnField>
      </RadioGroup>
      {choice === CUSTOM_SUBJECT_CHOICE ? <Input name="subject_custom" aria-label="Your subject line" required maxLength={EMAIL_LIMITS.subject} defaultValue={subjectOptions.includes(subject) ? "" : subject} /> : null}
    </ShadcnFieldSet>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Preview text</span><Input name="preview_text" maxLength={EMAIL_LIMITS.previewText} defaultValue={previewText} placeholder="A short line shown beside the subject in the inbox" /></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Audience</span><ShadcnNativeSelect name="audience_segment_id" defaultValue={audienceSegmentId ?? ""} className=""><ShadcnNativeSelectOption value="">All opted-in contacts ({allContactsCount})</ShadcnNativeSelectOption>{segments.map((segment) => <ShadcnNativeSelectOption key={segment.id} value={segment.id}>{segment.name} ({segment.count})</ShadcnNativeSelectOption>)}</ShadcnNativeSelect></ShadcnFieldLabel></ShadcnField>
    <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5"><span >Email copy</span><ShadcnTextarea name="body" required minLength={EMAIL_LIMITS.bodyMin} maxLength={EMAIL_LIMITS.body} rows={16} defaultValue={body} className="w-full leading-6" /></ShadcnFieldLabel></ShadcnField>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button>
      {state?.message ? <ShadcnAlert asChild role="status"><p role="status" className="text-sm font-semibold text-emerald-700 ">{state.message}</p></ShadcnAlert> : null}
      {state?.error ? <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">{state.error}</p></ShadcnAlert> : null}
    </div>
  </form></ShadcnFieldGroup>;
}
