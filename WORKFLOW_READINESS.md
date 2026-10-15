# Publishing workflow verification

Updated 14 October 2026. Implementation and mocked provider checks are complete. No content was sent to a social account, WordPress site or AI provider during verification.

| Work item | Implemented behavior | Live prerequisite |
| --- | --- | --- |
| REN-411 Calendar and approvals | Ordered approval transitions, reviewer permissions, a second named approver for sensitive content, future date validation, browser timezone conversion, version guards and cancellation of manual calendar reservations. Calendar reservations explicitly do not send posts. | An authenticated workspace member; no external provider required. |
| REN-412 Social publishing | Approved text can be sent now or scheduled through a matching, available Buffer channel. Queued posts remain scheduled until Buffer confirms delivery. Manual copying and live-link recording remain available for media-only channels. | Verified Buffer key or OAuth connection and a healthy supported channel. |
| REN-409 Video repurposing | Private recordings produce a transcript, highlights, approximate clip ranges, blog, email newsletter, LinkedIn copy and a YouTube short-form script. All four drafts retain activity/media provenance and enter human review. Interrupted runs resume without duplicating existing drafts. | Gemini configured for media analysis; supported recording up to 14 MB. Short-form output is a script, not an edited video export. |
| REN-413 Website publishing and SEO | Editable articles have local SEO preparation before AI connection, optional AI recommendations, human application of title/description/terms and version protection. WordPress receives the approved article, semantic headings/lists and description as excerpt. | Verified WordPress Application Password for publishing. SEO plugin-specific metadata needs that plugin's REST integration. |
| REN-418 WordPress scheduling | Approved articles can become native WordPress future posts with UTC timing. Deterministic slugs avoid duplicate articles. Delivery checks confirm publication or return withdrawn/failed posts to approved. | A publishing-capable WordPress account and a functioning WordPress scheduler/WP-Cron. |

## Delivery and recovery

The workspace reserves the asset version and saves a publication record before contacting a provider. Concurrent or repeated submissions cannot send the same reserved asset again. Provider-owned records cannot be changed through the manual transition or manual-posting actions while delivery is pending.

Provider acceptance means queued, not published. Confirmed failures restore the approved state. A timeout or missing receipt remains reserved because a post may already exist. Reviewers can recover a receipt by entering the provider post ID; the provider's copy or asset-specific WordPress slug must match before the receipt is linked. Recovery reads the existing post and never creates another one.

An unrecorded, definitely absent provider request needs operator review before releasing the reservation. The application deliberately does not assume that a network timeout means nothing was posted. Deleted provider posts may also need operator review if the provider no longer exposes a receipt.

The protected `/api/cron/content-publishing` route checks due requests in bounded batches with four concurrent status reads. `vercel.json` schedules checks every ten minutes. A deployment must actually support that cron frequency and function duration, with `CRON_SECRET` and the service-role database key available. Local `next start` does not execute cron entries; use the record's **Check delivery status** control locally. Provider schedulers deliver the posts, and the app checks their outcomes.

Provider contracts follow the official [Buffer posts and scheduling guide](https://developers.buffer.com/guides/posts-and-scheduling.html) and [WordPress REST posts reference](https://developer.wordpress.org/rest-api/reference/posts/).

## Setup validation

`npm run check:setup` checks secrets, origin and the required database tables without reading content or sending posts. The existing media, approval and publication tables passed. No new database migration is needed for these changes.

Placeholder WordPress domains such as `.example`, `.test` and `.invalid` cannot be connected and no longer show as usable publishing connections. The database's placeholder entry was not modified. Buffer API keys are verified with read-only account/channel requests and encrypted before storage.

## Verification evidence

- Full automated suite: 213 passing tests across 25 files.
- Production build and TypeScript: passed.
- ESLint: passed.
- Database and environment setup checks: passed.
- Provider tests use mocked responses for scheduling, queued/sent/error states, withdrawn WordPress drafts, duplicate submissions, authorization failures, partial database writes and timeout receipt recovery.
- Media tests exercise four-draft persistence, provenance, human review status, old-analysis upgrades, missing providers, invalid output and partial-run recovery.
- SEO tests exercise local preparation without AI, application of recommendations, reviewed-state protection and stale-write rejection.
- Authenticated browser checks confirmed the empty Buffer form cannot submit, placeholder WordPress is not connected, calendar timing is explicitly local, and manual scheduling explains that it does not deliver content. Content and integration pages fit at both normal desktop width and 390 px without horizontal overflow. The temporary viewport was reset.

Real provider authorization, account permissions, platform validation and successful delivery still require connection and a deliberate live test. Nothing in the automated results claims that live publishing has been verified.

## UI delivery gate

The new controls retain the existing navy palette, Open Sans typography and shared native form/button components. Their purpose is to distinguish manual calendar planning from provider delivery, make timing explicit and expose recovery rather than silently retry a possibly successful post. The established task-first design direction remains ENERGY 1 / RHYTHM 2 / MOTION 1.

- Hard gate PASS: labeled native fields, visible pending/error/status feedback, no invented delivery success; browser validation and desktop/mobile overflow checks pass. Provider behavior is covered by mocked action tests.
- Purpose gate PASS: controls directly submit, schedule, check or recover the selected content record; no decorative styling was added.
- Liveliness PASS: existing workspace hierarchy, spacing and accent are retained for this functional addition.
- Craft gate PASS: production build, lint, setup checks, the automated suite and authenticated UI checks pass. Live external submission is explicitly excluded until providers are connected.
