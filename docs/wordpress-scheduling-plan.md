# WordPress blog scheduling — plan

**Updated:** 2026-10-12
**Scope:** Card 4 in [content-workflow-spec.md](content-workflow-spec.md) (schedule a blog on WordPress), plus the pieces of Cards 1, 6, 8 and 10 it touches.
**Related:** [STATUS.md](STATUS.md) feature 3, [INTEGRATIONS.md](../INTEGRATIONS.md)

## Decisions

1. **Server actions + Vercel cron. No Supabase Edge Functions.** All WordPress calls run in Next.js server actions or a cron route, through `requestWordPress` and its SSRF guard.
2. **Keep secret-box encryption** for the application password (`AI_CONFIG_SECRET`), as today.
3. **One WordPress site per workspace.** The existing `cms_wordpress` integration row.
4. **`publications` is the scheduling record.** A scheduled post is a `publications` row (status, `scheduled_for`, `remote_status`, `last_synced_at`). `metadata.wordpress_post_id` and `metadata.wordpress_url` on the asset stay as pointers only.
5. **Scheduling follows the asset status.** Moving a WordPress-eligible asset (blog or website) to **Scheduled** creates the WordPress post as `future`. The transition shows an **"Also schedule on WordPress"** checkbox, on by default. Moving it back to **Approved** sets the WordPress post to draft.
6. **Actions live on the asset page.** The calendar shows badges only, with no WordPress actions.
7. **No trash or delete in v1.** Unscheduling sets the post to draft.
8. **Featured images deferred.**
9. **Posts changed directly in WordPress** get a **"Changed in WordPress"** flag. The asset status is left untouched.

Content goes to WordPress as Markdown rendered by `marked`, with raw HTML in the source escaped.

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Publish history (`publications` read on the asset page) | Done · `4bde2d4` |
| 1 | Markdown → HTML via `marked`; slug lookup across all non-trash statuses | Done · `1794269` |
| 2 | Migration: `scheduled` / `missed` / `cancelled` statuses, `remote_status`, `last_synced_at`, `updated_at`, one active WordPress row per asset, sync index | Done · `68bae23` · **not yet applied** |
| 3 | Client calls: `toDateGmt`, `assertSchedulable`, `createScheduledPost`, `updatePostSchedule`, `setPostDraft`, `getPostsByIds` | Done · `019c1e7` |
| 4 | Test connection (checklist, saves nothing) | Done · `f3f722f` |
| 5 | Schedule action + asset-page card + `AssetTransition` hook. **Must look up an existing post by slug before `createScheduledPost`**, since that call isn't idempotent. | Next |
| 6 | Reschedule / unschedule | |
| 9 | Status sync, Missed status, "Publish now" | |
| 7 | Category / tag picker | Later |
| 10 | Calendar badges + timezone fix | Later |
| 11 | Daily cron backstop; Missed / Failed on the dashboard | Later |

## Deferred

- Featured images (media upload)
- Trash / delete
- Strapi Blocks fields
- `npm audit` fixes

## Open notes

- **`updatePostSchedule` has a race.** It reads the post's status, then writes the new `date_gmt`. If WP-Cron publishes the post between the two, WordPress re-dates the live post, or pulls it back to `future` if the new time is ahead. The response status is checked, but the read and write are not atomic. Possible mitigation: after a non-`future` response, restore the original `date_gmt` and report it.
- **The sync index is a guess.** `publications_wordpress_sync_idx` is on `scheduled_for`, for WordPress rows in `scheduled` or `missed`. If the sync job orders by `last_synced_at` instead, change the index to match before it's used.
- **`setPostDraft` only acts on `future` posts.** It does nothing to a post that is already a draft, and refuses a live one, so unscheduling can never unpublish.
- **`getPostsByIds` uses `status=any`,** which leaves out trashed posts. The sync job should treat a missing id as trashed or deleted.
