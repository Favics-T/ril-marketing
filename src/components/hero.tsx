import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ClipboardCheck, FileText, LayoutDashboard, CalendarDays, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  { title: "Capture the source", detail: "Activity, audience, files and context", icon: FileText },
  { title: "Prepare the content", detail: "Channel drafts grounded in your work", icon: LayoutDashboard },
  { title: "Your team reviews", detail: "Edit, approve or send back for changes", icon: ClipboardCheck },
];

export function HeroSection({ signedIn = false }: { signedIn?: boolean }) {
  return <section className="efferd-product-hero" aria-labelledby="product-hero-heading">
    <div className="efferd-hero-copy">
      <Link href="#workflow" className="efferd-hero-announcement"><ClipboardCheck aria-hidden="true" className="size-4" /><span>Human approval at every release</span><ArrowRight aria-hidden="true" className="size-3.5" /></Link>
      <h1 id="product-hero-heading">The work behind<br />every campaign.</h1>
      <p className="efferd-hero-intro">Turn your programs, events and partnerships into content your team can review, publish and learn from. One workspace, with a person behind every decision.</p>
      <div className="efferd-hero-actions">
        <Button asChild size="lg"><Link href={signedIn ? "/dashboard" : "/sign-up"}>{signedIn ? "Open workspace" : "Create your workspace"}<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="#platform">Explore the platform</Link></Button>
      </div>
      <p className="efferd-hero-note">AI prepares the draft. Your team decides what goes live.</p>
    </div>
    <figure className="efferd-hero-preview">
      <div className="efferd-preview-frame" aria-hidden="true">
        <div className="efferd-preview-toolbar"><span className="efferd-preview-window-marks"><i /><i /><i /></span><span>RIL Marketing Workspace</span><span className="efferd-preview-toolbar-label">Workflow preview</span></div>
        <div className="efferd-preview-workspace">
          <div className="efferd-preview-sidebar">
            <Image src="/logo/whiteLogo.svg" alt="" width={116} height={52} className="h-9 w-auto" />
            <div className="efferd-preview-navigation"><span className="is-selected"><LayoutDashboard />Command Centre</span><span><ClipboardCheck />Approvals</span><span><FileText />Content Library</span><span><CalendarDays />Calendar</span><span><Users />Audience</span></div>
            <p>Human approval, always</p>
          </div>
          <div className="efferd-preview-main">
            <div className="efferd-preview-heading"><div><p>From activity to impact</p><h2>A clear next step.</h2></div><span className="efferd-preview-review-label"><ClipboardCheck />Review before release</span></div>
            <div className="efferd-preview-columns">
              <div className="efferd-preview-source"><h3>The source stays attached</h3><p>Your activity becomes the brief. Keep the audience, files and context alongside every draft.</p><div className="efferd-preview-source-line"><FileText /><span>Activity & source material</span><Check /></div><div className="efferd-preview-source-line"><Users /><span>Audience & brand guidance</span><Check /></div><div className="efferd-preview-source-line"><ClipboardCheck /><span>Named human decision</span><Check /></div></div>
              <ol className="efferd-preview-steps">{steps.map(({ title, detail, icon: Icon }) => <li key={title}><span className="efferd-preview-step-icon"><Icon /></span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol>
            </div>
            <div className="efferd-preview-release"><span><Check />Approve the content</span><ArrowRight /><span><CalendarDays />Publish and follow up</span></div>
            <p className="efferd-preview-footer">Approval opens the next step. It never silently publishes or sends.</p>
          </div>
        </div>
      </div>
      <figcaption>Illustrative workspace preview. Your content stays private.</figcaption>
    </figure>
  </section>;
}
