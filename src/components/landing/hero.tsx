import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  { title: "Keep the source", detail: "Record the programme, event, or partnership with its supporting material." },
  { title: "Shape the message", detail: "Prepare useful drafts for each audience and channel." },
  { title: "Make the decision", detail: "Review the copy and its context before it goes live." },
  { title: "Follow the response", detail: "Connect publishing, registrations, leads, and the next learning." },
];

export function Hero({ signedIn = false }: { signedIn?: boolean }) {
  return <section className="ril-home-hero" aria-labelledby="landing-title">
    <div className="ril-home-hero-main">
      <header className="ril-home-hero-heading">
        <p className="ril-home-eyebrow"><span aria-hidden="true" />The RIL marketing workspace</p>
        <h1 id="landing-title">Good work.<br /><span>A wider audience.</span></h1>
        <p className="ril-home-hero-description">Turn the things your team does into the stories people see. Keep source material, content, reviews, and campaign results in one connected workspace.</p>
        <div className="ril-home-actions"><Button asChild size="lg"><Link href={signedIn ? "/dashboard" : "/sign-up"}>{signedIn ? "Open your workspace" : "Create your workspace"}<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button><Button asChild variant="ghost" size="lg"><Link href="#workflow">Explore the workflow</Link></Button></div>
        <p className="ril-home-hero-note"><Check aria-hidden="true" />AI prepares. A person always approves.</p>
      </header>
      <figure className="ril-home-art"><Image src="/assets/images/ril-hero.png" alt="Blue sculptural forms from the Renaissance Innovation Labs identity" width={561} height={715} sizes="(max-width: 767px) 160px, 320px" priority /><figcaption>Renaissance Innovation Labs</figcaption></figure>
    </div>
    <ol className="ril-home-route" aria-label="From source material to audience learning">{steps.map((step,index)=><li key={step.title}><span className="ril-route-number" aria-hidden="true">0{index+1}</span><div><h2>{step.title}</h2><p>{step.detail}</p></div>{index < steps.length - 1 ? <ArrowRight className="ril-route-arrow" aria-hidden="true" /> : null}</li>)}</ol>
  </section>;
}
