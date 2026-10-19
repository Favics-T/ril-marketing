"use client";
import { Button } from "@/components/ui/button";

export default function PublishingError({ retry }: { retry: () => void }) {
  return <section className="workspace-page flex flex-col items-start gap-4" role="alert"><h1>Social posts could not load</h1><p className="text-sm text-muted-foreground">Check your connection and try again. No posts have been sent.</p><Button onClick={retry}>Try again</Button></section>;
}
