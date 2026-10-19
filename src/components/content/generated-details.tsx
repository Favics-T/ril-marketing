import { RichText } from "@/components/ui/rich-text";

export function GeneratedDetails({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  const structured = metadata.structured as Record<string, unknown> | undefined;
  const outline = Array.isArray(structured?.outline)
    ? structured.outline.filter((row): row is string => typeof row === "string")
    : [];
  const subjects = Array.isArray(metadata.subject_lines)
    ? metadata.subject_lines.filter(
        (row): row is string => typeof row === "string",
      )
    : [];
  const flags = Array.isArray(metadata.quality_flags)
    ? (metadata.quality_flags as { message?: string }[])
    : [];
  const links = Array.isArray(structured?.internalLinkSuggestions)
    ? (structured.internalLinkSuggestions as {
        anchorText?: string;
        suggestedPath?: string;
        reason?: string;
      }[])
    : [];
  const source = metadata.source_snapshot as
    | {
        revision?: number;
        summary?: string;
        transcript?: string;
        manual?: boolean;
      }
    | undefined;
  if (
    !outline.length &&
    !subjects.length &&
    !flags.length &&
    !links.length &&
    !source
  )
    return null;
  return (
    <section className="border-t border-border px-5 py-5 sm:px-6">
      <h2 className="text-base font-semibold">Generation details for review</h2>
      {flags.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Check before approval</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {flags.map((flag, index) => (
              <li key={index}>{flag.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {subjects.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Subject line options</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {subjects.map((subject) => (
              <li key={subject}>{subject}</li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-muted-foreground">
            Preview text:{" "}
            {typeof metadata.preview_text === "string"
              ? metadata.preview_text
              : "Not supplied"}
            . The asset title is the selected email subject; edit it before
            review to choose another.
          </p>
        </div>
      ) : null}
      {outline.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Blog outline
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {outline.map((heading, index) => (
              <li key={index}>{heading}</li>
            ))}
          </ol>
        </details>
      ) : null}
      {links.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Suggested internal links</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirm each destination before adding it to the article.
          </p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {links.map((link, index) => (
              <li key={index} className="break-words">
                {link.anchorText} → {link.suggestedPath}
                <br />
                {link.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {source?.summary ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Source snapshot · revision {source.revision}
            {source.manual ? " · supplied manually" : ""}
          </summary>
          <div className="mt-3">
            <RichText>{source.summary}</RichText>
          </div>
          {source.transcript ? (
            <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {source.transcript}
            </p>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
