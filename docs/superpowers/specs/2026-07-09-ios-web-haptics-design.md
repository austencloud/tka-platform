# iOS Web Haptics — Switch-Input Fallback

**Date:** 2026-07-09
**Status:** Approved (design approved in-session by Austen)
**Scope:** Extend the existing `HapticFeedback` service so iPhone users in Safari
and installed PWAs feel haptic taps. Today they get silence.

## Problem

`navigator.vibrate()` was never implemented in WebKit. Every browser on iOS is a
WebKit skin, so the existing web fallback in
`src/lib/shared/application/services/haptic-feedback.ts` silently no-ops on
iPhone: `hasVibrate` is false, `webVibrate()` returns false. The native Capacitor
path (`@capacitor/haptics`) only fires inside the native shell (T6, not shipped).

Meanwhile ~250 components already call `getHapticFeedback()` — the demand side is
fully wired. The gap is one missing branch on the supply side.

## The mechanism

Safari 17.4 introduced `<input type="checkbox" switch>`. Toggling that native
switch fires the Taptic Engine. Programmatically clicking an associated `<label>`
toggles the input, which fires the haptic. Works in Safari tabs and installed
PWAs alike.

Apple has been narrowing it:

| iOS | Behavior |
|---|---|
| < 17.4 | No switch attribute — feature detect fails, no-op |
| 17.4 – 18.3 | Works, no gesture requirement |
| 18.4 – 26.4 | Works only within ~1s of a real user click |
| 26.5+ | Programmatic trigger patched — toggle happens, no haptic |

All failure modes degrade to silent no-op, which is the correct progressive-
enhancement behavior. Our call sites are tap handlers, so the 18.4+ gesture
window is satisfied naturally. Anything not tied to touch (beat-synced practice
pulses) cannot work on iOS web and stays Capacitor-only.

## Approaches considered

1. **Extend `HapticFeedback` with an inline switch-hack branch (~30 lines) — CHOSEN.**
   Fits the centralized-service model all 250 call sites already use.
2. `ios-vibrator-pro-max` (npm) — global `navigator.vibrate` polyfill. Rejected:
   wraps the entire DOM in a `<label>` and overlays switches during pointermove.
   Too invasive for a 500+ component app.
3. `ios-haptics` (npm) — element-attach API (`hapticTrigger(el)` overlays a
   switch per element). Rejected: wrong integration model; would bypass the
   centralized service and require touching every call site.

Never-hand-roll justification: extending existing `haptic-feedback.ts`; it covers
native + Android web but not iOS web; adding iOS web. Both ecosystem packages
were evaluated and rejected for structural fit, not convenience.

## Design

All changes inside `haptic-feedback.ts`. Public API unchanged. No new files
except the test.

### Detection (constructor, browser only)

```ts
this.hasSwitchHaptics =
  !this.hasVibrate &&                                   // real vibrate wins
  (navigator.maxTouchPoints ?? 0) > 0 &&                // excludes macOS Safari
  "switch" in document.createElement("input");          // WebKit-only attribute
```

The `switch` IDL attribute only exists in WebKit, so this never activates on
Chrome/Android/desktop Chromium. `isSupported()` gains `|| this.hasSwitchHaptics`.

### Lazy DOM pair (created on first trigger)

One hidden `<input type="checkbox" switch>` + `<label for>` pair appended to
`document.body`:

- Visually hidden: `position: fixed`, offscreen inset, 1px box, `opacity: 0`,
  `pointer-events: none`. NOT `display: none` (may suppress the toggle/haptic).
- `aria-hidden="true"`, `tabindex="-1"` — invisible to a11y tree and tab order.
- Created once, reused for every trigger. SSR-safe (browser guard already wraps
  all trigger paths via `canTrigger()`).

### Trigger path

`webVibrate(ms)` falls through: `navigator.vibrate` → switch `label.click()` →
`false`. Single toggle per trigger for every intensity — iOS produces one fixed
system tap regardless, and the existing web path philosophy is "minimal, not
buzzy."

### no-checkboxes.md exemption

This adds a hidden `<input type="checkbox">` to the DOM. The design-system rule
bans checkboxes as *rendered UI controls*; this element is an invisible haptic
actuator, never painted, never focusable, never in the a11y tree. Documented
here and in an inline comment at the creation site so future diff-greps have an
answer.

## Testing

Unit test (`tests/unit/haptic-feedback-ios-switch.test.ts`):

- jsdom default (no `switch` support, no vibrate) → `impact()` returns false,
  no DOM elements created.
- Mocked switch support (patch `HTMLInputElement.prototype.switch` +
  `maxTouchPoints`) → trigger creates the hidden pair, clicks the label,
  returns true.
- Mocked `navigator.vibrate` present → vibrate used, switch path untouched.

Final verification requires a physical iPhone (Taptic can't be observed
remotely): Austen taps around the app in Safari/PWA and reports feel. If his
device is on iOS 26.5+, the hack is dead on his hardware but still ships for
the 17.4–26.4 population.

## Out of scope

- Beat-synced / timed haptics on iOS web (impossible post-18.4; Capacitor T6).
- Pattern support on the iOS web path (single tap only).
- Any change to call sites, settings UI, or the native path.
