"use client";
import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { Card as ShadcnCard } from "@/components/ui/card";
import { FieldGroup as ShadcnFieldGroup, FieldLabel as ShadcnFieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { NativeSelect as ShadcnNativeSelect, NativeSelectOption as ShadcnNativeSelectOption } from "@/components/ui/native-select";
import { Alert as ShadcnAlert } from "@/components/ui/alert";

import { ChannelIdentity } from "@/components/channel-identity";
import { ChannelSelect } from "@/components/channel-select";
import { channelLabel } from "@/lib/channels";
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
    <ShadcnCard asChild><section className="slip flex flex-col gap-4 p-5 sm:p-6">
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
              {selected.end || "End not set"} · <ChannelIdentity channel={selected.platform} />
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
        <ShadcnFieldGroup asChild><form action={action} className="flex flex-col gap-3">
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
                <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                  Start (MM:SS or HH:MM:SS)
                  <Input
                    name="clip_start"
                    defaultValue={selected.start || ""}
                    required
                  />
                </ShadcnFieldLabel></ShadcnField>
                <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                  End
                  <Input
                    name="clip_end"
                    defaultValue={selected.end || ""}
                    required
                  />
                </ShadcnFieldLabel></ShadcnField>
              </div>
              <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                Platform version
                <ChannelSelect name="clip_platform" value={platform} onValueChange={next => {
                  setPlatform(next);
                  const version = versions.find(item => item.platform === next);
                  if (version) setCaption(version.caption);
                }} options={["youtube", "instagram", "tiktok", "linkedin", "x"].map(value => [value, channelLabel(value)] as const)} />
              </ShadcnFieldLabel></ShadcnField>
              <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                Caption
                <Textarea
                  name="clip_caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={2200}
                  required
                />
              </ShadcnFieldLabel></ShadcnField>
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
              <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                Media type
                <ShadcnNativeSelect
                  name="media_type"
                  defaultValue={media.media[0]?.type || "image"}
                  className=""
                >
                  <ShadcnNativeSelectOption value="image">Images</ShadcnNativeSelectOption>
                  <ShadcnNativeSelectOption value="video">One video</ShadcnNativeSelectOption>
                </ShadcnNativeSelect>
              </ShadcnFieldLabel></ShadcnField>
              <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                File links, one per line
                <Textarea
                  name="media_urls"
                  rows={3}
                  defaultValue={media.media.map((file) => file.url).join("\n")}
                  placeholder="https://your-media-host.com/final-image.jpg"
                />
              </ShadcnFieldLabel></ShadcnField>
              <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                Image description
                <Input
                  name="media_alt"
                  defaultValue={media.media[0]?.alt || ""}
                  maxLength={1000}
                />
              </ShadcnFieldLabel></ShadcnField>
              {["instagram", "facebook"].includes(assetPlatform || "") ? (
                <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                  Post format
                  <ShadcnNativeSelect
                    name="post_type"
                    defaultValue={media.postType}
                    className=""
                  >
                    <ShadcnNativeSelectOption value="post">Post</ShadcnNativeSelectOption>
                    <ShadcnNativeSelectOption value="reel">Reel</ShadcnNativeSelectOption>
                    <ShadcnNativeSelectOption value="story">Story</ShadcnNativeSelectOption>
                  </ShadcnNativeSelect>
                </ShadcnFieldLabel></ShadcnField>
              ) : null}
              {assetPlatform === "youtube" ? (
                <>
                  <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                    YouTube title
                    <Input
                      name="video_title"
                      defaultValue={media.videoTitle}
                      maxLength={100}
                    />
                  </ShadcnFieldLabel></ShadcnField>
                  <ShadcnField asChild><ShadcnFieldLabel className="flex flex-col gap-1.5 text-sm">
                    YouTube category
                    <ShadcnNativeSelect
                      name="youtube_category"
                      defaultValue={media.youtubeCategory}
                      className=""
                    >
                      <ShadcnNativeSelectOption value="27">Education</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="28">Science & technology</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="22">People & blogs</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="29">Nonprofits & activism</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="26">How-to & style</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="1">Film & animation</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="2">Autos & vehicles</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="10">Music</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="15">Pets & animals</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="17">Sports</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="19">Travel & events</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="20">Gaming</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="23">Comedy</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="24">Entertainment</ShadcnNativeSelectOption>
                      <ShadcnNativeSelectOption value="25">News & politics</ShadcnNativeSelectOption>
                    </ShadcnNativeSelect>
                  </ShadcnFieldLabel></ShadcnField>
                  <ShadcnField asChild orientation="horizontal"><ShadcnFieldLabel className="flex items-center gap-2 text-sm">
                    <ShadcnCheckbox
                      
                      name="made_for_kids"
                      defaultChecked={media.madeForKids}
                    />
                    This YouTube video is made for children
                  </ShadcnFieldLabel></ShadcnField>
                </>
              ) : null}
            </>
          )}
          {state?.error ? (
            <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
              {state.error}
            </p></ShadcnAlert>
          ) : null}
          {state?.ok ? (
            <ShadcnAlert asChild role="status"><p role="status" className="text-sm">
              {state.message}
            </p></ShadcnAlert>
          ) : null}
          <Button className="w-fit" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save details"}
          </Button>
        </form></ShadcnFieldGroup>
      )}
    </section></ShadcnCard>
  );
}
