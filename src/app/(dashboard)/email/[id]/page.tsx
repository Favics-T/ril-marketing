import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { applyActiveConsentFilter } from "@/lib/email/consent";
import { listSegments } from "@/lib/audience/segments";
import { getUserRole } from "@/lib/audience/access";
import { isEmailAuthorRole } from "@/lib/email/from-newsletter";
import { StatusStamp } from "@/components/ui/status-stamp";
import { EmailDraftForm } from "@/components/email/email-draft-form";

export const metadata: Metadata = { title: "Email campaign" };
type EmailRow = { id:string; name:string; subject:string; preview_text:string; body:string; status:string; audience_segment_id:string|null; metadata:Record<string, unknown>|null };

export default async function EmailCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const organizationId = await getCallerOrganizationId();
  if (!organizationId) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select("id,name,subject,preview_text,body,status,audience_segment_id,metadata").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  const email = data as EmailRow | null;
  if (!email) notFound();

  const sourceId = typeof email.metadata?.source_content_asset_id === "string" ? email.metadata.source_content_asset_id : null;
  const storedOptions = Array.isArray(email.metadata?.subject_options) ? email.metadata.subject_options.filter((option): option is string => typeof option === "string") : [];
  const subjectOptions = storedOptions.includes(email.subject) ? storedOptions : [email.subject, ...storedOptions];
  const [role, segments, source] = await Promise.all([
    getUserRole(organizationId),
    listSegments(organizationId),
    sourceId ? supabase.from("content_assets").select("id,title").eq("organization_id", organizationId).eq("id", sourceId).maybeSingle<{ id: string; title: string }>() : Promise.resolve({ data: null }),
  ]);
  const editable = email.status === "draft" && isEmailAuthorRole(role);
  const [allContacts, segmentCounts] = editable ? await Promise.all([
    applyActiveConsentFilter(supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
    Promise.all(segments.map(async (segment) => {
      const { count } = await applyActiveConsentFilter(supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("audience_segment_id", segment.id));
      return { id: segment.id, name: segment.name, count: count ?? 0 };
    })),
  ]) : [{ count: 0 }, []];
  const segmentName = email.audience_segment_id ? segments.find((segment) => segment.id === email.audience_segment_id)?.name ?? "Segment" : "All opted-in contacts";

  return <div className="workspace-page flex flex-col gap-4 md:gap-6">
    <header>
      <Link href="/email" className="group inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"><span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Email campaigns</Link>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4"><h1>{email.name}</h1><StatusStamp status={email.status} /></div>
      {sourceId ? <p className="mt-2 text-sm text-muted-foreground">From newsletter · {source.data ? <Link href={`/library/${source.data.id}`} className="font-medium text-primary underline underline-offset-2">{source.data.title}</Link> : "no longer available"}</p> : null}
    </header>
    <section className="slip flex flex-col gap-4 p-5 sm:p-6">
      {editable
        ? <><p className="text-sm leading-6 text-muted-foreground">Choose the subject line and audience, and check the copy. When it&apos;s ready, submit it for review from Email campaigns. A different reviewer approves it before anyone can queue or send it.</p>
          <EmailDraftForm emailId={email.id} subject={email.subject} subjectOptions={subjectOptions} previewText={email.preview_text} body={email.body} audienceSegmentId={email.audience_segment_id} allContactsCount={allContacts.count ?? 0} segments={segmentCounts} /></>
        : <>
          <p className="text-sm leading-6 text-muted-foreground">{email.status === "draft" ? "Only an owner, admin or marketing manager can edit this draft." : "Only draft emails can be edited. Review, approval and sending happen from Email campaigns."}</p>
          <div><p className="dateline">Subject line</p><p className="mt-1 text-sm font-semibold">{email.subject}</p></div>
          {email.preview_text ? <div><p className="dateline">Preview text</p><p className="mt-1 text-sm">{email.preview_text}</p></div> : null}
          <div><p className="dateline">Audience</p><p className="mt-1 text-sm">{segmentName}</p></div>
          <div><p className="dateline">Email copy</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{email.body}</p></div>
        </>}
    </section>
  </div>;
}
