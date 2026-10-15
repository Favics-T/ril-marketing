import type { Metadata } from "next";
import { EditorLayout } from "@/components/editor-layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getActivity } from "@/lib/content/activities";
import { listSegments } from "@/lib/audience/segments";
import { createClient } from "@/lib/supabase/server";
import { ActivityForm } from "@/components/content/activity-form";

export const metadata: Metadata = { title: "Edit activity" };

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizationId = await getCallerOrganizationId();
  if (!organizationId) notFound();
  const activity = await getActivity(organizationId, id);
  if (!activity) notFound();
  const [segments, supabase] = await Promise.all([listSegments(organizationId), createClient()]);
  const { data: campaigns } = await supabase.from("campaigns").select("id,name").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200);
  return (
    <div className="workspace-page mx-auto w-full max-w-6xl">
      <header><Link href={`/activities/${activity.id}`} className="group inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />Activity</Link><p className="dateline mt-3">Source record</p><h1>Edit activity</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Keep the original activity current so future content and calendar recommendations use the right facts.</p></header>
      <EditorLayout guidance={["Keep dates, people and outcomes accurate.", "Changes inform future drafts. Review existing content separately.", "Save the source record before generating new content."]}><ActivityForm activity={activity} segments={segments.map((segment) => ({ id: segment.id, name: segment.name }))} campaigns={campaigns ?? []} /></EditorLayout>
    </div>
  );
}
