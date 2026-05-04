# Keyboard Sequence Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add numpad-driven sequence building with timing capture to the existing assemble-lab module.

**Architecture:** Keyboard handler and timing interpreter are pure functions (testable, no DOM). Timing state is a separate Svelte 5 runes module composed alongside the existing assemble-state. Keyboard mode is a toggle — zero visual change when off. Animation duration is overridable for replay.

**Tech Stack:** Svelte 5, TypeScript, vitest, existing assemble-lab state machine + SvgPropAnimator.

**Spec:** `docs/superpowers/specs/2026-05-04-keyboard-sequence-builder-design.md`

---

## File Map

```
src/lib/features/assemble-lab/
├── state/
│   ├── assemble-state.svelte.ts       MODIFY — add keyboardMode flag
│   └── timing-state.svelte.ts         CREATE — timing session state
├── services/
│   ├── assemble-keyboard-handler.ts       CREATE — pure keyboard dispatcher
│   ├── assemble-keyboard-handler.test.ts  CREATE — tests
│   ├── timing-interpreter.ts              CREATE — duration computation
│   └── timing-interpreter.test.ts         CREATE — tests
├── components/
│   ├── InteractiveGrid.svelte         MODIFY — key labels, duration override
│   ├── AssembleLabModule.svelte       MODIFY — keyboard listener, layout
│   ├── AssembleIdlePanel.svelte       MODIFY — keyboard mode toggle
│   ├── BuilderInstructionHeader.svelte MODIFY — keyboard mode toggle
│   ├── KeyboardHintStrip.svelte       CREATE — control key reference
│   ├── TimingControlsPanel.svelte     CREATE — capture/interpret toggles
│   └── ReplayTransport.svelte         CREATE — play/reset/re-record
```

---

### Task 1: Keyboard Handler — Pure Function + Tests

**Files:**
- Create: `src/lib/features/assemble-lab/services/assemble-keyboard-handler.ts`
- Create: `src/lib/features/assemble-lab/services/assemble-keyboard-handler.test.ts`

- [ ] **Step 1: Write failing tests for position key mapping**

```typescript
// assemble-keyboard-handler.test.ts
import { describe, it, expect } from "vitest";
import {
  handleAssembleKeyDown,
  type KeyboardAction,
  type KeyboardContext,
} from "./assemble-keyboard-handler";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

function makeEvent(code: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { code });
}

function makeContext(overrides: Partial<KeyboardContext> = {}): KeyboardContext {
  return {
    gridMode: GridMode.SKEWED,
    showCenter: true,
    isModalOpen: false,
    isInputFocused: false,
    ...overrides,
  };
}

describe("handleAssembleKeyDown", () => {
  describe("position keys", () => {
    it("maps Numpad8 to NORTH", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad8"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.NORTH });
    });

    it("maps Numpad2 to SOUTH", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad2"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.SOUTH });
    });

    it("maps Numpad4 to WEST", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad4"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.WEST });
    });

    it("maps Numpad6 to EAST", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad6"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.EAST });
    });

    it("maps Numpad7 to NORTHWEST", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad7"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.NORTHWEST });
    });

    it("maps Numpad9 to NORTHEAST", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad9"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.NORTHEAST });
    });

    it("maps Numpad1 to SOUTHWEST", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad1"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.SOUTHWEST });
    });

    it("maps Numpad3 to SOUTHEAST", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad3"), makeContext());
      expect(result).toEqual({ type: "position", location: GridLocation.SOUTHEAST });
    });

    it("maps Numpad5 to CENTER when showCenter is true", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad5"), makeContext({ showCenter: true }));
      expect(result).toEqual({ type: "position", location: GridLocation.CENTER });
    });

    it("returns null for Numpad5 when showCenter is false", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad5"), makeContext({ showCenter: false }));
      expect(result).toBeNull();
    });
  });

  describe("grid mode filtering", () => {
    it("blocks intercardinal keys in DIAMOND mode", () => {
      const ctx = makeContext({ gridMode: GridMode.DIAMOND });
      expect(handleAssembleKeyDown(makeEvent("Numpad7"), ctx)).toBeNull();
      expect(handleAssembleKeyDown(makeEvent("Numpad9"), ctx)).toBeNull();
      expect(handleAssembleKeyDown(makeEvent("Numpad1"), ctx)).toBeNull();
      expect(handleAssembleKeyDown(makeEvent("Numpad3"), ctx)).toBeNull();
    });

    it("allows cardinal keys in DIAMOND mode", () => {
      const ctx = makeContext({ gridMode: GridMode.DIAMOND });
      expect(handleAssembleKeyDown(makeEvent("Numpad8"), ctx)).toEqual({ type: "position", location: GridLocation.NORTH });
      expect(handleAssembleKeyDown(makeEvent("Numpad6"), ctx)).toEqual({ type: "position", location: GridLocation.EAST });
    });

    it("blocks cardinal keys in BOX mode", () => {
      const ctx = makeContext({ gridMode: GridMode.BOX });
      expect(handleAssembleKeyDown(makeEvent("Numpad8"), ctx)).toBeNull();
      expect(handleAssembleKeyDown(makeEvent("Numpad4"), ctx)).toBeNull();
    });

    it("allows intercardinal keys in BOX mode", () => {
      const ctx = makeContext({ gridMode: GridMode.BOX });
      expect(handleAssembleKeyDown(makeEvent("Numpad7"), ctx)).toEqual({ type: "position", location: GridLocation.NORTHWEST });
    });

    it("allows all keys in SKEWED mode", () => {
      const ctx = makeContext({ gridMode: GridMode.SKEWED });
      expect(handleAssembleKeyDown(makeEvent("Numpad8"), ctx)).not.toBeNull();
      expect(handleAssembleKeyDown(makeEvent("Numpad7"), ctx)).not.toBeNull();
    });
  });

  describe("control keys", () => {
    it("maps NumpadAdd to turnUp", () => {
      const result = handleAssembleKeyDown(makeEvent("NumpadAdd"), makeContext());
      expect(result).toEqual({ type: "turnUp" });
    });

    it("maps NumpadSubtract to turnDown", () => {
      const result = handleAssembleKeyDown(makeEvent("NumpadSubtract"), makeContext());
      expect(result).toEqual({ type: "turnDown" });
    });

    it("maps NumpadMultiply to toggleRotation", () => {
      const result = handleAssembleKeyDown(makeEvent("NumpadMultiply"), makeContext());
      expect(result).toEqual({ type: "toggleRotation" });
    });

    it("maps NumpadDivide to cycleOrientation", () => {
      const result = handleAssembleKeyDown(makeEvent("NumpadDivide"), makeContext());
      expect(result).toEqual({ type: "cycleOrientation" });
    });

    it("maps Numpad0 to switchHand", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad0"), makeContext());
      expect(result).toEqual({ type: "switchHand" });
    });

    it("maps NumpadDecimal to undo", () => {
      const result = handleAssembleKeyDown(makeEvent("NumpadDecimal"), makeContext());
      expect(result).toEqual({ type: "undo" });
    });

    it("maps NumpadEnter to finish", () => {
      const result = handleAssembleKeyDown(makeEvent("NumpadEnter"), makeContext());
      expect(result).toEqual({ type: "finish" });
    });
  });

  describe("input guards", () => {
    it("returns null when input is focused", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad8"), makeContext({ isInputFocused: true }));
      expect(result).toBeNull();
    });

    it("returns null when modal is open", () => {
      const result = handleAssembleKeyDown(makeEvent("Numpad8"), makeContext({ isModalOpen: true }));
      expect(result).toBeNull();
    });

    it("returns null for non-numpad keys", () => {
      const result = handleAssembleKeyDown(makeEvent("KeyA"), makeContext());
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/features/assemble-lab/services/assemble-keyboard-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement keyboard handler**

```typescript
// assemble-keyboard-handler.ts
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface KeyboardContext {
  gridMode: GridMode;
  showCenter: boolean;
  isModalOpen: boolean;
  isInputFocused: boolean;
}

export type KeyboardAction =
  | { type: "position"; location: GridLocation }
  | { type: "turnUp" }
  | { type: "turnDown" }
  | { type: "toggleRotation" }
  | { type: "cycleOrientation" }
  | { type: "switchHand" }
  | { type: "undo" }
  | { type: "finish" };

const NUMPAD_TO_LOCATION: Record<string, GridLocation> = {
  Numpad7: GridLocation.NORTHWEST,
  Numpad8: GridLocation.NORTH,
  Numpad9: GridLocation.NORTHEAST,
  Numpad4: GridLocation.WEST,
  Numpad5: GridLocation.CENTER,
  Numpad6: GridLocation.EAST,
  Numpad1: GridLocation.SOUTHWEST,
  Numpad2: GridLocation.SOUTH,
  Numpad3: GridLocation.SOUTHEAST,
};

const CARDINAL: Set<GridLocation> = new Set([
  GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST,
]);

const INTERCARDINAL: Set<GridLocation> = new Set([
  GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST,
]);

function isLocationValidForMode(location: GridLocation, mode: GridMode, showCenter: boolean): boolean {
  if (location === GridLocation.CENTER) return showCenter;
  switch (mode) {
    case GridMode.DIAMOND: return CARDINAL.has(location);
    case GridMode.BOX: return INTERCARDINAL.has(location);
    case GridMode.SKEWED: return true;
    default: return true;
  }
}

export function handleAssembleKeyDown(
  e: KeyboardEvent,
  context: KeyboardContext,
): KeyboardAction | null {
  if (context.isInputFocused || context.isModalOpen) return null;

  const location = NUMPAD_TO_LOCATION[e.code];
  if (location !== undefined) {
    if (!isLocationValidForMode(location, context.gridMode, context.showCenter)) return null;
    return { type: "position", location };
  }

  switch (e.code) {
    case "NumpadAdd": return { type: "turnUp" };
    case "NumpadSubtract": return { type: "turnDown" };
    case "NumpadMultiply": return { type: "toggleRotation" };
    case "NumpadDivide": return { type: "cycleOrientation" };
    case "Numpad0": return { type: "switchHand" };
    case "NumpadDecimal": return { type: "undo" };
    case "NumpadEnter": return { type: "finish" };
    default: return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/features/assemble-lab/services/assemble-keyboard-handler.test.ts`
Expected: All 20 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/services/assemble-keyboard-handler.ts src/lib/features/assemble-lab/services/assemble-keyboard-handler.test.ts
git commit -m "feat(assemble): add numpad keyboard handler with grid mode filtering"
```

---

### Task 2: Timing Interpreter — Pure Functions + Tests

**Files:**
- Create: `src/lib/features/assemble-lab/services/timing-interpreter.ts`
- Create: `src/lib/features/assemble-lab/services/timing-interpreter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// timing-interpreter.test.ts
import { describe, it, expect } from "vitest";
import {
  computeDurations,
  type CaptureMode,
  type InterpretMode,
  type TimedStepRecord,
} from "./timing-interpreter";

function makeRecords(keydowns: number[], keyups: number[]): TimedStepRecord[] {
  return keydowns.map((kd, i) => ({ keydownTimestamp: kd, keyupTimestamp: keyups[i]! }));
}

describe("computeDurations", () => {
  describe("inter-press capture", () => {
    it("computes gaps between consecutive keydowns", () => {
      const records = makeRecords([0, 200, 500, 600], [50, 250, 550, 650]);
      const result = computeDurations(records, "inter-press", "absolute");
      expect(result).toEqual([200, 300, 100]);
    });

    it("returns empty array for single step", () => {
      const records = makeRecords([0], [50]);
      expect(computeDurations(records, "inter-press", "absolute")).toEqual([]);
    });
  });

  describe("hold-duration capture", () => {
    it("computes keyup - keydown for each step", () => {
      const records = makeRecords([0, 300, 700], [200, 500, 1000]);
      const result = computeDurations(records, "hold-duration", "absolute");
      expect(result).toEqual([200, 200, 300]);
    });
  });

  describe("absolute interpretation", () => {
    it("clamps to [100, 3000]", () => {
      const records = makeRecords([0, 10, 5000], [5, 15, 5005]);
      const result = computeDurations(records, "inter-press", "absolute");
      expect(result[0]).toBe(100);   // 10ms clamped up
      expect(result[1]).toBe(3000);  // 4990ms clamped down
    });
  });

  describe("proportional interpretation", () => {
    it("normalizes relative to average and clamps to [150, 2000]", () => {
      // Gaps: 100, 300, 200 → avg=200
      // Ratios: 0.5, 1.5, 1.0
      // Target avg = 400ms → durations: 200, 600, 400
      const records = makeRecords([0, 100, 400, 600], [50, 150, 450, 650]);
      const result = computeDurations(records, "inter-press", "proportional");
      // Check ratios are preserved (proportional to input)
      expect(result[0]!).toBeLessThan(result[2]!);
      expect(result[1]!).toBeGreaterThan(result[2]!);
      // All within clamp range
      result.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(150);
        expect(d).toBeLessThanOrEqual(2000);
      });
    });
  });

  describe("quantized interpretation", () => {
    it("snaps to nearest subdivision at 120 BPM, 8th notes", () => {
      // 120 BPM, 8th note subdivision = 250ms
      // Gap: 230ms → snaps to 250ms
      // Gap: 480ms → snaps to 500ms (2 × 250)
      const records = makeRecords([0, 230, 710], [50, 280, 760]);
      const result = computeDurations(records, "inter-press", "quantized", 120, 8);
      expect(result[0]).toBe(250);
      expect(result[1]).toBe(500);
    });

    it("clamps to minimum 1 subdivision", () => {
      // 120 BPM, 8th notes = 250ms per subdivision
      // Gap: 10ms → clamp to 250ms (1 subdivision)
      const records = makeRecords([0, 10], [5, 15]);
      const result = computeDurations(records, "inter-press", "quantized", 120, 8);
      expect(result[0]).toBe(250);
    });

    it("clamps to maximum 8 subdivisions", () => {
      // 120 BPM, 8th notes = 250ms → max = 2000ms
      // Gap: 5000ms → clamp to 2000ms
      const records = makeRecords([0, 5000], [50, 5050]);
      const result = computeDurations(records, "inter-press", "quantized", 120, 8);
      expect(result[0]).toBe(2000);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/features/assemble-lab/services/timing-interpreter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement timing interpreter**

```typescript
// timing-interpreter.ts
export type CaptureMode = "inter-press" | "hold-duration";
export type InterpretMode = "proportional" | "absolute" | "quantized";

export interface TimedStepRecord {
  keydownTimestamp: number;
  keyupTimestamp: number;
}

const PROPORTIONAL_TARGET_AVG = 400;
const PROPORTIONAL_MIN = 150;
const PROPORTIONAL_MAX = 2000;
const ABSOLUTE_MIN = 100;
const ABSOLUTE_MAX = 3000;
const QUANTIZE_MIN_SUBDIVISIONS = 1;
const QUANTIZE_MAX_SUBDIVISIONS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractRawDurations(records: TimedStepRecord[], capture: CaptureMode): number[] {
  if (capture === "hold-duration") {
    return records.map(r => r.keyupTimestamp - r.keydownTimestamp);
  }
  // inter-press: gaps between consecutive keydowns
  const durations: number[] = [];
  for (let i = 0; i < records.length - 1; i++) {
    durations.push(records[i + 1]!.keydownTimestamp - records[i]!.keydownTimestamp);
  }
  return durations;
}

function applyAbsolute(raw: number[]): number[] {
  return raw.map(d => clamp(d, ABSOLUTE_MIN, ABSOLUTE_MAX));
}

function applyProportional(raw: number[]): number[] {
  if (raw.length === 0) return [];
  const avg = raw.reduce((sum, d) => sum + d, 0) / raw.length;
  if (avg === 0) return raw.map(() => PROPORTIONAL_TARGET_AVG);
  return raw.map(d => {
    const ratio = d / avg;
    return clamp(ratio * PROPORTIONAL_TARGET_AVG, PROPORTIONAL_MIN, PROPORTIONAL_MAX);
  });
}

function applyQuantized(raw: number[], bpm: number, subdivision: number): number[] {
  const subdivisionMs = (60_000 / bpm) / (subdivision / 4);
  return raw.map(d => {
    const subdivisions = Math.round(d / subdivisionMs);
    const clamped = clamp(subdivisions, QUANTIZE_MIN_SUBDIVISIONS, QUANTIZE_MAX_SUBDIVISIONS);
    return clamped * subdivisionMs;
  });
}

export function computeDurations(
  records: TimedStepRecord[],
  capture: CaptureMode,
  interpret: InterpretMode,
  bpm: number = 120,
  subdivision: number = 8,
): number[] {
  const raw = extractRawDurations(records, capture);
  switch (interpret) {
    case "absolute": return applyAbsolute(raw);
    case "proportional": return applyProportional(raw);
    case "quantized": return applyQuantized(raw, bpm, subdivision);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/features/assemble-lab/services/timing-interpreter.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/services/timing-interpreter.ts src/lib/features/assemble-lab/services/timing-interpreter.test.ts
git commit -m "feat(assemble): add timing interpreter with proportional/absolute/quantized modes"
```

---

### Task 3: Timing State

**Files:**
- Create: `src/lib/features/assemble-lab/state/timing-state.svelte.ts`

- [ ] **Step 1: Create timing state module**

```typescript
// timing-state.svelte.ts
import type { CaptureMode, InterpretMode, TimedStepRecord } from "../services/timing-interpreter";
import { computeDurations } from "../services/timing-interpreter";

export function createTimingState() {
  let records = $state<TimedStepRecord[]>([]);
  let captureMode = $state<CaptureMode>("inter-press");
  let interpretMode = $state<InterpretMode>("proportional");
  let bpm = $state(120);
  let subdivision = $state<4 | 8 | 16>(8);
  let isReRecording = $state(false);
  let reRecordIndex = $state(0);

  // Pending keydown for hold-duration capture
  let pendingKeydown = $state<number | null>(null);

  const durations = $derived(computeDurations(records, captureMode, interpretMode, bpm, subdivision));
  const hasTimingData = $derived(records.length > 0);

  function recordKeydown(): void {
    const now = performance.now();
    if (captureMode === "hold-duration") {
      pendingKeydown = now;
    }
    records = [...records, { keydownTimestamp: now, keyupTimestamp: now }];
  }

  function recordKeyup(): void {
    if (captureMode !== "hold-duration" || records.length === 0) return;
    const now = performance.now();
    const last = records[records.length - 1]!;
    records = [...records.slice(0, -1), { ...last, keyupTimestamp: now }];
    pendingKeydown = null;
  }

  function startReRecord(totalSteps: number): void {
    records = [];
    isReRecording = true;
    reRecordIndex = 0;
  }

  function advanceReRecord(): boolean {
    reRecordIndex++;
    return true;
  }

  function finishReRecord(): void {
    isReRecording = false;
    reRecordIndex = 0;
  }

  function clearTiming(): void {
    records = [];
    pendingKeydown = null;
    isReRecording = false;
    reRecordIndex = 0;
  }

  function setCaptureMode(mode: CaptureMode): void {
    captureMode = mode;
  }

  function setInterpretMode(mode: InterpretMode): void {
    interpretMode = mode;
  }

  function setBpm(value: number): void {
    bpm = Math.max(40, Math.min(300, value));
  }

  function setSubdivision(value: 4 | 8 | 16): void {
    subdivision = value;
  }

  return {
    get records() { return records; },
    get captureMode() { return captureMode; },
    get interpretMode() { return interpretMode; },
    get bpm() { return bpm; },
    get subdivision() { return subdivision; },
    get durations() { return durations; },
    get hasTimingData() { return hasTimingData; },
    get isReRecording() { return isReRecording; },
    get reRecordIndex() { return reRecordIndex; },

    recordKeydown,
    recordKeyup,
    startReRecord,
    advanceReRecord,
    finishReRecord,
    clearTiming,
    setCaptureMode,
    setInterpretMode,
    setBpm,
    setSubdivision,
  };
}

export type TimingState = ReturnType<typeof createTimingState>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/assemble-lab/state/timing-state.svelte.ts
git commit -m "feat(assemble): add timing state for keyboard capture sessions"
```

---

### Task 4: Assemble State — Add Keyboard Mode + Animation Duration Override

**Files:**
- Modify: `src/lib/features/assemble-lab/state/assemble-state.svelte.ts`

- [ ] **Step 1: Add keyboardMode state and animation duration override**

Add these state variables after line 43 (`let showCenter = $state<boolean>(false);`):

```typescript
let keyboardMode = $state<boolean>(false);
```

Add this to the animation callback type — change the signature on line 58-60 from:

```typescript
let onAnimationRequest = $state<
  ((step: BuilderStep) => Promise<void>) | null
>(null);
```

to:

```typescript
let onAnimationRequest = $state<
  ((step: BuilderStep, durationMs?: number) => Promise<void>) | null
>(null);
```

Add a `toggleKeyboardMode` function after `setShowCenter`:

```typescript
function toggleKeyboardMode(): void {
  keyboardMode = !keyboardMode;
}
```

Add to the returned object's readable state section:

```typescript
get keyboardMode() { return keyboardMode; },
```

Add to the returned object's actions section:

```typescript
toggleKeyboardMode,
```

Update `setAnimationCallback` signature to match:

```typescript
function setAnimationCallback(cb: (step: BuilderStep, durationMs?: number) => Promise<void>): void {
  onAnimationRequest = cb;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/assemble-lab/state/assemble-state.svelte.ts
git commit -m "feat(assemble): add keyboardMode flag and animation duration override to state"
```

---

### Task 5: InteractiveGrid — Key Labels + Duration Override

**Files:**
- Modify: `src/lib/features/assemble-lab/components/InteractiveGrid.svelte`

- [ ] **Step 1: Add key label data and accept keyboard mode prop**

In the `<script>` section, add a mapping from GridLocation to numpad key label after the existing imports:

```typescript
const LOCATION_TO_KEY_LABEL: Record<string, string> = {
  [GridLocation.NORTHWEST]: "7",
  [GridLocation.NORTH]: "8",
  [GridLocation.NORTHEAST]: "9",
  [GridLocation.WEST]: "4",
  [GridLocation.CENTER]: "5",
  [GridLocation.EAST]: "6",
  [GridLocation.SOUTHWEST]: "1",
  [GridLocation.SOUTH]: "2",
  [GridLocation.SOUTHEAST]: "3",
};
```

Import GridLocation at the top (change the existing import):

```typescript
import { GridLocation, type GridLocation as GridLocationType } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
```

Wait — `GridLocation` is already imported as a type. Check the existing import on line 16:

```typescript
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
```

Since `GridLocation` is both a value (const object) and a type, change this to a value import:

```typescript
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
```

This works because the file exports it as `const GridLocation = {...} as const` and `type GridLocation = ...`. Importing as a value gets both.

- [ ] **Step 2: Update animation callback to pass duration**

In the `$effect` that registers the animation callback (around line 178), update the callback signature and the `animator.animate` call to accept optional duration:

Change:
```typescript
builderState.setAnimationCallback(async (step: BuilderStep) => {
```
to:
```typescript
builderState.setAnimationCallback(async (step: BuilderStep, durationMs?: number) => {
```

Change every `durationMs: ANIMATION_DURATION_MS` in the callback to:
```typescript
durationMs: durationMs ?? ANIMATION_DURATION_MS,
```

There are two places: the main `animator.animate` call and the `ghostAnimator.animate` call.

- [ ] **Step 3: Add key label overlay in SVG**

Add key labels as text elements inside the hit targets loop. Before the closing `{/each}` of the hit targets section (around line 674), add text labels:

```svelte
<!-- Layer 5: Hit targets (always on top for clicks) -->
{#each hitTargets as target (target.location)}
  <!-- Key label (keyboard mode only) -->
  {#if builderState.keyboardMode}
    <text
      x={target.x}
      y={target.y + 5}
      class="key-label"
      class:key-invalid={!isActiveTarget(target)}
      text-anchor="middle"
      dominant-baseline="middle"
      aria-hidden="true"
    >{LOCATION_TO_KEY_LABEL[target.location] ?? ""}</text>
  {/if}
  <circle
    ...existing circle attributes...
  />
{/each}
```

Note: the text element must be BEFORE the circle so the circle's transparent fill sits on top for click capture.

- [ ] **Step 4: Add CSS for key labels**

Add to the `<style>` section:

```css
.key-label {
  font-size: 28px;
  font-weight: 700;
  fill: rgba(255, 255, 255, 0.25);
  pointer-events: none;
  font-family: var(--font-mono, monospace);
  user-select: none;
}

.key-label.key-invalid {
  fill: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 5: Run typecheck + verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/assemble-lab/components/InteractiveGrid.svelte
git commit -m "feat(assemble): add numpad key labels and animation duration override to grid"
```

---

### Task 6: KeyboardHintStrip Component

**Files:**
- Create: `src/lib/features/assemble-lab/components/KeyboardHintStrip.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  KeyboardHintStrip.svelte - Compact numpad control key reference bar.
  Visible only in keyboard mode. Shows current turn count + rotation direction.
-->
<script lang="ts">
  import type { AssembleState } from "../state/assemble-state.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let { builderState }: { builderState: AssembleState } = $props();

  const rotLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE ? "CW" : "CCW"
  );

  const turnLabel = $derived(
    builderState.turnCount === -0.5 ? "fl" : String(builderState.turnCount)
  );
</script>

<div class="hint-strip" aria-label="Keyboard controls reference">
  <span class="state-badge" aria-live="polite">
    <span class="badge-value">{turnLabel}</span>
    <span class="badge-label">{rotLabel}</span>
  </span>
  <span class="hint-divider" aria-hidden="true"></span>
  <span class="hint"><kbd>+</kbd><kbd>−</kbd> turns</span>
  <span class="hint"><kbd>*</kbd> flip</span>
  <span class="hint"><kbd>/</kbd> ori</span>
  <span class="hint"><kbd>0</kbd> hand</span>
  <span class="hint"><kbd>.</kbd> undo</span>
  <span class="hint"><kbd>⏎</kbd> done</span>
</div>

<style>
  .hint-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-wrap: wrap;
    justify-content: center;
  }

  .state-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 8px;
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.12));
    border: 1px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
  }

  .badge-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-accent, #6366f1);
    font-family: var(--font-mono, monospace);
  }

  .badge-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
    opacity: 0.7;
  }

  .hint-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
  }

  .hint :global(kbd) {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin-right: 2px;
  }

  @media (max-width: 768px) {
    .hint-strip {
      display: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/assemble-lab/components/KeyboardHintStrip.svelte
git commit -m "feat(assemble): add KeyboardHintStrip component for numpad control reference"
```

---

### Task 7: TimingControlsPanel Component

**Files:**
- Create: `src/lib/features/assemble-lab/components/TimingControlsPanel.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  TimingControlsPanel.svelte - Capture mode, interpretation mode, BPM/subdivision controls.
  Visible only in keyboard mode.
-->
<script lang="ts">
  import type { TimingState } from "../state/timing-state.svelte";

  let { timingState }: { timingState: TimingState } = $props();

  const CAPTURE_MODES = [
    { value: "inter-press" as const, label: "Between Presses" },
    { value: "hold-duration" as const, label: "Hold Duration" },
  ];

  const INTERPRET_MODES = [
    { value: "proportional" as const, label: "Proportional" },
    { value: "absolute" as const, label: "Absolute" },
    { value: "quantized" as const, label: "Quantized" },
  ];

  const SUBDIVISIONS = [
    { value: 4 as const, label: "¼" },
    { value: 8 as const, label: "⅛" },
    { value: 16 as const, label: "1/16" },
  ];

  function adjustBpm(delta: number): void {
    timingState.setBpm(timingState.bpm + delta);
  }
</script>

<div class="timing-controls" aria-label="Timing controls">
  <div class="control-group">
    <span class="group-label">Capture</span>
    <div class="pill-group" role="radiogroup" aria-label="Capture mode">
      {#each CAPTURE_MODES as mode}
        <button
          class="pill"
          class:active={timingState.captureMode === mode.value}
          role="radio"
          aria-checked={timingState.captureMode === mode.value}
          onclick={() => timingState.setCaptureMode(mode.value)}
        >{mode.label}</button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="group-label">Timing</span>
    <div class="pill-group" role="radiogroup" aria-label="Interpretation mode">
      {#each INTERPRET_MODES as mode}
        <button
          class="pill"
          class:active={timingState.interpretMode === mode.value}
          role="radio"
          aria-checked={timingState.interpretMode === mode.value}
          onclick={() => timingState.setInterpretMode(mode.value)}
        >{mode.label}</button>
      {/each}
    </div>
  </div>

  {#if timingState.interpretMode === "quantized"}
    <div class="control-group">
      <span class="group-label">BPM</span>
      <div class="bpm-control">
        <button
          class="bpm-btn"
          aria-label="Decrease BPM"
          onclick={() => adjustBpm(-5)}
        >−</button>
        <span class="bpm-value">{timingState.bpm}</span>
        <button
          class="bpm-btn"
          aria-label="Increase BPM"
          onclick={() => adjustBpm(5)}
        >+</button>
      </div>
    </div>

    <div class="control-group">
      <span class="group-label">Grid</span>
      <div class="pill-group" role="radiogroup" aria-label="Subdivision">
        {#each SUBDIVISIONS as sub}
          <button
            class="pill"
            class:active={timingState.subdivision === sub.value}
            role="radio"
            aria-checked={timingState.subdivision === sub.value}
            onclick={() => timingState.setSubdivision(sub.value)}
          >{sub.label}</button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .timing-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    align-items: center;
    justify-content: center;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .pill-group {
    display: flex;
    gap: 2px;
    border-radius: 8px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.2));
    padding: 2px;
  }

  .pill {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .pill:hover {
    color: var(--theme-text, #fff);
  }

  .pill.active {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.15));
    color: var(--theme-accent, #6366f1);
  }

  .pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  .bpm-control {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 8px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.2));
    padding: 2px;
  }

  .bpm-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bpm-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
  }

  .bpm-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    min-width: 36px;
    text-align: center;
    font-family: var(--font-mono, monospace);
  }

  @media (max-width: 768px) {
    .timing-controls {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/assemble-lab/components/TimingControlsPanel.svelte
git commit -m "feat(assemble): add TimingControlsPanel for capture and interpretation mode toggles"
```

---

### Task 8: ReplayTransport Component

**Files:**
- Create: `src/lib/features/assemble-lab/components/ReplayTransport.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  ReplayTransport.svelte - Replay controls + re-record timing button.
  Visible only when timing data exists.
-->
<script lang="ts">
  import type { AssembleState, BuilderStep } from "../state/assemble-state.svelte";
  import type { TimingState } from "../state/timing-state.svelte";

  let {
    builderState,
    timingState,
    onReplay,
    onReRecord,
  }: {
    builderState: AssembleState;
    timingState: TimingState;
    onReplay: () => void;
    onReRecord: () => void;
  } = $props();

  const isComplete = $derived(builderState.phase === "complete");
  const canReplay = $derived(timingState.hasTimingData && isComplete);
  const canReRecord = $derived(
    (builderState.blueSteps.length > 0 || builderState.redSteps.length > 0) &&
    !timingState.isReRecording
  );
</script>

{#if timingState.hasTimingData || canReRecord}
  <div class="transport" aria-label="Replay controls">
    <button
      class="transport-btn play"
      disabled={!canReplay}
      aria-label="Replay sequence with timing"
      onclick={onReplay}
    >
      <i class="fas fa-play" aria-hidden="true"></i>
      <span>Replay</span>
    </button>

    <button
      class="transport-btn re-record"
      disabled={!canReRecord}
      aria-label="Re-record timing for existing positions"
      onclick={onReRecord}
    >
      <i class="fas fa-circle" aria-hidden="true"></i>
      <span>Re-record</span>
    </button>

    {#if timingState.hasTimingData}
      <button
        class="transport-btn clear"
        aria-label="Clear timing data"
        onclick={() => timingState.clearTiming()}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
{/if}

<style>
  .transport {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 6px 0;
  }

  .transport-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .transport-btn:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .transport-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .transport-btn.play i {
    color: var(--theme-success, #22c55e);
    font-size: 10px;
  }

  .transport-btn.re-record i {
    color: var(--prop-red, #ed1c24);
    font-size: 10px;
  }

  .transport-btn.clear {
    padding: 8px 10px;
  }

  .transport-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .transport {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .transport-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/assemble-lab/components/ReplayTransport.svelte
git commit -m "feat(assemble): add ReplayTransport component for playback and re-recording"
```

---

### Task 9: AssembleLabModule — Wire Everything Together

**Files:**
- Modify: `src/lib/features/assemble-lab/AssembleLabModule.svelte`
- Modify: `src/lib/features/assemble-lab/components/AssembleIdlePanel.svelte`
- Modify: `src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte`

- [ ] **Step 1: Add keyboard mode toggle to AssembleIdlePanel**

In `AssembleIdlePanel.svelte`, add a keyboard mode toggle button after the center chip button (after line 71):

```svelte
<button
  class="center-chip"
  class:active={builderState.keyboardMode}
  role="switch"
  aria-checked={builderState.keyboardMode}
  aria-label="Keyboard mode (use numpad)"
  onclick={() => builderState.toggleKeyboardMode()}
>
  <span class="chip-label"><i class="fas fa-keyboard" aria-hidden="true"></i> Keyboard</span>
  <span class="chip-desc">Build with numpad</span>
</button>
```

- [ ] **Step 2: Add keyboard mode toggle to BuilderInstructionHeader**

In `BuilderInstructionHeader.svelte`, add a small keyboard toggle button inside the `.instruction-header` div, after the hand-switcher div (after line 140):

```svelte
<button
  class="keyboard-toggle"
  class:active={builderState.keyboardMode}
  role="switch"
  aria-checked={builderState.keyboardMode}
  aria-label="Toggle keyboard mode"
  onclick={() => builderState.toggleKeyboardMode()}
>
  <i class="fas fa-keyboard" aria-hidden="true"></i>
</button>
```

Add CSS:

```css
.keyboard-toggle {
  position: absolute;
  right: 16px;
  top: 12px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  font-size: var(--font-size-min, 14px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.keyboard-toggle:hover {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  color: var(--theme-text, #fff);
}

.keyboard-toggle.active {
  background: var(--theme-accent-bg, rgba(99, 102, 241, 0.12));
  border-color: var(--theme-accent-border, rgba(99, 102, 241, 0.3));
  color: var(--theme-accent, #6366f1);
}

.keyboard-toggle:focus-visible {
  outline: 2px solid var(--theme-text, #fff);
  outline-offset: 2px;
}
```

Make `.instruction-header` position relative:

```css
.instruction-header {
  position: relative;
  /* ...existing styles... */
}
```

- [ ] **Step 3: Wire keyboard listener and new components into AssembleLabModule**

In `AssembleLabModule.svelte`, add imports:

```typescript
import { createTimingState } from "./state/timing-state.svelte";
import { handleAssembleKeyDown } from "./services/assemble-keyboard-handler";
import type { KeyboardAction } from "./services/assemble-keyboard-handler";
import KeyboardHintStrip from "./components/KeyboardHintStrip.svelte";
import TimingControlsPanel from "./components/TimingControlsPanel.svelte";
import ReplayTransport from "./components/ReplayTransport.svelte";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
```

Create timing state after the builder state:

```typescript
const timingState = createTimingState();
```

Add the turn cycling constants and keyboard action dispatcher:

```typescript
const TURN_SEQUENCE = [-0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3] as const;
const ORIENTATION_SEQUENCE = [
  Orientation.IN, Orientation.OUT, Orientation.CLOCK, Orientation.COUNTER,
] as const;

function dispatchKeyboardAction(action: KeyboardAction): void {
  switch (action.type) {
    case "position":
      if (action.location) {
        if (builderState.keyboardMode) {
          timingState.recordKeydown();
        }
        builderState.handlePointClick(action.location);
      }
      break;
    case "turnUp": {
      const idx = TURN_SEQUENCE.indexOf(builderState.turnCount as any);
      const next = idx < TURN_SEQUENCE.length - 1 ? idx + 1 : 1; // wrap to 0 (index 1)
      builderState.setTurnCount(TURN_SEQUENCE[next]!);
      break;
    }
    case "turnDown": {
      const idx = TURN_SEQUENCE.indexOf(builderState.turnCount as any);
      const next = idx > 0 ? idx - 1 : TURN_SEQUENCE.length - 1;
      builderState.setTurnCount(TURN_SEQUENCE[next]!);
      break;
    }
    case "toggleRotation":
      builderState.setRotationDirection(
        builderState.rotationDirection === RotationDirection.CLOCKWISE
          ? RotationDirection.COUNTER_CLOCKWISE
          : RotationDirection.CLOCKWISE,
      );
      break;
    case "cycleOrientation": {
      const oriIdx = ORIENTATION_SEQUENCE.indexOf(builderState.currentOrientation as any);
      const nextOri = (oriIdx + 1) % ORIENTATION_SEQUENCE.length;
      builderState.setOrientation(ORIENTATION_SEQUENCE[nextOri]!);
      break;
    }
    case "switchHand":
      builderState.switchToHand(
        builderState.activeHand === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE,
      );
      break;
    case "undo":
      builderState.undoStep();
      break;
    case "finish":
      builderState.finishHand();
      break;
  }
}
```

Add the keyboard listener effect:

```typescript
$effect(() => {
  if (!builderState.keyboardMode) return;

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInputFocused =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    const action = handleAssembleKeyDown(e, {
      gridMode: builderState.gridMode,
      showCenter: builderState.showCenter,
      isModalOpen: false,
      isInputFocused,
    });

    if (action) {
      e.preventDefault();
      dispatchKeyboardAction(action);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code.startsWith("Numpad")) {
      timingState.recordKeyup();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
});
```

Add replay handler:

```typescript
function handleReplay(): void {
  // Replay is a future enhancement — log timing data for now
  console.log("Replay durations:", timingState.durations);
}

function handleReRecord(): void {
  const totalSteps = Math.max(builderState.blueSteps.length, builderState.redSteps.length);
  timingState.startReRecord(totalSteps);
}
```

- [ ] **Step 4: Update the template**

Replace the footer-section div contents in the template:

```svelte
<div class="footer-section" class:hidden={isIdle}>
  {#if builderState.keyboardMode}
    <TimingControlsPanel {timingState} />
    <KeyboardHintStrip {builderState} />
  {/if}
  <BuilderTurnBar {builderState} />
  <ReplayTransport
    {builderState}
    {timingState}
    onReplay={handleReplay}
    onReRecord={handleReRecord}
  />
  <StepStrip {builderState} />
</div>
```

- [ ] **Step 5: Run typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors

- [ ] **Step 6: Manual verification**

Open the assemble tab. Toggle keyboard mode ON. Verify:
1. Key labels appear on grid points
2. Numpad keys trigger `handlePointClick` (prop appears and moves)
3. Control keys cycle turns, rotation, orientation
4. `0` switches hands, `.` undoes, `Enter` finishes
5. KeyboardHintStrip shows current turn/rotation state
6. TimingControlsPanel toggles work
7. Keyboard mode OFF returns to normal click-only behavior

Cannot verify visually — say: "I cannot verify this visually. Please open the assemble tab, toggle keyboard mode on, and test numpad input."

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/assemble-lab/AssembleLabModule.svelte src/lib/features/assemble-lab/components/AssembleIdlePanel.svelte src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte
git commit -m "feat(assemble): wire keyboard input, timing capture, and UI controls into assemble lab"
```

---

### Task 10: Final Integration Test

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, including new keyboard handler and timing interpreter tests

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Commit any fixes if needed**
