# Colleague integration, 19 October 2026

The local `codex/integrate-colleague` branch combines the existing implementation at `5e3c50f` with two additional colleague branches. A backup branch, `codex/backup-before-ren417-and-search-20261019`, preserves the starting commit. The pre-existing generated `next-env.d.ts` change was backed up separately and was not discarded to make the merges succeed.

- `REN-417-landing-page-fixes` (`b5d6cb9`): internal page names stay private; public titles and previews use the headline; registration URLs are checked on save and display; lead responses no longer distinguish existing email addresses; repeat submissions only fill missing fields and retain first-touch attribution; tracking tokens are restricted to the landing page's workspace; the public form accepts an optional phone number. All incoming regression tests are retained.
- `wip-activity-search` (`a5f059e`): debounced activity search uses the URL, searches title/description/outcomes, supports clear and empty states, and filters within the caller's workspace. Its historical status document and repository instruction are retained. The historical document is labelled so its old status claims are not mistaken for today's implementation.

Four conflicts in the landing-page merge were resolved by combining the incoming behaviour and tests with the local spacing, surface styling and Lucide external-link icon. Activity search merged with the local Activity Hub campaign join intact. Additional tests cover workspace scoping, query sanitization, bounded terms, empty search and preservation of campaign details.

Existing social publishing, repurposing, approval enforcement, calendar, integration settings, private media and UI work remain in the combined branch. These are local merges; no GitHub branch or pull request is changed by this integration.
