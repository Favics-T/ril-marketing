import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMotif } from "@/components/brand-motif";

const steps = [
  { title: "Capture", detail: "Start with your real activity" },
  { title: "Create", detail: "Give the source a new format" },
  { title: "Decide", detail: "Review before anything goes live" },
  { title: "Connect", detail: "Publish, follow up, and learn" },
];

export function Hero() {
  return <section className="ril-home-hero" aria-labelledby="landing-title">
    <div className="ril-home-hero-copy">
      <p className="ril-home-eyebrow">Renaissance Innovation Labs · Marketing workspace</p>
      <h1 id="landing-title">One event in.<br /><span>A whole campaign out.</span></h1>
      <p>Bring your activities, audience, and ideas together. Create the next draft, make the next decision, and keep your whole campaign connected.</p>
      <div className="ril-home-actions"><Link href="/sign-up" className="ril-primary-link">Create your workspace<ArrowRight aria-hidden="true" /></Link><Link href="#workflow" className="ril-text-link">See how it works<ArrowRight aria-hidden="true" /></Link></div>
      <p className="ril-home-hero-note">AI prepares the work. Your team has the final say.</p>
    </div>
    <div className="ril-home-studio" aria-label="How work moves through RIL">
      <div className="ril-studio-flow">
        <div className="ril-studio-heading"><BrandMotif name="momentum" /><span>From activity to audience</span></div>
        <article className="ril-studio-source"><span className="ril-studio-label">The starting point</span><h2>Something worth sharing.</h2><p>A programme, an event, a partnership. Keep the context and source material in one place.</p></article>
        <div className="ril-studio-next"><ArrowRight aria-hidden="true" /><span>Shape it for each channel</span></div>
        <div className="ril-studio-outputs"><span>Blog draft</span><span>Newsletter</span><span>Social copy</span></div>
        <p className="ril-studio-approval">Review together. Publish with a person’s approval.</p>
      </div>
      <figure className="ril-home-art"><Image src="/assets/images/ril-hero.png" alt="Sculptural blue forms from the Renaissance Innovation Labs identity" width={561} height={715} priority sizes="(max-width: 767px) 240px, 280px" /><figcaption>Room for ideas.<br />A clear way forward.</figcaption></figure>
    </div>
    <ol className="ril-home-route" aria-label="The marketing workflow">{steps.map((step,index) => <li key={step.title}><span className="ril-route-number" aria-hidden="true">0{index + 1}</span><div><h2>{step.title}</h2><p>{step.detail}</p></div></li>)}</ol>
  </section>;
}