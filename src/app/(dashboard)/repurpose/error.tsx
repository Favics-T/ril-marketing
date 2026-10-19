"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <section
      className="workspace-page flex flex-col items-start gap-4"
      role="alert"
    >
      <h1>Sources could not load</h1>
      <p className="text-sm text-muted-foreground">
        Check the connection and try again. Your saved sources and drafts have
        not been removed.
      </p>
      <Button onClick={retry}>Try again</Button>
    </section>
  );
}
