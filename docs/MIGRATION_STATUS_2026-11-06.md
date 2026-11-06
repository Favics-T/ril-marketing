# Supabase migrations applied and verified: 6 November 2026

## Completed rollout

After the read-only inspection below, the user granted full access and explicitly instructed continuation. The exact three pending migrations were applied to `rbyyyflgeuigcslhnxat` at 11:50 WAT (10:50 UTC), using the checked-in SQL without changes. The CLI exited successfully. Verification completed at 11:53 WAT.

| Migration | Final state |
| --- | --- |
| `20261025000001_landing_page_approval.sql` | Applied; landing-page approval function and enabled guard trigger verified. |
| `20261028000000_email_signoff_content_and_unflag.sql` | Applied; enabled email guard, content-change invalidation and sign-off history `reason` column verified. |
| `20261103000000_leads_column_grants.sql` | Applied; authenticated INSERT=false, DELETE=false, consent UPDATE=false, notes UPDATE=true. |

Remote history now contains all 33 local versions. A final dry run reports `upToDate: true`, with no migrations, seeds or roles pending. RLS remains enabled and the inspected access policies are unchanged.

Before applying, a dry run confirmed exactly these three files. A transaction containing their definitions, both colleague SQL verification suites and additional landing-page approval checks passed on the live database, then rolled back. The same workflow checks passed after deployment without reapplying any migration, and rolled back again. Checks cover independent reviewers, rejection of self-approval and editing reviewed pages, publication attribution, cleared approvals on return to draft, sensitive-email copy/audience invalidation and lead permissions. No test users remain.

The rehearsal exposed a test-fixture error: the lead suite used `engaged`, while the real stage constraint and application use `engagement`. The SQL test now uses the valid value, and the isolated PostgreSQL fixture includes the real stage constraint. The two local security migration tests pass; the former value fails with that constraint. Migration SQL was not altered.

Affected records were compared before and after: six landing pages, six email campaigns, no sign-off events, no leads and one community item are unchanged. Account/workspace counts are unchanged: six auth users, six profiles, five organizations and six memberships.

### Recovery evidence and limits

The managed-backup endpoint reported no completed backups and PITR disabled. A private local snapshot of affected rows, relevant function definitions, triggers, grants, constraints, policies, exact migration files and execution results was saved before rollout at:

`C:/Users/ghost/AppData/Local/RILBackups/migration-rollout-2026-11-06-1793961888959`

This is an affected-data/schema recovery snapshot, not a full managed database backup. It contains private application data and must not be committed. Review its schema/grant snapshot before any targeted recovery; do not reset the database or delete migration-history rows to undo a deployment.

Commands used, in an isolated CLI directory containing the project's linked configuration and all 33 migration files:

```powershell
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault --dry-run
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault --dry-run
```

The updated personal token initialized a temporary database login role. The previously rejected database password was omitted; credentials were never logged. No seeds, role deployment, vault update, migration repair or remote reset ran. No hosting deployment, live email or provider publishing was performed. Authenticated browser checks remain outstanding.

## Earlier read-only inspection (superseded by the rollout above)

Project: `rbyyyflgeuigcslhnxat`. During the initial read-only phase, the updated personal token successfully read migration history and database metadata through the Management API. No credential values were displayed, and that phase made no remote changes.

## Live results

The migration-history endpoint returned HTTP 200 with 30 applied versions. A separate read-only SQL query returned the same version list. Comparing that list with the 33 checked-in migration files identifies exactly three pending files, in order:

| Migration | Verified state |
| --- | --- |
| `20261025000001_landing_page_approval.sql` | Pending. Neither `public.guard_landing_page_workflow()` nor `landing_pages_approval_guard` exists. |
| `20261028000000_email_signoff_content_and_unflag.sql` | Pending. The existing email guard lacks the follow-up's content-change invalidation, and `email_campaign_signoff_events.reason` is absent. |
| `20261103000000_leads_column_grants.sql` | Pending. The authenticated role still has direct lead INSERT/DELETE privileges and UPDATE on `marketing_consent`. |

`20261021000000_email_sensitive_signoff.sql` is recorded as applied. Its email-campaign guard trigger exists and is enabled normally. This resolves the earlier uncertainty about the prerequisite; it does not need to be blindly reapplied.

The expected landing-page columns, including `metadata` and approval attribution fields, exist. RLS is enabled on both `landing_pages` and `leads`, and the landing-page table has one policy. These schema checks do not replace a full rollout rehearsal or authenticated end-to-end verification.

## Original release gate and commands (historical)

The updated token was requested for read-only verification. Credential presence and successful inspection do not authorize application. No migration was attempted with it. The database password rejected on 5 November was not retested during this read-only check.

An authorized operator with working deployment credentials should first confirm the project, backup/restore point, release window and compatibility of applications sharing this database, then run:

```powershell
Set-Location -LiteralPath 'C:\Users\ghost\Downloads\renaissance marketing'
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault --dry-run
```

The dry run must contain only the three pending files above. Stop if the history has changed, another migration appears, or authentication fails. No `--include-all`, migration-history repair, seeds, remote reset or RLS changes are needed merely to resolve this verified pending set.

Only after deployment authorization and the preview are confirmed, the apply command is:

```powershell
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault
```

Afterward, verify all three recorded versions, the enabled landing-page and email guards, the email history `reason` column, and the expected lead grants: INSERT=false, DELETE=false, consent UPDATE=false, notes UPDATE=true. Run the role/approval and public-page checks in the existing [integration handoff](COLLEAGUE_INTEGRATION_2026-11-05.md) and [landing-page deployment checklist](LANDING_PAGE_MIGRATION_DEPLOYMENT_2026-10-28.md). Prefer designated staging records for workflow tests.

## Evidence and limits

- Read-only audit time: 6 November 2026, approximately 11:34 WAT.
- Requests used the documented `/database/query/read-only` endpoint. No application records were selected.
- Migration and catalog responses are saved locally under `%TEMP%/ril-readonly-migration-audit-results.json` and `%TEMP%/ril-migration-prerequisites-results.json`. These contain schema metadata, not credential values.
- Earlier 403/401/password failures remain historical findings in [the credential diagnosis](SUPABASE_CREDENTIAL_DIAGNOSIS_2026-11-05.md); the new token now works for the verified read operations.
