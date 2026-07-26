---
status: active
value: 3
effort: S
remaining: "Body status: Active (deferred implementation — immediate dupe-suppression shipped separately)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Create Tutorial — Coach-Mark the Real Start-Position Picker (Design)

Date: 2026-06-21
Status: Active (deferred implementation — immediate dupe-suppression shipped separately)

## Problem

The create tutorial's first step renders a **second, identical** start-position
picker inside a modal card, on top of the construct page that already renders
the real one behind a dim scrim.

- `CreateTutorialWizard.svelte` is a `position: fixed; inset: 0` scrim
  (`rgba(0,0,0,0.4)`, `z-priority`) over the live construct page.
- `PickStartPositionStep.svelte` prints its own title/subtitle, then embeds a
  fresh `StartPositionPicker` instance inside the card.
- The real `StartPositionPicker` is already on the construct page, dimmed behind
  the scrim.

Result: two live pickers stacked — one dimmed, one not — doing the exact same
thing. The user called it out: "isn't it kind of silly to have a modal in front
of the actual start position picker that does the exact same thing they could
literally do in the app."

A secondary defect (the embedded picker re-rendered its own "Choose your start
position" hint and a guest "New here? Show me how" link that replayed the very
tutorial it sat inside) was fixed immediately via an `embedded` prop on
`StartPositionPicker` that suppresses the picker's own chrome. That prop is the
bridge; this spec removes the need for the embedded instance entirely.

## Goal

Step 1 of the tutorial coaches the user to tap the **real** picker already on
the page — no second picker instance. Dim everything except the real picker,
caption it, and advance when the real selection fires.

## Approach: spotlight / coach-mark

1. **No embedded picker.** `PickStartPositionStep` stops importing and mounting
   `StartPositionPicker`. The construct page's own picker is the target.
2. **Spotlight the real picker.** The wizard scrim gets a cut-out (or a
   raised-z highlight on the real picker's container) so the real picker is
   bright and interactive while the rest of the page stays dimmed.
3. **Caption near the target.** The tutorial copy ("Pick a starting position —
   every sequence begins with a position; tap one") renders as a caption
   anchored to the picker, not a full card that re-hosts the picker.
4. **Listen for the real selection.** Tutorial state subscribes to the construct
   page's start-position selection (the same `onSelectedPositionChange` source),
   and auto-advances on a `source === "user"` selection.

## Open questions (resolve during implementation planning)

- **Selection plumbing.** The embedded step today owns its own
  `createSimplifiedStartPositionState()` and listens to it. Coaching the real
  picker means subscribing to the construct page's existing start-position
  state instead. Identify that state's location and whether the tutorial can
  subscribe without coupling. (Grep `onSelectedPositionChange`,
  `createSimplifiedStartPositionState`, and where the construct picker's state
  is provisioned.)
- **Spotlight mechanism.** Options: (a) raise the real picker's container above
  the scrim via z-index + a backdrop hole, (b) an SVG/box-shadow cut-out
  overlay, (c) reuse an existing coach-mark/spotlight primitive if one exists
  (grep `spotlight`, `coach`, `highlight`, `TabIntro`, tour components under
  `src/lib/shared/onboarding/`). Prefer reuse per `never-hand-roll.md`.
- **Layout variance.** The construct picker can be in side-by-side vs stacked
  layout, simple vs advanced (16-variation) view, and the page scrolls. The
  spotlight anchor must track the real picker's actual box across these.
- **Other steps.** The same embed-a-live-component pattern is used by
  `AddStepTutorialStep`, `PlaySequenceStep`. This spec scopes step 1 only;
  decide whether the coach-mark approach should generalize to those before
  building a one-off.

## Out of scope

- Re-theming the wizard chrome, progress dots, or skip/back controls.
- The other tutorial steps (tracked as a follow-up question above).
- Removing the `embedded` prop — it stays as the suppression mechanism until
  this redesign lands, and may remain useful for any other embed surface.

## Related

- Immediate fix: `embedded` prop on
  `src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte`
  (hides `.workspace-hint` + guest `.guide-link`), passed from
  `src/lib/shared/onboarding/components/create-tutorial/steps/PickStartPositionStep.svelte`.
- `never-hand-roll.md` (reuse a spotlight primitive if one exists),
  `visualization-routing.md` (verify on a real test page, not a mockup).
