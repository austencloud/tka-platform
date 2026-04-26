---
status: backlog
value: 2
effort: M
remaining: Full build — timeline + sequence integration
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Spec: Tie the pattern timeline to a real TKA sequence

**Date:** 2026-04-10
**Status:** Ready for implementation
**Owner:** Next available sub-agent
**Estimated size:** Large (~6-8 hours, best as two sub-phases)
**Priority:** After drop-image-on-timeline + blend-crossfades. This is the payoff — the lab stops being abstract and becomes a tool for designing lighting for real sequences.

---

## Context

Today, the `PatternTimeline` in the POV Pattern Lab is **abstract**: `totalBeats` and `bpm` are user-configurable, but there's no actual TKA sequence loaded. The user paints clips onto an imaginary beat grid and watches LED staves cycle through patterns on that grid.

The whole point of the system is to design LED patterns that play *on a real sequence* — so beats of a letter like "BOOK" can each have different lighting. The `phrase-effort-lab` already solved "load a sequence into a lab and paint things onto its beats" for a different domain (effort phrases). This spec copies that architecture for patterns.

---

## Reference implementation

**Read first:** `src/lib/features/phrase-effort-lab/PhraseEffortLabModule.svelte` and `src/lib/features/phrase-effort-lab/domain/effort-timeline-types.ts`.

The phrase-effort-lab does essentially the same thing this spec asks for — it loads a sequence via `SequencePickerModal`, shows the sequence in an `AnimatorCanvas`, paints phrases onto a `PhraseTimeline`, and plays back with a fractional beat cursor. Nearly all the scaffolding can be copied and the domain swapped from "effort" to "pattern".

Key pieces to copy:

- `SequencePickerModal` import + usage (lines ~45, plus the `showPicker` state and the "Load sequence" button trigger)
- `AnimatorCanvas` import + the service construction (`AngleCalculator`, `MotionCalculator`, `EndpointCalculator`, `PropInterpolator`, `StepCalculator`)
- The playback rAF loop tied to `playbackBeat` (fractional)
- Session restore via localStorage (session key pattern)
- Keyboard handling (Space = toggle playback)

---

## Motivation

The user's ask: *"Timeline should match U beats with different patterns. Patterns can change mid-step or at the juncture of steps or at the end of specific loops or phrases or 16-count sequences."*

This ties the pattern timeline to actual sequence structure so those clip boundaries mean something.

---

## Goals

### Phase 3a (first PR): Load a sequence, drive the timeline from its steps

- Add a "Load sequence" button to the POV Pattern Lab that opens `SequencePickerModal`.
- When a sequence is loaded:
  - `totalBeats` becomes the sequence's step count.
  - The Beats scrub in `PatternTimeline` is disabled (it's driven by the sequence).
  - The timeline header shows the sequence's word/name.
  - Playback BPM comes from the global visibility manager (`visibilityManager.getBpm()`), matching how phrase-effort-lab does it.
  - The loaded sequence ID is persisted so it survives reload.
- When no sequence is loaded (the default), everything falls back to the current abstract-beats mode. This is an additive feature, not a replacement.
- Loading a different sequence clamps existing clips to the new bounds (clips beyond the new `totalBeats` get dropped; clips that partially overlap get trimmed).
- An "Unload sequence" button reverts to abstract mode.

### Phase 3b (follow-up PR): Motion preview alongside the staff preview

- Add an `AnimatorCanvas` panel in the POV Pattern Lab showing the loaded sequence's motion (avatar + props).
- The animator's `currentStep` tracks the pattern timeline's playhead so the props move through the sequence in sync with the pattern playback.
- The LedStaffPreview, spin disc, and animator all play off the same clock.
- This is where the real "aha" moment happens — you see the props doing the sequence AND the LED staves playing the patterns AND the crossfades all in sync.

**Split rationale:** Phase 3a alone is already useful (painting patterns onto real sequence steps). Phase 3b layers on the motion preview. Phase 3a is ~3 hours; Phase 3b is ~3-5 hours depending on service wiring.

## Non-goals

- **No save-back to Firestore.** The phrase-effort-lab saves timelines to the sequence document; this spec does NOT. Patterns are in-memory only (same as current). Persistence comes in a later spec once the pattern data format stabilizes.
- **No per-step pattern assignment UI** distinct from the clip-painting UI. The existing paint-by-dragging interaction is how you map patterns to steps — the only thing that changes is that "a beat" now corresponds to a real step.
- **No changes to the sequence editor itself.** All work happens in the lab tab.

---

## Design

### Phase 3a

#### poi-state additions

```typescript
// At the top, alongside other imports:
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

// New persisted key:
const SEQUENCE_STORAGE_KEY = "tka-poi-sequence-id";

// Inside createPoiState:
let loadedSequence = $state<SequenceData | null>(null);
let loadedSteps = $state<readonly StepData[]>([]);

// Derived: when a sequence is loaded, totalBeats IS the step count.
// Replace the existing `let totalBeats = $state(16)` with a $derived
// that prefers sequence length and falls back to a persisted manual value.
let manualTotalBeats = $state(16);
const totalBeats = $derived(
  loadedSequence ? Math.max(1, loadedSteps.length) : manualTotalBeats
);

function loadSequence(seq: SequenceData, steps: readonly StepData[]): void {
  loadedSequence = seq;
  loadedSteps = steps;
  // Persist just the ID (not the whole sequence payload)
  try {
    localStorage.setItem(SEQUENCE_STORAGE_KEY, seq.id ?? "");
  } catch { /* ignore */ }
  // Clamp existing clips to the new bounds
  patternTimeline = {
    ...patternTimeline,
    clips: patternTimeline.clips
      .filter((c) => c.startBeat <= steps.length)
      .map((c) => ({
        ...c,
        endBeat: Math.min(c.endBeat, steps.length),
      })),
  };
  // Reset playhead
  playheadBeat = 0;
}

function unloadSequence(): void {
  loadedSequence = null;
  loadedSteps = [];
  try {
    localStorage.removeItem(SEQUENCE_STORAGE_KEY);
  } catch { /* ignore */ }
}

// Replace setTotalBeats:
function setTotalBeats(n: number): void {
  if (loadedSequence) return; // ignored when a sequence drives it
  manualTotalBeats = Math.max(1, Math.min(128, Math.round(n)));
  if (playheadBeat >= manualTotalBeats) playheadBeat = 0;
}
```

Expose `loadedSequence`, `loadedSteps`, `loadSequence`, `unloadSequence` through the return object.

**Session restore on factory creation:**

```typescript
// After the image restore block in createPoiState:
const savedSequenceId = (() => {
  try {
    return localStorage.getItem(SEQUENCE_STORAGE_KEY);
  } catch { return null; }
})();

if (savedSequenceId) {
  // Look up the sequence in libraryState and load its steps.
  // Mirror how PhraseEffortLabModule does restore — it uses libraryState
  // to find the sequence by ID and constructs StepData via StepCalculator.
  // (Defer the actual call to a separate module method or helper;
  //  the restore flow is nontrivial because StepData isn't stored in
  //  the sequence, it's computed.)
}
```

Session restore is nontrivial because `StepData` is derived from the sequence's raw data by `StepCalculator`. Look at `PhraseEffortLabModule.svelte` lines ~117-180 (the `tryRestoreSession` function) for the pattern.

#### UI: PovPatternLab header

Add a sequence picker button above the lab grid (or in the existing `.controls-column`, above `PatternPicker`):

```svelte
<script lang="ts">
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  // ... existing imports

  let showSequencePicker = $state(false);

  function handleSequenceSelected(seq: SequenceData, steps: readonly StepData[]) {
    poi.loadSequence(seq, steps);
    showSequencePicker = false;
  }
</script>

<div class="sequence-header">
  {#if poi.loadedSequence}
    <div class="loaded-sequence">
      <i class="fas fa-music" aria-hidden="true"></i>
      <span class="seq-word">{poi.loadedSequence.word ?? poi.loadedSequence.name}</span>
      <span class="seq-length">{poi.loadedSteps.length} steps</span>
      <button class="text-btn" onclick={() => poi.unloadSequence()}>
        Unload
      </button>
    </div>
  {:else}
    <button class="text-btn" onclick={() => (showSequencePicker = true)}>
      <i class="fas fa-folder-open" aria-hidden="true"></i>
      Load sequence
    </button>
  {/if}
</div>

{#if showSequencePicker}
  <SequencePickerModal
    onSelect={handleSequenceSelected}
    onClose={() => (showSequencePicker = false)}
  />
{/if}
```

Check the exact `SequencePickerModal` API by reading how phrase-effort-lab uses it — the callback signature may be different.

#### UI: PatternTimeline tweaks

- Disable the Beats scrub when `poi.loadedSequence` is non-null (can't manually change beat count when a sequence drives it).
- In the timeline header, replace "Pattern Timeline" with `poi.loadedSequence ? "{word} — Pattern Timeline" : "Pattern Timeline"` so the sequence name is visible in context.
- Optionally label each beat marker with the corresponding step's letter (read from `poi.loadedSteps[beatIdx].letter`) — this is a **huge** usability win because you can see you're painting onto "B - O - O - K" directly.

### Phase 3b — AnimatorCanvas integration

Create a new component `src/lib/features/poi/components/PovAnimatorPreview.svelte` that wraps the existing `AnimatorCanvas` with pattern-lab-specific setup:

- Takes the loaded sequence's steps.
- Drives `currentStep` from `poi.playheadBeat` (convert fractional beat to step index + interpolation fraction).
- Lives in the preview column of `PovPatternLab` alongside `PovSpinPreview` and `LedStaffPreview`.
- Either replaces the spin disc OR appears above it — user choice, but default is "below the spin disc, above the staff preview".

Reuse the service wiring pattern from `PhraseEffortLabModule.svelte`:

```typescript
let propInterpolator: PropInterpolator;
let stepCalculator: StepCalculator;

onMount(() => {
  const angleCalc = new AngleCalculator();
  const motionCalc = new MotionCalculator(angleCalc);
  const endpointCalc = new EndpointCalculator();
  propInterpolator = new PropInterpolator(motionCalc, endpointCalc);
  stepCalculator = new StepCalculator();
});
```

The animator needs to know the current position in the sequence. Since `poi.playheadBeat` is fractional and beats are 1-indexed in our timeline but the animator uses 0-indexed steps, you'll need:

```typescript
const currentStep = $derived(Math.min(
  poi.loadedSteps.length - 1,
  Math.floor(poi.playheadBeat)
));
const stepProgress = $derived(poi.playheadBeat - Math.floor(poi.playheadBeat));
```

Then feed those to `AnimatorCanvas` (check its prop shape).

**Playback sync:** when the user hits play on the pattern timeline, the animator ALSO plays through the sequence at the same rate. The pattern timeline's rAF loop (in `PatternTimeline.svelte`) advances `playheadBeat`; the animator's `currentStep` is derived from that, so it updates automatically.

---

## Files to touch

### Phase 3a

1. `src/lib/features/poi/state/poi-state.svelte.ts` — add `loadedSequence`, `loadedSteps`, `loadSequence`, `unloadSequence`, convert `totalBeats` to a `$derived`, split manual state into `manualTotalBeats`, add session restore logic.
2. `src/lib/features/lab/tabs/PovPatternLab.svelte` — add sequence picker button, modal, loaded sequence display.
3. `src/lib/features/poi/components/PatternTimeline.svelte` — disable Beats scrub when sequence loaded, show sequence word in header, optionally label beat markers with letters.

### Phase 3b

4. `src/lib/features/poi/components/PovAnimatorPreview.svelte` — **new file**, wraps `AnimatorCanvas` with lab-specific setup.
5. `src/lib/features/lab/tabs/PovPatternLab.svelte` — add `PovAnimatorPreview` to the preview column.

---

## Implementation plan

### Phase 3a

1. Add `SequenceData`/`StepData` imports and the new state fields to poi-state.
2. Convert `totalBeats` from `$state` to `$derived` (this is a non-trivial refactor — verify all readers still work).
3. Implement `loadSequence` + `unloadSequence` + clip clamping.
4. Implement `setTotalBeats` no-op when sequence is loaded.
5. Add the session restore block (copy the pattern from `phrase-effort-lab/PhraseEffortLabModule.svelte::tryRestoreSession`).
6. Add the sequence picker UI to `PovPatternLab.svelte`.
7. Disable Beats scrub + show sequence word in `PatternTimeline.svelte`.
8. `npm run check` clean.
9. Verify in browser: load a sequence, confirm beat count matches, paint clips, play back, confirm it works. Reload and confirm the sequence restores.

### Phase 3b

1. Read `AnimatorCanvas` prop shape.
2. Create `PovAnimatorPreview.svelte` with service wiring from phrase-effort-lab.
3. Wire `currentStep` from `poi.playheadBeat`.
4. Add to `PovPatternLab` preview column.
5. `npm run check` clean.
6. Verify in browser: load sequence, paint clips, hit play, confirm animator props move in sync with staff pattern changes.

---

## Verification / acceptance criteria

### Phase 3a

- [ ] "Load sequence" button opens `SequencePickerModal`.
- [ ] After loading a sequence with N steps, `poi.totalBeats` === N and the beat ruler shows exactly N beats.
- [ ] The Beats scrub in the timeline controls is disabled/greyed out.
- [ ] The timeline header shows the sequence's word.
- [ ] Existing clips are clamped/trimmed to the new bounds when a shorter sequence is loaded.
- [ ] "Unload sequence" returns to abstract mode with the previous manual `totalBeats`.
- [ ] Reloading the page restores the loaded sequence (not the clips — those are still in-memory).
- [ ] Optional stretch: beat markers show the corresponding step letter (B, O, O, K, …).

### Phase 3b

- [ ] A third preview (`PovAnimatorPreview`) appears in the right column showing the loaded sequence's props.
- [ ] Hitting play on the timeline advances BOTH the staves' patterns AND the animator's props in sync.
- [ ] Scrubbing the playhead (future enhancement) updates both simultaneously.
- [ ] When no sequence is loaded, the animator preview is hidden or shows an empty-state.

---

## Open questions

- **SequencePickerModal prop signature** — not verified in this spec; read the file directly before wiring.
- **Does `AnimatorCanvas` support fractional step progress?** Phrase-effort-lab uses fractional beats for playback; if `AnimatorCanvas` can't interpolate mid-step, we get a choppy animator but a smooth pattern preview. Check and handle.
- **Should unloading a sequence clear clips or keep them?** Current spec says keep them and revert to manual `totalBeats`. Clips painted beyond the manual total remain accessible but unreachable by the playhead. Alternative: drop them. TBD with user.
- **Tempo source** — phrase-effort-lab reads `visibilityManager.getBpm()`. Should the pattern lab's `bpm` setter override that, or defer to it? My instinct: when a sequence is loaded, default BPM comes from visibility manager, but the user can override it locally. Same pattern as phrase-effort-lab.
- **Phase 3c (deferred):** save-back — persist clips + timeline settings keyed by sequence ID. Out of scope for this spec.
