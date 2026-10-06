"use client";

import { useActionState } from "react";
import Link from "next/link";
import { generateFromActivity, type ActionResult } from "@/actions/content";
import { REPURPOSE_KINDS } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";

/** Turn one activity into draft assets (blog / newsletter / social / short-form).
 *  Drafts always land as `ai_generated`, pending human review. */
export function GenerateFromActivity({ activityId }: { activityId: string }) {
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (_prev, fd) => generateFromActivity(activityId, fd),
		null
	);

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
				<Button asChild size="sm" className="w-fit">
					<Link href="/library">Review in Content Library</Link>
				</Button>
			</div>
		);
	}

	return (
		<form action={action} className="flex flex-col gap-4">
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
			{state?.ok === false ? (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			) : null}
			<Button type="submit" size="sm" className="w-fit" disabled={pending}>
				{pending ? "Generating…" : "Generate drafts"}
			</Button>
		</form>
	);
}
