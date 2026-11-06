# Shared site motion

The user requested motion across the site on 15 October 2026.

| Surface | Behavior |
| --- | --- |
| Workspace and auth navigation | Content settles by 6px over 220ms; shell remains stable |
| Streamed workspace content | Direct content replacement receives the same transition |
| Buttons, navigation, form controls | 140ms color feedback; fine-pointer press and hover feedback |
| Popovers and menus | 180ms entrance, 120ms exit, existing Radix focus behavior preserved |
| Dialogs and mobile drawers | Short entrance and exit; drawer entrance reduced from 500ms to 260ms |
| Disclosures | Chevron rotation plus size/opacity transition in supporting browsers |
| AI connection forms and status messages | Brief appearance when added |
| Homepage | Coordinated hero copy/art entrance; existing viewport reveals activated |

Content is visible without JavaScript. Page animations cancel on route cleanup, component removal, or a change to reduced-motion preference. No global mutation observer, recurring layout measurement, animation package, artificial navigation delay, or continuous decorative loop was added. The page observer watches only direct child replacement to handle streamed content. Unsupported disclosure interpolation falls back to normal native open/close behavior.

Reduced-motion preferences disable spatial transitions. Existing chart, ASCII, toast, and pointer-command animations retain their own behavior and accessibility paths. Keyboard command search stays instant.
