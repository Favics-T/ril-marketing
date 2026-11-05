# Colleague integration — 5 November 2026

## Preserved work

The local analytics and interface changes were committed as `982d4e8` before merging. The local backup branch is `codex/checkpoint-before-colleague-20261105`. Generated walkthrough recordings remain outside the code commit, with a second copy under `%LOCALAPPDATA%/RILBackups/integration-2026-11-05-224936/recordings`.

The integration keeps the existing authenticated layouts, shadcn components, full-message email review, consent-filtered delivery controls, Content Library links, analytics, and channel icons. No environment file was read or included in the checkpoint.

## Merged branches

- `taiwo/leads-lockdown` at `80e028b`: authenticated users may update the existing CRM fields but cannot directly insert/delete leads or change consent, unsubscribe, suppression, contact or workspace fields. The scoped community-to-lead function remains available.
- `REN-414-sensitive-signoff` at `42d7839`: sensitive emails require an independent senior sign-off; changes to subject, preview, body or audience invalidate that sign-off. Flagging or changing signed-off content during delivery pauses sending. Database guards and delivery checks remain in place, with append-only sign-off history.
- `taiwokolapo533/ren-421-dashboard-show-failed-and-overdue-posts` at `7cd246d`: the Command Centre shows failed/missed publishing attempts and overdue approved/scheduled posts in a separate Needs attention panel. Same-channel successful retries clear older failures. The due-today reminder list no longer duplicates overdue posts. Query failures have a separate panel error state.

Conflict resolution combined behavior rather than replacing either version. Content's named second-reviewer indicators remain alongside email's senior sign-off notices. Email inbox links and full message disclosure remain. The dashboard retains its current layout, metrics, decision queue and channel icons.

Production verification exposed a Turbopack error in the generated Google Fonts imports for Open Sans (`next/font/google queries have exactly one entry`). The root layout now loads the same Open Sans family through `next/font/local`. The unchanged official variable font, its SIL Open Font License and pinned upstream provenance are bundled in `public/fonts`, so the build no longer needs to fetch that font from Google.

## Database rollout is separate

The linked Supabase reference remains `rbyyyflgeuigcslhnxat`. A fresh migration-history check using the existing CLI session again failed with HTTP 403 at the login-role endpoint. The audit ran from an isolated temporary directory with copied migration files and link metadata, without loading `.env`.

No remote database changes were made. The live status of these versions is unverified:

1. `20261021000000_email_sensitive_signoff.sql`
2. `20261025000001_landing_page_approval.sql`
3. `20261028000000_email_signoff_content_and_unflag.sql`
4. `20261103000000_leads_column_grants.sql`

The email follow-up's comment says its predecessor was already applied. That is the colleague's handoff evidence, not an independently verified live result. Do not deploy an application that expects the new columns before checking its target database. The updated email actions now expect the trigger to record the submitter.

An authorized deployment operator should run:

```powershell
Set-Location -LiteralPath 'C:\Users\ghost\Downloads\renaissance marketing'
supabase migration list --linked --project-ref rbyyyflgeuigcslhnxat
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault --dry-run
```

Review the exact pending set, target database, backups and compatibility of every application sharing that database before authorizing application. Because the incoming migration dated 21 October precedes some existing local migrations, the CLI may report an ordering discrepancy. Stop for history/schema reconciliation; do not automatically add `--include-all` or run `migration repair`.

When the migration history is consistent and the exact pending set has been reviewed and authorized, the normal apply command is:

```powershell
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault
```

`db push` applies every pending migration, not one named file. Never include seeds or reset the remote database as part of this integration.

The operator can check recorded versions without selecting application data:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20261021000000', '20261025000001', '20261028000000', '20261103000000')
ORDER BY version;

SELECT tgname, tgenabled, pg_get_triggerdef(oid, true)
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('landing_pages_approval_guard', 'email_campaigns_signoff_guard');

SELECT has_table_privilege('authenticated', 'public.leads', 'INSERT') AS can_insert_leads,
       has_table_privilege('authenticated', 'public.leads', 'DELETE') AS can_delete_leads,
       has_column_privilege('authenticated', 'public.leads', 'marketing_consent', 'UPDATE') AS can_edit_consent,
       has_column_privilege('authenticated', 'public.leads', 'notes', 'UPDATE') AS can_edit_notes;
-- Expected after the lead migration: false, false, false, true.
```

Compare the guard definitions with the checked-in migrations, confirm the triggers are enabled normally, and verify the existing organization-scoping policies remain. Run the colleague's rollback-only SQL checks in staging before any production rehearsal. They create test fixtures temporarily, so they require deployment authority even though they end in rollback:

- `supabase/tests/ren414_sensitive_signoff.sql`
- `supabase/tests/leads_column_grants.sql`

The landing-page-specific backup, approval and public-access checklist remains in [the earlier deployment audit](LANDING_PAGE_MIGRATION_DEPLOYMENT_2026-10-28.md).

## Validation scope

The new `tests/colleague-security-migrations.test.ts` loads the three incoming security migrations into an isolated PGlite database and executes the colleague's SQL suites unchanged. Its auth/table fixture tests the new grants, triggers and SQL assertions; it does not reproduce the entire deployed Supabase schema or prove a production rollout. Application tests mock provider writes. No live email, social post, CMS publication, lead submission or provider connection mutation is part of this integration.

### Completed validation

- All **1,106 tests across 108 files pass**: the 107-file suite produced 1,104 passes, and the newly added attention-panel file produced two more. Both colleague SQL suites are included in that count.
- The shared Windows Vitest run timed out under contention and stalled between files. Validation used the normal fork pool in fresh per-file processes, with two files at a time. JSON reports and a combined result remain under `%TEMP%/ril-integration-file-results`. The timezone tests also passed in the fork pool; a diagnostic thread-pool run was not used for acceptance because those tests intentionally change the process timezone.
- Full-project lint passed, followed by lint on the three code files added or changed afterward. TypeScript passed independently and again in the successful production build.
- `next build` passes after the local-font fix, including all 53 generated static pages.
- The built app was served locally on port 3001. Sign-in returned HTTP 200; unauthenticated requests to `/dashboard`, `/email`, `/approvals` and `/analytics` returned HTTP 307 to `/sign-in`.
- Authenticated visual verification remains incomplete: the in-app browser webview failed to attach on repeated attempts. No authenticated screen or live workflow mutation was claimed as visually verified.
- Ancestry checks confirm the integration contains current colleague `main` and all three incoming branch tips. No unresolved merge conflicts remain.

### Publishing handoff

GitHub CLI had no active login, and a push dry run failed because no GitHub credentials were available. The user chose to sign in while validation continued. Push and PR creation must be confirmed from their actual command results; this document does not claim either has happened. The prepared PR title and body are in [PR_INTEGRATION_2026-11-05.md](PR_INTEGRATION_2026-11-05.md). Commits use the existing local identity, **DavidAroh**, with no added assistant co-author trailer.
