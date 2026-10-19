import type { Metadata } from "next";
import { AsciiLogo } from "@/components/auth/ascii-logo";
import { PageMotion } from "@/components/ui/page-motion";

export const metadata: Metadata = { title: "Your workspace" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="restored-auth flex min-h-[100dvh] items-stretch bg-background">
    <div className="flex min-h-[100dvh] w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
      <PageMotion className="mx-auto w-full max-w-sm">{children}</PageMotion>
    </div>
    <aside aria-hidden="true" className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block lg:w-1/2">
      <AsciiLogo className="absolute inset-0 flex items-center justify-center text-primary-foreground/90" />
    </aside>
  </main>;
}
