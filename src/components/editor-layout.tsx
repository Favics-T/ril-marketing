import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import type { ReactNode } from "react";

export function EditorLayout({ children, title = "Keep in view", guidance }: { children: ReactNode; title?: string; guidance: string[] }) {
  return <div className="workspace-editor glass-editor">
    <div className="min-w-0">{children}</div>
    <Card asChild><aside className="editor-guidance"><CardHeader><CardTitle asChild><h2>{title}</h2></CardTitle></CardHeader><CardContent><ol>{guidance.map((item,index)=><li key={item}><span aria-hidden="true">0{index+1}</span><p>{item}</p></li>)}</ol></CardContent><CardFooter asChild><p className="editor-guidance-footer">Keep the source clear. Your team owns the decision.</p></CardFooter></aside></Card>
  </div>;
}
