"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section className="workspace-panel mx-auto my-8 max-w-xl p-7 sm:p-10" role="alert">
    <AlertCircle className="mb-4 size-7 text-destructive" aria-hidden="true"/>
    <h1>This page couldn’t load</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">We couldn’t retrieve the workspace data. Try again, or return to the Command Centre while the connection recovers.</p>
    <div className="mt-7 flex flex-wrap gap-3"><Button onClick={retry}>Reload this page</Button><Button asChild variant="outline"><Link href="/dashboard">Command Centre</Link></Button></div>
  </section>;
}
