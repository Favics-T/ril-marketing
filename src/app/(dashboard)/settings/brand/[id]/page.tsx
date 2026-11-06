import type { Metadata } from "next";
import { EditorLayout } from "@/components/editor-layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getBrandKnowledgeEntry } from "@/lib/brand/knowledge";
import { BrandKnowledgeForm } from "@/components/brand/brand-knowledge-form";

export const metadata: Metadata = { title: "Edit brand knowledge" };

export default async function EditBrandKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, organizationId] = await Promise.all([
    params,
    getCallerOrganizationId(),
  ]);
  if (!organizationId) notFound();
  const entry = await getBrandKnowledgeEntry(organizationId, id);
  if (!entry) notFound();

  return (
    <div className="workspace-page mx-auto w-full max-w-6xl">
      <header>
        <Link href="/settings/brand" className="group inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
          Brand Knowledge
        </Link>
        <h1 className="mt-2 text-balance">Edit entry</h1>
      </header>
      <EditorLayout guidance={["Check the facts and language against current brand guidance.", "Keep this entry focused on one topic so it can be used in relevant drafts.", "Save your changes. Deactivate entries that no longer apply."]}><BrandKnowledgeForm entry={entry} /></EditorLayout>
    </div>
  );
}
