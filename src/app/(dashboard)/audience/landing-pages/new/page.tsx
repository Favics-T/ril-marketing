import type { Metadata } from "next";
import { EditorLayout } from "@/components/editor-layout";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getLandingPageOptions } from "@/lib/landing-pages";
import { LandingPageForm } from "@/components/landing-pages/landing-page-form";

export const metadata: Metadata = { title: "Create landing page" };

export default async function NewLandingPage() {
  const organizationId = await getCallerOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const options = await getLandingPageOptions(organizationId);
  return (
    <div className="workspace-page mx-auto w-full max-w-6xl">
      <header><Link href="/audience/landing-pages" className="group inline-flex min-h-9 items-center gap-1.5 rounded-md py-2 text-[13px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" /> Landing Pages</Link><p className="dateline mt-3">Campaign builder</p><h1>Create a landing page</h1><p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">Draft a focused public page. A reviewer approves it, then a different owner, admin or leader publishes it.</p></header>
      <EditorLayout guidance={["Focus the headline and call to action on one campaign.", "Link the audience and source activity for attributable lead capture.", "Save the draft. A reviewer approves it before a different authorized person publishes."]}><LandingPageForm {...options} /></EditorLayout>
    </div>
  );
}
