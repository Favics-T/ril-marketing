import type { Metadata } from "next";
import { AsciiLogo } from "@/components/auth/ascii-logo";
import { PageMotion } from "@/components/ui/page-motion";
import { BrandShapes } from "@/components/landing/brand-shapes";

export const metadata: Metadata = { title: "Your workspace" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="restored-auth ril-auth-shell">
    <div className="ril-auth-column">
      <PageMotion className="ril-auth-body">{children}</PageMotion>
      <p className="ril-auth-footer">Renaissance Innovation Labs · Marketing workspace</p>
    </div>
    <aside className="ril-auth-brand">
      <div className="ril-auth-art" aria-hidden="true"><AsciiLogo className="flex h-full items-center justify-center" /></div>
      <div className="ril-auth-message"><h2>Make good work<br />go further.</h2><p>Your activities. Your audience. Your next decision. All working together.</p><span>AI drafts. Your team approves.</span></div>
      <BrandShapes />
    </aside>
  </main>;
}
