import { StatusStamp } from "@/components/ui/status-stamp";
import { REMINDER_LABEL, type ReminderState } from "@/lib/content/reminders";

/** Red for overdue, the blue "needs action" field for due today. */
export function ReminderFlag({ state }: { state: ReminderState | null }) {
	if (!state) return null;
	return (
		<StatusStamp variant={state === "overdue" ? "failed" : "pending"} data-reminder={state}>
			{REMINDER_LABEL[state]}
		</StatusStamp>
	);
}
