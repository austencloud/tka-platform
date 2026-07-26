---
status: active
value: 4
effort: M
remaining: "Body status: Draft — awaiting user review"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Create Tutorial — Type-1 Options + Tap-to-Play Polish

**Date:** 2026-06-29
**Status:** Draft — awaiting user review

Three related changes to the Create tutorial flow, all surfaced together.

## A. Add-beat step shows only Type 1, as a plain grid

### Problem
`AddStepTutorialStep` embeds the full `OptionPicker`, which organizes next-beat
options into Type 1–6 sections and renders a swipe layout with side arrows to
move between sections, plus an "All / Continuous" filter pill after the first
beat. For a first-time user that's too much. We want to present **only the Type 1
(dual-shift) options as a single grid**, framed as if that's the whole option set;
the other types are discovered later in the real app.

### Mechanism (already in the codebase)
- `OptionPicker` already accepts a `filterPredicate?: (option: PictographData) => boolean`
  (`OptionPicker.svelte:47`, applied at `:218–220` and `:289–290`). The tutorial
  currently passes none.
- The organizer classifies a pictograph's type via
  `getLetterType(letter)` → `LetterType.TYPE1…TYPE6` (`option-organizer.ts:10,51`).
- With only Type 1 surviving, the organizer returns **one** section. In
  `OptionPickerContent`, the swipe layout requires `sections.length > 1`
  (`:213`) → disabled; `shouldUseCompact4x4` requires `isContinuousOnly` → false;
  so it falls through to the single-section grid (`:474–485`,
  `OptionViewerSection`, 4 columns, `showHeader={false}`). No side arrows, no
  type header — exactly the desired plain grid.

### Changes
1. **`AddStepTutorialStep.svelte`** — pass a Type-1 predicate and hide filters:
   ```svelte
   <script>
     import { getLetterType } from "$lib/shared/foundation/domain/models/letter";
     import { LetterType } from "$lib/shared/foundation/domain/models/letter-type";
     const isType1 = (o: PictographData) =>
       !!o.letter && getLetterType(o.letter as Letter) === LetterType.TYPE1;
   </script>
   <mod.default {currentSequence} {currentGridMode}
     onOptionSelected={handleOptionSelected}
     filterPredicate={isType1}
     hideFilters />
   ```
2. **`OptionPicker.svelte`** — add `hideFilters?: boolean` prop (default false),
   thread to `OptionPickerContent`.
3. **`OptionPickerContent.svelte`** — accept `hideFilters` (default false). Gate the
   standalone pill and the unified-header filter on it:
   `shouldShowFilterToggle()` callers become `shouldShowFilterToggle() && !hideFilters`
   (the `{#if shouldShowFilterToggle() && !useUnifiedHeader}` pill at `:374`, and
   `showFilter={shouldShowFilterToggle()}` at `:356`). This is an extension of the
   shared primitive, not a fork.

### Risks / verification
- **Emptiness:** Type 1 is the most populous type, but a given pick *could* yield
  zero Type-1 continuations, stalling the 4-beat tutorial. MUST verify by walking
  all 4 picks from a few start positions in the test route. If a dead-end exists,
  fall back (e.g. unfilter when the Type-1 set is empty) — decide only if observed.
- **Count:** Type 1 is A–V (22 letters, per MCP), but the option set from a start
  position is a subset. Confirm it reads as a clean grid (≈16). The grid is
  fit-to-viewport, so a larger/smaller count still lays out; this is cosmetic.

## B. Play-step copy (kill the AI-ism)

`PlaySequenceStep` subtitle "Watch your sequence come to life" is contrived. Replace,
tied to the tap-to-play behavior (C):

- Idle (not playing): **"Tap to play your sequence."**
- Playing: **"Tap to pause."**

## C. Play step uses tap-to-play minimal chrome

### Problem
The play step renders its own green play button + stop button and a swap from
`ChoreoCard` to `AnimatorCanvas` with `isPlaying={true}` hardcoded. It does **not**
pass the tap-to-toggle props, so tapping the canvas does nothing, and it shows the
full `UnifiedTimeline` transport (scrubber) instead of the minimal progress line.
This contradicts the established `minimal player chrome` decision (tap-to-play +
thin `SequenceProgressBar`).

### Canonical pattern (proven)
`landing/components/PlayWithItInner.svelte:208–228` uses `AnimatorCanvas` with
`tapToToggle={true}`, `progressLine={true}`, `onPlaybackToggle={togglePlayPause}`.
`AnimatorCanvas` props confirmed: `tapToToggle` (default false, `:102`),
`progressLine` (default false → thin `SequenceProgressBar`, `:103`),
`onPlaybackToggle` (`:66/:118`), `hideProgressBar` (`:75`). The tap handler ignores
taps unless `tapToToggle` is set (`:282`) and calls `onPlaybackToggle()` (`:298`).

### Changes — `PlaySequenceStep.svelte`
1. **Initialize playback on mount, paused.** After obtaining `playbackController`
   in `onMount`, and once `tutorialSequence` is built, call
   `playbackController.initialize(tutorialSequence, animationState)`,
   `animationState.setSequenceData(tutorialSequence)`,
   `animationState.setShouldLoop(true)` — but do **not** start playback. The canvas
   shows the sequence paused at step 0.
2. **Render `AnimatorCanvas` directly (drop the `ChoreoCard` swap).** Remove the
   `showAnimation` branch and the `ChoreoCard` import/usage. The `.viewer-container`
   always holds `AnimatorCanvas` with:
   ```svelte
   <AnimatorCanvas
     sequenceData={animationState.sequenceData}
     currentStep={currentStep}
     isPlaying={isPlaying}
     blueProp={animationState.bluePropState}
     redProp={animationState.redPropState}
     gridMode={tutorialSequence.gridMode}
     letter={currentLetter}
     stepData={currentStepData}
     word={tutorialSequence.word}
     focused={true}
     tapToToggle={true}
     progressLine={true}
     onPlaybackToggle={handleToggle}
   />
   ```
3. **`handleToggle`** replaces `handlePlay`/`handleStop`:
   ```ts
   function handleToggle() {
     hapticService?.trigger("selection");
     if (!playbackController) return;
     playbackController.togglePlayback();
     hasPlayed = true; // unlocks Continue on first tap
   }
   ```
   `isPlaying` continues to come from the existing `animationState.subscribe`
   (`:136–144`), so the subtitle and any state react correctly.
4. **Remove the green play button and stop button.** The `.button-row` keeps only
   the **Continue** button, still gated on `hasPlayed` (first tap sets it). Continue
   is navigation, not playback chrome — it stays.
5. **Subtitle** per B.

### What the user sees
The sequence renders paused. Tap it → plays (with the transient play/pause icon
flash built into `AnimatorCanvas`), a thin non-interactive progress line shows
position, tap again → pauses. No green button, no scrubber transport. Continue
appears after the first tap.

## Files

| File | Change |
|---|---|
| `AddStepTutorialStep.svelte` | Pass Type-1 `filterPredicate` + `hideFilters`. |
| `OptionPicker.svelte` | Add `hideFilters` prop, thread down. |
| `OptionPickerContent.svelte` | Accept `hideFilters`; gate filter pill + unified-header filter. |
| `PlaySequenceStep.svelte` | Tap-to-play minimal chrome; init on mount; drop ChoreoCard/green/stop buttons; new copy. |

## Verification (test route `/test/tutorial-fullscreen` already exists)

At mobile width, walk the full flow:
1. Add-beat shows a single grid, **no side arrows**, **no All/Continuous pill**.
2. Complete all 4 picks — confirm Type-1 options are present at every pick (no stall).
3. Play step: tapping the canvas toggles play/pause; thin progress line only (no
   transport scrubber); no green/stop buttons; Continue appears after first tap.
4. Copy reads "Tap to play your sequence." / "Tap to pause."
Screenshots for the add-beat grid and the play step.

## Out of scope
- Mobile-fullscreen work (separate shipped change) — unaffected.
- Forcing the dedicated `compact4x4` path: unnecessary, the single-section fallback
  already yields the 4-column grid.
