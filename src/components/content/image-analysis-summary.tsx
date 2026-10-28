import type { ReactNode } from "react";
import type { EventTiming, ImageAnalysisV2, ImagePurpose, MissingDetail } from "@/lib/ai/image-analysis-v2";
import { conflictFieldKey, conflictFieldLabel, openConflicts, resolutionMatches, type ConflictField, type ImageConflict } from "@/lib/ai/image-conflicts";

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
const MISSING_LABELS: Record<MissingDetail["detail"], (inRecord: boolean) => string> = {
  date: (inRecord) => inRecord ? "Date: captions use the activity record's date." : "Date: not in the activity record either. Add one so captions can say when it is.",
  venue: () => "Venue: the activity record has no venue, so captions won't name one. Add it to the graphic or the activity description.",
  registration: (inRecord) => inRecord ? "Registration link: captions use the activity record's link." : "Registration link: not in the activity record either. Add one so captions can ask people to register.",
};

const chip = "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[11px] font-semibold leading-4";
const warningChip = `${chip} border-destructive/60 text-destructive`;
const heading = "font-medium text-foreground";

const mentions = (text: string, value: string) => Boolean(value.trim()) && text.toLowerCase().includes(value.trim().toLowerCase());

/** True when a saved analysis is the v2 marketing shape. */
export function isMarketingAnalysis(analysis: Record<string, unknown> | undefined | null): analysis is Record<string, unknown> & ImageAnalysisV2 {
  return analysis?.version === 2;
}

/**
 * What the v2 analysis says about an image, for the person deciding how to
 * use it. `conflictActions` renders the choices for a conflict that's still
 * open; without it the conflicts are shown read-only.
 */
export function ImageAnalysisSummary({ analysis, model, conflictActions }: { analysis: ImageAnalysisV2; model: string; conflictActions?: (conflict: ImageConflict) => ReactNode }) {
  const { onImageText, usability } = analysis;
  // Saved before conflict choices and missing details existed.
  const resolutions = analysis.resolutions ?? [];
  const missing = analysis.missingDetails ?? [];
  const open = openConflicts({ onImageText, resolutions });
  const settled = resolutions.filter((resolution) => !onImageText.conflicts.some((conflict) => resolutionMatches(resolution, conflict)));
  const flags = [
    usability.identifiableFaces ? "Identifiable faces: check consent" : null,
    usability.blurry ? "Blurry" : null,
    usability.smallTextOnMobile ? "Text too small on mobile" : null,
  ].filter((flag): flag is string => Boolean(flag));
  // A note restating a conflict is shown once, in the conflict box.
  const notes = usability.notes.filter((note) => !onImageText.conflicts.some((conflict) => mentions(note, conflict.onImage) && mentions(note, conflict.activityRecord)));
  const conflictFor = (key: ConflictField | null) => key ? onImageText.conflicts.find((conflict) => conflictFieldKey(conflict.field) === key) : undefined;
  const rows: Array<[string, string | null, ConflictField | null]> = [
    ["Event name (detected on image)", onImageText.eventName, "eventName"], ["Date", onImageText.date, "date"], ["Venue", onImageText.venue, "venue"],
    ["Call to action", onImageText.callToAction, null], ["Partners", onImageText.partnerNames.join(", ") || null, "partners"],
  ];
  const details = rows.filter((entry): entry is [string, string, ConflictField | null] => Boolean(entry[1]));
  return (
    <div className="max-w-[64ch] space-y-3 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chip} border-foreground/40 text-foreground`}>{TYPE_LABELS[analysis.imageType]}{analysis.subtype ? ` · ${SUBTYPE_LABELS[analysis.subtype]}` : ""}</span>
        <span className={`${chip} border-foreground/40 text-foreground`}>{PURPOSE_LABELS[analysis.purpose.primary]}</span>
        <span className={`${chip} border-border`}>{TIMING_LABELS[analysis.timing]}</span>
        {open.length ? <span className={warningChip}>Needs resolution</span> : null}
      </div>
      <p>{analysis.purpose.rationale}</p>
      {analysis.purposeRepair ? <p>Purpose changed from {PURPOSE_LABELS[analysis.purposeRepair.from].toLowerCase()}: {analysis.purposeRepair.reason}</p> : null}

      {flags.length || notes.length ? (
        <div className="space-y-1">
          {flags.length ? <ul className="flex flex-wrap gap-1.5" aria-label="Usability checks">{flags.map((flag) => <li key={flag} className={warningChip}>{flag}</li>)}</ul> : null}
          {notes.length ? <ul className="list-disc pl-4">{notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        </div>
      ) : null}

      {onImageText.lines.length || details.length || onImageText.conflicts.length || settled.length ? (
        <section aria-label="Text on the image">
          <p className={heading}>Text on the image</p>
          {onImageText.lines.length ? <ul className="mt-1 space-y-0.5 text-foreground">{onImageText.lines.map((line, index) => <li key={`${index}-${line}`}>&ldquo;{line}&rdquo;</li>)}</ul> : null}
          {details.length ? (
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
              {details.map(([label, value, key]) => {
                const conflict = conflictFor(key);
                return <div key={label} className="contents"><dt>{label}</dt><dd className="text-foreground">{value}{conflict ? <span className="text-destructive"> · activity record: &ldquo;{conflict.activityRecord}&rdquo;</span> : null}</dd></div>;
              })}
            </dl>
          ) : null}
          {onImageText.conflicts.length ? (
            <ul className="mt-2 space-y-1" aria-label="Conflicts with the activity record">
              {onImageText.conflicts.map((conflict, index) => {
                const chosen = resolutions.find((resolution) => resolutionMatches(resolution, conflict));
                return (
                  <li key={`${index}-${conflict.field}`} role="note" className="space-y-1 rounded-[3px] border border-destructive/60 px-2 py-1 text-destructive">
                    <p><span className="font-semibold">{conflictFieldLabel(conflict.field)}:</span> the image says &ldquo;{conflict.onImage}&rdquo;, the activity record says &ldquo;{conflict.activityRecord}&rdquo;.</p>
                    {chosen
                      ? <p>Choice saved: {chosen.choice === "image" ? <>use &ldquo;{chosen.value}&rdquo; from the image.</> : <>activity record updated to &ldquo;{chosen.value}&rdquo;.</>}</p>
                      : <p>Caption drafts are on hold until you choose.</p>}
                    {!chosen && conflictActions ? <div className="flex flex-wrap gap-1.5">{conflictActions(conflict)}</div> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {settled.length ? (
            <ul className="mt-2 space-y-0.5" aria-label="Settled conflicts">
              {settled.map((resolution) => (
                <li key={`${resolution.key}-${resolution.field}`}>
                  {conflictFieldLabel(resolution.field)}: {resolution.choice === "image" ? <>captions use &ldquo;{resolution.value}&rdquo; from the image.</> : <>the activity record was updated to &ldquo;{resolution.value}&rdquo;.</>}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {missing.length ? (
        <section aria-label="Missing from the graphic">
          <p className={heading}>Missing from the graphic</p>
          <ul className="mt-1 list-disc pl-4">{missing.map((item) => <li key={item.detail}>{MISSING_LABELS[item.detail](item.inRecord)}</li>)}</ul>
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

      <p>{open.length ? "Caption drafts are on hold until the conflicts above are resolved" : "Caption drafts are in the Content Library for review"} · {model}</p>
    </div>
  );
}
