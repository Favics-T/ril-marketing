import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedLandingPage } from "@/lib/landing-pages";
import {
  leadFormPage,
  publicLandingPagePath,
  safeRegistrationUrl,
} from "@/lib/landing-page-url";
import { LeadCaptureForm } from "@/components/landing-pages/lead-capture-form";
import { LandingPageContent } from "@/components/landing-pages/page-content";
import { pageContent } from "@/lib/landing-page-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingPage(slug).catch(() => null);
  if (!page) return { title: "Page not found" };
  // The headline, never the internal page name, titles the public page and its link previews.
  const description = page.meta_description || pageContent(page.metadata).description || page.headline;
  return {
    title: page.headline,
    description,
    alternates: { canonical: publicLandingPagePath(page) },
    robots: { index: true, follow: true },
    openGraph: {
      title: page.headline,
      description,
      type: "website",
      url: publicLandingPagePath(page),
    },
    twitter: { card: "summary", title: page.headline, description },
  };
}

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublishedLandingPage(slug).catch(() => null);
  if (!page) notFound();
  const registrationUrl = safeRegistrationUrl(page.registration_url);
  return (
    <main
      id="main"
      className="published-page glass-campaign min-h-dvh bg-background text-foreground"
    >
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between px-5 py-6 sm:px-8">
        <Link
          href="/"
          aria-label="Renaissance Innovation Labs home"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={100} height={45} unoptimized className="h-10 w-auto" />
        </Link>
        <Button asChild variant="outline" className="published-header-action h-auto max-w-56 whitespace-normal py-3"><a href="#register-interest">{page.cta_label}</a></Button>
      </header>
      <div className="published-page-layout mx-auto grid gap-8 px-5 py-10 sm:px-8 sm:py-16">
        <article className="published-page-story min-w-0 max-w-3xl">
          <LandingPageContent headline={page.headline} body={page.body} metadata={page.metadata} ctaLabel={page.cta_label} />
          {registrationUrl ? (
            <a
              href={registrationUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              View registration details
            </a>
          ) : null}
        </article>
        <Card asChild><aside id="register-interest" className="published-page-contact h-fit scroll-mt-8 bg-card lg:sticky lg:top-8">
          <CardHeader><p className="dateline">Your next step</p>
          <CardTitle asChild><h2 className="mt-1 text-balance text-xl font-bold tracking-tight">
            {page.cta_label}
          </h2></CardTitle>
          <CardDescription asChild><p className="mt-1 text-sm leading-6 text-muted-foreground">
            Share your details and the RIL team can follow up.
          </p></CardDescription></CardHeader>
          <CardContent>
            <LeadCaptureForm
              page={leadFormPage(page)}
              pageKey={publicLandingPagePath(page).slice(3)}
            />
          </CardContent>
        </aside></Card>
      </div>
      <footer className="mx-auto max-w-6xl border-t border-border/80 px-5 py-5 text-xs text-muted-foreground sm:px-8">
        Renaissance Innovation Labs
      </footer>
    </main>
  );
}
