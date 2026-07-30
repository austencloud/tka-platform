---
status: shipped
value: 3
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-30
---

# Create Tutorial — Coach-Mark the Real Start-Position Picker (Design)

Date: 2026-06-21
Status: Shipped and verified 2026-07-30. Superseded by the live Construct guide.

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

## Closure (2026-07-30)

Do not build this coach-mark. Commit `e2615015a2` replaced the production
duplicate-picker wizard with `ConstructTutorialGuide.svelte`, an inline guide
rendered beside the real Construct controls.

The audited live path now works as follows:

1. `MainApplication.svelte` shows an opt-in prompt that names the three actions:
   choose a start position, add one pictograph, and play the sequence.
2. Accepting it moves `appEntryState` to `create-tutorial`.
3. `CreateModule.svelte` waits for every persistence restore to finish, then
   starts `constructTutorialState` in a clean tutorial workspace. If a draft
   already exists, its sequence, selection, persistence record, and undo
   timeline are held outside the tutorial session.
4. `ConstructTabContent.svelte` renders the guide above the real
   `StartPositionPicker`.
5. Choosing a canonical or custom start position advances the guide, including
   the valid replay case where the chosen position is already current.
6. Choosing any available pictograph advances the guide. Clicking a letter-type
   tab is optional navigation, not a tutorial requirement.
7. Playing the sequence completes the guide and shows a completion
   acknowledgment.
8. Dismissing the guide restores an existing draft exactly. Completing the
   guide keeps its temporary sequence visible through the sequence viewer, then
   restores the draft when the viewer closes. A true first-run sequence remains
   the user's sequence.

The old `CreateTutorialWizard` and its embedded `PickStartPositionStep` remain
reachable only from the dedicated test route and component tests. Removing that
legacy test surface is separate dead-code work, not a reason to add another
onboarding layer.

Verification on 2026-07-30:

- Flow Arts MCP confirmed that `movement type` is not a glossary term. The
  canonical learner concepts used here are `letter`, `step`, `pictograph`, and
  the six numbered letter types.
- 29 focused unit tests passed across tutorial state, start-position display and
  equivalence, letter-type navigation, analytics, and app-entry state.
- 16 Chromium component tests passed across the live guide, opt-in prompt,
  letter-type reference, desktop picker, and swipe layout, including
  accessibility scans.
- The real app passed the complete three-action walkthrough. Replay over an
  existing α draft opened a blank Step 1, stayed blank after an eight-second
  delayed-restore check, and restored the same α draft after Dismiss.
- Four dedicated workspace-isolation tests cover draft and selection
  restoration, suppressed tutorial persistence, first-run retention, stale
  picker selection, and undo-history suspension.
- Screenshots were inspected at 375×812, 960×412, 768×1024, 1440×900,
  1920×1080, 2560×1440, and 3840×2160.
- The latest shared `pnpm run check` reported no diagnostics in this work. Its
  only two errors are in another session's untracked
  `ButtonPanel.svelte.test.ts`; five pre-existing warnings remain elsewhere.
