# Workflow usability pass — 21 October 2026

Scope: all 37 dashboard routes, grouped into 23 task families. Existing identity, authentication, workspace isolation, approvals, consent checks and publishing services are retained. No live generation, sending, publishing or test-record creation was used for this pass.

## Changes

| Workflow | Friction found | Change |
| --- | --- | --- |
| Orientation | Navigation lists product areas without explaining their relationship. | A route-specific Page guide explains the purpose, three steps and a relevant destination for every dashboard route. The Command Centre offers activity, authored draft and repurposing starting points when no activities exist. |
| Activity capture | Optional registration, people and campaign fields compete with the source description. | Name, date and description stay visible; supplementary details use a labeled disclosure. Existing populated details remain expanded. Saving still opens the activity for files and generation. |
| Authored content | Starting status competes with writing; successful saving does not explain the next step. | Editing remains the default; saving as an Idea is an optional setting. Clear saving/review guidance accompanies the form. Approval category remains visible. |
| Draft editing | Website search fields dominate social copy editing. | Website search details expand for website content and remain available as an optional disclosure elsewhere. All saved fields are still submitted. |
| Review/status | The status menu does not explain what each state means. | Context-specific guidance explains editing, independent review, approval, calendar reservations and publishing. The existing state machine and all server gates remain authoritative. |
| Repurposing | Initial activity selector can be empty; every output is selected; writing options overwhelm the source selection; “Save source Idea” obscures what happens. | Default to pasted text unless arriving from a specific source. Put source choice first, start with one blog output, disclose optional preferences, and label the action “Save source & continue.” Generation remains a separate explicit action. |
| Generation handoff | Activity draft generation returns to the entire library. | Success links filter the library by the source activity. Source detail copy distinguishes generation from recovery and links generated drafts individually. |
| Campaign planning | A large plan is required visually even though most fields are optional. | Name, objective and audience description lead. Dates, channel planning, linked segment and budget use an optional disclosure; existing plans remain expanded. The first campaign form opens automatically. |
| Audience segments | A beginner encounters preferences before defining the group. | Name and description lead; audience preferences are optional. “Hooks” becomes “Messages that resonate.” |
| Landing pages | URL slug and CTA terminology are technical; extra attribution fields distract from public copy. | Plain field labels, an explicit link-name example, accurate registration behavior and optional search/linking fields. Saving is labeled as a draft. Cancel returns to the related page list instead of arbitrary browser history. |
| Email review | Approval links lead to an unfiltered list; three-line clipping prevents reading the full message; authors see an approval button that the server will reject. | Approval links target the exact workspace-scoped email, even beyond the normal recent list. Full-copy disclosure opens during review. Only eligible independent reviewers see approval; others see the reason. |
| Email setup | Technical sender configuration appears before the writing task. | Draft creation and review lead; sender setup remains clearly linked and available below the workflow, with delivery requirements explained. |
| Nurture | Automatic enrolment appears before creating a sequence. | Create the sequence first; optional automatic enrolment follows the sequence list. Explain series, delays and consent in plain language. |
| Lead follow-up | Date and sequence labels disappear visually; absent sequences have no link. | Persistent field labels and a direct link to create/activate a series. Tasks remain separate from email sending. |
| Reports | Weekly/monthly selection does not update the dates. Errors leave the form through a generic page boundary. | Last complete Monday–Sunday week and calendar month presets, custom date editing, UTC explanation, pending state and recoverable inline feedback. Existing server validation remains. |
| Empty views | Empty content, leads, insights, SEO and publishing lists lack a practical next action; filtered emptiness looks like a fresh workspace. | Task-specific links and filter-aware library empty states. Automation empty-state guidance reflects whether the setting is already enabled. |
| Server form feedback | Saving or review actions can look idle during a request. | Shared form-status submit control prevents repeated clicks and announces pending work on email, nurture, community, report review/scheduling and automation forms. |
| Assistant | Markdown responses display as plain text. | Use the existing safe rich-text renderer. |
| Form recovery | React can reset uncontrolled fields even when an action returns a validation error. | Keep entered values in the activity, content, repurposing, segment, campaign, landing-page and brand forms so users can fix the problem without rewriting their work. |

Calendar, social/website delivery, community review, analytics, trends, brand knowledge and connections were inspected for entry points, boundaries and next steps. Their existing working controls are retained; their Page guides describe prerequisites and the distinction between drafting, approval and delivery. No new onboarding gate or compulsory tour is introduced.

## Verification

- Authenticated browser inspection of all 23 dashboard index surfaces and key create/review forms.
- Route coverage test ensures every current dashboard page has a guide with an existing destination.
- Report period tests cover week, year, month and leap-year boundaries; action tests cover validation, workspace scope and recoverable errors.
- Lint and TypeScript passed. The production build completed with all 52 static pages generated.
- Complete test suite: 760 tests passed across 74 files.
- Browser checks confirmed monthly presets change dates, manual date input changes the period to Custom, optional activity fields remain available, exact email review shows one item with the full copy expanded, and nurture starts with sequence creation.
- Desktop (1280px) and mobile (390px) inspection passed. Checked mobile forms had no document overflow; the guide stayed within the viewport and closed with Escape. Temporary viewport settings were reset.

Authentication and workspace setup were also reviewed in source: their existing labeled fields, inline validation, pending states and confirmation instructions were retained. No new account was created to exercise onboarding.

Live provider publishing and email delivery are deliberately outside this UX verification. No assertion of end-to-end delivery is made.
