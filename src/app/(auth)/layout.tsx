import type { Metadata } from "next";
import { PageMotion } from "@/components/ui/page-motion";
import Link from "next/link";
import Image from "next/image";
import { FileText, ClipboardCheck, Send } from "lucide-react";

export const metadata: Metadata = { title: "Your workspace" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="restored-auth ril-auth-shell">
    <aside className="ril-auth-story" aria-label="About the workspace">
      <Link href="/" aria-label="Renaissance Innovation Labs home"><Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={100} height={45} priority /></Link>
      <div className="ril-auth-story-copy"><p className="ril-home-eyebrow">A little more connected.</p><h2>Your next campaign<br />starts here.</h2><p>A place for the source, the first draft, the second pair of eyes, and the conversations that follow.</p><ol><li><FileText aria-hidden="true" /><div><strong>Keep the context</strong><span>Start with the work your team is doing.</span></div></li><li><ClipboardCheck aria-hidden="true" /><div><strong>Make it yours</strong><span>Shape the story. Review every public step.</span></div></li><li><Send aria-hidden="true" /><div><strong>See what connects</strong><span>Publish, follow up, and learn for next time.</span></div></li></ol></div>
      <p className="ril-auth-story-footnote">AI prepares. Your team decides.</p>
    </aside>
    <div className="ril-auth-column"><PageMotion className="ril-auth-body">{children}</PageMotion><footer className="ril-auth-footer"><p>Renaissance Innovation Labs</p><Link href="/">Back to the website</Link></footer></div>
  </main>;
}
