# Fuse Tab: Synchronized Playback & Seamless Pick Transitions

**Date:** 2026-03-25
**Status:** Draft

---

## Problem

The Fuse tab has the right bones but the playback flow is disjointed:

1. **No pre-pick playback.** ChoreoCards sit static until picked. There's no sense of rhythm or preview.
2. **Pick interrupts playback.** Clicking "Pick" destroys the ChoreoCard, mounts a new AnimationCanvas, and starts from beat 0 after a 300ms delay. The other half pauses.
3. **No cross-panel sync.** Each AnimationPreview runs its own independent timer. They drift.
4. **Fuse result errors.** `SequenceFuser` builds the result with `steps: []` and `word: ""`. When `ensureMotionData` tries to look up an empty word in the gallery, it fails with "No sequence found for blue red".

## Goal

Continuous, synchronized playback from the moment a sequence loads through pick, dual-canvas preview, fuse, and result — with zero interruptions.

---

## Design

### Shared Beat Clock

A single beat clock lives in `fuse-state`. It ticks based on `bpm` and emits a `currentBeat` (0-indexed float) that all panels read from.

```typescript
// In fuse-state.svelte.ts
let currentBeat = $state(0);
let clockRunning = $state(false);
let clockAnimFrameId: number | null = null;
let lastClockTimestamp: number | null = null;

function startClock() {
  if (clockRunning) return;
  clockRunning = true;
  lastClockTimestamp = null;
  tick();
}

function stopClock() {
  clockRunning = false;
  if (clockAnimFrameId !== null) {
    cancelAnimationFrame(clockAnimFrameId);
    clockAnimFrameId = null;
  }
}

function tick() {
  if (!clockRunning) return;
  clockAnimFrameId = requestAnimationFrame((now) => {
    if (lastClockTimestamp !== null) {
      const deltaMs = now - lastClockTimestamp;
      const beatsPerMs = bpm / 60_000;
      currentBeat += deltaMs * beatsPerMs;
    }
    lastClockTimestamp = now;
    tick();
  });
}
```

The clock auto-starts when at least one sequence is loaded (browse or picked). It stops on `reset()` AND on disposal (when the Fuse tab unmounts). The `createFuseState` factory returns a `dispose()` method that calls `stopClock()`, and `FuseTab.svelte` calls it in `onDestroy`.

**Why a shared clock instead of per-panel timers:** A single rAF loop with a single timestamp source guarantees lock-step. Two independent rAF loops will drift by frame-scheduling jitter.

**DI note:** `animationPlaybackController` is registered as a factory (`() => new AnimationPlaybackController(...)`) in `animator-container.ts`, so each `container.items.animationPlaybackController` call creates a new instance. Both panels safely get independent controllers.

### Phase 1: Pre-Pick ChoreoCard Playback

Each `FuseSequenceBrowser` reads `fuseState.currentBeat` and derives a `highlightedStepIndex` from it:

```typescript
const highlightedStep = $derived.by(() => {
  if (!currentItem?.steps?.length) return null;
  const stepCount = currentItem.steps.length;
  // Wrap the shared clock's beat into this sequence's length.
  // ChoreoCard's highlightedStepIndex is 0-indexed where 0 = first motion beat
  // (not start position). So wrapping by stepCount gives the correct cell.
  const wrappedBeat = Math.floor(fuseState.currentBeat) % stepCount;
  return wrappedBeat;
});
```

This index is passed to `ChoreoCard` via its existing `highlightedStepIndex` and `showHighlight` props. Note: `FuseSequenceBrowser` currently doesn't pass these props — they need to be threaded through. Both left and right panels read from the same `currentBeat`, so the gold border steps in sync across both halves.

When the user **shuffles**, the new card immediately picks up the current beat position. No reset needed.

### Phase 2: Seamless Pick Transition

When the user clicks "Pick":

1. `FusePanel` sets `selectedSequence` (as today)
2. `FuseAnimationPreview` mounts and initializes its `AnimationPlaybackController`
3. Instead of starting from beat 0, it reads `fuseState.currentBeat`, wraps it into the sequence length, and seeks there:

```typescript
// After controller.initialize():
const stepCount = fullSeq.steps?.length ?? 1;
const wrappedBeat = Math.floor(fuseState.currentBeat) % stepCount;
controller.seekToStep(wrappedBeat);
controller.togglePlayback(); // Start immediately, no 300ms delay
```

4. The `FuseAnimationPreview` drives its controller via the shared clock's BPM (using `setSpeed()` as today). Since both the shared clock and the controller use `requestAnimationFrame` with the same BPM, they stay naturally aligned. No continuous drift correction is needed — the initial `seekToStep` on mount is sufficient because both timers advance at the same rate from the same sync point.

The other panel (still showing ChoreoCard) continues stepping on the same shared clock, unaffected.

### Phase 3: Both Picked — Dual Synchronized Canvases

Same mechanism as Phase 2 applied to both panels. Both `FuseAnimationPreview` instances derive their beat from the shared clock. The existing `registerController` / BPM sync in fuse-state stays, but the shared clock is now the authoritative time source.

### Phase 4: Fuse Result — Inline with Viewer Escape Hatch

The existing `FuseResultView` continues to show:
- Celebration burst (canvas particles)
- Fused sequence playing in AnimatorCanvas with both props

Changes:
- Replace the "See Related" button with "Open in Viewer" — navigates to the sequence viewer module with the fused sequence
- The "Save" button saves the fused sequence to the user's library (existing save infrastructure)
- The "Build Another" button resets as today

### Bug Fix: Empty Steps in Fused Sequence

**Root cause:** `SequenceFuser.fuse()` returns a `SequenceData` with `steps: []`. The `ensureMotionData` call in `FuseResultView` tries to look up this empty-word sequence in the gallery and fails.

**Fix:** Build proper `steps` with motion data from the solo prop data. The fuser already computes `tiledBlueSteps` and `tiledRedSteps` — it just doesn't populate the main `steps` array with them.

Each step must satisfy the `StepData` interface (extends `PictographData`):

```typescript
// Required StepData fields:
interface StepData extends PictographData {
  stepNumber: number;      // >= 1
  duration: number;        // beat duration (1 for standard)
  blueReversal: boolean;
  redReversal: boolean;
  isBlank: boolean;
}

// PictographData requires:
interface PictographData {
  id: string;
  motions: Partial<Record<MotionColor, MotionData | undefined>>;
  letter?: Letter | null;
  startPosition?: GridPosition | null;
  endPosition?: GridPosition | null;
}
```

Each `SoloPropStepData` maps to a `MotionData` via `createMotionData()`:

```typescript
function buildMotionFromSoloPropStep(
  step: SoloPropStepData,
  color: MotionColor,
  gridMode: GridMode
): MotionData {
  return createMotionData({
    motionType: step.motionType,
    rotationDirection: step.rotationDirection,
    startLocation: step.startLocation,
    endLocation: step.endLocation,
    turns: step.turns,
    startOrientation: step.startOrientation,
    endOrientation: step.endOrientation,
    color,
    gridMode,
    isVisible: true,
  });
}

// Build the steps array:
const steps: StepData[] = [];
for (let i = 0; i < targetLength; i++) {
  steps.push({
    id: crypto.randomUUID(),
    stepNumber: i + 1,
    duration: tiledBlueSteps[i].duration ?? 1,
    blueReversal: stepPairings[i].blueReversal,
    redReversal: stepPairings[i].redReversal,
    isBlank: false,
    letter: stepPairings[i].letter ?? null,
    startPosition: null,
    endPosition: null,
    motions: {
      blue: buildMotionFromSoloPropStep(tiledBlueSteps[i], MotionColor.BLUE, gridMode),
      red: buildMotionFromSoloPropStep(tiledRedSteps[i], MotionColor.RED, gridMode),
    },
  });
}
```

This means `ensureMotionData` checks `seq.steps?.some(b => b?.motions?.blue && b?.motions?.red)`, finds populated motions, and returns immediately — no gallery lookup.

The `word` field should be set to `"__fused__"` (a value that can't match any real gallery entry) with `name` keeping the human-readable `"blue-name + red-name"` label. The `displayName` field can hold the friendly name for UI display.

---

## Files Changed

| File | Change |
|------|--------|
| `fuse-state.svelte.ts` | Add shared beat clock (currentBeat, startClock, stopClock, tick) |
| `FuseSequenceBrowser.svelte` | Wire `highlightedStepIndex` + `showHighlight` from shared clock |
| `FuseAnimationPreview.svelte` | Seek to shared clock beat on mount instead of beat 0; remove 300ms delay |
| `FusePanel.svelte` | Pass shared clock beat through to browser |
| `FuseResultView.svelte` | Replace "See Related" with "Open in Viewer" |
| `SequenceFuser.ts` | Build proper `steps` array with motion data from solo prop steps |
| `FuseLayout.svelte` | Minor: start clock when sequences load |
| `FuseTab.svelte` | Call `fuseState.dispose()` in onDestroy to clean up clock rAF |

## Files NOT Changed

- `ChoreoCard.svelte` — already has `highlightedStepIndex` and `showHighlight` props
- `AnimationPlaybackController` — `seekToStep()` already supports jumping to any beat
- `AnimatorCanvas` — no changes needed

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Left sequence has 4 beats, right has 8 | Each wraps independently: `beat % ownLength` |
| User shuffles while clock is running | New card picks up current beat position |
| BPM changes mid-playback | Clock uses current BPM for delta calculation; controllers get `setSpeed()` as today |
| Fused sequence has no word | `word: "__fused__"` (never matches gallery), `name` holds readable label |
| Tab unmounts without reset | `dispose()` stops clock rAF — no leaked animation frames |
| Solo prop data missing on source sequences | Guard remains: if `!blue \|\| !red` return early (as today) |

---

## What This Does NOT Change

- The shuffle-to-discover UX (shuffle button, pool cycling)
- The assembly animation (FLIP merge effect)
- The celebration overlay
- The mode toggle (prop paths vs hand paths)
- The length selector
- The match-lengths toggle
