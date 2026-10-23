"use client";

import { useActionState, useId, useState } from "react";
import { transitionAsset, type ActionResult } from "@/actions/content";
import { ASSET_STATUSES, canTransitionAsset } from "@/lib/content/transitions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateToZonedInput, WORKSPACE_TIME_ZONE_LABEL, zonedWallTimeToDate } from "@/lib/time";
import { needsSecondApproval, categoryLabel, type ContentSignoff, type ContentReviewer } from "@/lib/content/workflow";

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
	expectedUpdatedAt, category = "standard", sensitivity, signoffs = [], reviewers = [], authorId, secondReviewerId,
}: {
	assetId: string;
	status: string;
	manualSocialPosting?: boolean;
	scheduledFor?: string | null;
	expectedUpdatedAt?: string; category?: string; sensitivity?: string; signoffs?: ContentSignoff[]; reviewers?: ContentReviewer[]; authorId?: string | null; secondReviewerId?: string | null;
}) {
	const targets = ASSET_STATUSES.filter((s) => canTransitionAsset(status, s) && s !== "published");
	const second = needsSecondApproval(category, sensitivity);
	const waiting = reviewers.find(person => person.id === secondReviewerId);
	const [to, setTo] = useState(status);
  const statusId = useId();
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

	return (
		<form action={action} className="flex flex-col gap-3">
			<input type="hidden" name="expected_updated_at" value={expectedUpdatedAt ?? ""} />
			<p className="text-sm leading-6 text-muted-foreground">{{ idea: "Add the copy, save your draft, then choose Editing to develop it.", ai_generated: "Check the generated copy against its source. Save your edits, then choose Review when ready.", editing: "Save your copy first, then choose Review to request independent approval.", review: "An independent reviewer must check the copy before choosing Approved. Choose Editing if changes are needed.", approved: "This copy is approved. Use the publishing controls to send it, or choose Scheduled to reserve a calendar time.", scheduled: "Check the delivery controls below. A reserved calendar time alone does not publish this content.", published: "This content is live. Delivery details and its recorded link appear below.", analysing: "Review the recorded performance of this published content." }[status]}</p>
			<p className="text-sm text-muted-foreground">{categoryLabel(category)} · {signoffs.length}/{second ? 2 : 1} approvals for this revision.</p>
			{signoffs.map(signoff => <p key={signoff.id} className="text-sm">{signoff.tier === 1 ? "First" : "Second"} approval: <strong>{signoff.reviewer_name}</strong> · {signoff.reviewer_role.replaceAll("_", " ")}</p>)}
			{second && signoffs.length === 1 ? <p role="status" className="text-sm">Waiting for {waiting?.name ?? "the named second reviewer"}. Only they can complete approval.</p> : null}
			{["approved", "scheduled"].includes(status) && signoffs.length < (second ? 2 : 1) ? <p role="status" className="text-sm text-destructive">This older approval has no recorded sign-off for the current revision. Return to Editing and request review before publishing.</p> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={statusId} className="dateline">Status</label>
        <Select name="to" value={to} onValueChange={setTo} disabled={pending}>
          <SelectTrigger id={statusId}><SelectValue>{label(to)}{to === status ? " · current" : ""}</SelectValue></SelectTrigger>
          <SelectContent>{ASSET_STATUSES.map(value => <SelectItem key={value} value={value} disabled={value !== status && !targets.includes(value)}>{label(value)}{value === status ? " · current" : ""}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs leading-5 text-muted-foreground">Select an available status, then save. Review and approval rules still apply. Published status is recorded through the publishing controls.</p>
      </div>
			{to === "approved" && second && signoffs.length === 0 ? <label className="flex flex-col gap-1.5"><span className="dateline">Named second reviewer</span><select required name="second_reviewer_id" className={fieldClass} defaultValue=""><option value="" disabled>Choose an owner, admin or leader</option>{reviewers.filter(person => person.id !== authorId && ["owner", "admin", "leadership"].includes(person.role)).map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select><span className="text-xs text-muted-foreground">They must be different from you and the content author.</span></label> : null}
			{to === "scheduled" ? (
				<label className="flex flex-col gap-1.5">
					<span className="dateline">Scheduled for ({WORKSPACE_TIME_ZONE_LABEL})</span>
					<Input
						type="datetime-local"
						name="scheduled_for"
						required
						defaultValue={dateToZonedInput(scheduledFor)}
						className={fieldClass}
					/>
				</label>
			) : null}
			{to === "scheduled" ? <p className="text-sm text-muted-foreground">This reserves a calendar time. To deliver automatically, use the publishing controls after approval.</p> : null}
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
						{state.message ?? `Status updated to ${label(to)}.`}
				</p>
			) : null}
			<Button type="submit" size="sm" className="w-fit" disabled={pending || to === status}>
				{pending ? "Saving…" : "Save status"}
			</Button>
		</form>
	);
}
