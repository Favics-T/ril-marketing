# Workspace command menu

The [Efferd reference video](https://x.com/efferdco/status/2110449789066490250) was viewed successfully in the browser. It shows a compact header search expanding into an anchored menu of grouped navigation entries. The dashboard now uses that interaction through shadcn Command/cmdk and Radix Popover. The homepage hero is a separate earlier change.

| Before | After | Why |
| --- | --- | --- |
| Centered search dialog and overlay | Header-anchored command popover with no backdrop | Match the demonstrated interaction and keep workspace context visible. |
| Filtered links with no active keyboard selection | cmdk filtering, grouped results, selected-row highlight and arrow/Enter handling | Make the menu usable from the keyboard as well as the mouse. |
| Only Ctrl/Cmd+K | Click, F outside editable fields, and Ctrl/Cmd+K | Match the visible F shortcut while preserving normal typing. |
| Full input focus rectangle | Borderless input with a blue search icon while focused | Preserve the user's requested removal of the blue input border. |

All entries come from the existing workspace navigation. They open real routes; no placeholder pages or provider actions were added. Queries filter locally and are cleared on close. Escape, the close control and outside-click dismissal are supported. Escape and the close control return focus to the header trigger.

The reference was replayed for the user's follow-up about smooth click motion. Pointer opening now expands from the trigger's measured width to the full panel, widening leftward and revealing the list downward over 260ms. The input moves with that expansion without stretching its text. Results fade into place over 200ms after a 40ms offset. Keyboard opening and reduced-motion preferences skip these animations; input focus is immediate in every mode. No layout dimensions are animated.

## Browser verification

- Follow-up motion check: pointer opening reports `command-expand` at 260ms with `cubic-bezier(.23, 1, .32, 1)`. Desktop trigger width is 176.24px and panel width is 340px; the phone trigger is 44px. Input focus is immediate. Ctrl+K reports `animation-name: none` and the keyboard opening method. Filtering, arrow selection, Escape, close-button focus restoration and phone bounds were rechecked. Build/TypeScript and targeted ESLint pass; browser error logs remain empty. Reduced motion is handled by the scoped `no-preference` media query (source checked, not browser-emulated).
- Clicking header search opens a menu at the same vertical position as the trigger (14 px from the viewport top in the desktop check).
- ArrowDown selects Approvals after Command Centre. Filtering `content` selects Content Library; Enter opens `/library` and closes the menu.
- Mouse selection of Calendar opens `/calendar` and closes the menu.
- F opens search. Typing F in either the menu input or the Content Library filter does not close/open the menu unexpectedly.
- Ctrl+K opens the menu, and reopening after a query starts with an empty input.
- An unmatched query shows a real empty state. Escape closes the menu and restores focus.
- The close control and outside clicks dismiss the menu.
- 1280 px desktop and 390 px phone widths have no horizontal overflow. At phone width the panel stays inside the viewport, from x=16 to x=356, with a scrollable list and 44 px rows. Temporary viewport overrides were reset.
- The focused input has no outline. Browser error logs are empty.
- Production build and TypeScript pass. ESLint reports no errors; its one image warning is in the unused registry logo-cloud component.

## Design delivery gate

- Hard gate PASS: real routes, local filtering, an explicit empty state, keyboard navigation, focus restoration, no inner blue border, and verified desktop/mobile bounds.
- Purpose gate PASS: existing navigation icons identify their pages; one framed popover separates results from the working page. The requested click expansion explains its relationship to the header trigger, without a backdrop.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 2 / MOTION 1 direction is retained. Group headings, selected-row contrast and spacing organize results around the active search.
- Craft gate PASS: build and TypeScript pass, lint has no errors, and click, typing, filtering, keyboard selection, navigation, dismissal and responsive behavior were exercised in the authenticated browser.
