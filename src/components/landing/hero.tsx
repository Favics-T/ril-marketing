import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section aria-labelledby="landing-title" className="landing-hero-motion overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:min-h-[620px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-4 lg:py-16">
        <div className="relative z-10 py-5 lg:py-10">
          <h1
            id="landing-title"
            className="max-w-none text-[clamp(3rem,4.7vw,3.8rem)] font-extrabold leading-[1.02] tracking-[-0.055em] text-foreground"
          >
            One event in.
            <span className="mt-2 block text-primary">A whole campaign out.</span>
          </h1>
          <p className="mt-7 max-w-[48ch] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Turn program and event activity into on-brand content, scheduled
            posts, emails, and leads. Your team approves every step.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 items-center gap-3 rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors duration-200 hover:bg-[var(--ril-blue-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Build your workspace
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="#workflow"
              className="inline-flex items-center gap-2 py-3 text-sm font-bold text-foreground"
            >
              Explore the workflow
              <ArrowRight aria-hidden className="size-4 text-primary" />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[550px] lg:max-w-none">
          <Image
            src="/assets/images/ril-hero.png"
            alt="Sculptural blue forms from the Renaissance Innovation Labs visual identity"
            width={561}
            height={712}
            priority
            sizes="(max-width: 1024px) 90vw, 48vw"
            className="relative h-auto max-h-[500px] w-full object-contain lg:max-h-[560px]"
          />
        </div>
      </div>
    </section>
  );
}
