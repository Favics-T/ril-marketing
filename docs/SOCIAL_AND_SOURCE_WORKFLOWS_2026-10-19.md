# Social publishing and source repurposing

## Using the features

Open **Repurpose content** in the sidebar (`/repurpose`), or follow the link from Add content or an activity attachment. Save an activity, attached file, public HTTPS URL, transcript or manual summary as an Idea. Choose the formats and newsletter style, then generate from its source page. Saving the source does not call AI.

Extraction is saved before generation. The source page shows its transcript/text, topics, quotes, statistics, proposed angles and calls to action. Generated assets link back to the source and keep a snapshot of its revision, so later corrections do not change the evidence attached to earlier drafts.

The existing full generation engine supplies blog drafts, outlines and SEO information; newsletters with subject options, preview text and the chosen style; separate LinkedIn, Instagram, X, YouTube and TikTok drafts; and short-form editing briefs. Clip ranges and captions can be edited, and platform-specific suggested captions can be selected. These are production instructions, not rendered video files. An empty clip result is valid when the source has no strong moment.

Every generated asset starts **AI generated**. Editing, Review and recorded human approval are still required before release. Sensitive content keeps its named second-reviewer requirement. Media and clip edits change the approval revision; approved content must return to Editing before those details can change.

Open **Social publishing** (`/publishing`) for drafts, review, approved posts, scheduled deliveries and publication records. An approved post can be published now, scheduled at an explicit WAT time, or added to the next Buffer queue slot. The confirmation shows approved copy and media. Buffer acceptance remains Scheduled until the provider confirms delivery; a recorded live link is shown when available.

For images and videos, add final stable public HTTPS file URLs under Publishing media before review. Private activity attachments are not made public. Instagram requires media; YouTube requires a video, title and category. LinkedIn, Facebook and X support the media request path. Short-form scripts cannot be submitted as completed videos. Unsupported network/media combinations remain manual.

Without Buffer, copy approved text, publish in the social account and record the live link using the existing manual flow.

## Failure and recurrence behaviour

- A confirmed publishing failure restores the asset to Approved, preserves its receipt/error history and adds an in-app Marketing alert. It does not silently retry.
- An uncertain timeout keeps the reservation. Recovery verifies the selected channel, approved text and media before linking a provider receipt, preventing duplicate or unrelated deliveries.
- A failed extraction leaves the source as an Idea with an error, Retry and a manual transcript/summary option. Successful extraction and already saved drafts are retained. Partial generation retries fill missing formats without duplicating saved output slots.
- A manual summary starts a new source revision; earlier generated assets remain in the library.
- Repeating plans prepare fresh Editing drafts up to seven days ahead. They copy no signoffs or delivery receipts. Each occurrence needs human approval and a publishing decision. Revoked publishing authority pauses the plan.
- **Update publishing status** checks this workspace's pending deliveries and prepares due recurring drafts. It is available to reviewers and does not send new posts. One failed recurring plan does not stop other delivery checks.

## Connections and deployment

Live sending requires a working Buffer connection with the target accounts connected in Buffer. AI generation requires the workspace's configured AI provider; direct audio/video understanding currently uses Gemini. A transcript or manual summary can be used with the other text providers.

Recording sources are limited to 14 MB; images and documents to 8 MB, PDFs to 25 pages. Scanned PDFs need extractable text/OCR. URLs must resolve to public addresses and must be direct resources; login pages, redirects and social video watch pages require a direct source or transcript. The source reader pins checked DNS results and refuses private network destinations.

Deployment is still required for unattended checks. The existing protected `/api/cron/content-publishing` task runs daily at 09:00 UTC in `vercel.json`; set `CRON_SECRET` on the deployed host. Buffer executes the actual delivery timing. Local use can run checks with the workspace button. Alerts in this implementation are in-app, not email or Slack messages.

## Database and validation

Migration `20261019090000_social_and_repurposing_workflows.sql` adds organization-isolated source/output records, recurring plans, publishing alerts and service-only atomic completion/preparation functions. A live-schema rehearsal was rolled back before applying it. Existing counts remained 131 assets, 8 publications and 5 memberships. Existing 48 policies were retained and four scoped read policies added. Local backups and migration evidence are under `C:/Users/ghost/.codex/backups/ril-integration-20261018/`.

Automated validation: 593 tests passed across 59 files; lint passed. Coverage includes real PostgreSQL workflow constraints, cross-workspace isolation, immutable approval revisions, recurring preparation, atomic/deduplicated output saves, failed transcription/manual recovery, SSRF controls, Buffer media/queue payloads, uncertain delivery and receipt recovery. Provider calls in tests are mocked. No live social post was sent for verification.

The final production build passed compilation, TypeScript and static page generation. Browser checks passed for source creation, a second manual source revision, required-field validation, URL/transcript form states, the social drafts filter, clip controls and the workspace status check. The test source was backed up and removed; no generated or real content was changed. The app was checked at 1280 px and 390 px with no horizontal overflow. Keyboard Tab reached the source selector with a visible outline. No browser console warnings or errors were captured. The local production server is running on port 3001.

Screenshots: [repurposing desktop](C:/Users/ghost/.codex/visualizations/2026/09/30/01a0f244-bf58-7da1-b570-942a7f5137cb/repurposing-desktop-final.png), [repurposing phone](C:/Users/ghost/.codex/visualizations/2026/09/30/01a0f244-bf58-7da1-b570-942a7f5137cb/repurposing-mobile-final.png), [publishing](C:/Users/ghost/.codex/visualizations/2026/09/30/01a0f244-bf58-7da1-b570-942a7f5137cb/social-publishing-workspace-final.png).

## Scoped UI delivery gate

The design follows the user's established white workspace, blue actions, Open Sans, existing sidebar and form components. ENERGY 2 / RHYTHM 2 / MOTION 1: daily task forms use restrained feedback, with the source form or content record as the focal point. This is a feature implementation within that approved direction.

| Check | Result and evidence |
| --- | --- |
| R-01 | PASS: flat workspace surfaces; no new gradients or glows. |
| R-02 | PASS: no new em-dash marketing copy; existing user content is retained. |
| R-03 | PASS: 390 px and 1280 px checks show document width equal to viewport width. |
| R-04 | PASS: existing Lucide icons follow the user's icon instruction; Copy identifies repurposing and Refresh identifies a status check. |
| R-05 | PASS: source form, evidence, records and delivery stages follow the actual workflow. |
| R-06 | PASS: existing Open Sans and type hierarchy retained. |
| R-07 | PASS: no decorative background pattern introduced. |
| R-08 | PASS: external navigation arrows identify connection links; buttons use action labels. |
| R-09 | PASS: statuses reflect database state; no promotional badges added. |
| R-10 | PASS: no glass treatment introduced. |
| R-11 | PASS: existing control and surface radii retained. |
| R-12 | PASS: existing restrained control elevation retained; no new large shadows. |
| R-13 | PASS: no glow added. |
| R-14 | PASS: source entry, evidence, alerts and lists have different structures according to their purpose. |
| R-15 | PASS: action labels specify Save source Idea, Generate drafts, Save new source revision and Update publishing status. |
| R-16 | PASS: new copy describes the task and its actual limits. |
| R-17 | PASS: displayed totals and statuses come from scoped database queries. |
| R-18 | PASS: no testimonial content introduced. |
| R-19 | PASS: existing control/dialog feedback retained; no simultaneous decorative animations. |
| R-20 | PASS: established RIL branding and the human approval workflow retained. |
| R-21 | PASS: existing light presentation retained. |
| R-22 | PASS: no unrelated illustrations introduced. |
| R-23 | PASS: no new visual asset created; navigation entries expose the requested workflows. |
| R-24 | PASS: repurposing routes, asset links and social stages resolve locally; production build includes them. |
| R-25 | PASS: computed text tokens are navy/muted navy on white or the pale page surface; white on the blue submit button. Muted text on the page exceeds 5:1 and white on the button exceeds 6:1. |
| R-26 | PASS: controls have real route/action bindings; source saving, revision recovery, validation, filtering and status checks were exercised; provider writes use automated fixtures. |
| R-27 | PASS: source and queue empty states, route loading/error boundaries, pending buttons and inline errors are implemented. |
| R-28 | PASS: no FAQ introduced. |
| R-29 | PASS: existing neutral surfaces, navy text and blue accent retained. |
| R-30 | PASS: no external product layout or brand copied. |
| R-31 | PASS: layout follows source/input, evidence/output and review/delivery relationships. |
| R-32 | PASS: labelled controls, native keyboard selectors and visible focus; Tab navigation checked in-browser. |
| R-33 | PASS: implementation is in source and SQL; Prettier only formats files. |
| R-34 | PASS: components use existing surface, foreground, input and primary theme tokens. |
| R-35 | PASS: 593 tests, lint and final production build pass; recorded browser checks above. No live provider delivery is claimed. |
| R-36 | PASS: security and workflow statements are backed by database/contract tests; live-connection limits are explicit. |
| R-37 | PASS: existing user-selected SaaS workspace direction retained; task-focused dials stated above. |
| R-38 | PASS: synthetic verification text was explicitly labelled and removed; no fabricated public content added. |
| C-1 | PASS: typography, color and controls inherit the approved workspace system. |
| C-2 | PASS: server actions, status/error feedback and provider contracts are tested. |
| C-3 | PASS: each section supplies input, evidence, review details or delivery information. |
| C-4 | PASS: responsive/keyboard checks and error/retry states are recorded above. |
| C-5 | PASS: existing records are preserved and verification claims are scoped to what was tested. |

Buffer request formats were checked against the official [media example](https://developers.buffer.com/examples/create-video-post.html), [post input reference](https://developers.buffer.com/types/CreatePostInput.html) and [YouTube metadata reference](https://developers.buffer.com/types/YoutubePostMetadataInput.html).
