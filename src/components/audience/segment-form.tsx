"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	createSegment,
	updateSegment,
	type ActionResult,
} from "@/actions/audience/segments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";

type ProgramOption = { id: string; name: string };

export type SegmentFormValue = {
	id: string;
	name: string;
	description: string | null;
	needs_motivations: string[];
	preferred_formats: string[];
	preferred_platforms: string[];
	preferred_hooks: string[];
	programIds: string[];
};

/** Create or edit an audience segment. Newline lists map to the action's
 *  splitLines/splitList fields; program links come through `program_ids`. */
export function SegmentForm({
	programs,
	segment,
}: {
	programs: ProgramOption[];
	segment?: SegmentFormValue;
}) {
	const router = useRouter();
	const editing = Boolean(segment);
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (_prev, fd) =>
			segment ? updateSegment(segment.id, fd) : createSegment(fd),
		null
	);

	useEffect(() => {
		if (!editing && state?.ok && state.id) {
			router.push(`/audience/segments/${state.id}`);
		}
	}, [editing, state, router]);

	return (
		<form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
			<p className="text-sm leading-6 text-muted-foreground">Name the group and describe who it includes. Add preferences when you know them; you can update them later.</p>
			<div className="space-y-2">
				<Label htmlFor="name">Segment name</Label>
				<Input
					id="name"
					name="name"
					required
					minLength={2}
					defaultValue={segment?.name ?? ""}
					placeholder="e.g. First-time founders"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					name="description"
					rows={2}
					defaultValue={segment?.description ?? ""}
				/>
			</div>
			<details className="border-t pt-4"><DisclosureSummary>Audience preferences (optional)</DisclosureSummary><div className="mt-4 grid gap-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="needs_motivations">Needs &amp; motivations (one per line)</Label>
					<Textarea
						id="needs_motivations"
						name="needs_motivations"
						rows={4}
						defaultValue={(segment?.needs_motivations ?? []).join("\n")}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="preferred_hooks">Messages that resonate (one per line)</Label>
					<Textarea
						id="preferred_hooks"
						name="preferred_hooks"
						rows={4}
						defaultValue={(segment?.preferred_hooks ?? []).join("\n")}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="preferred_formats">Preferred formats (comma or line)</Label>
					<Textarea
						id="preferred_formats"
						name="preferred_formats"
						rows={2}
						defaultValue={(segment?.preferred_formats ?? []).join(", ")}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="preferred_platforms">Preferred platforms (comma or line)</Label>
					<Textarea
						id="preferred_platforms"
						name="preferred_platforms"
						rows={2}
						defaultValue={(segment?.preferred_platforms ?? []).join(", ")}
					/>
				</div>
			</div></details>
			{programs.length ? (
				<fieldset className="space-y-2">
					<legend className="dateline">Linked programs</legend>
					<div className="flex flex-wrap gap-x-6 gap-y-2">
						{programs.map((p) => (
							<label
								key={p.id}
								className="flex items-center gap-2 text-sm font-medium text-foreground"
							>
								<input
									type="checkbox"
									name="program_ids"
									value={p.id}
									defaultChecked={segment?.programIds.includes(p.id)}
									className="size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
								{p.name}
							</label>
						))}
					</div>
				</fieldset>
			) : null}
			{state?.ok === false ? (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			) : null}
			{editing && state?.ok ? (
				<p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
					Segment saved.
				</p>
			) : null}
			<div>
				<Button type="submit" disabled={pending}>
					{pending
						? "Saving…"
						: editing
							? "Save segment"
							: "Create segment"}
				</Button>
			</div>
		</form>
	);
}
