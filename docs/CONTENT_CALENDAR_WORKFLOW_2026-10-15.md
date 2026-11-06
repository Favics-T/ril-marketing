# Content calendar and approval workflow

Implemented on `codex/integrate-colleague`, preserving the previously merged GitHub work.

## Calendar

- Day, Monday-start week, and month grid; mobile uses a dated agenda.
- Campaign, platform, content type, and all eight status filters.
- Dated content includes scheduled posts, published posts without a scheduled date, and clearly labelled proposed times. Undated ideas, drafts, and approved items appear below the calendar.
- Drag approved/scheduled items to a day, then confirm the time. The Schedule/Reschedule buttons provide the same flow for keyboard and touch users. Times consistently use WAT.
- Calendar-only reservations can be scheduled, rescheduled, or removed without creating a provider post.
- Approved website/blog content can explicitly opt into WordPress scheduling. Rescheduling and unscheduling an existing WordPress post require a verified provider receipt before updating local history. Interrupted changes have a recovery action; it updates the same remote post rather than creating another one. Already published posts are preserved.
- Buffer-owned posts explain that their external time must be changed in Buffer, followed by a delivery check here. The calendar never pretends to update Buffer's schedule.
- Overdue labels cover every scheduled content type. WordPress delivery checks include queued, scheduled, and missed publication records.
- An opt-in timing action asks the configured AI provider to rank available slots using observed publishing history. With no provider, clearly labelled available daytime slots are offered instead. There is no claim of measured audience availability or engagement optimisation. The Phase 2 AI calendar generator was not added to this workflow.

## Approval enforcement

- Standard content requires an independent reviewer. Authors cannot approve their own content.
- Paid advertising, external communications, partnership announcements, leadership communications, and crisis content require two different reviewers. The first names an owner, admin, or leader for the second decision. Content remains in Review until that named person signs.
- Copy, classification, and returns to Editing advance the revision. Earlier sign-offs remain in history but cannot authorise the new revision.
- Named decisions are stored separately from the status history. Audit snapshots show the person, role, revision, time, note, and previous/new schedule where relevant.
- Approval, scheduling, and manual post recording use database functions with membership, role, version, and state checks. Audit failures roll back decisions rather than silently losing their history.
- Authenticated database clients cannot directly update release status/timestamps or insert, edit, or delete approval/sign-off/publication history. Database triggers also gate service-mediated publication records and prevent editing approved copy.
- Platform limits are checked in the database before Review/Approved and again before release. X's optional thread separator is recognised; ordinary paragraph breaks do not turn a long post into multiple posts. Video production briefs retain the existing caption-limit exemption.
- WordPress, Buffer, and Strapi check recorded approval and reserve the asset before contacting the provider. Manual social posting still requires confirmation and the live HTTPS link.
- New content can begin as an Idea or Editing draft, with a content type and approval category.

## Existing content and rollout

The connected Supabase project has these recorded migrations:

- `20261015133111_content_approval_and_calendar_workflow.sql`
- `20261015133925_harden_content_copy_limits.sql`

The main migration was rehearsed against the live schema inside a rolled-back transaction before application. Existing copy, publication history, and status counts were preserved: 100 AI generated, 9 Editing, 5 Review, 2 Approved, 4 Scheduled, and 8 Published. Known paid-ad/PR/press-release content receives the corresponding sensitive classification; generation authorship is backfilled where available.

Older Approved/Scheduled items do not acquire invented signatures. The UI explains that fresh recorded approval is needed before a new release or future reservation. Remove an old reservation, return the content to Editing, and request review. Existing provider deliveries must be managed/reconciled at their destination before changing their content here.

This schema requires the updated application actions. Other deployments sharing this database must use this code before attempting the former direct status/history writes. These changes have not been pushed or deployed to a hosted application.

Schema/policy/grant snapshots and rollout evidence are saved under `C:/Users/ghost/.codex/backups/` (`content-workflow-live-before.json`, `content-workflow-rollout-result.json`, and `content-migration-history.json`). The original merge recovery backup remains intact.

## Verification

- 412 automated tests across 45 files, including actual PostgreSQL execution through PGlite for independent and sensitive approvals, revision invalidation, stale/cross-workspace attempts, immutable history, audit rollback, character limits, and provider receipt verification.
- Provider orchestration tests cover rejected/stale changes, uncertain requests, confirmed unscheduling, and preserving a WordPress post that is already live.
- Live database workflow rehearsal: Review → Approved → Scheduled → rescheduled → unscheduled → manually recorded Published, with the complete audit trail. All temporary writes were rolled back. No external publishing request was sent.
- Lint, TypeScript, and production build checked. Desktop/mobile calendar and content controls inspected in the authenticated browser.

Real provider delivery still depends on working WordPress/Buffer/Strapi credentials. Provider mutations are covered by mocks and database receipt tests; no real social post, CMS article, email, or AI generation was sent for verification.
