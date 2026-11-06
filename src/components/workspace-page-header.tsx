import type { ReactNode } from "react";

export function WorkspacePageHeader({ title, description, eyebrow, actions }: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return <header className="workspace-page-header">
    <div className="workspace-page-intro"><div className="workspace-title-line"><h1>{title}</h1>{eyebrow ? <p className="workspace-page-eyebrow">{eyebrow}</p> : null}</div>{description ? <p className="workspace-page-description">{description}</p> : null}</div>
    {actions ? <div className="workspace-page-actions">{actions}</div> : null}
  </header>;
}
