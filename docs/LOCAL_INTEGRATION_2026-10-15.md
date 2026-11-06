# Local integration — 15 October 2026

## Sources and recovery

- Integration branch: `codex/integrate-colleague`.
- Local starting commit: `bc22840`; all 175 changed/new local files were preserved in snapshot commit `8b04a01` before merging.
- Colleague repository: https://github.com/Favics-T/ril-marketing.git.
- Colleague main: `f3df405` (15 commits beyond the shared base), merged with a normal two-parent merge commit.
- Available workspace-access branch: `REN-416-workspace-access-fix` at `0cd32f4`, also merged with its history intact.
- Original `origin` remains https://github.com/DavidAroh/ril-marketing-.git. The colleague repository is a separate `colleague` remote.
- External recovery copy: `C:/Users/ghost/.codex/backups/ril-marketing-20261015-111647`, containing source files, working/staged patches, and a Git history bundle. Ignored environment files were left in place and unchanged.

Nothing was pushed, deployed, published, or sent. No live database migrations were applied by this integration.

## Comparison and merge decisions

| Area | Local work retained | GitHub work included |
| --- | --- | --- |
| Interface | Restored homepage/auth/sidebar, dashboard layout and charts, custom controls, simplified AI settings, site motion | New publishing/history and editor controls fitted into the local interface |
| Generation | Provider configuration checks, image/audio/video analysis, manual creation, source-linked drafts | Per-format generation specifications, source-material extraction/condensing, explicit template fallback, channel limits, generation brief |
| Content editing | Existing draft and SEO workflows | Landing-page rich-text editor, safe Markdown rendering, editorial length feedback |
| Social publishing | Reviewer checks, approved-copy reservation, receipt recovery, confirmed delivery, manual posting with live link | Due/overdue reminders and publication history |
| WordPress | Immediate/scheduled publishing, request reservation and status reconciliation | SEO plugins and field checks, read-only connection diagnostics, Markdown article HTML, all-status slug lookup, scheduling client helpers |
| Time | Custom date/time controls | WAT utilities, calendar grouping, asset/history formatting; new local publishing controls now also interpret inputs as WAT |
| Workspace access | Existing organization-scoped app behavior | Membership-based organization resolution, restricted public form props, access migration and rollback-only SQL rehearsal |

The duplicate reminder action now points to the live-link recording flow rather than bypassing it. Provider acceptance remains distinct from confirmed publication. A schedule retry reuses an existing future WordPress post; an explicit publish-now action retains GitHub's ability to publish an existing draft or future post. WordPress keeps numeric IDs in its client API; durable publication receipts store them as strings.

Publication history keeps URLs and actor IDs alongside the local delivery reservation. SEO save warnings remain visible. WordPress's two-minute scheduling margin is checked before reserving an asset. Buffer checks the selected channel's character limit and refuses to send a generated X thread bundle as one post.

The dependency manifest and lockfile contain both sets of additions. GitHub's removal of the generated TypeScript cache is retained. The daily Vercel cadence is preserved for Hobby compatibility; the local content-delivery check remains registered at 09:00 UTC daily. WordPress/Buffer perform scheduled delivery themselves; daily confirmation can lag by up to a day. No old schedule timestamps were shifted.

## Validation

- Full unit/integration suite: 392 tests pass across 42 files. Production build and TypeScript checks pass. Lint has zero errors and one pre-existing `next/no-img-element` warning in `logo-cloud.tsx`.
- Browser checks pass for authentication, the redesigned dashboard with overdue reminders, a scheduled social asset with manual live-link recording and history, the WAT calendar, combined WordPress settings, and the landing-page rich-text editor. The mobile editor has no horizontal overflow; no browser console errors were observed on these paths.
- Both fetched colleague branch tips are ancestors of the integration branch; no files present in colleague main were deleted by the merge.
- Read-only live schema check: publication history/scheduling columns (`url`, `actor_id`, `scheduled_for`, `remote_status`, `last_synced_at`, `updated_at`) are available.
- Tests mock provider writes. No live AI generation, email delivery, or external publication was performed.
- REN-416 includes SQL isolation/rehearsal scripts. Passing their source/rehearsal-generation tests does not mean the SQL has been executed against the live database.

## Remaining handoff work

Update: the subsequent [content calendar and approval implementation](CONTENT_CALENDAR_WORKFLOW_2026-10-15.md) completes the calendar views, filters, scheduling controls, named approvals, database enforcement, and their rollout. The numbered list below records the state at integration time; consult the newer note for current coverage and provider limitations.

This is a completed code integration, not a claim that the whole content/calendar epic is finished. The colleague's older gap audit and scheduling plan are preserved as historical documents; use this note alongside them.

1. **REN-420 was not pushed.** Its calendar week-view implementation was absent from all available remote branches. The user chose to continue with available GitHub code. Day/week/month-grid views, additional filters, and calendar drag/rescheduling remain follow-up work.
2. **Approval security remains a separate requirement.** REN-416 fixes workspace membership resolution and supplies a database access migration; it does not make asset status changes and their audit writes atomic, enforce the approval state machine in the database, or provide the second named approval/category model for sensitive content. Direct database approval/audit mutations must be hardened before claiming structural enforcement.
3. **WordPress scheduling plan is partly unfinished upstream.** Its low-level schedule/unschedule/reschedule helpers and publication statuses are retained. The planned automatic status-transition checkbox, cancelled/missed publication lifecycle, reschedule audit/compensation, task alerts, and dedicated dashboard/calendar badges are not all wired end to end. Local publishing controls and delivery checks remain available.
4. **Database rollout needs explicit handling.** Review the included migrations and existing deployment state, including REN-416, before rollout. The read-only column check does not verify RLS policy definitions or prove that every migration is applied.

The calendar and approvals descriptions were corrected so they do not claim visibility or second-person approval behavior that is not currently implemented.
