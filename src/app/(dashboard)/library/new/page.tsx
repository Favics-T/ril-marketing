import type { Metadata } from "next";
import { EditorLayout } from "@/components/editor-layout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentCreateForm } from "@/components/content/content-create-form";

export const metadata: Metadata = { title: "Add content" };

export default function NewContentPage() {
  return <div className="workspace-page mx-auto w-full max-w-6xl">
    <header><Link href="/library" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden="true" />Content Library</Link><h1 className="mt-2">Add content</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Write or paste your content. It starts as an editing draft and needs approval before posting.</p></header>
    <EditorLayout guidance={["Give the draft a title your team can find later.", "Choose the channel and write or paste the source copy.", "Saving creates an editing draft. Submit it for review before publishing."]}><ContentCreateForm/></EditorLayout>
  </div>;
}
