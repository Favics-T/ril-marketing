import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { Tagline } from "@/components/landing/tagline";
import { FlowStrip, Modules, Approval, Learning } from "@/components/landing/sections";
import { Faq, CloseCta, SiteFooter } from "@/components/landing/finale";

export function ProductHome({ signedIn = false }: { signedIn?: boolean }) {
  return <div className="restored-home min-h-[100dvh] bg-background text-foreground">
    <SiteHeader signedIn={signedIn} />
    <main id="main">
      <Hero />
      <FlowStrip />
      <Tagline />
      <Modules />
      <Approval />
      <Learning />
      <Faq />
      <CloseCta />
    </main>
    <SiteFooter />
  </div>;
}
