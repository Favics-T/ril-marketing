# Colleague integration, 19 October 2026

The local `codex/integrate-colleague` branch combines the existing implementation at `5e3c50f` with two additional colleague branches. A backup branch, `codex/backup-before-ren417-and-search-20261019`, preserves the starting commit. The pre-existing generated `next-env.d.ts` change was backed up separately and was not discarded to make the merges succeed.

- `REN-417-landing-page-fixes` (`b5d6cb9`): internal page names stay private; public titles and previews use the headline; registration URLs are checked on save and display; lead responses no longer distinguish existing email addresses; repeat submissions only fill missing fields and retain first-touch attribution; tracking tokens are restricted to the landing page's workspace; the public form accepts an optional phone number. All incoming regression tests are retained.
- `wip-activity-search` (`a5f059e`): debounced activity search uses the URL, searches title/description/outcomes, supports clear and empty states, and filters within the caller's workspace. Its historical status document and repository instruction are retained. The historical document is labelled so its old status claims are not mistaken for today's implementation.

Four conflicts in the landing-page merge were resolved by combining the incoming behaviour and tests with the local spacing, surface styling and Lucide external-link icon. Activity search merged with the local Activity Hub campaign join intact. Additional tests cover workspace scoping, query sanitization, bounded terms, empty search and preservation of campaign details.

Existing social publishing, repurposing, approval enforcement, calendar, integration settings, private media and UI work remain in the combined branch. These are local merges; no GitHub branch or pull request is changed by this integration.

## Verification

- PASS: all 648 tests across 62 files, including the incoming landing-page tests and the additional activity-search integration checks.
- PASS: ESLint and the production build, including TypeScript and static page generation.
- PASS: both incoming commit tips and the previous local tip are ancestors of the combined branch. The merge commits are `d337b8b` for REN-417 and `85f0a3c` for activity search.
- PASS: browser search for `bootcamp` returned two of eight activities; an unmatched term showed the empty state; Clear restored all eight. Browser console checks reported no warnings or errors.
- PASS: the existing published landing page's visible headline, document title, Open Graph title and Twitter title agree; the internal dashboard name is absent from those public titles. Its optional phone input is present.
- PASS: the landing page and activity search reflow at a 390 px viewport without horizontal document overflow. The browser viewport override was reset afterward.
- PASS: the original local spacing, shared form controls and Lucide external-link icon are retained alongside the incoming features. No visual assets or new design direction were introduced; the existing task-focused ENERGY 2 / RHYTHM 2 / MOTION 1 settings apply.
- PASS: source changes and conflict resolutions are in the repository; no external patch or CSS override is needed. Source records, lead data and publishing requests were not modified for the browser checks. Submission, attribution, consent and duplicate-lead behaviour were exercised with automated fixtures.

Screenshots are saved as `merged-activity-search.png`, `merged-activity-search-mobile.png`, `merged-landing-page-fixes.png` and `merged-landing-page-mobile.png` under `C:/Users/ghost/.codex/visualizations/2026/09/30/01a0f244-bf58-7da1-b570-942a7f5137cb/`.
