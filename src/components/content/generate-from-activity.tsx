"use client";

import { startTransition, useActionState, useRef } from "react";
import Link from "next/link";
import { generateFromActivity, type ActionResult } from "@/actions/content";
import { NEWSLETTER_STYLES, REPURPOSE_KINDS } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const field = "flex flex-col gap-1.5";
const label = "text-xs font-semibold text-muted-foreground";
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
				<p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
					{state.message ?? "Drafts created, pending your review."}
				</p>
				{state.warnings?.length ? (
					<ul role="alert" className="list-disc space-y-1 pl-4 text-xs leading-5 text-amber-700 dark:text-amber-400">
						{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}
					</ul>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" className="w-fit">
						<Link href="/library">Review in Content Library</Link>
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
		<form action={submit} className="flex flex-col gap-4">
			<fieldset className="flex flex-col gap-2.5">
				<legend className="sr-only">Content formats to generate</legend>
				{REPURPOSE_KINDS.map((k) => (
					<label
						key={k.kind}
						className="flex items-center gap-3 text-sm font-medium text-foreground"
					>
						<input
							type="checkbox"
							name="kinds"
							value={k.kind}
							defaultChecked={k.kind === "blog"}
							className="size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
						{k.label}
					</label>
				))}
			</fieldset>
			<details className="rounded-md border border-border p-3">
				<summary className="cursor-pointer text-sm font-medium text-foreground">Brief (optional)</summary>
				<p className="mt-2 text-xs text-muted-foreground">
					Anything left blank uses the activity, its campaign and the brand voice.
				</p>
				<div className="mt-3 grid gap-3 sm:grid-cols-2">
					<label className={field}>
						<span className={label}>Tone</span>
						<Input name="tone" maxLength={120} placeholder="e.g. Celebratory, practical" />
					</label>
					<label className={field}>
						<span className={label}>Length</span>
						<select name="length" defaultValue="" className={selectClass}>
							<option value="">Standard</option>
							<option value="short">Short</option>
							<option value="long">Long</option>
						</select>
					</label>
					<label className={`${field} sm:col-span-2`}>
						<span className={label}>Audience</span>
						<Input name="audience" maxLength={300} placeholder="Who should this speak to?" />
					</label>
					<label className={`${field} sm:col-span-2`}>
						<span className={label}>Goal</span>
						<Input name="objective" maxLength={300} placeholder="e.g. Drive registrations for the next cohort" />
					</label>
					<label className={`${field} sm:col-span-2`}>
						<span className={label}>Call to action</span>
						<Input name="cta" maxLength={200} placeholder="e.g. Apply before Friday" />
					</label>
					<label className={field}>
						<span className={label}>SEO focus keyword (blog)</span>
						<Input name="seo_focus_keyword" maxLength={80} />
					</label>
					<label className={field}>
						<span className={label}>Newsletter style</span>
						<select name="newsletter_style" defaultValue="" className={selectClass}>
							<option value="">Choose for me</option>
							{NEWSLETTER_STYLES.map((style) => (
								<option key={style} value={style}>{styleLabel(style)}</option>
							))}
						</select>
					</label>
				</div>
			</details>
			<label className="flex items-start gap-3 text-xs text-muted-foreground">
				<input
					type="checkbox"
					name="allow_template_fallback"
					className="mt-0.5 size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
				If the AI fails, save a basic template draft instead (clearly labelled, not AI-written)
			</label>
			{state?.ok === false ? (
				<div role="alert" className="flex flex-col gap-2">
					<p className="text-sm text-destructive">{state.error}</p>
					{lastRequest.current ? (
						<Button type="button" size="sm" variant="outline" className="w-fit" disabled={pending} onClick={() => retry(failed.length ? failed : undefined)}>
							{pending ? "Trying again…" : "Try again"}
						</Button>
					) : null}
				</div>
			) : null}
			<Button type="submit" size="sm" className="w-fit" disabled={pending}>
				{pending ? "Generating…" : "Generate drafts"}
			</Button>
		</form>
	);
}
