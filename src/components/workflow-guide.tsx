type WorkflowStep = { title: string; description: string };

export function WorkflowGuide({ label, steps }: { label: string; steps: WorkflowStep[] }) {
  return <nav className="ril-workflow-guide" aria-label={label}>
    <ol>{steps.map((step, index) => <li key={step.title}><span aria-hidden="true">{index + 1}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>)}</ol>
  </nav>;
}
