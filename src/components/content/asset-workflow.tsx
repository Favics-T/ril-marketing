import { Check } from "lucide-react";

export function AssetWorkflow({ status, approvalsReady }: { status: string; approvalsReady: boolean }) {
  const current = ["published", "analysing"].includes(status) ? 4 : status === "scheduled" ? 3 : status === "approved" ? (approvalsReady ? 2 : 1) : status === "review" ? 1 : 0;
  return <section className="asset-workflow" aria-label="Content workflow">
    <ol>{["Draft", "Review", "Approved", "Distribution"].map((label, index) => <li key={label} data-state={index < current ? "complete" : index === current ? "current" : "waiting"} aria-current={index === current ? "step" : undefined}><span className="asset-step-marker" aria-hidden="true">{index < current ? <Check /> : index + 1}</span><span>{label}</span></li>)}</ol>
    {status === "approved" && !approvalsReady ? <p>Required recorded approvals are still pending. Review the sign-offs before publishing.</p> : null}
  </section>;
}
