# Fuse Synchronized Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continuous, synchronized playback across both Fuse tab panels from pre-pick ChoreoCard highlighting through seamless pick transitions, dual animation canvases, and fused result display.

**Architecture:** A shared beat clock in `fuse-state` drives all playback. ChoreoCards derive their gold-border highlight index from this clock. Animation canvases sync to the clock's beat on mount via `seekToStep()`. The fuse bug is fixed by building proper `StepData` with motion data in `SequenceFuser`.

**Tech Stack:** Svelte 5 runes, requestAnimationFrame, existing AnimationPlaybackController + ChoreoCard infrastructure

**Spec:** `docs/superpowers/specs/2026-03-25-fuse-synchronized-playback-design.md`

---

### Task 1: Fix SequenceFuser — Build Proper Steps with Motion Data

The fuse result currently has `steps: []` which causes "No sequence found" errors. This is the blocking bug — fix it first so the result view works.

**Files:**
- Modify: `src/lib/features/fuse/services/implementations/SequenceFuser.ts`

- [ ] **Step 1: Add imports for motion data construction**

Add these imports at the top of `SequenceFuser.ts`:

```typescript
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
```

- [ ] **Step 2: Add `buildMotionFromSoloPropStep` helper**

Add this function before the `SequenceFuser` class:

```typescript
function buildMotionFromSoloPropStep(
  step: SoloPropStepData,
  color: MotionColor,
  gridMode: GridMode
): ReturnType<typeof createMotionData> {
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
```

- [ ] **Step 3: Build steps array in `fuse()` method**

In the `fuse()` method, replace the line `steps: [],` in the `createSequenceData` call. Before the `return createSequenceData(...)` call, add:

```typescript
// Determine grid mode from inputs
const gridMode = blueSoloProp.impliedGridMode ?? redSoloProp.impliedGridMode ?? GridMode.DIAMOND;

// Build proper steps with motion data so ensureMotionData short-circuits
const steps: StepData[] = [];
for (let i = 0; i < targetLength; i++) {
  const blueStep = tiledBlueSteps[i]!;
  const redStep = tiledRedSteps[i]!;
  steps.push({
    id: crypto.randomUUID(),
    stepNumber: i + 1,
    duration: blueStep.duration ?? 1,
    blueReversal: stepPairings[i]!.blueReversal,
    redReversal: stepPairings[i]!.redReversal,
    isBlank: false,
    letter: stepPairings[i]!.letter ?? null,
    startPosition: null,
    endPosition: null,
    motions: {
      blue: buildMotionFromSoloPropStep(blueStep, MotionColor.BLUE, gridMode),
      red: buildMotionFromSoloPropStep(redStep, MotionColor.RED, gridMode),
    },
  });
}
```

Then replace the entire `return createSequenceData({...})` call with:

```typescript
return createSequenceData({
  name: `${blueHandPath.name ?? "blue"} + ${redHandPath.name ?? "red"}`,
  displayName: `${blueHandPath.name ?? "blue"} + ${redHandPath.name ?? "red"}`,
  word: "__fused__",
  steps,
  blueSoloProp,
  redSoloProp,
  stepPairings,
  sequenceLength: targetLength,
  isCircular: false,
  isFavorite: false,
  tags: [],
  gridMode,
  metadata: { fusedFrom: [blueHandPath.id, redHandPath.id] },
});
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run check`
Expected: No type errors in SequenceFuser.ts

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/services/implementations/SequenceFuser.ts
git commit -m "fix(fuse): build proper steps with motion data in SequenceFuser

The fuser was returning steps: [] which caused ensureMotionData to fail
with 'No sequence found' when trying gallery lookup on an empty word.
Now builds StepData with blue/red MotionData from solo prop steps."
```

---

### Task 2: Add Shared Beat Clock to Fuse State

**Files:**
- Modify: `src/lib/features/fuse/state/fuse-state.svelte.ts`

- [ ] **Step 1: Add clock state variables**

Inside `createFuseState`, after the existing `$state` declarations (after line 61), add:

```typescript
// Shared beat clock — single rAF loop drives all panels
let currentBeat = $state(0);
let clockRunning = $state(false);
let clockAnimFrameId: number | null = null;
let lastClockTimestamp: number | null = null;
```

- [ ] **Step 2: Add clock functions**

After the clock state variables, add:

```typescript
function startClock() {
  if (clockRunning) return;
  clockRunning = true;
  lastClockTimestamp = null;
  tickClock();
}

function stopClock() {
  clockRunning = false;
  if (clockAnimFrameId !== null) {
    cancelAnimationFrame(clockAnimFrameId);
    clockAnimFrameId = null;
  }
  lastClockTimestamp = null;
}

function tickClock() {
  if (!clockRunning) return;
  clockAnimFrameId = requestAnimationFrame((now) => {
    if (lastClockTimestamp !== null) {
      const deltaMs = now - lastClockTimestamp;
      const beatsPerMs = bpm / 60_000;
      currentBeat += deltaMs * beatsPerMs;
    }
    lastClockTimestamp = now;
    tickClock();
  });
}
```

- [ ] **Step 3: Stop clock and reset beat in reset()**

In `reset()`, add `stopClock();` and `currentBeat = 0;` before the existing reset logic.

Note: The clock is started by `FuseSequenceBrowser.loadPool()` (Task 4) when sequences first load, not by select/deselect. The `startClock()` guard (`if (clockRunning) return`) makes redundant calls harmless, but the canonical start point is pool load.

- [ ] **Step 4: Add dispose function**

After the `reset` function, add:

```typescript
function dispose() {
  stopClock();
}
```

- [ ] **Step 5: Expose new state and functions in the return object**

Add to the return object:

```typescript
get currentBeat() { return currentBeat; },
get clockRunning() { return clockRunning; },
startClock,
stopClock,
dispose,
```

- [ ] **Step 6: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/fuse/state/fuse-state.svelte.ts
git commit -m "feat(fuse): add shared beat clock to fuse state

Single rAF loop drives currentBeat for synchronized playback across
both panels. Starts when a sequence is selected, stops on reset/dispose."
```

---

### Task 3: Wire ChoreoCard Beat Highlighting in FuseSequenceBrowser

**Files:**
- Modify: `src/lib/features/fuse/components/FuseSequenceBrowser.svelte`

- [ ] **Step 1: Import fuse context**

Add import at the top of the script block:

```typescript
import { getFuseContext } from "../context/fuse-context";
```

And get the state:

```typescript
const { state: fuseState } = getFuseContext();
```

- [ ] **Step 2: Add currentBeat prop and derive highlighted step**

After the existing `$derived` declarations, add:

```typescript
const highlightedStep = $derived.by(() => {
  if (!currentItem?.steps?.length) return null;
  const stepCount = currentItem.steps.length;
  return Math.floor(fuseState.currentBeat) % stepCount;
});
```

- [ ] **Step 3: Pass highlight props to ChoreoCard**

In the `<ChoreoCard>` component usage (around line 135), add these two props:

```svelte
highlightedStepIndex={highlightedStep}
showHighlight={highlightedStep !== null}
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/components/FuseSequenceBrowser.svelte
git commit -m "feat(fuse): wire ChoreoCard gold-border beat highlighting

FuseSequenceBrowser reads currentBeat from the shared clock and derives
a highlightedStepIndex, passed to ChoreoCard's existing highlight props."
```

---

### Task 4: Auto-Start Clock When Sequences Load in Browser

The clock should start as soon as the first sequence pool loads, not just on pick. This gives the ChoreoCards their synchronized stepping immediately.

**Files:**
- Modify: `src/lib/features/fuse/components/FuseSequenceBrowser.svelte`

- [ ] **Step 1: Start clock after pool loads**

In the `loadPool()` function, after `currentItem = pool[0] ?? null;` and before `if (currentItem)`, add:

```typescript
if (pool.length > 0) {
  fuseState.startClock();
}
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/fuse/components/FuseSequenceBrowser.svelte
git commit -m "feat(fuse): auto-start shared clock when sequence pool loads

Gold-border highlighting begins as soon as sequences are available,
giving the pre-pick ChoreoCards their synchronized stepping."
```

---

### Task 5: Seamless Pick Transition in FuseAnimationPreview

**Files:**
- Modify: `src/lib/features/fuse/components/FuseAnimationPreview.svelte`

- [ ] **Step 1: Add currentBeat prop**

Add `currentBeat` to the props interface:

```typescript
let {
  sequence,
  bpm = DEFAULT_BPM,
  onBack,
  onControllerReady,
  propColor,
  currentBeat = 0,
}: {
  sequence: SequenceData;
  bpm?: number;
  onBack: () => void;
  onControllerReady?: (controller: IAnimationPlaybackController) => void;
  propColor?: "blue" | "red";
  currentBeat?: number;
} = $props();
```

- [ ] **Step 2: Replace the delayed start with clock-synced seek**

In the `$effect` that initializes playback (around line 78-111), replace the last two lines:

```typescript
// OLD:
// Start playback after a brief delay so the canvas renders first
setTimeout(() => controller?.togglePlayback(), 300);
```

With:

```typescript
// Sync to shared clock beat position, then start immediately
const stepCount = fullSeq.steps?.length ?? 1;
if (stepCount > 0 && currentBeat > 0) {
  const wrappedBeat = Math.floor(currentBeat) % stepCount;
  controller!.seekToStep(wrappedBeat);
}
controller!.togglePlayback();
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/fuse/components/FuseAnimationPreview.svelte
git commit -m "feat(fuse): seamless pick transition via shared clock sync

Animation preview seeks to the shared clock's current beat on mount
instead of starting from beat 0 with a 300ms delay. Playback continues
from exactly where the ChoreoCard's gold border was."
```

---

### Task 6: Thread currentBeat Through FusePanel

**Files:**
- Modify: `src/lib/features/fuse/components/FusePanel.svelte`

- [ ] **Step 1: Add currentBeat prop**

Add `currentBeat` to the props:

```typescript
let {
  side,
  selectedSequence,
  onSelect,
  onDeselect,
  bpm,
  onControllerReady,
  mode = "soloProps",
  length = 8,
  currentBeat = 0,
}: {
  side: "left" | "right";
  selectedSequence: SequenceData | null;
  onSelect: (seq: SequenceData) => void;
  onDeselect: () => void;
  bpm: number;
  onControllerReady?: (controller: IAnimationPlaybackController) => void;
  mode?: "soloProps" | "handPaths";
  length?: number;
  currentBeat?: number;
} = $props();
```

- [ ] **Step 2: Pass currentBeat to FuseAnimationPreview**

In the template where `<FuseAnimationPreview>` is rendered, add the `currentBeat` prop:

```svelte
<FuseAnimationPreview
  sequence={selectedSequence}
  {bpm}
  onBack={onDeselect}
  {onControllerReady}
  propColor={side === "left" ? "blue" : "red"}
  {currentBeat}
/>
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/fuse/components/FusePanel.svelte
git commit -m "feat(fuse): thread currentBeat through FusePanel to preview

Passes the shared clock's currentBeat to FuseAnimationPreview
so it can seek to the correct beat on mount."
```

---

### Task 7: Pass currentBeat from FuseLayout to Panels

**Files:**
- Modify: `src/lib/features/fuse/components/FuseLayout.svelte`

- [ ] **Step 1: Add currentBeat to both FusePanel instances**

In the template where the two `<FusePanel>` components are rendered, add:

```svelte
<FusePanel
  side="left"
  selectedSequence={fuseState.leftSequence}
  onSelect={fuseState.selectLeft}
  onDeselect={fuseState.deselectLeft}
  bpm={fuseState.bpm}
  onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
  mode={fuseMode}
  length={fuseLength}
  currentBeat={fuseState.currentBeat}
/>
```

Same for the right panel — add `currentBeat={fuseState.currentBeat}`.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/fuse/components/FuseLayout.svelte
git commit -m "feat(fuse): pass shared clock currentBeat to both panels

Both FusePanel instances now receive the shared clock's currentBeat
for synchronized ChoreoCard highlighting and animation canvas seeking."
```

---

### Task 8: Add Dispose Cleanup in FuseTab

**Files:**
- Modify: `src/lib/features/fuse/FuseTab.svelte`

- [ ] **Step 1: Add onDestroy import and disposal**

Add `onDestroy` import:

```typescript
import { onDestroy } from "svelte";
```

After `const { state: fuseState, error: initError } = init();`, add:

```typescript
onDestroy(() => {
  fuseState?.dispose();
});
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/fuse/FuseTab.svelte
git commit -m "fix(fuse): clean up shared clock rAF on tab unmount

Calls fuseState.dispose() in onDestroy to prevent leaked
requestAnimationFrame loops when navigating away from the Fuse tab."
```

---

### Task 9: Update FuseResultView — "Open in Viewer" Button

**Files:**
- Modify: `src/lib/features/fuse/components/FuseResultView.svelte`

- [ ] **Step 1: Import openSequenceViewer**

Add at the top of the script:

```typescript
import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
```

- [ ] **Step 2: Replace handleSeeRelated with handleOpenInViewer**

Replace the existing `handleSeeRelated` function:

```typescript
function handleOpenInViewer() {
  if (!sequence) return;
  openSequenceViewer(sequence, {
    returnPath: "/app/create",
    returnLabel: "Fuse",
    initialBpm: fuseState.bpm,
  });
}
```

- [ ] **Step 3: Update the button in the template**

Replace the "See Related" button:

```svelte
<button class="action-btn action-related" onclick={handleOpenInViewer}>
  <i class="fas fa-expand" aria-hidden="true"></i>
  <span>Open in Viewer</span>
</button>
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/components/FuseResultView.svelte
git commit -m "feat(fuse): replace 'See Related' with 'Open in Viewer'

Opens the fused sequence in the sequence viewer drawer overlay
with the current BPM preserved."
```

---

### Task 10: Final Verification

- [ ] **Step 1: Full type check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual verification checklist**

Test in browser at localhost:5173:

1. Open Fuse tab — gold border should step through beats on both ChoreoCards
2. Change BPM — gold border speed should change
3. Shuffle — new card picks up current beat position
4. Click Pick on left — animation canvas mounts, continues from same beat
5. Right ChoreoCard continues stepping uninterrupted
6. Click Pick on right — both canvases play synchronized
7. Click Fuse — no "No sequence found" error, result shows with both props
8. Click "Open in Viewer" — sequence viewer drawer opens with the fused sequence
9. Click "Build Another" — resets to browse state
10. Navigate away from Fuse tab and back — no console errors about leaked rAF
