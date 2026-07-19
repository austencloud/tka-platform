# Construct Attract Demo — Design

**Date:** 2026-07-19 (second pass same day — Austen review of the first build)
**Status:** Approved direction (brainstormed with Austen; option C locked)
**Scope:** Rework of the Construct section on the composer five-wings page
(`src/routes/test/composer-wings/_sections/ConstructSection.svelte`), destined
for the real `/composer` page after harness sign-off.

## Problem

The current Construct section is a single phase-swapped pane (start picker →
option picker → done card) inside a `clamp(340px, 54vh, 720px)` container. On a
big screen it renders three ~170px start tiles floating in a ~700px empty black
band — the worst content-to-void ratio on the page. The built sequence exists
only as a word string; there is no visible workspace, so the core Create-tab
story ("pick a step, watch the sequence grow") never actually appears. And the
widget is inert: on a marketing surface, most visitors scroll past without
clicking, so the demo shows nothing at all.

## Decisions (locked in brainstorm)

1. **Two-pane layout** — workspace (growing sequence) beside the option picker,
   mirroring the real Create tab.
2. **Attract mode (arcade pattern)** — the demo builds sequences by itself in a
   loop until the visitor interacts, then hands over control.
3. **Cursor-only demonstration** — a ghost pointer taps UI options; no prop
   movement stage in this section (movement belongs to Outputs/Play wings).
4. **Random valid walk** — each attract cycle picks a random start position and
   4 random valid Type-1 options from the real picker. Every cycle differs.
5. **Grab-the-wheel takeover** — first real pointer interaction kills the
   attract loop for the visit; the visitor continues from the current board
   state. Nothing resets on takeover.

## Layout

- **Toolbar strip above the side-by-side view (ADDED, second pass):** Prop
  picker over the workspace half, Turns picker over the picker half. On the
  wide layout the toolbar mirrors the demo-body's 2fr/3fr grid so each control
  sits over the pane it affects; below ~1100px it wraps.
- **≥ ~1100px:** workspace left, picker right (result reads first LTR; actions
  on the side the ghost taps). Grid split roughly 2fr / 3fr; both panes grow
  with the viewport so the 1680+ tier fills honestly.
- **< ~1100px:** stacked — workspace as a compact strip on top, picker below.
- **Band height fits content.** The fixed `54vh` container dies. The picker
  keeps a min-height only large enough for its own grid; the section never
  reserves void.

### Workspace pane (REVISED 2026-07-19, Austen review)

The first cut hand-rolled a 5-cell grid; rejected — the codebase has a
canonical workspace layout and the demo must use it. The workspace pane now
mounts the REAL `WorkspaceGrid`
(`src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte`):

- **Start position owns column 1** (the canonical convention from
  `grid-calculations.ts` — steps flow in columns 2+); real `StartTile` /
  `StepCell` renderers.
- Steps convert via `pictographDataToStepData` (the create-tutorial's own
  converter); `calculateGridLayout(..., { manualColumnCount: 4 })` sizes the
  grid from the measured pane. **Height clamp (second pass):** the calculator's
  narrow few-steps branch (<650px container, ≤2 steps) sizes cells by width
  only (mobile convention — a scroll container absorbs overflow); this demo's
  frame is fixed-height and must never scroll, so the section caps
  `cellSize ≤ (frameH − 40) / rows`. This was the "start position needs a
  scrollbar" bug Austen hit: a 368px cell in a 300px frame.
- The pane is a fixed-height frame (`.ws-frame`) so the footprint is reserved
  before anything is built — no layout shift (`no-layout-shift.md`).
- Word line above the grid: "Your sequence · ΦΨ · step 2/8" with
  `tabular-nums`; word always routed through `simplifyRepeatedWord`. A **Play**
  button (`data-demo-play`) shares the status row — slot always reserved,
  visible once ≥1 step exists.

### 8-count building (ADDED, second pass)

Visitors can click up to **8 steps** (`MAX_STEPS = 8`, `STEP_COLUMNS = 4` → two
clean rows beside the start column). The attract act still builds 4 per cycle
so cycles stay snappy. Hitting the 8-step cap starts playback automatically;
before that the Play button flips the section into the play phase.

### Prop policy (ADDED 2026-07-19, Austen review)

- A compact **prop picker** sits at the top of the workspace column: the
  canonical five (staff, club, fan, triad, buugeng), staff pre-selected.
  Reuses the store `PropPicker` radiogroup
  (`src/lib/features/store/components/PropPicker.svelte`) with
  `SHOP_PROP_OPTIONS` / `DEFAULT_SHOP_PROP`.
- **Poi is impossible on this surface.** The poi UI-reduction system is its
  own world; the composer demo never shows it, even when the user's global
  setting is poi. The chosen demo prop flows as
  `bluePropTypeOverride`/`redPropTypeOverride` through the whole chain —
  `WorkspaceGrid → StartTile → StepCell`, `StartPositionPicker →
  PictographGrid → PictographContainer`, and `OptionPicker` (prepare + the
  poi-legality gate via `applyPoiLegalComposerFilter`'s new optional
  `propTypes` param). Root cause this fixed: with global settings poi/poi the
  poi-legal filter emptied the Type-1 option set and the demo stalled at
  step 0.
- Shared-primitive extensions made for this (all additive, default-off):
  `OptionPicker` + `StartPositionPicker` + `PictographGrid` + `StartTile`
  gained `bluePropTypeOverride`/`redPropTypeOverride`;
  `applyPoiLegalComposerFilter` gained the optional `propTypes` argument.

### Turns policy (ADDED, second pass)

- The first build silently inherited the user's **sticky Create-tab turns**
  (`tka-option-picker-pending-turns` in localStorage — OptionPicker's pending
  turns persist across reloads), which is how Austen saw red=1/blue=0 baked
  into demo options. Same leak class as the poi prop leak; same fix shape.
- A compact **Turns picker** (shared `SegmentedControl`, whole turns **0–3**
  only — the demo deliberately skips half turns) sits in the toolbar over the
  picker pane and applies to BOTH hands.
- `OptionPicker` gained `blueTurnsOverride`/`redTurnsOverride` (additive,
  default-off): an overridden picker uses the pinned turns for option
  preparation and never reads or writes the sticky localStorage turns.

### Play phase (REVISED, second pass — replaces the done card)

"You built X — build another" was dead information. The build now ends in a
**play phase**: the picker pane swaps to the real
`AnimationPlayer` (`sequence-viewer/components/AnimationPlayer.svelte`,
standalone mode — demo steps carry full motion data so no gallery lookup),
`autoPlay`, minimal chrome (`showControls={false}`, `hideWordHeader`,
`tapToToggle`), prop overrides passed through. The player's `onStepChange`
drives `WorkspaceGrid.selectedStepNumber`, so the workspace highlights the
currently-playing step (0 = start tile) via the canonical selection mechanism —
the pictograph row and the animation read as one instrument. "Build another"
survives as the single button under the player; entering play via the button
or the 8-step cap are the only two paths.

### Picker pane

- Unchanged primitives: `StartPositionPicker` (embedded) during `pick-start`,
  `OptionPicker` (`filterPredicate: isType1`, `hideFilters`) during `add-step`.
- The phase swap now happens **inside the picker pane only**; the workspace
  stays mounted throughout. The third phase is the play phase (see §Play
  phase) — the done card is gone.

## Attract loop

New state module `construct-attract-act.svelte.ts` colocated with the section
(named after the existing `hero-act.svelte.ts` "Hero Attract Act" precedent —
same idea, different mechanism: this act drives pointer taps, not sequence
swaps).

### Mechanics

- **Visibility-gated:** an IntersectionObserver starts the act when the
  section enters the viewport and pauses it when it leaves. No offscreen
  timers/rAF (background-loop perf-tax precedent).
- **Cycle:**
  1. Ghost eases to a random start-position tile → press → picker phase flips.
  2. Every ~1.6s: ghost eases to a random visible option tile → press → beat
     fills the next workspace slot.
  3. After step 4: word emphasis moment (~2.5s — done card shows, word large).
  4. Board clears, new cycle with a fresh random walk.
- **Target acquisition is DOM-driven:** the act queries the rendered picker
  for its actual option tiles (stable selector on the option button; add a
  `data-demo-target` attribute if no stable class exists), picks one at
  random, animates the ghost to its bounding box, and dispatches a real
  `click`. The demo therefore taps exactly what a human could tap — validity
  comes from the real engine, and picker refactors can't silently desync a
  scripted path.
- **Selector gotcha (found in Austen's review, second pass):** the option grid
  renders `OptionCard` (`data-testid="option-card"`) only on the wide desktop
  layout; the swipe/fallback layouts render `OptionViewerSection` tiles
  (`data-testid="option-item"`). The demo pane uses the fallback, so the act's
  `OPTION_SEL` matches BOTH. Matching only `option-card` was the bug that froze
  the ghost at step 0 — `waitFor` timed out every cycle and the loop restarted
  from the start position forever.
- **Cycle ending (second pass):** after the last step the act presses the
  section's real Play button (`[data-demo-play]`), hides the ghost, and lets
  the built sequence animate for `PLAY_MS ≈ 7s` before resetting into the next
  cycle — every attract cycle ends on the payoff, not a word card.
- **Timing constants** live at the top of the act module (`STEP_MS ≈ 1600`,
  `DONE_MS ≈ 2500`, ghost travel ≈ 450ms eased). Tune-by-eye values, one
  place.

### Ghost pointer

New tiny component `GhostPointer.svelte` colocated with the section. Grep
evidence: no existing ghost-cursor/attract-pointer primitive in
`src/lib` (`ghost|attract|demo-cursor|autoplay` sweep, 2026-07-19); the hero
act is a sequence-swap attract with no pointer. Nothing external fits either —
tour libraries (driver.js class) highlight elements, they don't perform a
scripted pointer. Creation justified.

- Soft glowing accent-colored dot (~28px), `position: absolute` overlay inside
  the demo band, moved via `transform` with an eased transition; scale-dip on
  press.
- `aria-hidden="true"`, `pointer-events: none`. Purely decorative.
- Never rendered under `prefers-reduced-motion` or after takeover.

## Takeover

- Trigger: first `pointerdown` anywhere inside the demo band (capture phase on
  the band wrapper — fires before any picker click handling).
- Effect: act stops permanently for this visit; ghost fades out (~200ms);
  in-flight board state stays exactly as-is; the visitor's own taps continue
  the build. Done card's "Build another" resets the board but does NOT revive
  the attract loop.
- Keyboard counts too: first `focusin` into the picker also takes over, so a
  keyboard user is never fighting the ghost.

## Reduced motion

`prefers-reduced-motion: reduce` → no act, no ghost, no auto-taps. Section
mounts directly in interactive mode with the existing hint line ("Pick a
starting position to begin."). Media query lives in the section; the act
checks it once at start.

## Accessibility

- Ghost is `aria-hidden` decoration; all real interaction targets are the
  existing picker primitives (which own their own semantics).
- Auto-filling beats are visual-only during attract; once takeover happens the
  workspace is a static rendered list (no live-region churn). The word line is
  the accessible summary; add `aria-live="polite"` to it so user-driven picks
  announce, but suppress announcements while the act drives (attract sets
  `aria-live="off"`).
- Workspace cells get `alt`/`aria-label` = step letter (e.g. "Step 2: Ψ").

## What this kills from the current section

- The `54vh` fixed-height `.picker-container` void.
- The invisible-until-done sequence (word-only feedback).
- The inert-widget problem — the section is in motion for every scroll-past.

## Non-goals

- No prop-movement animation stage in this section (Outputs/Play wings own
  motion).
- No changes to `StartPositionPicker` / `OptionPicker` internals beyond a
  stable demo-target selector if one is missing.
- No shared-singleton state; the section keeps its isolated local state
  (existing design, unchanged).
- Not yet wired into the live `/composer` — harness first, integration is a
  separate step after the five sections are individually signed off.

## Verification

- Harness page at 2560×1305 (Austen's real CSS viewport) and ~900px narrow:
  screenshot both; no void band, no layout shift as beats fill (compare
  before/after frames mid-cycle).
- Takeover test: click mid-attract → ghost gone, board preserved, next click
  is a real pick. Keyboard: Tab into picker → same.
- Reduced-motion test: emulate `prefers-reduced-motion` → no ghost, hint line
  shows, interaction works.
- Console clean during three full attract cycles.
