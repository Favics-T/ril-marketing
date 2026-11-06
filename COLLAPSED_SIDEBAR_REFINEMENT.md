# Collapsed sidebar — Emil refinement

| Before | After | Why |
| --- | --- | --- |
| 48px rail with expanded header/group padding and forced 32px buttons | 72px rail with centered 44px controls and a 36px monogram | Prevent clipping and align every icon to the same centerline. |
| Collapsed navigation disables scrolling | Scrollable navigation with a thin scrollbar | Keep all routes reachable on shorter screens. |
| Invisible group headings leave uneven spacing | Hidden headings with short dividers and consistent group spacing | Preserve navigation grouping without crowding the rail. |
| Active page relies on its filled square | Existing navy selection plus a small side marker | Make the current location easier to spot. |
| Empty collapsed footer | Pinned, labelled expand button | Provide an obvious way back to full navigation. |
| Blue animated tooltips | Instant compact navy tooltips | Keep repeated navigation quick and identify icon-only controls. |

The expanded sidebar and mobile drawer retain their layout and current colors. Icon links have explicit accessible names. Collapsed mode shows all navigation even when the expanded sidebar's search has a query. Hover feedback changes color only, with no icon scaling or bouncing.

Verified in the authenticated browser: 72px rail and 44×44px controls share the same centerline; keyboard focus scrolls the bottom AI settings link into view; the pinned expand control restores full navigation; Tab opens a readable light-on-navy tooltip without animation. At 390px the mobile drawer remains 288px wide and its search filters to Reports correctly. Build/TypeScript and targeted ESLint pass, browser errors are empty, and viewport overrides were reset.
