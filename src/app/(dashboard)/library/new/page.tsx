import type { Metadata } from "next";
import { EditorLayout } from "@/components/editor-layout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentCreateForm } from "@/components/content/content-create-form";
import { requireOrganizationId } from "@/lib/supabase/organization";
import { getConnectedChannelOptions } from "@/lib/content/connected-channels";

export const metadata: Metadata = { title: "Add content" };

export default async function NewContentPage({ searchParams }: { searchParams: Promise<{ channel?: string; format?: string }> }) {
  const params = await searchParams;
  const organizationId = await requireOrganizationId();
  const channels = await getConnectedChannelOptions(organizationId);
  const blog = params.channel === "website" && params.format === "blog";
  const backHref = blog ? "/audience/landing-pages?view=website" : "/library";
  return <div className="workspace-page mx-auto w-full max-w-6xl">
    <header><Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden="true" />{blog ? "Website publishing" : "Content Library"}</Link><h1 className="mt-2">{blog ? "Create blog draft" : "Add content"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Write or paste your content. It starts as an editing draft and needs approval before posting.</p></header>
    <p className="mt-4 text-sm text-muted-foreground">Starting from a recording, document or activity? <Link href="/repurpose" className="font-semibold text-primary underline">Repurpose a source into multiple drafts</Link>.</p>
    <EditorLayout guidance={["Give the draft a title your team can find later.", "Choose a connected channel, or leave it unassigned until an account is connected.", "Add files if needed, then save. Submit your draft for review before publishing."]}><ContentCreateForm organizationId={organizationId} channels={channels} key={blog ? "website-blog" : "content"} initialChannel={blog ? "website" : ""} initialFormat={blog ? "blog" : "social post"} cancelHref={backHref}/></EditorLayout>
  </div>;
}
