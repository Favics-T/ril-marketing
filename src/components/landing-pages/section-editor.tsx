"use client";

import { Plus, Trash2 } from "lucide-react";
import type { LandingPageContent } from "@/lib/landing-page-content";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";

export function SectionEditor({ content, onChange }: { content: LandingPageContent; onChange: (content: LandingPageContent) => void }) {
  return <div className="divide-y border-y">
    <details><DisclosureSummary className="py-4">Benefits{content.benefits.length ? ` · ${content.benefits.length}` : ""}</DisclosureSummary><div className="space-y-3 pb-5">
      {content.benefits.map((value, i) => <div key={i} className="flex items-start gap-2"><label className="flex-1 space-y-1 text-sm">Benefit {i + 1}<Input value={value} maxLength={240} onChange={e => onChange({ ...content, benefits: content.benefits.map((v, j) => j === i ? e.target.value : v) })} /></label><Remove label={`Remove benefit ${i + 1}`} onClick={() => onChange({ ...content, benefits: content.benefits.filter((_, j) => j !== i) })} /></div>)}
      <Add label="Add benefit" disabled={content.benefits.length >= 8} onClick={() => onChange({ ...content, benefits: [...content.benefits, ""] })} />
    </div></details>
    <details><DisclosureSummary className="py-4">Programme details{content.programme.length ? ` · ${content.programme.length}` : ""}</DisclosureSummary><div className="space-y-4 pb-5">
      <p className="text-sm text-muted-foreground">Add the practical details visitors need, such as dates, venue or eligibility.</p>
      {content.programme.map((item, i) => <fieldset key={i} className="space-y-2"><legend className="text-sm font-semibold">Detail {i + 1}</legend><div className="flex items-start gap-2"><div className="grid flex-1 gap-2 sm:grid-cols-2"><label className="space-y-1 text-sm">Label<Input value={item.label} maxLength={80} onChange={e => onChange({ ...content, programme: content.programme.map((v, j) => j === i ? { ...v, label: e.target.value } : v) })} /></label><label className="space-y-1 text-sm">Details<Input value={item.detail} maxLength={300} onChange={e => onChange({ ...content, programme: content.programme.map((v, j) => j === i ? { ...v, detail: e.target.value } : v) })} /></label></div><Remove label={`Remove detail ${i + 1}`} onClick={() => onChange({ ...content, programme: content.programme.filter((_, j) => j !== i) })} /></div></fieldset>)}
      <Add label="Add programme detail" disabled={content.programme.length >= 8} onClick={() => onChange({ ...content, programme: [...content.programme, { label: "", detail: "" }] })} />
    </div></details>
    <details><DisclosureSummary className="py-4">Image &amp; video</DisclosureSummary><div className="grid gap-4 pb-5">
      <p className="text-sm leading-6 text-muted-foreground">Use media you have permission to share publicly. Private activity and library files stay private.</p>
      <label className="space-y-1 text-sm">Image link<Input type="url" value={content.image.url} placeholder="https://…" maxLength={1000} onChange={e => onChange({ ...content, image: { ...content.image, url: e.target.value } })} /></label>
      <label className="space-y-1 text-sm">Image description<Input value={content.image.alt} maxLength={200} onChange={e => onChange({ ...content, image: { ...content.image, alt: e.target.value } })} /><span className="text-xs text-muted-foreground">Describe what the image shows for visitors using a screen reader.</span></label>
      <label className="space-y-1 text-sm">YouTube or Vimeo link<Input type="url" value={content.video.url} placeholder="https://www.youtube.com/watch?v=…" maxLength={1000} onChange={e => onChange({ ...content, video: { ...content.video, url: e.target.value } })} /></label>
      <label className="space-y-1 text-sm">Video title<Input value={content.video.title} maxLength={160} onChange={e => onChange({ ...content, video: { ...content.video, title: e.target.value } })} /></label>
    </div></details>
    <details><DisclosureSummary className="py-4">Testimonials{content.testimonials.length ? ` · ${content.testimonials.length}` : ""}</DisclosureSummary><div className="space-y-5 pb-5">
      <p className="text-sm leading-6 text-muted-foreground">Only use real quotes with permission from the person quoted.</p>
      {content.testimonials.map((item, i) => <fieldset key={i} className="space-y-3"><legend className="text-sm font-semibold">Testimonial {i + 1}</legend><label className="block space-y-1 text-sm">Quote<Textarea value={item.quote} maxLength={1000} rows={3} onChange={e => onChange({ ...content, testimonials: content.testimonials.map((v, j) => j === i ? { ...v, quote: e.target.value } : v) })} /></label><div className="grid gap-3 sm:grid-cols-2">{(["name", "role"] as const).map(key => <label key={key} className="space-y-1 text-sm">{key === "name" ? "Name" : "Role or organisation (optional)"}<Input value={item[key]} maxLength={key === "name" ? 120 : 160} onChange={e => onChange({ ...content, testimonials: content.testimonials.map((v, j) => j === i ? { ...v, [key]: e.target.value } : v) })} /></label>)}</div><Remove label={`Remove testimonial ${i + 1}`} onClick={() => onChange({ ...content, testimonials: content.testimonials.filter((_, j) => j !== i) })} /></fieldset>)}
      <Add label="Add testimonial" disabled={content.testimonials.length >= 6} onClick={() => onChange({ ...content, testimonials: [...content.testimonials, { quote: "", name: "", role: "" }] })} />
    </div></details>
    <details><DisclosureSummary className="py-4">Frequently asked questions{content.faqs.length ? ` · ${content.faqs.length}` : ""}</DisclosureSummary><div className="space-y-5 pb-5">
      {content.faqs.map((item, i) => <fieldset key={i} className="space-y-3"><legend className="text-sm font-semibold">Question {i + 1}</legend><label className="block space-y-1 text-sm">Question<Input value={item.question} maxLength={200} onChange={e => onChange({ ...content, faqs: content.faqs.map((v, j) => j === i ? { ...v, question: e.target.value } : v) })} /></label><label className="block space-y-1 text-sm">Answer<Textarea value={item.answer} maxLength={1500} rows={3} onChange={e => onChange({ ...content, faqs: content.faqs.map((v, j) => j === i ? { ...v, answer: e.target.value } : v) })} /></label><Remove label={`Remove question ${i + 1}`} onClick={() => onChange({ ...content, faqs: content.faqs.filter((_, j) => j !== i) })} /></fieldset>)}
      <Add label="Add question" disabled={content.faqs.length >= 10} onClick={() => onChange({ ...content, faqs: [...content.faqs, { question: "", answer: "" }] })} />
    </div></details>
  </div>;
}

function Add({ label, ...props }: { label: string; disabled: boolean; onClick: () => void }) {
  return <Button type="button" variant="outline" size="sm" {...props}><Plus className="size-4" aria-hidden="true" />{label}</Button>;
}
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="sm" aria-label={label} title={label} onClick={onClick}><Trash2 className="size-4" aria-hidden="true" /></Button>;
}
