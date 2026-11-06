# Release readiness: 6 November 2026

The current branch is suitable for a local pilot, subject to the remaining acceptance checks below. It is not signed off for public production use. The user selected the existing Vercel project `ril-marketing`, then explicitly deferred Vercel work. No production promotion or merge into main was performed.

## Completed in this readiness pass

- Added GitHub Actions checks for PRs to main and pushes to main: clean dependency installation, tests, lint, TypeScript, a production build and HTTP smoke checks. They use CI-only public configuration and no production credentials. Supabase service keys and provider keys are not supplied to the runner. The workflow has read-only repository permissions and cannot publish content or deploy the database.
- Added `npm run check:http -- <origin>` for 11 unauthenticated HTTP checks: the homepage and sign-in page, login redirects on protected workspace routes, rejection of unauthenticated publishing/email cron requests, and Resend webhook method/signature checks. It does not trigger an authenticated worker or send email. CI starts a temporary production server and runs the same checks against it.
- Corrected content approval controls: authors see why another reviewer must approve; approval is unavailable to an ineligible role, a repeated first reviewer, or someone other than the named senior reviewer. The second-reviewer picker excludes the author and the current reviewer. Guidance is associated with the status field for assistive technology. The database remains the final approval authority.
- Corrected older email bodies that displayed and sent literal Markdown markers. Review and both outgoing text/HTML variants now use the existing newsletter plain-text conversion. Stored copy and approval records are unchanged. HTML stays escaped, and unsubscribe/idempotency safeguards are preserved.
- Removed contradictory deployment advice that described credential encryption as optional. `AI_CONFIG_SECRET` must remain stable on deployments sharing the encrypted connections.

## Verified results

- Nine targeted approval tests and 48 email/newsletter tests passed locally. Email tests use mocked provider requests, including the new Markdown/escaping regression case; no real email was sent.
- Lint on changed source files passed. The rebuilt production app passed TypeScript and generated all 53 static pages. It was restarted locally on port 3001.
- All 11 local HTTP checks passed. The full GitHub checks passed on the approval-fix commit `65fb06a`; check the PR's latest Project checks result before merging any subsequent commit.
- Signed-in owner checks exercised library search and its empty state, required-title validation, connected-channel selection, content review, calendar day/week/month switching, email disclosure/setup guidance, and all three Analytics tabs. Analytics CSV export produced the audience CSV for the selected dates.
- In the rebuilt preview, the author's Approved option is disabled while Editing remains available. Review guidance is visible and associated with the status selector. The page has no horizontal document overflow at 1280 px or 390 px; Escape closes mobile navigation. Email disclosure shows readable copy without the old heading/bold markers, and the browser reported no warnings or errors during these checks.
- Live connection diagnostics verified Gemini key/model access and one available Buffer channel. No generation, post or email was requested by these diagnostics.
- The database rollout remains documented in [the migration report](MIGRATION_STATUS_2026-11-06.md): all 33 migrations applied, live transaction tests rolled back cleanly, and affected data/access policies unchanged.

These checks do not claim that every user role or external delivery has been exercised in an authenticated browser. Existing application records were inspected, not edited, approved or published for this pass. Provider diagnostics may refresh their cached health/channel state.

## Release gates still open

| Gate | Remaining action | Acceptance evidence |
| --- | --- | --- |
| Production configuration | Resume work on the selected `ril-marketing` project and confirm its actual public domain. Set the public origin and existing stable secrets in the correct hosting environment. | Production setup check passes; sign-in and public pages work at the confirmed HTTPS origin. |
| Authentication redirects | Supabase's current `site_url` is `http://localhost:3000` and its redirect allow-list is empty. Replace/add the confirmed production URLs while retaining only needed development/preview callbacks. | Real sign-in/confirmation/reset flows return to the correct application. No guessed domain is configured. |
| Required integrations | Decide which services are in the initial launch. Notion, YouTube, WordPress, Strapi, GA/Search Console and Resend currently need setup; optional services may remain disconnected with their existing guidance. | Each service included in the release passes its saved connection check. |
| Real delivery | Use designated test content/accounts for an approved Buffer post, any required CMS publication and a YouTube upload if in scope. For email, use an opted-in test address and a verified sender. | Provider confirms delivery, the platform stores its receipt/live URL, and a deliberate failure follows the recovery path without duplicate delivery. |
| Email/webhooks | Configure the real Resend webhook and signing secret after the public origin is available. | Signed delivery events appear; unsubscribe cancels future delivery. Unsigned requests remain rejected. |
| Independent reviewer acceptance | Have a separate reviewer complete approval. Exercise sensitive content with its named senior reviewer, plus a normal member's restricted access. | Authors cannot self-approve; only the named person completes the second decision; changed copy requires fresh approval. |
| Background operation | Verify the deployed cron configuration and monitoring. The checked-in jobs run daily; email delivery processes at most 100 per invocation. Confirm this cadence fits launch volume. | Scheduled runs and failure alerts are observed on the deployed host. No unauthenticated invocation succeeds. |
| Recovery | Establish a full managed backup or a verified database export/restore procedure. The migration snapshot covers affected data/schema only; no completed managed backups or PITR were available at rollout. | Restore a backup into an isolated database and confirm records, memberships, RLS, grants and approval guards before adopting the procedure. |
| Review and release | Review PR #10 and require its latest Project checks result before merging. A merge may trigger the existing hosting integrations, so coordinate it with the deferred deployment setup. | Final checks pass, the intended commit is deployed, and Marketing accepts the release. |

## Commands

```powershell
npm run lint
npm run typecheck
npm test -- --pool=forks --maxWorkers=2
npm run build
npm run check:setup -- --production
npm run check:http -- http://localhost:3001
```

`check:setup -- --production` currently fails the public HTTPS origin check in the local configuration, while required secret presence and database-table reachability pass. It verifies the environment where it runs; a local result does not certify Vercel's environment. Run the HTTP check against the confirmed deployed origin only after production configuration is ready. Do not paste secret values into tickets, PRs or check output.
