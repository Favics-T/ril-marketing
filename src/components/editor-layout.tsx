import type { ReactNode } from "react";

export function EditorLayout({ children, title = "Before you save", guidance }: { children: ReactNode; title?: string; guidance: string[] }) {
  return <div className="workspace-editor">
    <div className="min-w-0">{children}</div>
    <aside className="editor-guidance"><h2>{title}</h2><ol>{guidance.map((item,index)=><li key={item}><span aria-hidden="true">0{index+1}</span><p>{item}</p></li>)}</ol><p className="editor-guidance-footer">Keep the source clear. Your team owns the decision.</p></aside>
  </div>;
}
