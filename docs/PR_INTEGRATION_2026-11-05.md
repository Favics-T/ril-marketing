# Integrate marketing workspace, analytics and colleague security updates

Base: `Favics-T/ril-marketing:main`

Head: `Favics-T/ril-marketing:david/integrate-colleague`

This combines David's local workspace and analytics changes with the colleague's lead permissions, sensitive-email approval and failed/overdue publishing work. It preserves the existing layouts, content workflows, full-message review, channel icons and approval indicators.

Sensitive email campaigns require independent senior sign-off before delivery. Changes to subject, preview, body or audience invalidate that sign-off, and changing approved copy during delivery pauses sending. The Command Centre separates failed/overdue posts from due-today reminders. Database grants restrict direct lead updates to CRM fields, protecting consent and suppression data.

The checkpoint also includes the unified Overview, Content and Audience analytics views, comparisons, channel breakdowns and CSV exports, plus the existing workspace interface updates. Open Sans is bundled with its licence to fix a Turbopack Google Fonts build error without changing the typeface.

## Validation

- 1,106 tests across 108 files pass, using fresh per-file fork processes to avoid a Windows worker-reuse stall. This includes both unchanged colleague SQL verification suites in isolated PostgreSQL and dashboard panel rendering tests.
- TypeScript, lint and the production build pass. The built sign-in endpoint returns 200 and protected routes redirect unauthenticated requests to sign-in.
- Authenticated browser verification remains incomplete because the in-app webview could not attach. Provider writes are mocked; no live publishing or sending was performed.

See [the integration handoff](COLLEAGUE_INTEGRATION_2026-11-05.md) for the exact validation scope and commands.

## Database rollout

Do not deploy before reviewing the target Supabase schema and migration history. Live migration inspection currently returns HTTP 403, so no remote migrations were applied and their status remains unverified. Review versions `20261021000000`, `20261025000001`, `20261028000000` and `20261103000000`. The earlier email migration may require migration-order reconciliation; do not blindly add `--include-all` or repair history.

The integration handoff includes preserved-work checkpoints and the rollout checklist. The older PR #7 targets a different integration branch and does not include this head; it has not been changed or closed by this work.

Related: REN-414, REN-421.
