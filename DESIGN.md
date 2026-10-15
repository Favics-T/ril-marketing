---
name: RIL Marketing Workspace
description: A composed marketing workspace with human approval at every release gate.
colors:
  primary: "hsl(213 86% 39%)"
  brand-blue: "#177ae5"
  surface-strong: "#182332"
  surface-strong-selected: "#314766"
  surface-strong-hover: "#223145"
  surface-strong-border: "#354255"
  surface-strong-muted: "#b8c6d8"
  sidebar-foreground: "#35465f"
  canvas: "hsl(220 25% 97%)"
  card: "#ffffff"
  foreground: "hsl(216 34% 17%)"
  muted-foreground: "hsl(215 15% 40%)"
  info-background: "#edf4fe"
  info-foreground: "#20569e"
  success-background: "#eef6f1"
  success-foreground: "#24633d"
  danger-background: "#fbeeee"
  danger-foreground: "#a32d2d"
typography:
  display:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 4.4vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 2.4vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.045em"
  body:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.6
  navigation:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  status:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
  section-title:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  field-mobile:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  stat:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
  metric:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
rounded:
  control: "6px"
  panel: "12px"
  composition: "16px"
  status: "5px"
  action-large: "8px"
  menu: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
  navigation-selected:
    backgroundColor: "{colors.surface-strong-selected}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
  status-info:
    backgroundColor: "{colors.info-background}"
    textColor: "{colors.info-foreground}"
---

# RIL Marketing Workspace

## Overview

**Creative North Star: "A composed marketing workspace"**

A composed marketing workspace for the RIL team: white navigation and working surfaces, slate metadata, and blue reserved for the next action. Open Sans and the existing RIL logo preserve the user's established identity. On 15 October 2026 the user restored the light sidebar, original blue-art homepage and split-screen blue ASCII authentication design from their screenshots. Navy remains available for dashboard metrics and charts.

Full-project redesign, guided by Emil Kowalski's design engineering principles. ENERGY 2 / RHYTHM 2 / MOTION 1.

The homepage uses the original “One event in. A whole campaign out.” hero with the blue RIL sculpture, followed by the tagline, six-step workflow, platform modules, approval, learning, FAQ and closing sections. Authentication places the form on white beside the existing animated ASCII mark on RIL blue. The sidebar uses a black logo, blue action button, pale blue selection and “You’re in control” footer. Signed-in visitors can still view the homepage and open their workspace explicitly. Recent navigation, form, AI settings and text-rendering fixes remain in place.

**Key Characteristics:**
- Navy navigation separates wayfinding from editing.
- White panels and structured rows keep decisions scannable.
- Status words communicate meaning alongside color.
- Page changes use a short settling transition; keyboard search remains immediate.

## Colors

### Primary

Action blue identifies the next action and keyboard focus. Brand blue remains available for brand and chart roles; its exact relationship to the official media kit is recorded in PRODUCT.md rather than asserted here.

### Neutral

Navy anchors navigation, metrics and chart panels. Selected navigation and hover surfaces use their own semantic tokens. White working surfaces sit on a pale slate canvas; slate text carries secondary detail.

Information, success and danger treatments each have background, foreground and border tokens. Shared surface and status tokens live in `src/app/globals.css`. The light sidebar overrides its local navigation tokens in workspace.css; restored public/authentication blue is scoped in product.css. Dashboard charts and metrics retain their existing navy surfaces.

**The Named State Rule.** Color supports a status word; it never replaces it.

## Typography

Open Sans remains the sole typeface, following the user's previous font choice. Weight and size establish hierarchy. The frontmatter records the current display, workspace heading, body and label styles; it does not introduce a new type direction.

The existing navigation (13px), status (11px), panel title (15px), mobile field (16px), statistic (28px) and metric (36px) steps are documented too. Fluid public section headings, responsive metric reductions and local title variants are intentional extensions rather than a new typeface. Outbound email uses Arial as a client-compatible fallback; legacy logo fills are brand assets, not interface palette drift.

Page headings lead, contextual dates and counts follow, and actions align with the heading. Tabular numerals support measurements. Factual copy and the product's approval terminology stay intact.

## Layout

The workspace uses persistent desktop navigation and a mobile drawer. Content has a maximum width of 1440px. The Command Centre uses a 1.85:1 main/side layout: review, measured goals and source activity lead; calendar, content mix and lead follow-up sit alongside. Below 1100px these groups stack, with two side panels alongside each other where space allows. Editors place guidance alongside the form, then stack it below 1024px. Lists use structured rows and metadata wraps on mobile.

Below 768px, controls have at least 44px targets, forms stack, and large tables scroll within their containers. Workspace search and standalone original-comment links meet the same target standard. Every editable Community reply has a visible associated label and distinguishing comment context in its accessible name.

## Elevation & Depth

White panels use a quiet offset shadow (`0 2px 3px -2px #18233214`) and a light 1px boundary. Navigation stays flat; dialogs use a broader offset shadow for their temporary layer. The requested thick dark top-edge accents are removed.

## Shapes

Controls, panels and large compositions use a 6/12/16px hierarchy. Status chips use 5px corners. Corners group related content without turning the whole interface into pills.

## Components

### Buttons and fields

Primary actions use blue, white text, visible focus and disabled feedback. Standard buttons are 40px high on desktop; large actions are 48px. Mobile minimums are 44px. Fields use white surfaces, bounded widths, associated labels and a visible focus ring.

### Navigation and status

Selected navigation uses the dark selection token, with a word and icon. Status treatments map to named information, success and danger families; neutral states use the shared muted tokens.

Lucide is the configured shadcn icon library across navigation, pagination, actions, feedback and disclosure controls. Button icons use `data-icon` placement and inherit their size from the component. Decorative icons are hidden from assistive technology; control labels carry the meaning. Provider and organization logos remain identity assets, and charts remain data graphics.

### Panels and charts

Panels share ordinary light borders with no decorative top stripe. The Command Centre's review header uses a full navy surface, named action and compact count; this is not a border accent. The content mix retains the requested rounded donut and established slate slices. Measured KPI progress has a chart and numeric percentage; goals without measurement sit in an accessible disclosure with their target values. Missing measurement remains distinct from zero. Other analytics views retain their existing chart layout.

### Motion

At the user's request on 15 October 2026, shared motion now covers the site. Workspace and authentication page content settles over 220ms while the shell stays still; streamed page replacement also receives this transition. Controls respond in 140ms, menus enter in 180ms and leave in 120ms, dialogs enter in 220ms, and mobile drawers enter in 260ms. Disclosures interpolate their content size where the browser supports it. AI connection forms and feedback have a brief arrival. The homepage hero coordinates copy and the RIL mark once, with existing section reveals following viewport entry. These effects use CSS or the Web Animations API without another animation library.

Workspace search retains its existing header-anchored behavior matching the user's Efferd video reference. Mouse and touch clicks expand the field leftward and reveal results downward over 260ms. F when not typing and Ctrl/Cmd+K open instantly; grouped page results support arrow selection, Enter navigation and Escape. Reduced motion removes spatial effects, including active page animations, and keyboard focus remains immediate and visible.

The user-requested content-mix animation settles its slices once on viewport entry (300ms per slice, staggered by 60ms). Fine-pointer hover offsets a slice by 4px with a 160ms transition. Reduced motion shows the static final chart; percentages, geometry and colors are unchanged. This is a local chart treatment, not a recurring page entrance.

## Do's and Don'ts

### Do:
- Do preserve the navy/blue palette, Open Sans and plain black/white RIL logo.
- Do use semantic dark-surface and status tokens for repeated colors.
- Do label editable fields and keep mobile targets at least 44px.
- Do keep approval, consent, organization and publishing gates authoritative.
- Do include text equivalents for charts and distinguish missing data from zero.

### Don't:
- Don't reintroduce the thick dark top-edge accents the user removed.
- Don't revive the discarded Open Lab or Flatplan visual direction.
- Don't invent testimonials, customers, statistics or claims.
- Keep routine page transitions under 250ms and do not delay keyboard search.
