# Colleague integration and social publishing, 18 October 2026

## Integration

The local `codex/integrate-colleague` branch preserves the pre-existing calendar, approval enforcement, provider checks, design, and media repurposing in checkpoint `01b6e89`. An external Git bundle and patch are under `C:/Users/ghost/.codex/backups/ril-integration-20261018/`.

- REN-425 / PR #3: merged hashtag cleanup, structured image response parsing, redacted failed-response snapshots, failed generation records, and upstream tests. Failed diagnostic responses are excluded from browser attachment data. Local audio/video transcription and all four repurposing formats are retained.
- REN-408 / PR #5: merged attachment guidance, linked campaigns, WAT edit timestamps, private image previews with link fallback, and display tests. Local layout and disclosure controls are retained.
- REN-420 / PR #2: merged date helpers, approved/scheduled/published queries, overdue flags and tests. The newer local day/week/month calendar, all-stage filters, drag scheduling, recorded approvals, timing suggestions and provider recovery remain in use.
- REN-416 was already merged locally. GitHub main and PRs were not changed. PR #4 remains a separate WIP activity-search branch.

All three fetched branch tips are ancestors of the combined local branch. Merge commits preserve their history.

## Activity timestamp migration

`20261017000000_activities_updated_at.sql` was tested with PostgreSQL, rehearsed against the live schema in a rolled-back transaction, then applied transactionally and recorded with its original version in migration history. All 20 activities remain; all 20 have an edit timestamp. Existing records start at their creation date, and later edits update the timestamp. No content or publishing status was changed by this migration.

## Social publishing, first implementation

`/publishing` is linked from Create & publish in the sidebar. It lists social content in Review, Approved, Scheduled, Published or Analysing, scoped to the authenticated workspace, with validated stage/platform filters and pagination. Drafts remain in the Content Library. Approved is a stored status; the detail page and database release gate still check actual sign-offs before sending.

The existing asset-level manual posting flow remains: copy approved text, publish it yourself, then record the live HTTPS post link. Provider-owned reservations cannot be recorded manually over an uncertain delivery.

The Buffer text composer now filters accounts by platform, explains unavailable channels, validates copy and WAT timing, and requires a final approved-copy preview before submission. The server checks the displayed asset version, refreshes channels, checks reviewer access and database approval, and reserves the request before contacting Buffer. A concurrent submission cannot resend the same reserved copy.

New requests record their selected Buffer channel. Timeout recovery checks both approved text and the recorded channel. Older requests without a recorded channel are conservatively left for verification in Buffer. Confirmed provider receipts retain the public post URL and reported delivery error; accepting a queued post never marks it published. API field names were checked against [Buffer's reference](https://developers.buffer.com/reference.html) and [scheduling guide](https://developers.buffer.com/guides/posts-and-scheduling.html).

This phase supports text-only Buffer publishing. Photos, videos and separate X thread parts still use manual posting. There is no bulk multi-account release, media upload, automatic retry of uncertain writes, or engagement-metrics claim. Live delivery still requires valid Buffer credentials and an available connected channel. These changes do not publish a post merely by opening the workspace.

## Verification

- 545 automated tests pass across 55 files, including PostgreSQL approval and migration tests, queue scoping/filter validation, unavailable/mismatched channels, stale previews, timeout recovery and provider receipt handling.
- Test concurrency is capped at four workers after the full suite exposed a PostgreSQL startup timeout under machine contention. The database suite also passed independently.
- TypeScript and ESLint pass. The production build passes and includes `/publishing`. The error boundary uses the installed Next.js version's `retry` callback.
- No live social post, email, paid AI generation or CMS article was sent during this work. No Git push or hosted application deployment was performed.

## UI decisions and remaining verification

The publishing list follows the existing white workspace surfaces, Open Sans, blue actions, status stamps and WAT labels. A flat list supports scanning post text and delivery state; Send, Refresh and Add icons identify actual actions. Motion stays limited to the existing control feedback and dialog transitions. ENERGY 1 / RHYTHM 1 / MOTION 1.

The browser initially could not attach a tab, then recovered after the local server restarted and a fresh HTTP tab opened. Authenticated checks verified the publishing list, stage filters, platform submission, empty and loading states, and the merged Activity Hub's campaign and timestamp display. The mobile publishing page had equal client and scroll widths of 390px.

A temporary development-only composer fixture verified account selection, disabled paused accounts, immediate and scheduled previews, Escape/Back dismissal, missing-time validation, the custom date picker and WAT review time, and visible missing-connection errors. It had no real account or content asset, sent no post, and was removed before the final build. External writes remain covered by mocked requests; real delivery has not been exercised against a connected Buffer account.

The root HTML now declares its existing smooth scroll behaviour for Next.js route transitions, resolving the development warning observed during verification. Screenshots are under the task's visualization directory: `social-publishing-mobile.png`, `activity-hub-integrated.png`, and `social-composer-confirmation-check.png`. The composer screenshot is a labelled test fixture, not evidence of a connected provider.

The final production build was also checked in the authenticated browser. Content creation and activity-to-campaign navigation completed, the campaign anchor existed, desktop client/scroll widths were both 1280px, and no console errors were reported. `social-publishing-final.png` shows the real publishing workspace. The temporary preview route is absent from the final route list. The production server is left running locally on port 3001.

## Scoped UI delivery checks

- Hard gate PASS: live workspace records supply list content/counts; controls have labels and working destinations; empty/loading/error feedback is present; mobile scroll width is 390px at a 390px viewport. Publishing mutations are verified through mocked provider requests rather than live releases.
- Purpose gate PASS: the flat list supports text scanning, the existing blue actions preserve the chosen design, and icons identify send/refresh/create operations. No decorative effects or new brand assets were introduced.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1; primary creation and per-post actions follow the existing workspace hierarchy, with control and dialog feedback rather than ambient animation.
- Craft checks PASS: existing typography, status stamps, controls and surfaces are reused; keyboard dialog dismissal and account controls were exercised; provider connection and delivery limits are stated rather than presented as completed connections.
