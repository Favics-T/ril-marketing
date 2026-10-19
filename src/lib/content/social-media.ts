import { z } from "zod";

export const socialPostSchema = z.object({
  media: z
    .array(
      z.object({
        type: z.enum(["image", "video"]),
        url: z
          .string()
          .url()
          .max(2000)
          .refine((value) => {
            try {
              const u = new URL(value);
              return (
                u.protocol === "https:" &&
                !u.username &&
                !u.password &&
                !u.searchParams.has("token") &&
                ![...u.searchParams.keys()].some((key) =>
                  /signature|credential|expires|x-amz-/i.test(key),
                )
              );
            } catch {
              return false;
            }
          }, "Use a stable public HTTPS media URL, not an expiring signed link."),
        alt: z.string().max(1000).default(""),
      }),
    )
    .max(10)
    .default([]),
  postType: z.enum(["post", "reel", "story"]).default("post"),
  videoTitle: z.string().trim().max(100).default(""),
  youtubeCategory: z
    .enum([
      "1",
      "2",
      "10",
      "15",
      "17",
      "19",
      "20",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
    ])
    .default("27"),
  madeForKids: z.boolean().default(false),
});
export type SocialPost = z.infer<typeof socialPostSchema>;
export function socialPost(
  metadata?: Record<string, unknown> | null,
): SocialPost {
  const result = socialPostSchema.safeParse(metadata?.social_post ?? {});
  return result.success
    ? result.data
    : {
        media: [],
        postType: "post",
        videoTitle: "",
        youtubeCategory: "27",
        madeForKids: false,
      };
}
export function bufferMediaInput(post: SocialPost, service: string) {
  const assets = post.media.map((media) =>
    media.type === "video"
      ? { video: { url: media.url } }
      : {
          image: {
            url: media.url,
            ...(media.alt ? { metadata: { altText: media.alt } } : {}),
          },
        },
  );
  const metadata =
    service === "instagram"
      ? {
          instagram: {
            type: post.postType,
            shouldShareToFeed: post.postType !== "story",
          },
        }
      : service === "facebook"
        ? { facebook: { type: post.postType } }
        : service === "youtube"
          ? {
              youtube: {
                title: post.videoTitle,
                categoryId: post.youtubeCategory,
                madeForKids: post.madeForKids,
                privacy: "public",
              },
            }
          : undefined;
  return { assets, ...(metadata ? { metadata } : {}) };
}
