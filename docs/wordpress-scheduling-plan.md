# WordPress blog scheduling — plan

**Updated:** 2026-10-13 (step 4b done)
**Scope:** Card 4 in [content-workflow-spec.md](content-workflow-spec.md) (schedule a blog on WordPress), plus the pieces of Cards 1, 6, 8, 9 and 10 it touches.
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
9. **Failures and changes made in WordPress** (revised 2026-10-13, to meet PRD §13):
   - **Scheduling fails** (WordPress rejects or errors): the asset stays **Approved**, and a `failed` publication row records the reason.
   - **The post is found as a draft, trashed or missing, and we didn't cause it:** the asset reverts to **Approved**. The publication becomes `cancelled`, with an `error` explaining what was found. An alert is raised.
   - **Missed** (WordPress still reports `future` after `scheduled_for`): the asset stays **Scheduled**, shows a red **Missed** badge and a **"Publish now"** action, and an alert is raised.

Content goes to WordPress as Markdown rendered by `marked`, with raw HTML in the source escaped.

### Further rules (2026-10-13)

- **Schedules always mean WAT.** The input is read in `WORKSPACE_TIME_ZONE`, whatever zone the device is set to, and labelled "(WAT)".
- **Audit trail.** Schedule, reschedule and unschedule each write an `asset_approvals` row.
- **Reschedule history (Card 1, Card 3).** A reschedule marks the old publication row `cancelled` with the note "Rescheduled to <time>", then inserts a new `scheduled` row with the same `external_id`. The old row must be cancelled first, because the unique index allows only one active row per asset.
- **No manual Scheduled → Published** while the asset has an active WordPress publication (`scheduled` or `missed`). Users are pointed to "Publish now" instead.
- **Retry.** `requestWordPress` retries 429 and 503 responses with backoff: at most 3 attempts, honouring `Retry-After`.
- **Writes to `publications`.** All new code writes them through the admin client, after role checks. Moving the existing writers over is a follow-up (gap audit A3, PRD §12/§16).

### Scope changes

- **Calendar rescheduling (Card 8, PRD §6.10).** Out of v1. Reschedule from the asset page only; the calendar shows badges.
- **Strapi scheduling (Card 5).** Out of scope until it's confirmed which CMS the live site uses (spec open question 1).

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Publish history (`publications` read on the asset page) | Done · `4bde2d4` |
| 1 | Markdown → HTML via `marked`; slug lookup across all non-trash statuses | Done · `1794269` |
| 2 | Migration: `scheduled` / `missed` / `cancelled` statuses, `remote_status`, `last_synced_at`, `updated_at`, one active WordPress row per asset, sync index | Done · `68bae23` · **not yet applied** |
| 3 | Client calls: `toDateGmt`, `assertSchedulable`, `createScheduledPost`, `updatePostSchedule`, `setPostDraft`, `getPostsByIds` | Done · `019c1e7` |
| 4 | Test connection (checklist, saves nothing) | Done · `f3f722f` |
| 4b | Time fix: schedule input read as WAT (labelled, pre-filled), calendar day grouping and month bounds in `WORKSPACE_TIME_ZONE`, one shared formatter (`src/lib/time.ts`) for the calendar, asset page, dashboard and publish history. Tests around midnight WAT under several process zones. | Done · `18b167e` |
| 5 | Schedule action + asset-page card + `AssetTransition` hook + `asset_approvals` row. **Must look up an existing post by slug before `createScheduledPost`**, since that call isn't idempotent. Block manual Scheduled → Published for assets with an active WordPress publication. | |
| 6 | Reschedule (cancel old row + new row, as above) / unschedule, each with an `asset_approvals` row. If inserting the new row fails, restore the old row to `scheduled` and report the error. | |
| 9 | Status sync + Missed + "Publish now" + alerts as `tasks` rows. Sync runs on load of the calendar, asset page and dashboard (non-blocking, skipping rows synced in the last 3 minutes) and from a daily cron route. Includes retry with backoff in `requestWordPress`. | |
| 7 | Category / tag picker | Later |
| 10 | Calendar badges | Later |
| 11 | Dashboard Missed / Failed | Later |

## Sync latency (known limitation)

WordPress publishes scheduled posts itself, through WP-Cron, which only runs when the site gets traffic. The app learns the result only when it syncs:
- when someone opens the calendar, an asset page or the dashboard (rows synced in the last 3 minutes are skipped), or
- from the daily cron, which is all Vercel Hobby allows.

If nobody opens the app, a post that went live can show as Scheduled, and a missed post won't be flagged, **for up to about 24 hours**. Getting faster confirmation needs a more frequent cron (a paid Vercel plan) or an external scheduler (spec open question 3).

## Alerts as `tasks` (findings for step 9)

The existing `tasks` table ([platform_alignment.sql:40](../supabase/migrations/20260916000004_platform_alignment.sql#L40)) was built for insight reviews:
- **Columns:** `type` (free text, default `insight_review`, no CHECK), `title`, `status` (`open` / `done`), `insight_id`, `completed_at`. There is no link to a content asset or publication.
- **Writers:** the insight job inserts with the admin client. The insight actions close tasks by `insight_id`.
- **Display:** the dashboard's `listOpenTasks(org, 5)` ([tasks.ts](../src/lib/audience/tasks.ts)) shows the 5 newest open tasks. The link target is chosen by `type`: any type containing `"publish"` currently links to `/settings/ai`, which is wrong for an asset alert.

Step 9 therefore needs:
- a migration adding `content_asset_id` and `publication_id` (nullable FKs)
- a partial unique index so the same alert isn't raised twice: one open task per (publication, type)
- types such as `publish_missed` and `publish_cancelled`
- dashboard links to `/library/<id>`
- tasks closed when the item is published, rescheduled or unscheduled (Card 10)

## Deferred

- Featured images (media upload)
- Trash / delete
- Strapi Blocks fields
- `npm audit` fixes

## Open notes

- **`updatePostSchedule` has a race.** It reads the post's status, then writes the new `date_gmt`. If WP-Cron publishes the post between the two, WordPress re-dates the live post, or pulls it back to `future` if the new time is ahead. The response status is checked, but the read and write are not atomic. Possible mitigation: after a non-`future` response, restore the original `date_gmt` and report it.
- **The sync index is a guess.** `publications_wordpress_sync_idx` is on `scheduled_for`, for WordPress rows in `scheduled` or `missed`. The on-load sync skips rows by `last_synced_at`, so consider `(last_synced_at NULLS FIRST)` or a composite index before step 9.
- **Reschedule isn't atomic.** Cancelling the old row and inserting the new one are two writes. Decided: if the insert fails, restore the old row to `scheduled` and report the error (step 6).
- **`setPostDraft` only acts on `future` posts.** It does nothing to a post that is already a draft, and refuses a live one, so unscheduling can never unpublish.
- **`getPostsByIds` uses `status=any`,** which leaves out trashed posts. The sync job should treat a missing id as trashed or deleted.
- **Existing `scheduled_for` values** saved before `4bde2d4` is deployed were stored as UTC wall-clock time, one hour late for Lagos. Production keeps writing them that way until it's deployed. Decided: no automatic shift. Review them by hand with the query below.

## Old schedules to review by hand (read-only)

Lists future scheduled assets whose time was last set before `4bde2d4` went live. Set `deployed_at` to that deploy's time. "When it was set" means the latest move to Scheduled in `asset_approvals`, falling back to `created_at`.

```sql
WITH params AS (SELECT timestamptz '2026-10-14 12:00:00+01' AS deployed_at),  -- set to the 4bde2d4 deploy time
last_scheduled AS (
  SELECT content_asset_id, max(created_at) AS scheduled_at
  FROM asset_approvals
  WHERE to_status = 'scheduled'
  GROUP BY content_asset_id
)
SELECT ca.id, ca.title, ca.channel, ca.format,
       ca.scheduled_for,
       to_char(ca.scheduled_for AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') AS shown_now_wat,
       to_char(ca.scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS probably_typed_wat,
       coalesce(ls.scheduled_at, ca.created_at) AS time_set_at
FROM content_assets ca
LEFT JOIN last_scheduled ls ON ls.content_asset_id = ca.id
CROSS JOIN params
WHERE ca.status = 'scheduled'
  AND ca.scheduled_for > now()
  AND coalesce(ls.scheduled_at, ca.created_at) < params.deployed_at
ORDER BY ca.scheduled_for;
```

`probably_typed_wat` is what the user most likely entered: the old code saved their typed time as UTC. To fix a row, set `scheduled_for` back by one hour.
