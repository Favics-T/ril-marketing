import type { Metadata } from "next";
import { EditorLayout } from "@/components/editor-layout";
import { redirect } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listPrograms } from "@/lib/audience/segments";
import { SegmentForm } from "@/components/audience/segment-form";

export const metadata: Metadata = { title: "New segment" };

export default async function NewSegmentPage() {
	const orgId = await getCallerOrganizationId();
	if (!orgId) redirect("/onboarding");

	const programs = await listPrograms(orgId);

	return (
		<div className="workspace-page mx-auto w-full max-w-6xl">
			<header>
				<p className="dateline">New segment</p>
				<h1>
					Define an audience
				</h1>
				<p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
					Needs, motivations, and preferred formats ground every AI
					recommendation for this audience.
				</p>
			</header>
			<EditorLayout guidance={["Describe who this audience is and what they need.", "Record motivations, formats and related programs with specific language.", "New audience insights still need human approval before informing content."]}><SegmentForm programs={programs.map((p) => ({ id: p.id, name: p.name }))} /></EditorLayout>
		</div>
	);
}
