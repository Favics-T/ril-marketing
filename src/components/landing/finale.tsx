import { Disclosure } from "@/components/ui/disclosure";
import { Button } from "@/components/ui/button";
import { ChannelMark } from "@/components/settings/channel-icons";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { BrandShapes } from "./brand-shapes";

const faqs = [
  {
    q: "Does the AI publish anything on its own?",
    a: "Never. Drafts wait in review, and only assets a human marks Approved can move to scheduling and publishing.",
  },
  {
    q: "Which channels can we publish to?",
    a: "Approved articles can publish through a configured WordPress or Strapi connection. Social copy uses linked Buffer channels, approved videos can upload directly to YouTube, and manual posts can be recorded with their live link. Each connection needs to be set up first.",
  },
  {
    q: "Do we need our own AI key?",
    a: "No. Template mode works without one. Bring your own OpenAI, Anthropic, or Gemini key to unlock full generation.",
  },
  {
    q: "What information does the AI use?",
    a: "Drafting uses the source material you select, approved audience insights, and relevant brand guidance. The assistant uses limited workspace signals and does not send lead contact details. Review your AI provider’s data handling before connecting it.",
  },
  {
    q: "Who sees our workspace data?",
    a: "Only your team. Every organisation is isolated at the database level, with roles for marketing, leadership, and admins.",
  },
  {
    q: "What happens to content we reject?",
    a: "Suppressed insights stay on the bench and never reach recommendations, drafts, calendar entries, or reports.",
  },
] as const;

export function Faq() {
  return (
    <section
      aria-labelledby="faq-heading"
      id="faq"
      className="ril-home-faq scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <h2
            id="faq-heading"
            className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:sticky lg:top-24"
          >
            A few useful answers.
          </h2>
        </Reveal>
        <div className="lg:col-span-8">
          <div className="border-t border-border">
            {faqs.map((item, i) => (
              <Reveal key={item.q} delay={i * 40}>
                <Disclosure className="ril-home-faq-item" title={item.q}><p className="max-w-[64ch] text-base leading-7 text-muted-foreground">{item.a}</p></Disclosure>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </section>
  );
}

export function CloseCta() {
  return (
    <section
      aria-labelledby="close-heading"
      className="ril-home-close relative overflow-hidden bg-primary text-primary-foreground"
    >
      <BrandShapes />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2
            id="close-heading"
            className="max-w-[18ch] text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
          >
            Start with your next activity.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-4 max-w-[52ch] text-base leading-7 text-primary-foreground/85">
            Bring the source material. Create with context. Keep the decision
            with the people who know your audience.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/sign-up">
              Create your workspace
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/sign-in">
              Sign in
            </Link></Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}


const pageLinks = [
  { href: "#workflow", label: "Workflow" },
  { href: "#platform", label: "Platform" },
  { href: "#learning", label: "Learning" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteFooter() {
  return (
    <footer className="ril-home-footer border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-sm">
            <Link href="/" aria-label="RIL home" className="inline-flex">
              <Image
                src="/logo/blackLogo.svg"
                alt="Renaissance Innovation Labs"
                width={100} height={45}
                className="h-auto w-[120px] max-w-none"
              />
            </Link>
            <p className="mt-5 text-lg font-bold tracking-tight text-foreground">
              Useful work deserves a useful story.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Built in Port Harcourt, Nigeria, in the open lab spirit:
              collaboration, community, and trust.
            </p>
          </div>
          <nav aria-label="Footer" className="flex gap-14 text-sm">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                On this page
              </p>
              {pageLinks.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  {s.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Elsewhere
              </p>
              <Link
                href="/sign-in"
                className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Create your workspace
              </Link>
              <Link
                href="https://www.renaissancelabs.org"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                renaissancelabs.org
              </Link>
              <Link
                href="https://www.twitter.com/RxlabsHQ"
                target="_blank"
                rel="noreferrer"
                aria-label="Renaissance on X (opens in a new tab)"
                title="X"
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChannelMark service="x" className="size-5" />
              </Link>
              <Link
                href="https://www.instagram.com/RxlabsHQ"
                target="_blank"
                rel="noreferrer"
                aria-label="Renaissance on Instagram (opens in a new tab)"
                title="Instagram"
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChannelMark service="instagram" className="size-5" />
              </Link>
            </div>
          </nav>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            © {new Date().getFullYear()} Renaissance Innovation Labs
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="https://www.renaissancelabs.org/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="https://www.renaissancelabs.org/terms"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="#main"
              className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Back to top ↑
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
