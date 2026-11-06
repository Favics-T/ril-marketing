# Integrate marketing workspace, analytics and colleague security updates

Base: `Favics-T/ril-marketing:main`

Head: `Favics-T/ril-marketing:david/integrate-colleague`

This combines David's local workspace and analytics changes with the colleague's lead permissions, sensitive-email approval and failed/overdue publishing work. It preserves the existing layouts, content workflows, full-message review, channel icons and approval indicators.

Sensitive email campaigns require independent senior sign-off before delivery. Changes to subject, preview, body or audience invalidate that sign-off, and changing approved copy during delivery pauses sending. The Command Centre separates failed/overdue posts from due-today reminders. Database grants restrict direct lead updates to CRM fields, protecting consent and suppression data.

The checkpoint also includes the unified Overview, Content and Audience analytics views, comparisons, channel breakdowns and CSV exports, plus the existing workspace interface updates. Open Sans is bundled with its licence to fix a Turbopack Google Fonts build error without changing the typeface.

Approval status choices now explain and disable self-approval and ineligible second-review decisions before submission. Legacy Markdown email bodies use the same plain-text conversion in full-message review and outgoing email, preserving escaped HTML and unsubscribe controls. GitHub Actions now runs tests, lint, type checks, a production build and unauthenticated HTTP smoke checks without production credentials.

## Validation

- The integration baseline passed 1,106 tests across 108 files, using fresh per-file fork processes to avoid a Windows worker-reuse stall. This includes colleague SQL verification suites in isolated PostgreSQL and dashboard panel rendering tests. On 6 November, the two security migration tests passed again after correcting a lead-stage test value and adding the real stage constraint to the fixture.
- TypeScript, lint and the production build pass. The built sign-in endpoint returns 200 and protected routes redirect unauthenticated requests to sign-in.
- The 6 November owner-session checks exercised library validation/search, connected channels, review controls, calendar views, email disclosures/setup and Analytics tabs/CSV export. Live connection diagnostics verified AI writing and Buffer. Multi-user acceptance and real provider delivery are still pending; provider-write tests remain mocked.

See [the integration handoff](COLLEAGUE_INTEGRATION_2026-11-05.md) for the exact validation scope and commands.

## Database rollout

On 6 November, after explicit deployment authorization, the three pending migrations were applied: `20261025000001_landing_page_approval.sql`, `20261028000000_email_signoff_content_and_unflag.sql`, and `20261103000000_leads_column_grants.sql`. All 33 local versions are now recorded remotely; a final CLI dry run reports no pending migrations. The original `20261021000000_email_sensitive_signoff.sql` was already applied and was not reapplied.

Live rollback tests passed both before and after deployment for independent landing-page approval, sensitive-email sign-off and restricted lead permissions. Enabled guards, the email history column and restricted consent grants were verified. Existing affected records, account/workspace counts and inspected policies are unchanged. The rollout required no history repair, seeds or reset. A private affected-data/schema recovery snapshot was saved first; the project has no completed managed backups and PITR is disabled. See [the rollout report](MIGRATION_STATUS_2026-11-06.md) for evidence, commands and remaining browser checks. This database rollout did not deploy the hosted application or send/publish content.

The integration handoff includes preserved-work checkpoints and the rollout checklist. The older PR #7 targets a different integration branch and does not include this head; it has not been changed or closed by this work.

Related: REN-414, REN-421.

See [release readiness](RELEASE_READINESS_2026-11-06.md) for the remaining acceptance gates. The user deferred Vercel configuration and production deployment; this PR remains a draft.
