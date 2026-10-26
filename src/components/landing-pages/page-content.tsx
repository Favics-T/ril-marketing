"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { pageContent, publicMediaUrl, videoEmbedUrl } from "@/lib/landing-page-content";
import { PageCopy } from "./page-copy";
import { Button } from "@/components/ui/button";

export function LandingPageContent({ headline, body, metadata, preview = false, ctaLabel }: {
  headline: string; body: string; metadata?: Record<string, unknown> | null; preview?: boolean; ctaLabel?: string;
}) {
  const content = pageContent(metadata);
  const Heading = preview ? "h2" : "h1";
  const image = publicMediaUrl(content.image.url);
  return <div className="campaign-page-content min-w-0 space-y-10 break-words">
    <div>
      <Heading className="max-w-[20ch] text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{headline || "Your page headline"}</Heading>
      {content.description ? <p className="mt-5 max-w-[65ch] text-lg leading-8 text-muted-foreground">{content.description}</p> : null}
      {ctaLabel ? <a href="#register-interest" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{ctaLabel}</a> : null}
    </div>
    {image ? <figure>
      {/* External public media is not proxied through the server or sent workspace credentials. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={content.image.alt} loading="lazy" referrerPolicy="no-referrer" className="h-auto w-full rounded-xl object-contain" />
    </figure> : null}
    {body ? <PageCopy markdown={body} className="max-w-[70ch] text-base leading-8 text-muted-foreground" /> : null}
    {content.benefits.length ? <section aria-label="What you will gain"><h2 className="text-2xl font-bold tracking-tight">What you’ll gain</h2><ul className="mt-5 list-disc space-y-3 pl-5 text-base leading-7">{content.benefits.map((benefit, i) => <li key={i}>{benefit}</li>)}</ul></section> : null}
    {content.programme.length ? <section aria-label="Programme details"><h2 className="text-2xl font-bold tracking-tight">Programme details</h2><dl className="mt-5 divide-y border-y">{content.programme.map((item, i) => <div key={i} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_2fr] sm:gap-5"><dt className="font-semibold">{item.label}</dt><dd className="text-muted-foreground">{item.detail}</dd></div>)}</dl></section> : null}
    {content.video.url ? <PageVideo key={content.video.url} url={content.video.url} title={content.video.title} /> : null}
    {content.testimonials.length ? <section aria-label="Testimonials"><h2 className="text-2xl font-bold tracking-tight">In their words</h2><div className="mt-5 space-y-7">{content.testimonials.map((item, i) => <figure key={i}><blockquote className="text-lg leading-8">“{item.quote}”</blockquote><figcaption className="mt-3 text-sm"><span className="font-semibold">{item.name}</span>{item.role ? <span className="text-muted-foreground"> · {item.role}</span> : null}</figcaption></figure>)}</div></section> : null}
    {content.faqs.length ? <section aria-label="Frequently asked questions"><h2 className="text-2xl font-bold tracking-tight">Your questions, answered</h2><div className="mt-5 divide-y border-y">{content.faqs.map((item, i) => <details key={i} className="py-4"><summary className="cursor-pointer rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.question}</summary><p className="mt-3 whitespace-pre-line text-base leading-7 text-muted-foreground">{item.answer}</p></details>)}</div></section> : null}
  </div>;
}

function PageVideo({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const embed = videoEmbedUrl(url);
  if (!embed) return null;
  return <figure className="space-y-3">
    {loaded ? <iframe src={embed} title={title || "Programme video"} loading="lazy" allow="fullscreen; picture-in-picture" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" className="aspect-video w-full rounded-xl border-0" allowFullScreen /> :
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-muted p-5 text-center"><p className="font-semibold">{title || "Watch the programme video"}</p><Button type="button" variant="outline" onClick={() => setLoaded(true)}><Play className="size-4" aria-hidden="true" />Load video</Button><p className="max-w-sm text-xs leading-5 text-muted-foreground">Playing loads content from {embed.includes("vimeo") ? "Vimeo" : "YouTube"}.</p></div>}
  </figure>;
}
