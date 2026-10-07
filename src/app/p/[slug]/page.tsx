import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedLandingPage } from "@/lib/landing-pages";
import { publicLandingPagePath } from "@/lib/landing-page-url";
import { LeadCaptureForm } from "@/components/landing-pages/lead-capture-form";
import { PageCopy } from "@/components/landing-pages/page-copy";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingPage(slug).catch(() => null);
  if (!page) return { title: "Page not found" };
  return {
    title: page.title,
    description: page.meta_description || page.headline,
    alternates: { canonical: publicLandingPagePath(page) },
    robots: { index: true, follow: true },
    openGraph: { title: page.title, description: page.meta_description || page.headline, type: "website", url: publicLandingPagePath(page) },
    twitter: { card: "summary", title: page.title, description: page.meta_description || page.headline },
  };
}

export default async function PublicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedLandingPage(slug).catch(() => null);
  if (!page) notFound();
  return (
    <main id="main" className="published-page min-h-dvh bg-muted/30 text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-border/80 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Renaissance Innovation Labs home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={100} height={45} unoptimized className="h-9 w-auto dark:hidden" /><Image src="/logo/whiteLogo.svg" alt="Renaissance Innovation Labs" width={176} height={79} unoptimized className="hidden h-9 w-auto dark:block" /></Link>
        <span className="dateline hidden sm:inline">From Renaissance Innovation Labs</span>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        <article className="max-w-3xl">
          <p className="dateline">{page.title}</p>
          <h1 className="mt-4 max-w-[18ch] text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">{page.headline}</h1>
          {page.body ? <PageCopy markdown={page.body} className="mt-8 text-base leading-8 text-muted-foreground sm:text-lg" /> : null}
          {page.registration_url ? <a href={page.registration_url} target="_blank" rel="noreferrer" className="mt-8 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">View registration details</a> : null}
        </article>
        <aside className="h-fit rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-7 lg:sticky lg:top-8">
          <p className="dateline">Get in touch</p>
          <h2 className="mt-1 text-balance text-xl font-bold tracking-tight">{page.cta_label}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Share your details and the RIL team can follow up.</p>
          <div className="mt-5"><LeadCaptureForm page={page} pageKey={publicLandingPagePath(page).slice(3)} /></div>
        </aside>
      </div>
      <footer className="mx-auto max-w-6xl border-t border-border/80 px-5 py-5 text-xs text-muted-foreground sm:px-8">Renaissance Innovation Labs</footer>
    </main>
  );
}
