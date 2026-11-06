"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { Alert as ShadcnAlert } from "@/components/ui/alert";
import { FieldGroup as ShadcnFieldGroup, FieldSet as ShadcnFieldSet, FieldLegend as ShadcnFieldLegend, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";


import { startTransition, useActionState, useRef } from "react";
import Link from "next/link";
import { generateFromActivity, type ActionResult } from "@/actions/content";
import { NEWSLETTER_STYLES, REPURPOSE_KINDS } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const field = "flex flex-col gap-1.5";
const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

const kindLabel = (kind: string) => REPURPOSE_KINDS.find((k) => k.kind === kind)?.label ?? kind;
const styleLabel = (style: string) => style.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Turn one activity into draft assets (blog / newsletter / social / short-form).
 *  Drafts always land as `ai_generated`, pending human review. */
export function GenerateFromActivity({ activityId }: { activityId: string }) {
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (_prev, fd) => generateFromActivity(activityId, fd),
		null
	);
	// React resets the form after submit, so keep the last request for "Try again".
	const lastRequest = useRef<FormData | null>(null);

	const submit = (fd: FormData) => {
		lastRequest.current = fd;
		action(fd);
	};

	const retry = (kinds?: string[]) => {
		const previous = lastRequest.current;
		if (!previous) return;
		const fd = new FormData();
		previous.forEach((value, key) => {
			if (key !== "kinds") fd.append(key, value);
		});
		for (const kind of kinds ?? previous.getAll("kinds").map(String)) fd.append("kinds", kind);
		startTransition(() => submit(fd));
	};

	const failed = state?.failedKinds ?? [];

	if (state?.ok) {
		return (
			<div className="flex flex-col gap-3">
				<ShadcnAlert asChild role="status"><p role="status" className="text-sm font-semibold text-emerald-700 ">
					{state.message ?? "Drafts created, pending your review."}
				</p></ShadcnAlert>
				{state.warnings?.length ? (
					<ul role="alert" className="list-disc flex flex-col gap-1 pl-4 text-xs leading-5 text-amber-700 ">
						{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}
					</ul>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" className="w-fit">
						<Link href={`/library?activity=${activityId}`}>Review these drafts</Link>
					</Button>
					{failed.length ? (
						<Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => retry(failed)}>
							{pending ? "Trying again…" : `Try again: ${failed.map(kindLabel).join(", ")}`}
						</Button>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<ShadcnFieldGroup asChild><form action={submit} className="flex flex-col gap-4">
			<ShadcnFieldSet className="flex flex-col gap-2.5">
				<ShadcnFieldLegend className="sr-only">Content formats to generate</ShadcnFieldLegend>
				{REPURPOSE_KINDS.map((k) => (
					<ShadcnField asChild orientation="horizontal" key={k.kind}><ShadcnFieldLabel
						key={k.kind}
						className="flex items-center gap-3 text-sm font-medium text-foreground"
					>
						<ShadcnCheckbox
							
							name="kinds"
							value={k.kind}
							defaultChecked={k.kind === "blog"}
							className="size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
						{k.label}
					</ShadcnFieldLabel></ShadcnField>
				))}
			</ShadcnFieldSet>
			<Disclosure className="rounded-md border border-border p-3" title={<>Brief (optional)</>} summaryClassName="cursor-pointer text-sm font-medium text-foreground">
				
				<p className="mt-2 text-xs text-muted-foreground">
					Anything left blank uses the activity, its campaign and the brand voice.
				</p>
				<div className="mt-3 grid gap-3 sm:grid-cols-2">
					<ShadcnField asChild><ShadcnFieldLabel className={field}>
						<span >Tone</span>
						<Input name="tone" maxLength={120} placeholder="e.g. Celebratory, practical" />
					</ShadcnFieldLabel></ShadcnField>
					<ShadcnField asChild><ShadcnFieldLabel className={field}>
						<span >Length</span>
						<ShadcnNativeSelect name="length" defaultValue="" className={selectClass}>
							<ShadcnNativeSelectOption value="">Standard</ShadcnNativeSelectOption>
							<ShadcnNativeSelectOption value="short">Short</ShadcnNativeSelectOption>
							<ShadcnNativeSelectOption value="long">Long</ShadcnNativeSelectOption>
						</ShadcnNativeSelect>
					</ShadcnFieldLabel></ShadcnField>
					<ShadcnField asChild><ShadcnFieldLabel className={`${field} sm:col-span-2`}>
						<span >Audience</span>
						<Input name="audience" maxLength={300} placeholder="Who should this speak to?" />
					</ShadcnFieldLabel></ShadcnField>
					<ShadcnField asChild><ShadcnFieldLabel className={`${field} sm:col-span-2`}>
						<span >Goal</span>
						<Input name="objective" maxLength={300} placeholder="e.g. Drive registrations for the next cohort" />
					</ShadcnFieldLabel></ShadcnField>
					<ShadcnField asChild><ShadcnFieldLabel className={`${field} sm:col-span-2`}>
						<span >Call to action</span>
						<Input name="cta" maxLength={200} placeholder="e.g. Apply before Friday" />
					</ShadcnFieldLabel></ShadcnField>
					<ShadcnField asChild><ShadcnFieldLabel className={field}>
						<span >SEO focus keyword (blog)</span>
						<Input name="seo_focus_keyword" maxLength={80} />
					</ShadcnFieldLabel></ShadcnField>
					<ShadcnField asChild><ShadcnFieldLabel className={field}>
						<span >Newsletter style</span>
						<ShadcnNativeSelect name="newsletter_style" defaultValue="" className={selectClass}>
							<ShadcnNativeSelectOption value="">Choose for me</ShadcnNativeSelectOption>
							{NEWSLETTER_STYLES.map((style) => (
								<ShadcnNativeSelectOption key={style} value={style}>{styleLabel(style)}</ShadcnNativeSelectOption>
							))}
						</ShadcnNativeSelect>
					</ShadcnFieldLabel></ShadcnField>
				</div>
			</Disclosure>
			<ShadcnField asChild orientation="horizontal"><ShadcnFieldLabel className="flex items-start gap-3 text-xs text-muted-foreground">
				<ShadcnCheckbox
					
					name="allow_template_fallback"
					className="mt-0.5 size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
				If the AI fails, save a basic template draft instead (clearly labelled, not AI-written)
			</ShadcnFieldLabel></ShadcnField>
			{state?.ok === false ? (
				<ShadcnAlert asChild variant="destructive"><div role="alert" className="flex flex-col gap-2">
					<p className="text-sm text-destructive">{state.error}</p>
					{lastRequest.current ? (
						<Button type="button" size="sm" variant="outline" className="w-fit" disabled={pending} onClick={() => retry(failed.length ? failed : undefined)}>
							{pending ? "Trying again…" : "Try again"}
						</Button>
					) : null}
				</div></ShadcnAlert>
			) : null}
			<Button type="submit" size="sm" className="w-fit" disabled={pending}>
				{pending ? "Generating…" : "Generate drafts"}
			</Button>
		</form></ShadcnFieldGroup>
	);
}
