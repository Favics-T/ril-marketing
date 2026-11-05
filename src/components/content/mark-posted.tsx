"use client";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import { useActionState } from "react";
import { transitionAsset, type ActionResult } from "@/actions/content";
import { Button } from "@/components/ui/button";

/** One-click Scheduled → Published for a social post that was posted by hand. */
export function MarkPosted({ assetId }: { assetId: string }) {
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (_prev, fd) => transitionAsset(assetId, fd),
		null
	);
	return (
		<ShadcnFieldGroup asChild><form action={action} className="flex flex-col gap-2">
			<input type="hidden" name="to" value="published" />
			<input type="hidden" name="note" value="Marked as posted from reminder." />
			{state?.ok === false ? (
				<ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
					{state.error}
				</p></ShadcnAlert>
			) : null}
			<Button type="submit" size="sm" className="w-fit" disabled={pending}>
				{pending ? "Saving…" : "Mark as posted"}
			</Button>
		</form></ShadcnFieldGroup>
	);
}
