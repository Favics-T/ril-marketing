import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export function WorkspaceSection({ id, title, description, action, children, footer, className = "" }: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return <Card asChild><section className={cn("workspace-panel workspace-section", className)} aria-labelledby={id}>
    <CardHeader asChild className="flex-row items-start justify-between"><header className="workspace-panel-heading">
      <div className="min-w-0"><CardTitle asChild><h2 id={id}>{title}</h2></CardTitle>{description ? <CardDescription asChild><p>{description}</p></CardDescription> : null}</div>
      {action}
    </header></CardHeader>
    <CardContent className="workspace-section-body p-0">{children}</CardContent>
    {footer ? <CardFooter className="command-side-footer">{footer}</CardFooter> : null}
  </section></Card>;
}
