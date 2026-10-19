import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="recovery-page flex min-h-dvh items-center justify-center p-6">
      <div className="slip w-full max-w-md rounded-2xl px-8 py-12 text-center">
        <p className="dateline tabular-nums">404</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">This page isn’t here.</h1>
        <p className="mx-auto mt-2 max-w-[32ch] text-balance text-[13px] leading-5 text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button asChild className="group min-h-10 rounded-lg font-semibold">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Back to home
            </Link>
          </Button>
          <Button asChild variant="outline" className="group min-h-10 rounded-lg font-semibold">
            <Link href="/dashboard">
              Go to dashboard
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
