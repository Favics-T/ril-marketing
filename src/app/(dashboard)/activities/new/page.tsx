import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listSegments } from "@/lib/audience/segments";
import { ActivityForm } from "@/components/content/activity-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log activity" };

export default async function NewActivityPage() {
	const orgId = await getCallerOrganizationId();
	if (!orgId) redirect("/onboarding");

	const segments = await listSegments(orgId);
	const supabase = await createClient();
	const { data: campaigns } = await supabase.from("campaigns").select("id,name").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);

	return (
		<div className="workspace-page mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
			<header>
				<p className="dateline">New source record</p>
				<h1>
					Log activity
				</h1>
				<p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
					Describe it once. Drafts, calendar entries, and sign-up tracking all
					build on this record.
				</p>
				<p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
					Once it&apos;s saved, you can attach photos, videos and documents on the
					activity&apos;s page.
				</p>
			</header>
			<ActivityForm segments={segments.map((s) => ({ id: s.id, name: s.name }))} campaigns={campaigns ?? []} />
		</div>
	);
}
