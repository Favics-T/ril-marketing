# RIL Marketing Platform — design system

27 October 2026. The full project uses Emil Kowalski's design engineering principles: clear hierarchy, dependable controls, restrained motion, and small details that make repeated work feel immediate.

## Identity and direction

RIL's existing horizontal logo, Open Sans, and blue identity remain. The blue sculpture on the homepage is the existing supplied asset, shown at its natural ratio. No stock imagery, replacement logos, invented customer proof, or synthetic workspace records are introduced.

The interface is a light, neutral workbench. A pale grey canvas separates white work surfaces; fine rules group records; blue identifies actions, selected navigation, and useful information. The public website uses the same typography and controls with more space and a stronger headline. The charcoal closing panel uses RIL's existing black identity colour.

The previous glass presentation is replaced by opaque navigation and solid working surfaces. There is no theme switcher. Daily work remains visually quiet while source, review, and delivery stay distinct.

## Tokens and ownership

The shared controls are shadcn/ui source components from the official registry, using the existing New York / Radix setup. Buttons, fields, cards, badges, dates, pagination, tabs, progress, notifications, and overlays share that foundation across public and authenticated routes. See [SHADCN_UI.md](SHADCN_UI.md) for the full component map. Component variants own their presentation; layout CSS owns placement and reflow.

`src/app/ril-theme.css` owns the semantic palette and the compatibility aliases used by existing components. Tailwind colour bindings remain HSL channels; `--app-*` roles are complete CSS colours.

| Role | Value | Purpose |
| --- | --- | --- |
| Brand blue | `#177AE5` | RIL identity |
| Action blue | `#1466D7` | Filled controls and selected indicators |
| Link blue | `#175FC1` | Readable inline actions |
| Primary text | `#212120` | Titles and content |
| Body text | `#41464F` | Supporting content |
| Muted text | `#656B75` | Descriptions and labels |
| Metadata | `#6C727C` | Secondary context |
| Canvas | `#F6F7F9` | Workspace background |
| Panel | `#FFFFFF` | Forms, tables, and working areas |
| Divider | `#E4E7EC` | Surface boundaries |
| Field boundary | `#8B919C` | Input outline |

`src/app/ril-refresh.css` owns workspace composition and responsive behaviour. `src/app/product.css` owns the homepage, account screens, onboarding, and public campaigns. Shared primitives own their variants; `src/app/motion.css` owns interaction motion. Existing route-specific styles continue to describe specialised content and charts.

## Typography and geometry

- Open Sans throughout, with system sans-serif fallbacks.
- Workspace titles: 28px on desktop, 25px on phones; weight 600–650.
- Section headings: 15–16px; record titles: 13–14px.
- Working text: 13–15px; editor copy has a generous reading line height.
- Small labels and metadata: 11–12px; counts use tabular numerals.
- Public headline: up to 64px, reducing fluidly to phone sizes.
- Default buttons: 40px; compact actions: 36px; coarse-pointer targets: at least 44px.
- Phone inputs: 16px text and 44px height.
- Control radius: 7px; panel radius: 12px; large public surfaces: 18–20px.
- Main gutters: 32px desktop, 24px on smaller laptops, 18px on phones.

## Workspace structure

The 15.5rem sidebar has a fixed identity/search/action area, a separately scrollable tool list, and settings access at the bottom. Selection is a quiet blue row. Groups remain collapsible; the collapsed rail retains real destinations and tooltips. Mobile uses a dismissible solid sheet.

The straight top bar reserves its space above scrolling content. It contains location, workspace search, the page guide, and the real account menu. Search supports F and Ctrl/Cmd+K. Page titles, contextual dates, descriptions, and actions share consistent baselines.

The Command Centre has one four-metric strip, a review queue beside the publishing agenda, and separate follow-through areas for activities, leads, and tasks. Metrics come from the workspace or display an explicit unavailable state. Local review filters remain inside the queue.

The Content Library uses a full-width filter panel and a real table with a wider content column. Status choices scroll horizontally on phones. Mobile records keep the content title first, with labelled workflow and date/action fields below it.

Repurposing has a main source form and a narrower recent-source column. Output choices are a compact group of independent checkboxes. Editors and delivery workflows distinguish the main working area from supporting context. Settings use a dedicated section navigation beside their forms.

The calendar keeps its backlog beside the dated content when space permits. Phone filters form two columns, and the month view uses a compact seven-column grid. Scheduling retains its existing confirmation and approval checks.

Analytics retains Overview, Content, and Audience views with persistent date-range text, complete metric labels, and local charts. When there are visits but no captured leads, the initial trend displays visits. Empty and unavailable states remain distinct. Audience panels use valid Card composition.

## Public and account screens

The homepage opens with a short benefit-led headline, the existing blue sculpture, a primary workspace action, and a four-step explanation of the workflow. Responsibility, capabilities, workflow, learning, FAQ, and the closing action use different layouts without introducing fictional business evidence. Signed-in visitors can open their workspace directly.

Desktop account pages pair the form with a quiet explanation of the workflow. Phones show the form and RIL identity directly. Password visibility, validation, pending/error feedback, confirmation, and redirects remain. Authentication forms use POST and hold submission until hydration so credentials do not fall back to a GET query.

Onboarding separates the team form from next-step guidance. Published campaigns pair readable source content with the real consent-aware lead form and stack at smaller widths.

## Interaction rules

| Before | After | Why |
| --- | --- | --- |
| Page and streaming-content entrance animation | Immediate route content | Repeated navigation should feel direct |
| Broad hover motion | Short colour feedback | Frequent work should stay visually stable |
| Identical pointer and keyboard transitions | Instant keyboard-triggered overlays | Keyboard users should not wait for presentation |
| Inset frosted navigation | Solid neutral navigation | Keep text and current location predictable |
| Oversized or clipped review controls | Compact, labelled local filters | Keep all choices usable on a phone |
| Empty Card slot in Audience analytics | Two complete peer panels | Preserve rendering and information structure |
| Duplicate desktop sidebar toggles | One toggle beside the sidebar identity; mobile-only header opener | Keep navigation controls predictable without duplication |
| Framed header controls and repeated page icons | Page name, compact search, quiet help, and a circular account control | Give frequent navigation a clearer hierarchy |
| Analytics arrow wraps below its label | One inline shadcn action with a fixed-size trailing icon | Keep the label and destination cue together |

Pointer presses receive a subtle 0.98 scale response over 120ms. Menus and popovers enter near their trigger with a small opacity/transform change. Standard UI motion stays under 300ms. Drawers use a short directional transition. Tooltips delay initially and skip the delay between nearby controls. There is no route entrance animation or moving chart-tab transition.

Navigation labels only create tooltips in the collapsed desktop rail. Mobile controls omit tooltip content so a visually hidden tooltip cannot intercept Escape above the navigation drawer. Grouped fields use one focus outline around the complete control.

`InputModality` distinguishes keyboard and pointer input for motion. Reduced motion removes nonessential movement and transitions. Hover treatments are limited to fine pointers. Focus remains visible; status wording accompanies colour; existing labels, validation, dialogs, and keyboard behaviour remain.

## Functional boundaries

The redesign preserves organisation isolation, server-action contracts, approval requirements, consent, scheduling confirmations, provider configuration, and delivery controls. It does not configure services, send messages, publish content, or change campaign/lead records. Visual testing uses the existing workspace and its real empty/setup states.
