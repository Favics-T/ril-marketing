"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { FieldGroup as ShadcnFieldGroup, FieldSet as ShadcnFieldSet, FieldLegend as ShadcnFieldLegend, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Card as ShadcnCard } from "@/components/ui/card";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


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
		<ShadcnFieldGroup asChild><ShadcnCard asChild><form onReset={event => event.preventDefault()} action={action} className="slip flex flex-col gap-5 p-5 sm:p-6">
			<p className="text-sm leading-6 text-muted-foreground">Name the group and describe who it includes. Add preferences when you know them; you can update them later.</p>
			<div className="flex flex-col gap-2">
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
			<div className="flex flex-col gap-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					name="description"
					rows={2}
					defaultValue={segment?.description ?? ""}
				/>
			</div>
			<Disclosure className="border-t pt-4" title={<>Audience preferences (optional)</>}><div className="mt-4 grid gap-5 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor="needs_motivations">Needs &amp; motivations (one per line)</Label>
					<Textarea
						id="needs_motivations"
						name="needs_motivations"
						rows={4}
						defaultValue={(segment?.needs_motivations ?? []).join("\n")}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="preferred_hooks">Messages that resonate (one per line)</Label>
					<Textarea
						id="preferred_hooks"
						name="preferred_hooks"
						rows={4}
						defaultValue={(segment?.preferred_hooks ?? []).join("\n")}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="preferred_formats">Preferred formats (comma or line)</Label>
					<Textarea
						id="preferred_formats"
						name="preferred_formats"
						rows={2}
						defaultValue={(segment?.preferred_formats ?? []).join(", ")}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="preferred_platforms">Preferred platforms (comma or line)</Label>
					<Textarea
						id="preferred_platforms"
						name="preferred_platforms"
						rows={2}
						defaultValue={(segment?.preferred_platforms ?? []).join(", ")}
					/>
				</div>
			</div></Disclosure>
			{programs.length ? (
				<ShadcnFieldSet className="flex flex-col gap-2">
					<ShadcnFieldLegend className="dateline">Linked programs</ShadcnFieldLegend>
					<div className="flex flex-wrap gap-x-6 gap-y-2">
						{programs.map((p) => (
							<ShadcnField asChild orientation="horizontal" key={p.id}><ShadcnFieldLabel
								key={p.id}
								className="flex items-center gap-2 text-sm font-medium text-foreground"
							>
								<ShadcnCheckbox
									
									name="program_ids"
									value={p.id}
									defaultChecked={segment?.programIds.includes(p.id)}
									className="size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
								{p.name}
							</ShadcnFieldLabel></ShadcnField>
						))}
					</div>
				</ShadcnFieldSet>
			) : null}
			{state?.ok === false ? (
				<ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
					{state.error}
				</p></ShadcnAlert>
			) : null}
			{editing && state?.ok ? (
				<p className="text-sm font-semibold text-emerald-700 ">
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
		</form></ShadcnCard></ShadcnFieldGroup>
	);
}
