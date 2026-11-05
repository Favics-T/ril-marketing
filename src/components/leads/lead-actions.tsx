"use client";
import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState } from "react";
import {
	setLeadStage,
	saveLeadNotes,
	setLeadQualified,
	type ActionResult,
} from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STAGES = [
	"awareness",
	"engagement",
	"captured",
	"nurturing",
	"converted",
	"retention",
] as const;

const fieldClass =
	"h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const label = (s: string) => s.replace(/\b\w/, (c) => c.toUpperCase());

const ok = (s: ActionResult | null) => s?.ok === true;
const err = (s: ActionResult | null) => (s?.ok === false ? s.error : null);

export function LeadActions({
	leadId,
	stage,
	isQualified,
	notes,
	hasOwner,
}: {
	leadId: string;
	stage: string;
	isQualified: boolean;
	notes: string | null;
	hasOwner: boolean;
}) {
	const [stageState, stageAction, stagePending] = useActionState<
		ActionResult | null,
		FormData
	>(async (_p, fd) => setLeadStage(leadId, String(fd.get("stage") ?? "")), null);

	const [qualState, qualAction, qualPending] = useActionState<
		ActionResult | null,
		FormData
	>(async () => setLeadQualified(leadId, !isQualified), null);

	const [notesState, notesAction, notesPending] = useActionState<
		ActionResult | null,
		FormData
	>(async (_p, fd) => saveLeadNotes(leadId, fd), null);

	return (
		<div className="flex flex-col gap-5">
			<ShadcnFieldGroup asChild><form action={stageAction} className="flex flex-col gap-2">
				<ShadcnField asChild><ShadcnFieldLabel htmlFor="lead-stage" className="dateline">
					Funnel stage
				</ShadcnFieldLabel></ShadcnField>
				<ShadcnNativeSelect
					id="lead-stage"
					name="stage"
					defaultValue={stage}
					className={fieldClass}
				>
					{STAGES.map((s) => (
						<ShadcnNativeSelectOption key={s} value={s}>
							{label(s)}
						</ShadcnNativeSelectOption>
					))}
				</ShadcnNativeSelect>
				<Button type="submit" size="sm" className="w-fit" disabled={stagePending}>
					{stagePending ? "Saving…" : "Update stage"}
				</Button>
				{err(stageState) ? (
					<ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
						{err(stageState)}
					</p></ShadcnAlert>
				) : ok(stageState) ? (
					<p className="text-sm font-semibold text-emerald-700 ">
						Stage updated · score recalculated.
					</p>
				) : null}
			</form></ShadcnFieldGroup>

			<ShadcnFieldGroup asChild><form action={qualAction} className="flex flex-col gap-2 border-t border-border pt-4">
				<span className="dateline">Qualification</span>
				<Button
					type="submit"
					size="sm"
					variant={isQualified ? "outline" : "default"}
					className="w-fit"
					disabled={qualPending}
				>
					{qualPending
						? "Saving…"
						: isQualified
							? "Mark not qualified"
							: "Mark qualified"}
				</Button>
				{err(qualState) ? (
					<ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
						{err(qualState)}
					</p></ShadcnAlert>
				) : null}
			</form></ShadcnFieldGroup>

			<ShadcnFieldGroup asChild><form action={notesAction} className="flex flex-col gap-2 border-t border-border pt-4">
				<ShadcnField asChild><ShadcnFieldLabel htmlFor="lead-notes" className="dateline">
					Follow-up notes
				</ShadcnFieldLabel></ShadcnField>
				<Textarea
					id="lead-notes"
					name="notes"
					rows={4}
					maxLength={5000}
					defaultValue={notes ?? ""}
					placeholder="Who reached out, what was said, next step…"
				/>
				{hasOwner ? (
					<ShadcnField asChild orientation="horizontal"><ShadcnFieldLabel className="flex items-center gap-2 text-sm text-muted-foreground">
						<ShadcnCheckbox
							
							name="owner_cleared"
							className="size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
						Release ownership on save
					</ShadcnFieldLabel></ShadcnField>
				) : null}
				<Button type="submit" size="sm" variant="outline" className="w-fit" disabled={notesPending}>
					{notesPending ? "Saving…" : "Save notes"}
				</Button>
				{err(notesState) ? (
					<ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
						{err(notesState)}
					</p></ShadcnAlert>
				) : ok(notesState) ? (
					<p className="text-sm font-semibold text-emerald-700 ">
						Notes saved.
					</p>
				) : null}
			</form></ShadcnFieldGroup>
		</div>
	);
}
