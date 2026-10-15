"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="recovery-page flex min-h-dvh items-center justify-center p-6">
      <div role="alert" className="slip w-full max-w-md rounded-2xl px-8 py-12 text-center">
        <p className="dateline tabular-nums">Unexpected error</p>
        <h1 className="mt-2 text-balance text-xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-[32ch] text-balance text-[13px] leading-5 text-muted-foreground">
          We could not load this page. Try again, or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={retry} variant="outline" className="group min-h-10 rounded-lg font-semibold">
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
          <Button asChild className="group min-h-10 rounded-lg font-semibold">
            <Link href="/dashboard">
              Back to dashboard
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
