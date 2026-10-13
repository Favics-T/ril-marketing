"use client";

import { useActionState, useState } from "react";
import { transitionAsset, type ActionResult } from "@/actions/content";
import { ASSET_STATUSES, canTransitionAsset } from "@/lib/content/transitions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dateToZonedInput, WORKSPACE_TIME_ZONE_LABEL, zonedWallTimeToDate } from "@/lib/time";

const fieldClass =
	"h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const label = (s: string) =>
	s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Advance a content asset through the approval pipeline (PRD §11).
 *  Only transitions the state machine allows are offered. */
export function AssetTransition({
	assetId,
	status,
	scheduledFor = null,
}: {
	assetId: string;
	status: string;
	/** The asset's saved time, pre-filled (in WAT) when it is scheduled again. */
	scheduledFor?: string | null;
}) {
	const targets = ASSET_STATUSES.filter((s) => canTransitionAsset(status, s));
	const [to, setTo] = useState<string>(targets[0] ?? "");
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (_prev, fd) => {
			// datetime-local carries no zone. Schedules always mean WAT, whatever
			// zone this device is set to, so convert here and send an exact instant.
			const local = fd.get("scheduled_for");
			if (typeof local === "string" && local) {
				const at = zonedWallTimeToDate(local);
				if (!at) return { ok: false, error: "Enter a valid date and time." };
				fd.set("scheduled_for", at.toISOString());
			}
			return transitionAsset(assetId, fd);
		},
		null
	);

	if (targets.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				This asset is at the end of the pipeline.
			</p>
		);
	}

	return (
		<form action={action} className="flex flex-col gap-3">
			<label className="flex flex-col gap-1.5">
				<span className="dateline">Move to</span>
				<select
					name="to"
					value={to}
					onChange={(e) => setTo(e.target.value)}
					className={fieldClass}
				>
					{targets.map((t) => (
						<option key={t} value={t}>
							{label(t)}
						</option>
					))}
				</select>
			</label>
			{to === "scheduled" ? (
				<label className="flex flex-col gap-1.5">
					<span className="dateline">Scheduled for ({WORKSPACE_TIME_ZONE_LABEL})</span>
					<input
						type="datetime-local"
						name="scheduled_for"
						required
						defaultValue={dateToZonedInput(scheduledFor)}
						className={fieldClass}
					/>
				</label>
			) : null}
			<label className="flex flex-col gap-1.5">
				<span className="dateline">Note (optional)</span>
				<Textarea name="note" rows={2} />
			</label>
			{state?.ok === false ? (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			) : null}
			{state?.ok ? (
				<p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
					Moved to {label(to)}.
				</p>
			) : null}
			<Button type="submit" size="sm" className="w-fit" disabled={pending}>
				{pending ? "Saving…" : "Apply transition"}
			</Button>
		</form>
	);
}
