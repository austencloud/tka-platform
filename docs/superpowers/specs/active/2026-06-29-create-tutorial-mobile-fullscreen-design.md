# Create Tutorial — Mobile Fullscreen

**Date:** 2026-06-29
**Status:** Draft — awaiting user review

## Problem

On mobile the Create tutorial steps render inside a centered card. The card chrome
(capped width, padding, 24px radius, border) plus the picker's own fixed-height
container squeeze the embedded pictograph pickers. On the "pick your options" step
(`AddStepTutorialStep`, embeds the live `OptionPicker`) the option tiles and the
picker's navigation arrows are cramped — the screen reads as awkwardly boxed-in.

Root cause, confirmed in code:

- `OptionPicker` → `OptionPickerContent` sizes tiles with a device-aware fitter
  (`calculateDeviceAwareSize`) that fits to its container, picking the **smaller**
  of the width/height budgets.
- The container is the step card's content box: `.tutorial-step` caps width
  (720/780px), adds 12–24px padding + 24px radius + border; the content container
  (`.picker-container` / `.viewer-container`) is a fixed `clamp(...vh)` height.
- So both axes are constrained → tiles stay small even though the wizard overlay
  itself is already `position: fixed; inset: 0` (fullscreen).

## Decisions (locked with user)

| Question | Decision |
|---|---|
| Which steps go fullscreen on mobile | **All 4** (pick-start, add-beat, play, ready) |
| Header treatment on mobile | **Shrink to one compact line** (title · subtitle) |
| Breakpoint | **≤900px** (covers phones + small tablets / phone landscape) |

## Approach — wizard-owned override

Because the treatment applies to **all** steps, the wizard
(`CreateTutorialWizard.svelte`) is the single owner. It already wraps every step,
so one `@media (max-width: 900px)` block strips the chrome for all four at once.

**Cascade safety:** the override is scoped as
`.create-tutorial-wizard :global(.tutorial-step) { ... }` → specificity **(0,2,0)**,
which beats each step's own `.tutorial-step` mobile rule **(0,1,0)** regardless of
bundle/source order. This is why the chrome strip lives in the wizard and not in 4
separate files — no specificity fights, no per-step duplication.

### Mobile (`≤900px`) treatment — all from the wizard

Layout container:

- `.step-container` → `padding: 0; max-width: none; align-items: stretch`
- `.create-tutorial-wizard` → `align-items: stretch` (stop vertical centering so the
  card fills the viewport)

Card chrome strip (`:global(.tutorial-step)`):

- `max-width: none; width: 100%`
- `border: none; border-radius: 0`
- `min-height: 100dvh; box-sizing: border-box`
- `padding-inline: max(8px, env(safe-area-inset-left)/(right))` — reach near the
  edges but clear notches
- `padding-top: 56px` — clear the fixed Back/Skip buttons (top:12–16px, ~40px tall)
- `padding-bottom: 88px` — clear the fixed step-dots (bottom:24px, ~36px tall).
  This preserves the dot-overlap clearance the 2026-03-11 spec fixed; the
  "Start building" / Continue buttons stay above the dots, not behind them.

Content height-fill (the visual steps only — steps 1/2/3):

- `:global(.picker-container), :global(.viewer-container)` →
  `height: auto; flex: 1; min-height: 0`

  Frees the **second** axis so the device-aware fitter grows tiles to the real
  maximum. The Ready step's accordion (`.accordion-list`) is intentionally **not**
  height-filled — it's a content-sized list and should stay top-aligned/scrollable.

### One-line header (mobile)

Each step currently renders `<h1 class="title">` + `<p class="subtitle">` as the
first two children of `.tutorial-step`. Wrap those two in a `.step-header` div in
all 4 steps (markup only — no per-step CSS). The wizard owns the styling:

- Desktop default: `.step-header { display: flex; flex-direction: column;
  align-items: center; gap: 4px }` — visually identical to today (title above
  subtitle).
- `≤900px` (`:global(.step-header)`): `flex-direction: row; flex-wrap: wrap;
  align-items: baseline; justify-content: center; gap: 6px 8px`; shrink
  `:global(.title)` → ~1.05rem and `:global(.subtitle)` → ~0.8rem; insert a `·`
  separator via `:global(.step-header .subtitle::before)`.

On a 375px phone the longest header ("Add beat 2 of 4 · Pick a move. 2 beats left.")
may wrap to two tight lines — acceptable; it still reclaims the vertical space vs
today's two full-size lines. The picker fills everything below.

## Net result on a phone

Compact one-line header at top → `OptionPicker` spans edge-to-edge horizontally and
from under the header down to just above the step-dots → arrows spread, pictograph
tiles scale up on both axes.

## Files

| File | Change |
|---|---|
| `CreateTutorialWizard.svelte` | New `@media (max-width: 900px)` block: chrome strip via `:global(.tutorial-step)`, container/centering, content height-fill, `.step-header` desktop + mobile styling. |
| `PickStartPositionStep.svelte` | Wrap title+subtitle in `.step-header`. |
| `AddStepTutorialStep.svelte` | Wrap title+subtitle in `.step-header`. |
| `PlaySequenceStep.svelte` | Wrap title+subtitle in `.step-header`. |
| `ReadyStep.svelte` | Wrap title+subtitle in `.step-header`. (Already has the mobile accordion + icon-badge fix.) |

Each step's existing `@media (max-width: 480/640px)` padding/radius rules become
inert under the wizard's (0,2,0) override on mobile; leave them (harmless, still
apply >900px? no — they're ≤640, fully shadowed ≤900). **Cleanup:** delete the now
dead per-step mobile `.tutorial-step` padding/border-radius rules to avoid confusion.

## Out of scope (flagged, not folding in)

- **Shared `TutorialStepCard` primitive.** The 4 steps duplicate ~15 lines of
  identical card CSS (`container-type`, flex column, gap, bg, radius, border) plus
  near-identical mobile media queries. A shared shell component would kill that
  drift and is the cleaner long-term home for "fullscreen on mobile." Deferred —
  bigger refactor than this goal needs (YAGNI now). Worth a follow-up.

## Verification

Per project visualization-routing (test page with real components, never a mockup):

1. Build `src/routes/test/tutorial-fullscreen/` rendering the **real**
   `AddStepTutorialStep` (and `PickStartPositionStep`) at 375px and 414px widths,
   carded (current) vs fullscreen (new) side by side.
2. Capture screenshots; compare measured pictograph tile size before/after.
3. Confirm: no content under the fixed Back/Skip or step-dots; safe-area respected;
   desktop (>900px) unchanged.

## Risks

- `100dvh` on iOS Safari with the dynamic toolbar — `dvh` is the correct unit
  (resolves to the visible viewport); verify no double-scroll. Fallback `100vh` not
  needed on current browser targets.
- Device-aware fitter must react to the new container size — it sizes off the
  container, so freeing both axes should just produce larger tiles; verify in the
  test page rather than assuming.
