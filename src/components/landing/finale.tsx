import { ChannelMark } from "@/components/settings/channel-icons";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { Reveal } from "./reveal";
import { BrandShapes } from "./brand-shapes";

const faqs = [
  {
    q: "Does the AI publish anything on its own?",
    a: "Never. Drafts wait in review, and only assets a human marks Approved can move to scheduling and publishing.",
  },
  {
    q: "Which channels can we publish to?",
    a: "Approved blog posts can publish directly to WordPress. LinkedIn, Instagram, X, and YouTube use Buffer when connected. Paid media and platform comment sync are not yet live.",
  },
  {
    q: "Do we need our own AI key?",
    a: "No. Template mode works without one. Bring your own OpenAI, Anthropic, or Gemini key to unlock full generation.",
  },
  {
    q: "Is our data used to train AI models?",
    a: "No. Your leads, partner details, and internal data are used only for the current request, never for third-party model training.",
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
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <h2
            id="faq-heading"
            className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:sticky lg:top-24"
          >
            Asked before you ask.
          </h2>
        </Reveal>
        <div className="lg:col-span-8">
          <div className="border-t border-border">
            {faqs.map((item, i) => (
              <Reveal key={item.q} delay={i * 40}>
                <details className="group border-b border-border py-5">
                  <DisclosureSummary className="cursor-pointer text-base font-bold leading-snug text-foreground">
                    {item.q}
                  </DisclosureSummary>
                  <p className="mt-3 max-w-[64ch] text-sm leading-7 text-muted-foreground">
                    {item.a}
                  </p>
                </details>
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
      className="relative overflow-hidden bg-primary text-primary-foreground"
    >
      <BrandShapes variant="blue" />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2
            id="close-heading"
            className="max-w-[18ch] text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
          >
            Make the next event the campaign.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-4 max-w-[52ch] text-base leading-7 text-primary-foreground/85">
            Log what happened this week. Walk into Monday with drafts waiting,
            links tracked, and nothing published without your say.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-white px-7 text-base font-semibold text-[var(--ril-blue-deep)] transition-colors duration-200 hover:bg-white/90"
            >
              Get started
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-12 items-center rounded-md border border-white/40 px-7 text-base font-semibold text-white transition-colors duration-200 hover:border-white/70 hover:bg-white/10"
            >
              Sign in
            </Link>
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
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-sm">
            <Link href="/" aria-label="RIL home" className="inline-flex">
              <Image
                src="/logo/blackLogo.svg"
                alt="Renaissance Innovation Labs"
                width={120}
                height={28}
                className="h-auto w-[120px] max-w-none"
                style={{ height: "28px", width: "auto" }}
              />
            </Link>
            <p className="mt-5 text-lg font-bold tracking-tight text-foreground">
              One event in. A whole campaign out.
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
                Get started
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
