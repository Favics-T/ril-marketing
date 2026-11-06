# Shared dropdowns and date pickers

| Before | After | Why |
| --- | --- | --- |
| OS dropdown with a solid blue selection stripe | Framed menu, 44px options, pale brand-color selection and checkmark | Matches the existing workspace palette and makes selection clear. |
| Browser calendar popup | Custom DayPicker in the existing shadcn/Radix popover | The same calendar appears throughout the product. |
| Separate date implementations | Shared Input routes date and datetime-local fields through DateInput | Activities, campaigns, reports, follow-ups and publishing use one design. |
| Native date/time values | Original named native inputs remain the submitted controls | Preserve required/min/max validation, local datetime values, manual entry and server actions. |

Typography and color use the existing Open Sans and semantic workspace tokens. The calendar has Monday-first weeks, month/year dropdowns, previous/next controls, selected and today states, keyboard day navigation, Clear and Today. Scheduling calendars retain a local time control and a Done button. No UTC conversion is introduced.

All native single-choice selects are styled through CSS `appearance: base-select`, verified as supported by the in-app browser. Native form semantics, typeahead, required checks, disabled options and existing change handlers remain intact. Browsers that do not support customizable selects retain their native option menu as a functional fallback. Existing Radix Select controls receive matching trigger/option sizes and selection treatment. See [customizable select documentation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select).

DateInput preserves uncontrolled native input behavior for manual segmented entry. It synchronizes the calendar from the current input whenever opened, restores its state on an uncancelled form reset, and respects controlled values supplied by parent components. Both previously raw date/datetime fields were migrated to shared Input.

Production build/TypeScript and targeted ESLint pass. Browser checks cover dropdown selection, keyboard calendar selection, Today, Clear/required validation, month navigation and mobile bounds. No report generation, publication or database save is used to verify the controls.

Final browser evidence: Space/ArrowDown/Enter changes Period from Weekly to Monthly; direct entry of `2026-09-28` opens September with the 28th selected; date keyboard selection writes `2026-10-09`; Clear leaves the required input's `valueMissing` true; Today writes `2026-10-14`. At 390px the calendar spans x=38–378 without page overflow. Changing a scheduling date keeps `15:30`, and editing the popup time to `16:45` then Done writes `2026-11-02T16:45`. Browser errors are empty. Viewport overrides were reset.

Delivery gates: real form values and native validation are retained; visual changes identify focus/selection and popup elevation; no decorative motion was added; desktop/phone behavior is checked in the authenticated app.
