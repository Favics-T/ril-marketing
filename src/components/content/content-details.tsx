"use client";
import { useActionState, useState } from "react";
import { saveContentDetails } from "@/actions/content-details";
import { socialPost } from "@/lib/content/social-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ContentDetails({
  assetId,
  updatedAt,
  metadata,
  editable,
  clip = false,
  platform: assetPlatform,
}: {
  assetId: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  editable: boolean;
  clip?: boolean;
  platform?: string | null;
}) {
  const [state, action, pending] = useActionState(
    saveContentDetails.bind(null, assetId),
    null,
  );
  const media = socialPost(metadata);
  const selected = (metadata.clip_edit || metadata.clip || {}) as {
    start?: string;
    end?: string;
    caption?: string;
    platform?: string;
  };
  const versions =
    (
      metadata.clip as
        | { platformVersions?: { platform: string; caption: string }[] }
        | undefined
    )?.platformVersions || [];
  const [platform, setPlatform] = useState(
    selected.platform ||
      (["instagram", "tiktok", "youtube", "linkedin", "x"].includes(
        assetPlatform || "",
      )
        ? assetPlatform!
        : "youtube"),
  );
  const [caption, setCaption] = useState(selected.caption || "");
  return (
    <section className="slip flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-base font-semibold">
        {clip ? "Clip instructions" : "Publishing media"}
      </h2>
      {!editable ? (
        <>
          <p className="text-sm text-muted-foreground">
            Return to Editing to change these details. Any change requires fresh
            approval.
          </p>
          {clip ? (
            <p className="whitespace-pre-wrap text-sm">
              {selected.start || "Start not set"} –{" "}
              {selected.end || "End not set"} · {selected.platform}
              <br />
              {selected.caption}
            </p>
          ) : media.media.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {media.media.map((file) => (
                <li key={file.url}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-primary underline"
                  >
                    {file.type}: {file.url}
                  </a>
                  {file.alt ? <p>{file.alt}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Text-only post. No media is attached.
            </p>
          )}
        </>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="expected_updated_at" value={updatedAt} />
          <input
            type="hidden"
            name="detail_kind"
            value={clip ? "clip_edit" : "social_post"}
          />
          {clip ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Review the source, adjust the range and caption, then request
                review. These are editing instructions; no clip has been
                rendered.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  Start (MM:SS or HH:MM:SS)
                  <Input
                    name="clip_start"
                    defaultValue={selected.start || ""}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  End
                  <Input
                    name="clip_end"
                    defaultValue={selected.end || ""}
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm">
                Platform version
                <select
                  name="clip_platform"
                  value={platform}
                  onChange={(event) => {
                    setPlatform(event.target.value);
                    const version = versions.find(
                      (item) => item.platform === event.target.value,
                    );
                    if (version) setCaption(version.caption);
                  }}
                  className="h-11 rounded-md border border-input bg-card px-3"
                >
                  {["youtube", "instagram", "tiktok", "linkedin", "x"].map(
                    (p) => (
                      <option key={p}>{p}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Caption
                <Textarea
                  name="clip_caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={2200}
                  required
                />
              </label>
              {versions.length ? (
                <p className="text-xs text-muted-foreground">
                  Changing platform loads its suggested caption when available.
                  Review the wording before saving.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Use direct, permanent HTTPS file links. Buffer fetches them when
                the post goes out. Private activity attachments stay private;
                upload a final public copy to your media host first.
              </p>
              <label className="flex flex-col gap-1.5 text-sm">
                Media type
                <select
                  name="media_type"
                  defaultValue={media.media[0]?.type || "image"}
                  className="h-11 rounded-md border border-input bg-card px-3"
                >
                  <option value="image">Images</option>
                  <option value="video">One video</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                File links, one per line
                <Textarea
                  name="media_urls"
                  rows={3}
                  defaultValue={media.media.map((file) => file.url).join("\n")}
                  placeholder="https://your-media-host.com/final-image.jpg"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Image description
                <Input
                  name="media_alt"
                  defaultValue={media.media[0]?.alt || ""}
                  maxLength={1000}
                />
              </label>
              {["instagram", "facebook"].includes(assetPlatform || "") ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  Post format
                  <select
                    name="post_type"
                    defaultValue={media.postType}
                    className="h-11 rounded-md border border-input bg-card px-3"
                  >
                    <option value="post">Post</option>
                    <option value="reel">Reel</option>
                    <option value="story">Story</option>
                  </select>
                </label>
              ) : null}
              {assetPlatform === "youtube" ? (
                <>
                  <label className="flex flex-col gap-1.5 text-sm">
                    YouTube title
                    <Input
                      name="video_title"
                      defaultValue={media.videoTitle}
                      maxLength={100}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    YouTube category
                    <select
                      name="youtube_category"
                      defaultValue={media.youtubeCategory}
                      className="h-11 rounded-md border border-input bg-card px-3"
                    >
                      <option value="27">Education</option>
                      <option value="28">Science & technology</option>
                      <option value="22">People & blogs</option>
                      <option value="29">Nonprofits & activism</option>
                      <option value="26">How-to & style</option>
                      <option value="1">Film & animation</option>
                      <option value="2">Autos & vehicles</option>
                      <option value="10">Music</option>
                      <option value="15">Pets & animals</option>
                      <option value="17">Sports</option>
                      <option value="19">Travel & events</option>
                      <option value="20">Gaming</option>
                      <option value="23">Comedy</option>
                      <option value="24">Entertainment</option>
                      <option value="25">News & politics</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="made_for_kids"
                      defaultChecked={media.madeForKids}
                    />
                    This YouTube video is made for children
                  </label>
                </>
              ) : null}
            </>
          )}
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state?.ok ? (
            <p role="status" className="text-sm">
              {state.message}
            </p>
          ) : null}
          <Button className="w-fit" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save details"}
          </Button>
        </form>
      )}
    </section>
  );
}
