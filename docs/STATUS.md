# Project Status — Feature Audit and Best-Practices Review

Audited: **2026-10-08**, against `main` at `7a64fd8`, **plus the uncommitted publish-history work** in the working tree (see feature 9).
Read-only audit: no code was changed. The live database was checked with two read-only calls: Supabase Management API migration history, and the PostgREST schema listing.
Baseline: [content-gap-audit.md](content-gap-audit.md) (2026-10-02). Three commits have landed since then.

## Summary

| # | Feature | Status | One-line verdict |
|---|---|---|---|
| 1 | Improve content quality | **Done** | Per-format specs, schema-checked LLM output with one retry, quality flags, generation brief, channel limits enforced on Review/Approve. |
| 2 | Social posts as reminders with "due today" / "overdue" | **Not started** | "Scheduled" is a status plus a timestamp. No reminder, due-today or overdue logic exists anywhere. |
| 3 | Schedule blogs on WordPress | **Not started** | WordPress publishing is immediate only (`status: "publish"`). No future-dated posts and no scheduled job. |
| 4 | Send SEO title and description to the website | **Done (uncommitted, untested on a live site)** | WordPress: SEO title + meta description written to Yoast or Rank Math (chosen in settings). Strapi: optional SEO title/description field mapping, including `component.field`. Description still doubles as the excerpt. |
| 5 | Turn an approved newsletter into an email campaign | **Not started** | No action or button converts a newsletter asset, and `email_campaigns` has no link to `content_assets`. Only the unattended automation job drafts an email. |
| 6 | Calendar: approved / scheduled / published / overdue, week view, rescheduling | **Partial** | Month list only, showing Scheduled and Published only. No Approved, no Overdue, no week view, no reschedule action. |
| 7 | Fix scheduled times being an hour off | **Not started** | Root cause still present: `datetime-local` is parsed in the server's zone (UTC on Vercel), and the views disagree on which zone they display. |
| 8 | Failures and overdue posts on the dashboard | **Not started** | The dashboard never reads `publications`. Overdue scheduled items are *filtered out* of the dashboard. |
| 9 | Publish history on every content item | **Partial (uncommitted, blocked)** | UI, query and migration are written but uncommitted. **The migration is not applied to the live DB, so every publication insert will fail there**, Buffer's included. |
| 10 | Rich text editor for the landing page | **Done** | Tiptap editor storing Markdown, with a sanitised renderer, tests and a raised length limit (`7a64fd8`). |

**Totals: 3 Done · 2 Partial · 5 Not started.**

### Top risks, in priority order

1. **Do not deploy the uncommitted publish-history code before applying `20261008000000_publication_history.sql`.** Live `publications` has no `url` or `actor_id` columns, so PostgREST will reject the inserts. Those insert results are never checked, so publishes will appear to succeed while recording nothing, and Buffer history breaks along with WordPress and Strapi.
2. **Hour-off bug (7)** affects every scheduled item, and the calendar and dashboard show different times for the same item.
3. **WordPress posts render raw Markdown.** AI blog bodies are Markdown (`## ` headings), but [wordpress.ts:81-82](../src/lib/integrations/wordpress.ts#L81-L82) HTML-escapes the body into `<p>` tags, so live posts show literal `##`, `**` and similar. This was not one of the 10 features, but it blocks 3 and 4 from being useful.
4. **Approval and audit rows are editable by any workspace member** through the browser Supabase client: RLS checks org membership only, for every operation, on `content_assets`, `asset_approvals` and `publications`. That includes the new publish history.
5. **Overdue content is invisible.** It drops off the dashboard (`scheduled_for >= now`), the calendar doesn't flag it, and nothing publishes it.

---

## Feature detail

### 1. Improve content quality: **Done**

**Evidence**
- Per-format specs with Zod schemas and prompt rules: [specs/blog.ts](../src/lib/ai/specs/blog.ts), [specs/newsletter.ts](../src/lib/ai/specs/newsletter.ts), [specs/social.ts](../src/lib/ai/specs/social.ts), [specs/short-form.ts](../src/lib/ai/specs/short-form.ts), [specs/shared.ts](../src/lib/ai/specs/shared.ts)
- One generation path that validates the reply, retries once with the validation error, raises the token limit on truncation, caps concurrency and adds quality flags: [llm-generator.ts](../src/lib/ai/llm-generator.ts)
- Source material (transcripts, documents, media notes) passed into prompts, with visible truncation notes: [source.ts](../src/lib/ai/source.ts), [source-material.ts](../src/lib/content/source-material.ts)
- Generation brief (tone, length, audience, goal, CTA, SEO keyword, newsletter style). Template fallback is opt-in and labelled: [generate-from-activity.tsx](../src/components/content/generate-from-activity.tsx), [provider.ts](../src/lib/ai/provider.ts)
- Channel hard limits enforced before Review/Approved: [channels.ts](../src/lib/content/channels.ts), [content.ts:756-760](../src/actions/content.ts#L756-L760); live counter in [draft-editor.tsx](../src/components/content/draft-editor.tsx)
- Tests: [generation.test.ts](../src/lib/ai/generation.test.ts), [channels.test.ts](../src/lib/content/channels.test.ts)

**What's missing (follow-ups, not blockers)**
- No moderation pass. No token or cost capture on `ai_generations`.
- `sensitivity` is still never set, so the second-tier approval can never trigger (gap audit A2).
- The marketing-automation job still auto-saves template fallback drafts. This is intended, but they need watching in review.

**Risks**
- Quality flags are advisory: nothing stops an asset with flags from being approved.
- LLM paths are tested with mocks only. There is no regression check against a real provider.

### 2. Social posts as reminders with "due today" / "overdue": **Not started**

**Evidence (what exists)**
- `content_assets.scheduled_for` is set when moving to `scheduled`: [content.ts:782-787](../src/actions/content.ts#L782-L787)
- The Buffer publish action exists but **has no UI caller** ([integrations.ts `publishAssetViaBuffer`](../src/actions/integrations.ts#L49)). A repo grep finds no reference outside its definition.

**What's missing**
- No "reminder" concept. Nothing computes due today (`scheduled_for` within the workspace's local day) or overdue (`status = 'scheduled' AND scheduled_for < now()`).
- No badge or flag on the library, calendar, asset page or dashboard.
- No notification channel (email, in-app task). The `tasks` table exists ([tasks.ts](../src/lib/audience/tasks.ts)) and could carry these, but nothing writes publish reminders to it.
- No "mark as posted" step for posts published by hand. Today `scheduled → published` is a generic transition that records no `publications` row.

**Risks**
- "Due today" needs a workspace timezone, which doesn't exist yet (see 7). If this is built before 7 is fixed, it will flag the wrong day around midnight WAT.

### 3. Schedule blogs on WordPress: **Not started**

**Evidence**
- [wordpress.ts `publishWordPressPost`](../src/lib/integrations/wordpress.ts#L76-L89) always POSTs `status: "publish"` with no `date` / `date_gmt`.
- [actions/wordpress.ts `publishApprovedBlog`](../src/actions/wordpress.ts#L69) requires `status === "approved"`, so a `scheduled` asset can't be published at all.
- [vercel.json](../vercel.json) has 6 crons and none publishes due content.

**What's missing**
- Either (a) send `status: "future"` with `date_gmt` = `scheduled_for` and let WordPress publish it, or (b) a cron that publishes due `scheduled` blogs.
- Allow the publish action from `scheduled`, record a `queued` publication, and reconcile it once the post goes live.
- Unschedule and reschedule handling (update or trash the future post in WordPress).

**Risks**
- Option (a) depends on WP-Cron, which only fires on site traffic. Option (b) depends on Vercel Hobby crons, which are daily only (`lead-nurture` was already moved to daily for this reason), so posts could go out up to 24h late.
- Markdown rendering bug (top risk 3) applies here too.

### 4. Send SEO title and description to the website: **Done (uncommitted)**

**What was built**
- WordPress settings have an **SEO plugin** choice: None, Yoast SEO or Rank Math, saved as `config.seoPlugin`. It is checked on save: Rank Math must expose `rankmath/v1`, and Yoast's `_yoast_wpseo_title`/`_yoast_wpseo_metadesc` must appear in the posts REST schema.
- On publish (or when linking an existing post with the same slug), `metadata.seo.title`/`description` are written to the plugin: Rank Math through `POST /wp-json/rankmath/v1/updateMeta`, Yoast through the post `meta` (confirmed from WordPress's response, since unregistered keys are dropped silently). See [lib/integrations/wordpress.ts](../src/lib/integrations/wordpress.ts).
- An SEO write failure never fails the publish. The action returns a `warning`, the publish panel shows it, and `metadata.wordpress_seo_saved` records the outcome.
- Strapi has optional **SEO title field** and **SEO description field** settings. A dotted path such as `seo.metaTitle` writes into a component, and both fields share one component object.
- Tests: [wordpress.test.ts](../src/lib/integrations/wordpress.test.ts), [strapi.test.ts](../src/lib/integrations/strapi.test.ts).

**Still open**
- Yoast needs the site to register its meta for REST. The snippet is shown in the WordPress settings form when Yoast is selected.
- Focus keywords are not sent.
- Content already published can't be re-sent or updated. Strapi only writes SEO on create, not when linking an existing entry.
- Not yet tested against a real Yoast or Rank Math site, or against Strapi's SEO component (which may require `metaImage`).

### 5. Turn an approved newsletter into an email campaign: **Not started**

**Evidence**
- [email.ts `createEmailCampaign`](../src/actions/email.ts#L25) only takes typed form input.
- [email_campaigns.sql](../supabase/migrations/20260923000003_email_campaigns.sql) has no `content_asset_id` (confirmed on the live schema).
- The only bridge is the unattended job, which drafts an email from a freshly *generated* newsletter, not an approved asset: [marketing-automation.ts:76-105](../src/jobs/marketing-automation.ts#L76-L105).
- The newsletter spec already produces subject options and preview text: [specs/newsletter.ts](../src/lib/ai/specs/newsletter.ts).

**What's missing**
- A "Create email campaign" action on approved newsletter assets that copies the title/subject, preview text and body.
- `email_campaigns.content_asset_id` (FK) for traceability and to prevent duplicates.
- Body format conversion: the newsletter is Markdown, and the email body is sent as-is.

**Risks**
- The email flow needs a *second, different* reviewer to approve and queue it ([email.ts:63-65, 98-100](../src/actions/email.ts#L63-L65)). Converting an already-approved newsletter will need a decision: does the asset approval carry over, or does the email go through review again?

### 6. Calendar with approved, scheduled, published, overdue; week view; rescheduling: **Partial**

**Evidence**
- [calendar/page.tsx](../src/app/(dashboard)/calendar/page.tsx): a server-rendered **month list** grouped by day, with prev/next month.
- [assets.ts `listScheduled`](../src/lib/content/assets.ts#L127-L144) queries only `status IN ('scheduled','published')`, capped at 500.
- AI calendar proposals exist ([calendar-generator.tsx](../src/components/content/calendar-generator.tsx)) but only carry `metadata.suggested_publish_at`, so they never appear on the calendar.

**What's missing**
- **Approved** items (no date yet, or a suggested date) and **Overdue** (scheduled, `scheduled_for < now`, not published) are not shown or flagged.
- **Week view.** There is also no grid month view; it is a list.
- **Rescheduling.** There is no action; today it takes `scheduled → approved → scheduled` and retyping the date. There is no drag-and-drop either.
- Filters by channel, campaign or type.

**Risks**
- Day grouping uses the UTC date (`scheduled_for.slice(0,10)`, [calendar/page.tsx:58](../src/app/(dashboard)/calendar/page.tsx#L58)). Month boundaries are computed in the server zone ([calendar/page.tsx:46-47](../src/app/(dashboard)/calendar/page.tsx#L46-L47)). Items between 00:00 and 01:00 WAT land on the previous day or month. Fix 7 first.

### 7. Fix scheduled times being an hour off: **Not started**

**Root cause (still present)**
1. **Input:** `<input type="datetime-local">` ([asset-transition.tsx:59-64](../src/components/content/asset-transition.tsx#L59-L64)) submits `2026-10-10T09:00` with no zone.
2. **Parse:** `new Date(parsed.data.scheduled_for).toISOString()` runs on the server ([content.ts:786](../src/actions/content.ts#L786)), so it is read as **UTC on Vercel**. 09:00 entered in Lagos is stored as 09:00Z, which is **10:00 WAT**.
3. **Display is inconsistent:**
   - Dashboard: `timeZone: "Africa/Lagos"` hard-coded ([dashboard/page.tsx:62](../src/app/(dashboard)/dashboard/page.tsx#L62)) shows **10:00 WAT**.
   - Calendar: `toLocaleTimeString` with no zone, so the server zone, shows **09:00** ([calendar/page.tsx:31-35](../src/app/(dashboard)/calendar/page.tsx#L31-L35)).
   - `formatDay` / new `formatDayTime` use the server zone too ([format.ts:31-47](../src/lib/format.ts#L31-L47)). Asset-page "Suggested timing" does the same ([library/[id]/page.tsx:115](../src/app/(dashboard)/library/[id]/page.tsx#L115)).
   - Dashboard "today" is the UTC date ([dashboard/page.tsx:27](../src/app/(dashboard)/dashboard/page.tsx#L27)).

**What's missing**
- A workspace timezone (column on `organizations`, defaulting to `Africa/Lagos`).
- Convert the local input to an instant using that zone, either on the client (send an ISO string with offset) or on the server with the org zone. Pre-fill the input with the current value in the same zone.
- One shared formatter that always passes `timeZone`, used by the calendar, dashboard, asset page and publish history.
- Unit tests around DST-free and DST zones, and around midnight.

**Risks**
- Existing `scheduled_for` values were stored one hour late for Lagos users. After the fix they will *display* correctly as the time that was actually stored, which is one hour later than what users typed. Decide whether to shift existing future rows by −1h with a one-off migration.

### 8. Show failures and overdue posts on the dashboard: **Not started**

**Evidence**
- [dashboard/page.tsx](../src/app/(dashboard)/dashboard/page.tsx) loads insights, reviews, assets, leads, schedule, tasks, follow-ups, KPIs and activities. **It never reads `publications`.**
- `upcoming` keeps only `scheduled_for >= now` ([dashboard/page.tsx:45](../src/app/(dashboard)/dashboard/page.tsx#L45)), so **overdue items silently disappear** from the dashboard.
- Failed publish attempts *are* recorded (WordPress, Strapi and Buffer write `status: 'failed'` rows; WordPress and Strapi only in the uncommitted diff), but nothing surfaces them outside the new per-asset history panel.

**What's missing**
- An "Needs attention" panel: failed publications (latest per asset, not yet superseded by a success) plus overdue scheduled assets, each linking to the asset.
- Counts in the metrics row.
- Optionally, a `tasks` row on failure so it also appears in "Tasks needing attention".

**Risks**
- Depends on 9 (publication rows must actually be written to the live DB) and on 7 (for a correct "overdue" boundary).

### 9. Publish history on every content item: **Partial (uncommitted, blocked on migration)**

**Evidence (working tree, not committed)**
- Migration adds `publications.url`, `publications.actor_id` and an index, and backfills WordPress/Strapi rows from asset metadata: [20261008000000_publication_history.sql](../supabase/migrations/20261008000000_publication_history.sql)
- Query: [assets.ts `listAssetPublications`](../src/lib/content/assets.ts#L111-L125)
- UI: [publish-history.tsx](../src/components/content/publish-history.tsx), rendered on [library/[id]/page.tsx](../src/app/(dashboard)/library/[id]/page.tsx)
- WordPress, Strapi and Buffer actions now write `published` and `failed` rows with `url` and `actor_id`: [actions/wordpress.ts:89-99](../src/actions/wordpress.ts#L89-L99), [actions/strapi.ts:107-117](../src/actions/strapi.ts#L107-L117), [integrations.ts](../src/actions/integrations.ts)
- Pure-helper tests: [publications.test.ts](../src/lib/content/publications.test.ts)

**What's missing**
- **Apply the migration to the live DB.** Confirmed pending (see Migrations).
- Insert results are not checked anywhere ([actions/wordpress.ts:94,99](../src/actions/wordpress.ts#L94), [actions/strapi.ts:112,117](../src/actions/strapi.ts#L112), [integrations.ts:109](../src/actions/integrations.ts#L109)), so a failed history write is invisible.
- Manual `scheduled → published` transitions record no publication. The UI covers this with a "Marked published by hand" message.
- Actor name isn't shown (only `actor_id` is stored).

**Risks**
- **Deploy-order hazard:** if the code ships first, every publications insert fails on PostgREST's unknown-column error. This includes Buffer, which previously worked.
- `publications` RLS is `FOR ALL` by org membership, so any member can edit or delete history from the browser client. It shouldn't be called an "audit" trail until it is insert-only.
- The backfill casts `metadata->>'*_published_at'` to `timestamptz`. A malformed value would abort the migration. Values are app-written ISO strings today, so the risk is low.

### 10. Rich text editor for the landing page: **Done**

**Evidence**
- Editor (Tiptap v3, Markdown in and out, H2/H3, bold, italic, lists, quote, links, undo/redo, live count): [rich-text-editor.tsx](../src/components/ui/rich-text-editor.tsx)
- Wired into [landing-page-form.tsx](../src/components/landing-pages/landing-page-form.tsx). Limit raised to 10,000 in [landing-pages.ts](../src/actions/landing-pages.ts) and [landing-page-url.ts](../src/lib/landing-page-url.ts)
- Safe renderer (`skipHtml`, allow-list, unsafe protocols stripped, h1 folded to h2): [page-copy.tsx](../src/components/landing-pages/page-copy.tsx), used on the public page [p/[slug]/page.tsx](../src/app/p/[slug]/page.tsx)
- Tests: [page-copy.test.tsx](../src/components/landing-pages/page-copy.test.tsx)

**What's missing**
- No editor-level tests (Markdown round-trip of existing plain-text pages).
- The same editor isn't used for blog or newsletter bodies, which are also Markdown.

**Risks**
- The length limit counts Markdown syntax, so users see "including formatting" and hit the limit sooner than the visible text suggests.
- Round-tripping old plain-text copy through Tiptap can normalise it, for example by escaping `*` or `_` or merging single line breaks the next time a page is saved.

---

## Best-practices review

### Timezone handling: **Poor**
- There is no workspace or user timezone anywhere in the schema or app.
- Naive `datetime-local` values are parsed on the server ([content.ts:786](../src/actions/content.ts#L786)). This is the cause of feature 7.
- Rendering is inconsistent:
  - `Africa/Lagos` is hard-coded in one place ([dashboard/page.tsx:62](../src/app/(dashboard)/dashboard/page.tsx#L62)).
  - Explicit UTC is used in analytics ([analytics/page.tsx:31](../src/app/(dashboard)/analytics/page.tsx#L31)).
  - The server zone is used implicitly everywhere else: calendar, `formatDay`, `formatDayTime`, community, automation, lead nurture and follow-ups.
  - Calendar day grouping uses the UTC date string.
- Recommendation: an `organizations.timezone` column, one `formatInZone` / `parseLocalInZone` helper pair, and a lint rule or grep check against bare `toLocale*String` calls without `timeZone`.

### Supabase RLS: **Enabled everywhere; role-gating weak**
- All **41 tables** have RLS enabled (repo and live sets match).
- `email_provider_events` has RLS and no policy, which means deny-all to clients. That is intended: it is written only via `SECURITY DEFINER` RPCs granted to `service_role`.
- `SECURITY DEFINER` RPCs revoke `PUBLIC` and grant narrowly (`create_organization_with_owner`, `community_item_create_lead`, `record_resend_email_event`, `replay_resend_email_events`). The other definer functions are trigger functions (not callable via RPC) or `caller_organization_ids()`. Storage bucket policies are org-folder scoped.
- **Gap:** 35 of 53 policies are `FOR ALL` with org-membership checks only. Approvals, the `asset_approvals` audit log, `publications` history and `registration_links` can be written or changed by any member through the anon-key browser client ([supabase/client.ts](../src/lib/supabase/client.ts), shipped for uploads). Role and approval rules live only in server actions. `trend_monitoring` already shows the role-gated pattern to copy. Audit tables should be insert-only.
- Several actions use the **service-role client** for writes (for example, the CMS publish status update in [actions/wordpress.ts:100](../src/actions/wordpress.ts#L100) and [actions/strapi.ts](../src/actions/strapi.ts)). That is correct when it is guarded, but it means RLS gives no second line of defence there.

### Secrets exposure in client code: **Good**
- No `"use client"` file reads `process.env`. The only `NEXT_PUBLIC_*` values are the Supabase URL, the anon key and the site URL.
- [admin.ts](../src/lib/supabase/admin.ts) is `server-only`, and no client component imports it.
- Third-party credentials (WordPress application password, Strapi token, Buffer tokens, Resend key) are encrypted at rest with `AI_CONFIG_SECRET` ([secret-box.ts](../src/lib/crypto/secret-box.ts)) and only read server-side.
- `.env` is gitignored and untracked.
- **Watch:**
  - Local `.env` also holds `SUPABASE_ACCESS_TOKEN` (account-wide management token) and `SUPABASE_DB_PASSWORD`. The app doesn't use either; keep them out of Vercel project env.
  - Log files are committed (`dev-server.log`, `.next-dev-run.log`, `.impeccable/review/*.log`). A scan found no keys or JWTs in them, but they should be gitignored and removed from the index.

### Error handling around external APIs: **Mostly good, with gaps**
- **Good:**
  - WordPress and Strapi: 15s timeouts, `redirect: "error"`, DNS-resolved private-IP (SSRF) guard, mapped 401/403/404 messages, idempotent by slug, explicit "published but status not saved" message.
  - Resend uses idempotency keys and a retry schedule.
  - LLM calls have 60s timeouts and a validated retry.
  - GA4 has timeouts.
- **Gaps:**
  - Buffer OAuth token exchange and refresh `fetch` calls have **no timeout** ([buffer.ts:298](../src/lib/integrations/buffer.ts#L298), [buffer.ts:359](../src/lib/integrations/buffer.ts#L359)).
  - Buffer 429 is detected but not retried with backoff.
  - Inserts into `asset_approvals` and `publications` ignore their result ([content.ts:697,797](../src/actions/content.ts#L697), [integrations.ts:95,109](../src/actions/integrations.ts#L95), [actions/wordpress.ts:94,99,106](../src/actions/wordpress.ts#L94), [actions/strapi.ts:112,117,124](../src/actions/strapi.ts#L112)).
  - There is no error tracking or structured logging, so production failures are only visible to the user who triggered them.

### Type safety: **Strict but untyped at the DB boundary**
- `strict: true`; `tsc --noEmit` passes; ESLint is clean. There are **zero** `any`, `@ts-ignore` or `@ts-expect-error` in `src/`.
- **Gap:** no generated Supabase `Database` types. `db:types` in [package.json](../package.json) is a placeholder `echo`. Clients are untyped, query results are cast by hand (about 38 `as XRow` / `as XRow[]` casts), and `metadata` JSONB is narrowed ad hoc in each action. **This is exactly why the `url` / `actor_id` vs live-schema mismatch (feature 9) passes typecheck.** Generate types from the live project and type `createClient<Database>()`.

### Duplicated logic
- **SSRF/public-host guard and URL normaliser** are copy-pasted between [wordpress.ts:9-41](../src/lib/integrations/wordpress.ts#L9-L41) and [strapi.ts:19-51](../src/lib/integrations/strapi.ts#L19-L51).
- **CMS publish actions** `publishApprovedBlog` and `publishApprovedToStrapi` are about 90% identical: approval checks, excerpt and slug derivation, publication rows, status update and audit row.
- **Manager role list** `["owner","admin","marketing_manager"]` is inlined in 13 places (actions and pages), alongside the shared `REVIEWER_ROLES` / `requireReviewer` in [access.ts](../src/lib/audience/access.ts) and [guards.ts](../src/lib/audience/guards.ts).
- **Formatters:** `formatInteger` and `formatCompactNumber` exist in both [lib/format.ts](../src/lib/format.ts) (`en-US`) and [components/formater.ts](../src/components/formater.ts). `formatPercent` and `formatDate` also exist in both [lib/utils.ts](../src/lib/utils.ts) and `formater.ts`. Pages also call `toLocaleString` inline.
- **Two SEO checklists:** the draft editor and `/seo` (noted in the gap audit, S1).

### Test coverage: **Pure functions only**
- `vitest run`: **20 files, 155 tests, all passing.** `tsc` passes. Lint is clean.
- Covered: transitions table, AI specs and generation (mocked), channel limits, crypto, OAuth helpers, Strapi field mapping, email consent and delivery job, lead nurture, scoring, landing-page URL and copy rendering, publication helpers, and the lead capture route.
- **Not covered:**
  - Server actions with role or tier gating (`transitionAsset`, the publish actions, `createEmailCampaign`).
  - The calendar and dashboard queries, and any timezone parsing or formatting.
  - The cron routes (other than their jobs).
  - RLS policies (no SQL or pgTAP tests).
  - End to end flows.
- The features most likely to regress (7, 8, 9) have no tests.

### Migrations: applied vs pending, and drift

Checked live via the Supabase Management API (`/v1/projects/{ref}/database/migrations`) and the PostgREST schema listing.

| | Count |
|---|---|
| Migration files in `supabase/migrations/` | 23 |
| Applied on live project | 22 (versions match the first 22 files one to one) |
| **Pending** | **1: `20261008000000_publication_history.sql`** (uncommitted) |

- **Table drift:** none. Repo and live both have the same 41 tables.
- **Column drift:** only the pending migration. Live `publications` lacks `url` and `actor_id`, which the uncommitted code writes. Spot-checks of other recently added columns all match (`email_campaigns.metadata`, `email_campaigns.delivery_authorized_at`, `landing_pages.metadata`, `content_assets.updated_at`, `leads.marketing_consent`, `leads.email_suppressed_at`, `trends.risk`). A full column-by-column diff was **not** done; generating types (above) would make that mechanical.
- **History naming drift:** live migration names are truncated or different from the filenames (for example `20260923000000 brand` vs `…_brand_knowledge.sql`, and two different files both recorded as `email`). Versions line up, so `supabase db push` will work, but the history was clearly written by a different tool or by hand.
- **No local Supabase project config:** no `supabase/config.toml`, no link, no generated types. Migrations are applied outside a reproducible repo workflow.
- **Drift masking:** the early migrations use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` scaffolding ([audience_intelligence.sql:49-52](../supabase/migrations/20260916000000_audience_intelligence.sql#L49-L52) notes that `organizations` and `profiles` may already exist). These won't reconcile a pre-existing table whose columns differ, so a fresh database built from migrations may not match production exactly.

---

## Suggested order

1. **Apply `20261008000000_publication_history.sql` to live, then commit and deploy feature 9.** Check insert results while you're there.
2. **Fix 7** (workspace timezone + shared parse/format helpers + tests). Decide on shifting existing rows.
3. **8 and the overdue part of 6** (failures + overdue panel; Approved and Overdue on the calendar), then the week view and a reschedule action.
4. **Fix WordPress Markdown → HTML**, then **4** (SEO title and plugin meta) and **3** (future-dated WordPress posts).
5. **2** (reminders with due-today and overdue flags, built on 7 and 8), and wire the Buffer publish action into the UI.
6. **5** (newsletter → email campaign with `content_asset_id`).
7. Cross-cutting: generated DB types, role-gated and insert-only RLS for approval and history tables, and shared CMS publish and SSRF helpers.
