# Social platform icons

Replaced standalone social-platform labels with shared, monochrome brand icons across content lists and details, the command centre, chart legends, calendar, publishing, campaigns, community, lead attribution, repurposing and footer links. Platform pickers display the selected icon and show names beside icons in their menus. Account names and authored content remain readable text.

Supported marks: LinkedIn, Instagram, Facebook, X (including legacy Twitter values), YouTube, TikTok, Threads, Bluesky, Pinterest and Mastodon. Unknown and non-social sources retain their text. Custom brand paths come from the CC0 Simple Icons repository; existing Lucide marks are reused where available.

## Verification

- Full test suite: 661 tests passed across 63 files before adding Pinterest/Mastodon cases. Expanded icon suite: all 15 cases passed afterward.
- Final production build passed, including TypeScript and generation of all 52 static pages. ESLint passed. `git diff --check` passed.
- Library: selected Instagram, submitted the filter, observed `channel=instagram` and four matching assets. Clear filters returned all 35 assets and reset the trigger to All channels. Added a key to remount server-controlled filters when their URL value changes.
- New content: Enter opened Channel, ArrowDown selected Instagram, Enter confirmed it. The native form field retained `name=channel`, `value=instagram`, and `required=true`. Escape dismissed the menu. Cancel returned to the library without creating content.
- Calendar: Instagram reduced the unscheduled list from 24 to four items. All platforms restored 24. Existing scheduling actions were not changed.
- Publishing: Instagram submitted `platform=instagram` and displayed eight matching posts. Mobile width and document width both measured 390 pixels, with no horizontal overflow.
- Footer: X and Instagram links retain their original destinations, accessible link names, titles and new-tab behavior.
- Corrected the Select popup's CSS variable syntax so long icon menus scroll within the available space. Desktop menu bounds measured top 6.4/bottom 370 in a 720-pixel viewport; mobile bounds measured top 6/bottom 432/right 341 in a 390-by-844 viewport. Pinterest and Mastodon options both rendered SVG marks in the publishing picker.
- Regression cases cover accessible names, hidden decorative SVGs, legacy Twitter deduplication, unknown/non-social fallbacks, and original form values for clearable and disabled filters.
- Browser proof: `social-platform-icons-library.png`, `social-platform-icon-picker.png`, `social-platform-icon-picker-mobile.png` and `social-icons-publishing-mobile.png` in the task's visualization directory.

No records were created or published during these checks. Provider credentials and database policies were not changed.

## Delivery gate for this change

The gate applies to the icon replacement and the selectors composed for it, not a new audit of unchanged pages. Existing direction: white workspace, navy text, blue actions, Open Sans, monochrome icons. ENERGY 2 / RHYTHM 2 / MOTION 1.

- R-02 PASS: the change adds no prose containing em dashes.
- R-03 PASS: publishing measured 390/390 viewport/document width on mobile.
- R-17 PASS: no statistics were invented; browser counts came from existing workspace records.
- R-18 PASS: no testimonials or people were added.
- R-23 PASS: brand icons were explicitly requested; existing navigation and logos are retained.
- R-24 PASS: footer destinations are unchanged; Cancel and Clear filters returned to `/library`.
- R-25 PASS: icons inherit existing foreground/muted tokens; library glyphs measured RGB 87,99,117 against white, exceeding 3:1 for graphical objects.
- R-26 PASS: library/publishing filters submitted original values; calendar filtering and clearing worked.
- R-27 PASS: existing loading, error and empty states remain in the same page branches.
- R-28 PASS: FAQs were not changed.
- R-32 PASS: Enter, ArrowDown and Escape worked in the shared picker; existing focus rings remain on triggers and footer links.
- R-33 PASS: implementation lives in source components; no runtime CSS or DOM patching was added.
- R-34 PASS: inherited semantic colors are used; no theme behavior changed.
- R-35 PASS: final build, type checking, lint, tests and the recorded browser interactions above passed.
- R-36 PASS: no security, performance or compliance claims were added.
- R-37 PASS: existing user-approved identity and dials were retained.
- R-38 PASS: displayed content and accounts are existing data; no fictional records were added.
- R-01 PASS: no gradients, glows or new surface colors were added.
- R-04 PASS: each mark identifies its actual platform; Lucide reuse follows the user's existing icon choice.
- R-06 PASS: typography is inherited from the established Open Sans system.
- R-07 PASS: no background pattern was added.
- R-08 PASS: no decorative arrows were added; picker chevrons retain their disclosure function.
- R-09 PASS: no decorative badges were added.
- R-10 PASS: no blur or glass was added.
- R-12 PASS: existing Select popup elevation communicates an overlay; no new card shadows were added.
- R-13 PASS: no glow was added.
- R-14 PASS: existing content hierarchy and list structures are retained.
- R-19 PASS: only existing Select open/close transitions are used; no decorative motion was added.
- R-22 PASS: no illustration was added.
- Liveliness PASS: platform marks supply recognition within existing content-led screens; headings, whitespace, blue actions and product typography retain their existing roles and declared dials.
- C-1 PASS: marks identify destinations and reduce repeated metadata text.
- C-2 PASS: browser checks confirm selection, submission, clearing, dismissal and cancellation.
- C-3 PASS: no sections or content were added for decoration.
- C-4 PASS: shared rendering covers null, unknown, duplicate, disabled and empty-filter values; keyboard and mobile checks passed.
- C-5 PASS: data and validation evidence are identified above.
- R-05 PASS: page composition and navigation remain intact.
- R-11 PASS: existing component radii are retained.
- R-15 PASS: existing task actions and wording are retained.
- R-16 PASS: no marketing buzzwords were added.
- R-20 PASS: existing RIL identity is retained; the request is an icon refinement, not an identity replacement.
- R-21 PASS: no theme default changed.
- R-29 PASS: marks use currentColor and retain the established palette.
- R-30 PASS: no ornamental decorations were added.
- R-31 PASS: status badges and colors retain their existing meanings; social marks identify platforms rather than status.
