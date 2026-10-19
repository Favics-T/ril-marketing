"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRepurposingSource,
  runRepurposing,
  saveSourceSummary,
} from "@/actions/repurposing";
import { NEWSLETTER_STYLES, REPURPOSE_KINDS } from "@/lib/ai/types";
import {
  SOURCE_KINDS,
  type RepurposingSource,
} from "@/lib/content/repurposing-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const selectClass = "h-11 rounded-md border border-input bg-card px-3 text-sm";
const field = "flex flex-col gap-1.5 text-sm";
export function SourceCreateForm({
  activities,
  files,
  initialActivity = "",
  initialAttachment = "",
}: {
  activities: Array<{ id: string; title: string }>;
  files: Array<{ id: string; activity_id: string; file_name: string }>;
  initialActivity?: string;
  initialAttachment?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState(
    initialAttachment ? "attachment" : "activity",
  );
  const [activity, setActivity] = useState(initialActivity);
  const [state, action, pending] = useActionState(
    createRepurposingSource,
    null,
  );
  useEffect(() => {
    if (state?.ok && state.id) router.push(`/repurpose/${state.id}`);
  }, [state, router]);
  return (
    <form action={action} className="slip flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Start with one source</h2>
      <label className={field}>
        Source title
        <Input
          name="title"
          required
          minLength={2}
          maxLength={200}
          placeholder="Name this recording, article or activity"
        />
      </label>
      <label className={field}>
        Source type
        <select
          name="source_kind"
          className={selectClass}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {SOURCE_KINDS.map((value) => (
            <option key={value} value={value}>
              {
                {
                  activity: "Activity and its source material",
                  attachment: "Attached video, audio, image or document",
                  url: "Public URL",
                  transcript: "Paste a transcript",
                  summary: "Write a manual summary",
                }[value]
              }
            </option>
          ))}
        </select>
      </label>
      {["activity", "attachment"].includes(kind) ? (
        <label className={field}>
          Activity
          <select
            name="activity_id"
            className={selectClass}
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            required
          >
            <option value="">Choose an activity</option>
            {activities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "attachment" ? (
        <label className={field}>
          Private source file
          <select
            key={activity}
            name="attachment_id"
            className={selectClass}
            defaultValue={initialAttachment}
            required
          >
            <option value="">Choose an attached file</option>
            {files
              .filter((file) => file.activity_id === activity)
              .map((file) => (
                <option key={file.id} value={file.id}>
                  {file.file_name}
                </option>
              ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Attach files on the activity page first. Recordings support up to 14
            MB; documents support up to 8 MB and PDF sources up to 25 pages.
          </span>
        </label>
      ) : null}
      {kind === "url" ? (
        <label className={field}>
          Public HTTPS URL
          <Input
            name="source_url"
            type="url"
            required
            placeholder="https://…"
          />
          <span className="text-xs text-muted-foreground">
            Use a direct article, image, document or recording URL. Pages
            requiring a login and social video watch pages need a transcript
            instead.
          </span>
        </label>
      ) : null}
      {["transcript", "summary"].includes(kind) ? (
        <label className={field}>
          {kind === "transcript" ? "Transcript" : "Manual summary"}
          <Textarea
            name="input_text"
            rows={8}
            minLength={30}
            maxLength={50000}
            required
            placeholder="Include what was said, the context, supported facts and any real timestamps."
          />
        </label>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">
          Create drafts for
        </legend>
        {REPURPOSE_KINDS.map((item) => (
          <label
            key={item.kind}
            className="flex min-h-9 items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              name="kinds"
              value={item.kind}
              defaultChecked
            />
            {item.label}
          </label>
        ))}
        <p className="text-xs leading-5 text-muted-foreground">
          The social pack contains distinct LinkedIn, Instagram, X, YouTube and
          TikTok drafts. Short-form suggestions are only returned when the
          source supports them.
        </p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>
          Newsletter style
          <select
            name="newsletter_style"
            className={selectClass}
            defaultValue="event_recap"
          >
            {NEWSLETTER_STYLES.map((style) => (
              <option key={style} value={style}>
                {style.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Tone
          <Input
            name="tone"
            maxLength={120}
            placeholder="e.g. practical and clear"
          />
        </label>
        <label className={field}>
          SEO focus keyword
          <Input name="seo_keyword" maxLength={80} />
        </label>
        <label className={field}>
          Call to action
          <Input name="cta" maxLength={200} />
        </label>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Saving creates an Idea. AI processing starts only when you choose
        Generate on the next page. All output stays AI generated until a person
        reviews it.
      </p>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button className="w-fit" type="submit" disabled={pending}>
        {pending ? "Saving source…" : "Save source Idea"}
      </Button>
    </form>
  );
}
export function SourceRunControls({ source }: { source: RepurposingSource }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [summary, saveSummary, saving] = useActionState(
    saveSourceSummary.bind(null, source.id),
    null,
  );
  const active = source.status === "processing";
  return (
    <section className="slip flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-base font-semibold">Generate and recover</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        {active
          ? "A run is processing this source. Refresh to see its result. Interrupted runs can be retried after ten minutes."
          : "Extraction is saved before generation. If a format fails, saved drafts are kept and retries fill missing outputs."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || saving || source.status === "completed"}
          onClick={() =>
            start(async () => {
              setResult(null);
              const next = await runRepurposing(source.id);
              setResult(next);
              router.refresh();
            })
          }
        >
          {pending
            ? "Extracting and generating…"
            : active
              ? "Check / retry run"
              : source.error
                ? "Retry generation"
                : "Generate drafts"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || saving}
          onClick={() => router.refresh()}
        >
          Refresh source
        </Button>
      </div>
      {source.error ? (
        <p role="alert" className="text-sm text-destructive">
          Source remains an Idea: {source.error}
        </p>
      ) : null}
      {result?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : null}
      {result?.ok ? (
        <p role="status" className="text-sm">
          {result.message}
        </p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Use a transcript or manual summary instead
        </summary>
        <form action={saveSummary} className="mt-3 flex flex-col gap-3">
          <input
            type="hidden"
            name="expected_updated_at"
            value={source.updated_at}
          />
          <label className={field}>
            Source text for a new revision
            <Textarea
              name="manual_summary"
              minLength={30}
              maxLength={50000}
              rows={6}
              defaultValue={source.manual_summary || source.input_text}
              required
            />
          </label>
          <p className="text-xs text-muted-foreground">
            This replaces the input for the next run. Earlier drafts stay in the
            library with their original source revision.
          </p>
          {summary?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {summary.error}
            </p>
          ) : null}
          {summary?.ok ? (
            <p role="status" className="text-sm">
              {summary.message}
            </p>
          ) : null}
          <Button className="w-fit" type="submit" disabled={saving || pending}>
            {saving ? "Saving…" : "Save new source revision"}
          </Button>
        </form>
      </details>
    </section>
  );
}
