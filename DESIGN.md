---
name: RIL Marketing Workspace — Collaboration canvas
description: A light, spacious marketing workspace grounded in the RIL Press Kit, with the selected Miro reference informing layout and softer geometry.
source:
  title: "RIL Press Kit"
  pages: 49
  sha256: "ee3e0bfe8d41e0ed99b10fd9684f64250af0779e41ed45f71c887bf70dce1729"
colors:
  brand-blue: "#177AE5"
  brand-black: "#212120"
  white: "#FFFFFF"
  action-blue: "#1268C5"
  action-hover: "#0C529F"
  blue-tint: "#EDF5FF"
  blue-soft: "#DCECFF"
  canvas: "#F5F8FC"
  border: "#DFE6EF"
  secondary-text: "#62676C"
typography:
  family: "Open Sans, system-ui, sans-serif"
  public-display: "44–68px desktop; 38–52px phone"
  workspace-display: "32–48px desktop; 36px phone"
  workspace-title: "32px desktop; 28px phone"
  section: "20–24px"
  body: "16px; 1.65–1.75 line height"
  label: "14px"
  metadata: "12px"
geometry:
  controls: "10–12px radius"
  panels: "20px radius"
  large-groups: "28–32px radius"
  spacing: "4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 72, 80, 96px"
motion:
  feedback: "180–240ms"
  reduced-motion: "Remove nonessential movement"
---

# RIL collaboration-canvas design

## Direction and authority

A bright, spacious workspace that brings sources, drafts, decisions, and campaign follow-up together. White navigation and working surfaces sit on a light blue-grey canvas. RIL blue identifies actions and selected work; soft blue groups establish context without heavy black bands. Rounded geometry and open spacing give the app the collaborative quality of the selected Miro reference.

The supplied media kit governs identity. Open Sans, RIL Blue #177AE5, Black #212120, White #FFFFFF, horizontal black/white logos, and the five named motifs remain authoritative. The Miro reference informs composition, spacing, lighter surfaces, and geometry. Its yellow palette, proprietary typography, and logos are not imported into RIL.

This round replaces the previous black navigation and black public hero. It preserves the product, data, and workflows rather than presenting a simulated collaboration product. No presence avatars, shared cursors, fabricated comments, or editing permissions are invented.

## Verified media-kit rules

The supplied source matches the previously reviewed 49-page kit by SHA256. Its complete text and relevant visual examples established the following rules:

- Pages 7–9: optimistic, witty, confident, clear language. Interface labels, errors, consent, and approval decisions remain literal; public copy can be more expressive.
- Pages 13–18: the horizontal icon-and-logotype relationship; black or white logo variants only; no recolouring, rotation, effects, containing shapes, or newly stacked variants.
- Page 20: White #FFFFFF, Black #212120, and Blue #177AE5. The blue value is visible on the colour page although missing from its extracted text.
- Page 21: supporting shades. Secondary Renaissance colours chiefly belong to sub-brands, so they are not added as competing interface accents.
- Pages 22–24: Open Sans for headings, subheadings, and body, with mixed-case hierarchy and legibility on the chosen surface.
- Pages 26–27: Momentum (chevron), Community (circle), Flow (horizontal rectangle), Excellence (starburst), and Productivity (plus). Repetition and outline/lighter-fill interpretations are permitted.
- Page 28: flat/doodle and 3D illustration styles. This application reuses existing supplied RIL artwork; no new illustrations are generated.

Social image, film, email-signature, and merchandise guidance remains specific to those media. It does not add exports or impose social-post dimensions on the web application.

## Tokens and code ownership

`src/app/ril-brand.css` defines the brand palette and the light workspace compositions. Its product selectors include the workspace root so route-level legacy styles cannot override the final surface treatment. `src/app/ril-system.css` provides compatible `--work-*` tokens. Existing HSL semantic variables retain their format for Tailwind and Radix.

`src/app/(dashboard)/workspace.css` and `dashboard/command-centre.css` retain operational layout foundations. `src/app/product.css` defines the public, authentication, and public-campaign compositions. It has been rewritten for the current components rather than adding another theme override stack.

The exact RIL blue appears in artwork and brand motifs. Action blue #1268C5 and hover #0C529F are accessibility adaptations for small white button labels and text links, not claimed as the kit's primary blue. Semantic status colours remain accompanied by words and do not become additional brand accents.

Controls use approximately 10–12px rounding, content panels 20px, and large contextual groups 28–32px. White panels use light borders instead of heavy shadows. Typography relies on size, weight, and whitespace rather than all-capital labels. Normal-flow grid and flex layouts keep primary content from overlapping.

## Navigation

Navigation uses the existing black logo on white. A separate caption names the workspace. Active links use a pale-blue surface and darker blue text. Search, account controls, breadcrumbs, expandable groups, keyboard behavior, and the mobile drawer remain intact.

The collapsed rail keeps its functional expansion glyph rather than inventing a monogram. Its padding differs from the expanded navigation so the control remains reachable. The footer's human-approval reminder stays visible when expanded.

## Command Centre

The greeting and next action sit directly on the light canvas, with a soft-blue context panel alongside. A local view strip links to Overview, Review queue, Plan & schedule, and Results. These are real routes, not cosmetic tabs.

Actual review, schedule, content, and lead totals sit in separate readable panels. The review total receives blue emphasis. Each total links to its relevant workspace; unavailable data stays labelled unavailable.

The decision queue remains the main work area. Filters, status words, real content and insight links, and empty/error states are preserved. Source activities appear below it. Schedule and lead follow-up occupy the supporting column, with goals, channel mix, and tasks in their own regions.

The content-mix chart now has a white surface. Its labels and empty state use dark text rather than the former inverse palette. Segment values still come from recorded assets, and percentages are derived from those values.

## Lists, editors, and records

Content and lead directories separate filters from results on desktop. Filters collapse into a labelled disclosure below tablet width. Search, channel/activity/campaign/status parameters, pagination, and clear-filter links retain their original behavior. Titles lead, metadata follows, and each next action remains explicit.

Audience segments appear as real profile panels on wide screens and stack on smaller screens. Audience insights place evidence beside the finding and recommendation. Confidence and sample size remain visible; they are not replaced with invented score graphics. Approvals retain their filters, oldest-first ordering, partial-data warnings, and links to the full record.

Content editors retain source context, editable copy, saved preview, revision state, and approval/distribution controls. The numbered workflow uses a named current stage. Blue guidance areas support the white editor rather than competing with it. Files, provenance, live links, approval history, and scheduling remain available.

Campaign plans retain objective, audience, dates, budget, channel plan, lifecycle controls, and linked work. Actual results sit on a pale-blue strip. Lead detail facts wrap in full beside follow-up controls. Consent, explainable score reasons, and nurture eligibility retain their existing rules.

## Operational surfaces

Publishing retains connection state, alerts, repeating plans, filters, posts, and provider receipts. Its guide explains preparation, review, delivery, and confirmation without performing them. Email retains composer, independent approval, eligible-recipient counts, sender settings, scheduling, and actual delivery metrics.

The calendar keeps its day/week/month views, filters, WAT times, unscheduled items, and confirmed button/drag scheduling. Blue content panels identify work within the calendar; a reservation is not presented as publication. Narrow layouts use the existing agenda reflow.

Report creation and scheduling remain distinct from the archive. Pale-blue report headers, neutral metric groups, readable narratives, reviewer state, and evidence limitations keep each saved period understandable. Missing integrations remain named, not silently shown as zero.

Settings use a white local navigation group with a blue selected surface. Connector cards, brand knowledge, automation, assistant prompts, and forms share the lighter treatment. Roles, connection tests, credentials, opt-in automation, and external delivery behavior are unchanged.

## Public pages

The homepage has a centred outcome and a normal-flow workflow illustration. The diagram labels the real process: source activity, channel-specific drafts, and human review. It does not display fake dates, performance metrics, team members, or working controls. The original blue sculpture retains its full frame beside the process.

An ordered workflow, capability groups, light-blue brand statement, AI/human responsibility panels, audience-learning diagram, FAQ, and closing action explain the product. The primary action creates a workspace. Header sign-in or workspace access remains explicit. Legal and external links are retained.

Authentication places the unchanged form on white beside a soft-blue brand panel with the existing ASCII artwork and official motifs. The real logo, labels, password visibility, validation errors, pending feedback, email confirmation, and Supabase redirects remain functional. The optional artwork panel disappears on phones.

Published campaign pages use the black logo on a white header, readable full-frame content, and a soft-blue interest-form area. The existing builder blocks, publication state, CTA labels, registration links, attribution, validation, and consent handling remain intact. Editing a draft does not make it public.

## Imagery and source records

The existing black and white logo assets receive no recolouring or special effects. The original sculpture is 561 × 715 and is rendered at its intrinsic ratio. No new stock photos, generated images, or external hotlinks are introduced.

`src/components/brand-motif.tsx` draws interpretations of the five geometric motif types. They are not claimed to be extracted vector masters. Motifs remain decorative and do not replace action labels or status words. Source and licence information is retained in `public/assets/credits.json`.

## Responsive and accessible behavior

Workspace content remains capped at 1360px; public sections use 1280px. Headers, navigation, and normal-flow panels reserve their own space. Tablet widths collapse filter rails before results become too narrow. Overview, evidence, editor guidance, report scheduling, account panels, and public sections stack deliberately at smaller widths.

Phone forms retain 16px text and controls at least 44px high. Actions and metadata wrap, long detail values remain visible, and list previews keep a route to the full record. Visible focus, associated labels, accessible names, existing Radix focus management, hidden-state rules, and closed-dialog behavior remain intact.

Status words accompany colour. Reduced-motion preferences stop nonessential animation and transitions; the existing animation components also honor the preference. The brand statement remains fully readable without animation.

## Delivery boundaries

Changes are applied to the original Renaissance Marketing app and mirrored in this Open Design project. A timestamped source backup was made before this round. Existing landing-page builder changes, approval logic, consent rules, integrations, and other uncommitted work are preserved.

No environment values, credentials, database records, or migrations are changed. No messages are sent and no content is published. TypeScript and lint are code checks; they do not establish live integration readiness or a browser-based visual review. The existing original-app server uses `http://localhost:3000`.