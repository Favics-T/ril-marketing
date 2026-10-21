import type { EventTiming, ImageAnalysisV2, ImagePurpose } from "@/lib/ai/image-analysis-v2";

const TYPE_LABELS: Record<ImageAnalysisV2["imageType"], string> = {
  event_photo: "Event photo", graphic_design: "Graphic design", certificate_award: "Certificate or award", product_screenshot: "Product screenshot", other: "Other image",
};
const SUBTYPE_LABELS: Record<NonNullable<ImageAnalysisV2["subtype"]>, string> = {
  speaker: "speaker", crowd: "crowd", group: "group", workshop_in_action: "workshop in action", flyer: "flyer", poster: "poster", announcement: "announcement", quote_card: "quote card",
};
const PURPOSE_LABELS: Record<ImagePurpose, string> = {
  announce_upcoming: "Announce upcoming event", recap_past_event: "Recap past event", highlight_speaker_or_partner: "Highlight a speaker or partner",
  drive_registrations: "Drive registrations", celebrate_outcome: "Celebrate an outcome", behind_the_scenes: "Behind the scenes",
};
const TIMING_LABELS: Record<EventTiming, string> = { upcoming: "Upcoming", today: "Today", past: "Past", unknown: "No event date" };
const USE_LABELS: Record<ImageAnalysisV2["otherUses"][number]["use"], string> = {
  blog_header: "Blog header", newsletter_feature: "Newsletter feature", carousel_slide: "Carousel slide", website_banner: "Website banner",
};

const chip = "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[11px] font-semibold leading-4";
const warningChip = `${chip} border-destructive/60 text-destructive`;
const heading = "font-medium text-foreground";

/** True when a saved analysis is the v2 marketing shape. */
export function isMarketingAnalysis(analysis: Record<string, unknown> | undefined | null): analysis is Record<string, unknown> & ImageAnalysisV2 {
  return analysis?.version === 2;
}

/** What the v2 analysis says about an image, for the person deciding how to use it. */
export function ImageAnalysisSummary({ analysis, model }: { analysis: ImageAnalysisV2; model: string }) {
  const { onImageText, usability } = analysis;
  const flags = [
    usability.identifiableFaces ? "Identifiable faces: check consent" : null,
    usability.blurry ? "Blurry" : null,
    usability.smallTextOnMobile ? "Text too small on mobile" : null,
  ].filter((flag): flag is string => Boolean(flag));
  const details = [
    ["Event name", onImageText.eventName], ["Date", onImageText.date], ["Venue", onImageText.venue], ["Call to action", onImageText.callToAction],
    ["Partners", onImageText.partnerNames.join(", ") || null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <div className="max-w-[64ch] space-y-3 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chip} border-foreground/40 text-foreground`}>{TYPE_LABELS[analysis.imageType]}{analysis.subtype ? ` · ${SUBTYPE_LABELS[analysis.subtype]}` : ""}</span>
        <span className={`${chip} border-foreground/40 text-foreground`}>{PURPOSE_LABELS[analysis.purpose.primary]}</span>
        <span className={`${chip} border-border`}>{TIMING_LABELS[analysis.timing]}</span>
      </div>
      <p>{analysis.purpose.rationale}</p>
      {analysis.purposeRepair ? <p>Purpose changed from {PURPOSE_LABELS[analysis.purposeRepair.from].toLowerCase()}: {analysis.purposeRepair.reason}</p> : null}

      {flags.length || usability.notes.length ? (
        <div className="space-y-1">
          {flags.length ? <ul className="flex flex-wrap gap-1.5" aria-label="Usability checks">{flags.map((flag) => <li key={flag} className={warningChip}>{flag}</li>)}</ul> : null}
          {usability.notes.length ? <ul className="list-disc pl-4">{usability.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        </div>
      ) : null}

      {onImageText.lines.length || details.length || onImageText.conflicts.length ? (
        <section aria-label="Text on the image">
          <p className={heading}>Text on the image</p>
          {onImageText.lines.length ? <ul className="mt-1 space-y-0.5 text-foreground">{onImageText.lines.map((line, index) => <li key={`${index}-${line}`}>&ldquo;{line}&rdquo;</li>)}</ul> : null}
          {details.length ? <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">{details.map(([label, value]) => <div key={label} className="contents"><dt>{label}</dt><dd className="text-foreground">{value}</dd></div>)}</dl> : null}
          {onImageText.conflicts.length ? (
            <ul className="mt-2 space-y-1" aria-label="Conflicts with the activity record">
              {onImageText.conflicts.map((conflict, index) => (
                <li key={`${index}-${conflict.field}`} role="note" className="rounded-[3px] border border-destructive/60 px-2 py-1 text-destructive">
                  <span className="font-semibold">{conflict.field}:</span> the image says &ldquo;{conflict.onImage}&rdquo;, the activity record says &ldquo;{conflict.activityRecord}&rdquo;. Captions use the activity record.
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Content angles">
        <p className={heading}>Content angles</p>
        <ol className="mt-1 list-decimal space-y-1 pl-4">
          {analysis.angles.map((angle, index) => <li key={`${index}-${angle.title}`}><span className="text-foreground">{angle.title}</span>: {angle.angle}{angle.groundedIn.length ? <span> · from {angle.groundedIn.join(", ")}</span> : null}</li>)}
        </ol>
      </section>

      <section aria-label="Alt text">
        <p className="flex flex-wrap items-center gap-1.5"><span className={heading}>Alt text</span><span className={warningChip}>Needs human check</span></p>
        <p className="mt-1 text-foreground">{analysis.altText}</p>
      </section>

      {analysis.otherUses.length ? (
        <section aria-label="Other uses">
          <p className={heading}>Other uses</p>
          <ul className="mt-1 list-disc pl-4">{analysis.otherUses.map((use) => <li key={use.use}>{USE_LABELS[use.use]}{use.note ? `: ${use.note}` : ""}</li>)}</ul>
        </section>
      ) : null}

      <p>Caption drafts are in the Content Library for review · {model}</p>
    </div>
  );
}
