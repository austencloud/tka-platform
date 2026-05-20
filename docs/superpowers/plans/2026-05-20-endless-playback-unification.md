# Endless Playback Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify 6 surfaces that auto-play sequences into shared plumbing (`createEndlessPlayback()` state factory) while preserving each surface's distinct UI chrome.

**Architecture:** Extend `SequenceChainingOrchestrator` as the single chaining engine (add Live mode, configurable propType, history). Wrap it in a `createEndlessPlayback()` Svelte 5 state factory that provides reactive state + derived values + auto-chaining effects. Each surface creates the factory, reads its state, renders its own UI.

**Tech Stack:** Svelte 5 runes ($state/$derived/$effect), TypeScript strict mode, Vitest for unit tests.

---

## File Structure

### New files

| File | Purpose |
|------|---------|
| `src/lib/shared/animation-engine/domain/chaining-types.ts` | **Modified** — add `IBroadcastProvider`, `PlaybackHistoryEntry`, `"live"` to `SourceMode` |
| `src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts` | State factory: `createEndlessPlayback()` |
| `tests/unit/animation-engine/sequence-chaining-orchestrator.test.ts` | Unit tests for orchestrator extensions |
| `tests/unit/animation-engine/endless-playback-state.test.ts` | Unit tests for state factory |

### Modified files

| File | What changes |
|------|-------------|
| `src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts` | Add configurable propType, history array, live mode |
| `src/lib/features/lab/effects-lab/components/EffectsLabPlaybackHost.svelte` | Replace inline orchestrator usage with factory |
| `src/lib/shared/animation-engine/components/EndlessSpinner.svelte` | Replace with factory, then delete |
| `src/routes/landing/components/LandingAnimationDemo.svelte` | Replace inline chaining with factory |
| `src/routes/landing/components/PlayWithItInner.svelte` | Replace inline chaining + history + copy with factory |
| `src/routes/endless-spinner/+page.svelte` | Replace all 3 modes + inline chaining with factory |

### Deleted files (after all migrations)

| File | Reason |
|------|--------|
| `src/lib/shared/animation-engine/components/EndlessSpinner.svelte` | Replaced by factory |
| `src/lib/shared/animation-engine/getEndlessSpinnerOrchestrator.ts` | Component factory no longer needed |
| `src/lib/features/landing/services/sequence-data-serializer.ts` | Replaced by ClaudeCodeCopier |
| `src/routes/endless-spinner/components/SequenceHistoryPanel.svelte` | Surfaces use factory state for history |

---

## Task 1: Extend chaining-types.ts

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/chaining-types.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts` (move `SourceMode` export here)

- [ ] **Step 1: Move SourceMode to chaining-types.ts and add new types**

Add `SourceMode` (with `"live"`), `IBroadcastProvider`, and `PlaybackHistoryEntry` to `chaining-types.ts`. Currently `SourceMode` is defined in `SequenceChainingOrchestrator.ts` — move it to the shared types file so the factory can import it without pulling in the full class.

```typescript
// Add to chaining-types.ts, after existing imports:

import type { BroadcastStateClient } from "$lib/shared/landing/domain/broadcast-models";

export type SourceMode = "pick" | "library" | "infinite" | "live";

export interface IBroadcastProvider {
  subscribeToBroadcast(callback: (state: BroadcastStateClient | null) => void): () => void;
  calculateServerTimeOffset(): Promise<number>;
}

export interface PlaybackHistoryEntry {
  sequence: SequenceData;
  timestamp: number;
  sourceMode: SourceMode;
  word?: string;
}
```

- [ ] **Step 2: Update SequenceChainingOrchestrator.ts import**

In `SequenceChainingOrchestrator.ts`, remove the local `export type SourceMode = "pick" | "library" | "infinite";` line and replace with:

```typescript
import type { SourceMode } from "$lib/shared/animation-engine/domain/chaining-types";
// re-export for existing consumers
export type { SourceMode };
```

- [ ] **Step 3: Fix downstream imports**

Search for all files importing `SourceMode` from `SequenceChainingOrchestrator` and verify they still compile. The re-export should make this transparent.

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to SourceMode

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/domain/chaining-types.ts src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts
git commit -m "refactor: move SourceMode to chaining-types, add IBroadcastProvider and PlaybackHistoryEntry"
```

---

## Task 2: Extend SequenceChainingOrchestrator

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts`
- Create: `tests/unit/animation-engine/sequence-chaining-orchestrator.test.ts`

- [ ] **Step 1: Write failing tests for new features**

```typescript
// tests/unit/animation-engine/sequence-chaining-orchestrator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import type { IEndlessSpinnerOrchestrator, IInfiniteSequenceGenerator, IBroadcastProvider } from "$lib/shared/animation-engine/domain/chaining-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

function mockSpinner(): IEndlessSpinnerOrchestrator {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getInitialSequence: vi.fn().mockResolvedValue(null),
    getNextSequence: vi.fn().mockResolvedValue(null),
  };
}

function mockInfinite(): IInfiniteSequenceGenerator {
  return {
    generateInitial: vi.fn().mockResolvedValue(null),
    generateFromEndState: vi.fn().mockResolvedValue(null),
    getSessionCount: vi.fn().mockReturnValue(0),
  };
}

function makeSequence(word: string): SequenceData {
  return {
    id: word,
    word,
    steps: [{ motions: { blue: { propType: PropType.STAFF }, red: { propType: PropType.STAFF } } }],
  } as unknown as SequenceData;
}

describe("SequenceChainingOrchestrator extensions", () => {
  let spinner: IEndlessSpinnerOrchestrator;
  let infinite: IInfiniteSequenceGenerator;

  beforeEach(() => {
    spinner = mockSpinner();
    infinite = mockInfinite();
  });

  describe("configurable propType", () => {
    it("defaults to STAFF", () => {
      const orch = new SequenceChainingOrchestrator(spinner, infinite);
      expect(orch.propType).toBe(PropType.STAFF);
    });

    it("setPropType changes the prop type", () => {
      const orch = new SequenceChainingOrchestrator(spinner, infinite);
      orch.setPropType(PropType.FAN);
      expect(orch.propType).toBe(PropType.FAN);
    });
  });

  describe("history tracking", () => {
    it("starts with empty history", () => {
      const orch = new SequenceChainingOrchestrator(spinner, infinite);
      expect(orch.getHistory()).toEqual([]);
    });

    it("tracks sequences via hotSwapSequence", () => {
      const orch = new SequenceChainingOrchestrator(spinner, infinite);
      // Need to initialize first to set playbackController
      // For unit testing, we test the history array directly via the internal doHotSwap
      // by calling the public hotSwapSequence
      // But hotSwapSequence requires playbackController — test history via getHistory after startAutoMode
    });

    it("caps history at configured limit", () => {
      const orch = new SequenceChainingOrchestrator(spinner, infinite, undefined, { historyCapacity: 3 });
      // Simulate 5 swaps — only last 3 should remain
      expect(orch.historyCapacity).toBe(3);
    });
  });

  describe("constructor accepts IBroadcastProvider", () => {
    it("stores broadcast provider", () => {
      const provider: IBroadcastProvider = {
        subscribeToBroadcast: vi.fn().mockReturnValue(() => {}),
        calculateServerTimeOffset: vi.fn().mockResolvedValue(0),
      };
      const orch = new SequenceChainingOrchestrator(spinner, infinite, provider);
      expect(orch).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/sequence-chaining-orchestrator.test.ts`
Expected: FAIL — `propType`, `setPropType`, `getHistory`, `historyCapacity` don't exist yet

- [ ] **Step 3: Add configurable propType**

In `SequenceChainingOrchestrator.ts`, add a `_propType` field with getter/setter and use it in `doHotSwap()`:

```typescript
// Add field after existing private fields:
private _propType: PropType = PropType.STAFF;

// Add getter:
get propType(): PropType {
  return this._propType;
}

// Add setter:
setPropType(type: PropType): void {
  this._propType = type;
}
```

In `doHotSwap()`, replace the hardcoded `PropType.STAFF`:

```typescript
// Line 171: change from:
const applied = this.propTypeApplier.applyToSequence(sequenceData, PropType.STAFF);
// to:
const applied = this.propTypeApplier.applyToSequence(sequenceData, this._propType);
```

- [ ] **Step 4: Add history tracking**

Add history fields and methods:

```typescript
// After _propType field:
private _history: PlaybackHistoryEntry[] = [];
private _historyCapacity: number;

// Modify constructor to accept options:
constructor(
  private readonly spinnerOrchestrator: IEndlessSpinnerOrchestrator,
  private readonly infiniteGenerator: IInfiniteSequenceGenerator,
  private readonly broadcastProvider?: IBroadcastProvider,
  options?: { historyCapacity?: number }
) {
  this._historyCapacity = options?.historyCapacity ?? 30;
}

get historyCapacity(): number {
  return this._historyCapacity;
}

getHistory(): readonly PlaybackHistoryEntry[] {
  return this._history;
}
```

In `doHotSwap()`, push to history before swapping:

```typescript
// At the start of doHotSwap, after the guard:
this._history = [
  {
    sequence: sequenceData,
    timestamp: Date.now(),
    sourceMode: this.inferCurrentMode(),
    word: sequenceData.word ?? sequenceData.name,
  },
  ...this._history,
].slice(0, this._historyCapacity);
```

- [ ] **Step 5: Add live mode support**

Add private fields for live mode:

```typescript
private broadcastUnsubscribe: (() => void) | null = null;
private _sourceMode: SourceMode = "library";
```

Extend `startAutoMode()`:

```typescript
async startAutoMode(mode: SourceMode): Promise<void> {
  this.preloadedSequence = null;
  this.lastStep = -1;
  this._sourceMode = mode;

  if (mode === "library") {
    const initial = await this.spinnerOrchestrator.getInitialSequence();
    if (initial) {
      this.doHotSwap(initial);
      this.preloadNext(mode);
    }
  } else if (mode === "infinite") {
    const generated = await this.infiniteGenerator.generateInitial();
    if (generated) {
      this.doHotSwap(generated.sequence);
      this.preloadNext(mode);
    }
  } else if (mode === "live") {
    if (!this.broadcastProvider) {
      this.errorCallback?.("Live mode requires a broadcast provider");
      return;
    }
    this.broadcastUnsubscribe = this.broadcastProvider.subscribeToBroadcast((state) => {
      if (state?.currentSequence) {
        this.doHotSwap(state.currentSequence as unknown as SequenceData);
      }
    });
  }
}
```

Add `_sourceMode` to `inferCurrentMode()` as primary source:

```typescript
private inferCurrentMode(): SourceMode {
  if (this._sourceMode !== "library") return this._sourceMode;
  if (this.infiniteGenerator.getSessionCount() > 0) return "infinite";
  return "library";
}
```

Make `checkAndChain` no-op in live mode:

```typescript
// At the top of checkAndChain:
if (sourceMode === "pick" || sourceMode === "live") return;
```

And in `checkAndPreload`:

```typescript
if (sourceMode === "pick" || sourceMode === "live") return;
```

Clean up broadcast subscription in `dispose()`:

```typescript
dispose(): void {
  this.broadcastUnsubscribe?.();
  this.broadcastUnsubscribe = null;
  this.playbackController = null;
  this.animationState = null;
  this.preloadedSequence = null;
  this.swapCallback = null;
  this.errorCallback = null;
  this._history = [];
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/unit/animation-engine/sequence-chaining-orchestrator.test.ts`
Expected: PASS

- [ ] **Step 7: Run full typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts tests/unit/animation-engine/sequence-chaining-orchestrator.test.ts
git commit -m "feat: extend SequenceChainingOrchestrator with configurable propType, history, and live mode"
```

---

## Task 3: Create `createEndlessPlayback()` state factory

**Files:**
- Create: `src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts`
- Create: `tests/unit/animation-engine/endless-playback-state.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/animation-engine/endless-playback-state.test.ts
import { describe, it, expect, vi } from "vitest";

describe("createEndlessPlayback", () => {
  it("module exports createEndlessPlayback function", async () => {
    const mod = await import("$lib/shared/animation-engine/state/endless-playback-state.svelte");
    expect(typeof mod.createEndlessPlayback).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/endless-playback-state.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Write the factory**

Create `src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts`:

```typescript
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  SourceMode,
  IBroadcastProvider,
  PlaybackHistoryEntry,
  IEndlessSpinnerOrchestrator,
  IInfiniteSequenceGenerator,
} from "$lib/shared/animation-engine/domain/chaining-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { CopyResult } from "$lib/shared/browse/services/ClaudeCodeCopier";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import { getClaudeCodeCopier } from "$lib/shared/browse/getClaudeCodeCopier";
import { PropType as PropTypeEnum } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";

export interface EndlessPlaybackConfig {
  modes: SourceMode[];
  defaultMode: SourceMode;
  historyCapacity?: number;
  propType?: PropType;
  broadcastProvider?: IBroadcastProvider;
  spinnerOrchestrator: IEndlessSpinnerOrchestrator;
  infiniteGenerator: IInfiniteSequenceGenerator;
  playbackController: AnimationPlaybackController;
}

export interface EndlessPlaybackState {
  readonly currentSequence: SequenceData | null;
  readonly sourceMode: SourceMode;
  readonly history: readonly PlaybackHistoryEntry[];
  readonly isChainingNow: boolean;
  readonly isPreloading: boolean;
  readonly derivedStartPosition: unknown | null;
  readonly currentLetter: string | null;
  readonly currentStepData: unknown | null;
  readonly gridMode: GridMode | string | null;
  readonly totalSteps: number;
  readonly animationState: AnimationPanelState;
  readonly playbackController: AnimationPlaybackController;
  readonly servicesReady: boolean;

  initialize(): Promise<void>;
  setSourceMode(mode: SourceMode): Promise<void>;
  setPropType(type: PropType): void;
  skip(): void;
  shuffle(): Promise<void>;
  copyForAI(): Promise<CopyResult>;
  copyHistoryEntry(index: number): Promise<CopyResult>;
  hotSwapSequence(sequence: SequenceData): void;
  dispose(): void;
}

export function createEndlessPlayback(config: EndlessPlaybackConfig): EndlessPlaybackState {
  const animationState = createAnimationPanelState();
  const playbackController = config.playbackController;

  const orchestrator = new SequenceChainingOrchestrator(
    config.spinnerOrchestrator,
    config.infiniteGenerator,
    config.broadcastProvider,
    { historyCapacity: config.historyCapacity ?? 30 }
  );

  if (config.propType) {
    orchestrator.setPropType(config.propType);
  }

  let _currentSequence = $state<SequenceData | null>(null);
  let _sourceMode = $state<SourceMode>(config.defaultMode);
  let _servicesReady = $state(false);

  orchestrator.onSequenceSwapped((seq) => {
    _currentSequence = seq;
  });

  // Derived values — eliminates the ~30-line block duplicated across 6 surfaces
  const derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    return startPositionDeriver.getOrDeriveStartPosition(animationState.sequenceData);
  });

  const currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return derivedStartPosition?.letter || null;
    const steps = animationState.sequenceData.steps;
    if (steps?.length) {
      const idx = Math.max(0, Math.min(Math.floor(step) - 1, steps.length - 1));
      return steps[idx]?.letter || null;
    }
    return null;
  });

  const currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return derivedStartPosition || null;
    const steps = animationState.sequenceData.steps;
    if (steps?.length) {
      const idx = Math.max(0, Math.min(Math.floor(step) - 1, steps.length - 1));
      return steps[idx] || null;
    }
    return null;
  });

  const gridMode = $derived(
    _currentSequence?.gridMode ?? animationState.sequenceData?.gridMode ?? null
  );

  // Auto-chaining effect — replaces the most-duplicated pattern
  $effect(() => {
    if (_sourceMode === "pick" || _sourceMode === "live") return;
    orchestrator.checkAndChain(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      _sourceMode,
      _servicesReady,
      !!_currentSequence
    );
  });

  // Preload effect
  $effect(() => {
    if (_sourceMode === "pick" || _sourceMode === "live") return;
    orchestrator.checkAndPreload(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      _sourceMode,
      _servicesReady,
      !!_currentSequence
    );
  });

  return {
    get currentSequence() { return _currentSequence; },
    get sourceMode() { return _sourceMode; },
    get history() { return orchestrator.getHistory(); },
    get isChainingNow() { return orchestrator.isChainingNow; },
    get isPreloading() { return orchestrator.isPreloading; },
    get derivedStartPosition() { return derivedStartPosition; },
    get currentLetter() { return currentLetter; },
    get currentStepData() { return currentStepData; },
    get gridMode() { return gridMode; },
    get totalSteps() { return animationState.totalSteps; },
    get animationState() { return animationState; },
    get playbackController() { return playbackController; },
    get servicesReady() { return _servicesReady; },

    async initialize() {
      await orchestrator.initialize(playbackController, animationState);
      _servicesReady = true;
      if (_sourceMode !== "pick") {
        await orchestrator.startAutoMode(_sourceMode);
      }
    },

    async setSourceMode(mode: SourceMode) {
      _sourceMode = mode;
      if (mode !== "pick") {
        await orchestrator.startAutoMode(mode);
      }
    },

    setPropType(type: PropType) {
      orchestrator.setPropType(type);
    },

    skip() {
      orchestrator.skip();
    },

    async shuffle() {
      await orchestrator.shuffle();
    },

    async copyForAI(): Promise<CopyResult> {
      const seq = animationState.sequenceData;
      if (!seq) return { success: false, error: new Error("No sequence loaded") };
      return getClaudeCodeCopier().copyForClaude(seq);
    },

    async copyHistoryEntry(index: number): Promise<CopyResult> {
      const entry = orchestrator.getHistory()[index];
      if (!entry) return { success: false, error: new Error("History entry not found") };
      return getClaudeCodeCopier().copyForClaude(entry.sequence);
    },

    hotSwapSequence(sequence: SequenceData) {
      orchestrator.hotSwapSequence(sequence);
    },

    dispose() {
      orchestrator.dispose();
      playbackController.dispose();
      animationState.dispose();
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/animation-engine/endless-playback-state.test.ts`
Expected: PASS

- [ ] **Step 5: Run full typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts tests/unit/animation-engine/endless-playback-state.test.ts
git commit -m "feat: create createEndlessPlayback() state factory for unified endless playback"
```

---

## Task 4: Migrate EffectsLabPlaybackHost (lightest — already uses orchestrator)

**Files:**
- Modify: `src/lib/features/lab/effects-lab/components/EffectsLabPlaybackHost.svelte`

This surface already uses `SequenceChainingOrchestrator` directly. Migration replaces:
- Direct orchestrator instantiation → factory
- Inline derived values (currentLetter, currentStepData, gridMode) → factory deriveds
- Inline history management → factory history
- Inline auto-chaining `$effect()` blocks → factory handles internally

**What EffectsLabPlaybackHost keeps (unique UI):**
- SourceControls, SequencePickerModal, EffectsPanel
- localStorage persistence
- Keyboard shortcuts
- Save-to-library, copy via ClaudeCodeCopier
- BPM handling
- Effect descriptor theming

- [ ] **Step 1: Replace imports**

Remove these imports from `EffectsLabPlaybackHost.svelte`:

```typescript
// REMOVE:
import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
import { InfiniteSequenceGenerator } from "$lib/features/landing/services/InfiniteSequenceGenerator";
import { SpinnerMetricsRepository } from "$lib/features/landing/services/SpinnerMetricsRepository";
import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import type { SourceMode } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

// ADD:
import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
import type { SourceMode } from "$lib/shared/animation-engine/domain/chaining-types";
```

- [ ] **Step 2: Replace state initialization**

Replace the scattered state variables and onMount orchestrator creation with:

```typescript
// Remove these lines:
// let chainingOrchestrator = $state<SequenceChainingOrchestrator | null>(null);
// const animationState = createAnimationPanelState();

// Replace with factory creation (deferred — playbackController created in onMount):
let playback = $state<EndlessPlaybackState | null>(null);

// Then reference animationState through factory:
// animationState → playback.animationState (after init)
```

In `onMount`, after creating `playbackController`, replace the orchestrator setup block (lines ~233-263) with:

```typescript
const spinnerOrch = new EndlessSpinnerOrchestrator(
  browseLoader, generationOrchestrator, sequenceTransformer,
  startPositionDeriver, orientationCalculator, gridPositionDeriver
);
const metricsRepo = new SpinnerMetricsRepository();
const infiniteGen = new InfiniteSequenceGenerator(
  generationOrchestrator, metricsRepo, orientationCycleExtender
);

playback = createEndlessPlayback({
  modes: ["pick", "library", "infinite"],
  defaultMode: sourceMode,
  spinnerOrchestrator: spinnerOrch,
  infiniteGenerator: infiniteGen,
  playbackController,
});
await playback.initialize();
servicesReady = true;

// Keep the onSequenceSwapped side-effect for local sequence tracking:
// The factory updates its own currentSequence — sync to local `sequence` var:
$effect(() => {
  if (playback) sequence = playback.currentSequence;
});
```

- [ ] **Step 3: Delete inline derived values**

Remove the `currentLetter`, `currentStepData`, and `gridMode` `$derived` blocks (~lines 148-181). Replace reads with:
- `playback?.currentLetter`
- `playback?.currentStepData`
- `playback?.gridMode`

- [ ] **Step 4: Delete inline auto-chaining effects**

Remove the two `$effect()` blocks for `checkAndChain` and `checkAndPreload` (~lines 192-212). The factory handles these internally.

- [ ] **Step 5: Update template references**

In the template, replace `animationState` with `playback?.animationState` and `chainingOrchestrator` with `playback`. For example:
- `animationState.bluePropState` → `playback?.animationState.bluePropState`
- `chainingOrchestrator?.isChainingNow` → `playback?.isChainingNow`

- [ ] **Step 6: Update action handlers**

Replace `chainingOrchestrator?.skip()` with `playback?.skip()`, etc.

Replace copy function:
```typescript
async function getDebugData(): Promise<string> {
  if (!playback) return "No sequence loaded";
  const result = await playback.copyForAI();
  return result.success ? "Copied!" : "Copy failed";
}
```

- [ ] **Step 7: Run typecheck and build**

Run: `npm run check`
Expected: PASS — no type errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/lab/effects-lab/components/EffectsLabPlaybackHost.svelte
git commit -m "refactor: migrate EffectsLabPlaybackHost to createEndlessPlayback factory"
```

---

## Task 5: Migrate EndlessSpinner.svelte → factory, then delete

**Files:**
- Modify then delete: `src/lib/shared/animation-engine/components/EndlessSpinner.svelte`
- Delete: `src/lib/shared/animation-engine/getEndlessSpinnerOrchestrator.ts`

The EndlessSpinner component (~368 lines) has inline `applyPropTypeToSequence`, inline `extractEndState`, inline chaining detection, and all the derived values. After migration it becomes a thin wrapper around the factory — thin enough to inline into its single consumer, at which point the file is deleted.

- [ ] **Step 1: Find all consumers of EndlessSpinner.svelte**

Run: `grep -r "EndlessSpinner" src/ --include="*.svelte" --include="*.ts" -l`

This identifies where EndlessSpinner is imported so we know what needs updating when we delete it.

- [ ] **Step 2: Replace component internals with factory**

Replace the entire `<script>` block. Remove:
- Inline `applyPropTypeToSequence()` function
- Inline `extractEndState()` function
- All the derived value blocks (`derivedStartPosition`, `currentLetter`, `currentStepData`, `gridMode`)
- The `$effect` for chaining detection
- The `chainNextSequence`, `playSequence` functions
- Direct `spinnerOrchestrator` usage

Replace with factory usage. The component props (`propType`, `darkMode`, `onSequenceChange`) map to factory config. The template stays the same but reads from factory state.

```typescript
import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
import { createEndlessSpinnerOrchestrator } from "$lib/shared/animation-engine/getEndlessSpinnerOrchestrator";
import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";

interface Props {
  propType?: PropType;
  darkMode?: boolean;
  onSequenceChange?: (sequence: SequenceData) => void;
}

let { propType = PropType.STAFF, darkMode = true, onSequenceChange }: Props = $props();

let playback: EndlessPlaybackState | null = null;
let isReady = $state(false);
let hasError = $state(false);

const visibilityManager = getAnimationVisibilityManager();

onMount(async () => {
  try {
    animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
    const pc = getAnimationPlaybackController();
    const spinner = createEndlessSpinnerOrchestrator();
    // No infinite generator for this component (library-only)
    const noopInfinite = {
      generateInitial: async () => null,
      generateFromEndState: async () => null,
      getSessionCount: () => 0,
    };

    playback = createEndlessPlayback({
      modes: ["library"],
      defaultMode: "library",
      propType,
      spinnerOrchestrator: spinner,
      infiniteGenerator: noopInfinite,
      playbackController: pc,
    });

    await playback.initialize();
    isReady = true;
  } catch (err) {
    console.error("[EndlessSpinner] Failed to initialize:", err);
    hasError = true;
  }
});

// Watch for sequence changes to notify parent
$effect(() => {
  if (playback?.currentSequence && onSequenceChange) {
    onSequenceChange(playback.currentSequence);
  }
});

$effect(() => { visibilityManager.setDarkMode(darkMode); });

onDestroy(() => { playback?.dispose(); });

// Expose changePropType for parent
export function changePropType(newPropType: PropType) {
  playback?.setPropType(newPropType);
}
```

Template reads from `playback`:
- `gridMode` → `playback?.gridMode`
- `currentLetter` → `playback?.currentLetter`
- `currentStepData` → `playback?.currentStepData`
- `animationState.bluePropState` → `playback?.animationState.bluePropState`

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Check if EndlessSpinner.svelte has any remaining consumers**

If the grep from Step 1 shows the only consumer can inline the factory call directly, delete `EndlessSpinner.svelte` and update the consumer. If it still has multiple consumers, keep it as the thin wrapper for now.

- [ ] **Step 5: Delete getEndlessSpinnerOrchestrator.ts component factory**

This file provides `createEndlessSpinnerOrchestrator()` which was the factory for the now-deleted EndlessSpinner component. The factory registration pattern (`registerEndlessSpinnerOrchestratorFactory`) is still needed by `SequenceChainingOrchestrator` and the new `createEndlessPlayback` — but those import `IEndlessSpinnerOrchestrator` from `chaining-types.ts`, not this file.

Check if any file still imports from `getEndlessSpinnerOrchestrator.ts`:
```bash
grep -r "getEndlessSpinnerOrchestrator" src/ --include="*.ts" --include="*.svelte" -l
```

If only the deleted EndlessSpinner.svelte imported it, delete the file. If other files import the factory registration, keep the file but remove the component-related exports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: migrate EndlessSpinner.svelte to factory, delete component + component factory"
```

---

## Task 6: Migrate LandingAnimationDemo

**Files:**
- Modify: `src/routes/landing/components/LandingAnimationDemo.svelte`

LandingAnimationDemo (~723 lines) is library-only. Has inline `applyPropTypeToSequence`, `extractEndState`, preload/chain effects, derived values. Unique UI: randomize button, prop switcher, dark mode toggle, fire/LED/trails toggles, ChoreoCard side panel, crossfade transition, IntersectionObserver lazy loading.

- [ ] **Step 1: Replace imports**

Remove `EndlessSpinnerOrchestrator` and related direct-usage imports. Add factory import.

- [ ] **Step 2: Replace onMount initialization**

Replace the `loadAnimationEngine()` function internals. Keep the IntersectionObserver + lazy loading logic (unique to this surface). Inside `loadAnimationEngine()`, after getting `playbackController`:

```typescript
const sequenceTransformer = getSequenceTransformer();
const spinnerOrch = new EndlessSpinnerOrchestrator(
  browseLoader, generationOrchestrator as any, sequenceTransformer as any,
  startPositionDeriverInstance, orientationCalculatorInstance as any, gridPositionDeriverInstance as any
);
const noopInfinite = {
  generateInitial: async () => null,
  generateFromEndState: async () => null,
  getSessionCount: () => 0,
};

playback = createEndlessPlayback({
  modes: ["library"],
  defaultMode: "library",
  propType: currentPropType,
  spinnerOrchestrator: spinnerOrch,
  infiniteGenerator: noopInfinite,
  playbackController,
});
await playback.initialize();
servicesReady = true;
animationReady = true;
```

- [ ] **Step 3: Delete inline functions**

Delete:
- `applyPropTypeToSequence()` (~25 lines)
- `extractEndState()` (~25 lines)
- `preloadNextSequence()` (~15 lines)
- `chainToNextSequence()` (~25 lines)
- `hotSwapSequence()` (~15 lines)
- `loadSequence()` (~25 lines)

Replace `chainToNextSequence` calls with factory's internal auto-chaining (already handled by factory effects).

For prop switching (`handleChangeProp`), update to use factory:
```typescript
function handleChangeProp() {
  // ... existing prop selection logic ...
  currentPropType = newProp;
  playback?.setPropType(newProp);
  if (playback?.animationState.sequenceData) {
    const applied = applyToSequence(playback.animationState.sequenceData, newProp);
    playback.animationState.setSequenceData(applied);
  }
}
```

Import `applyToSequence` from `prop-type-applier.ts` instead of inline copy.

- [ ] **Step 4: Delete inline derived values**

Remove `derivedStartPosition`, `currentLetter`, `currentStepData`, `gridMode` $derived blocks. Replace template reads with `playback?.currentLetter`, `playback?.gridMode`, etc.

- [ ] **Step 5: Delete inline preload + chain $effects**

The two `$effect()` blocks for preloading and chaining (~lines 169-211) are deleted — factory handles them.

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Manual verification**

Open `localhost:5173` (user's dev server) and navigate to the landing page. Verify:
- Animation starts playing automatically
- Sequences chain seamlessly (no gap between sequences)
- Prop switcher works (changes prop type mid-playback)
- Dark mode / fire / LED / trails toggles work
- ChoreoCard side panel shows correct data
- Crossfade transition on randomize works

If cannot verify visually, say: *"I cannot verify this visually. Please navigate to the landing page and confirm: sequences auto-chain, prop switching works, effect toggles work."*

- [ ] **Step 8: Commit**

```bash
git add src/routes/landing/components/LandingAnimationDemo.svelte
git commit -m "refactor: migrate LandingAnimationDemo to createEndlessPlayback factory"
```

---

## Task 7: Migrate PlayWithItInner

**Files:**
- Modify: `src/routes/landing/components/PlayWithItInner.svelte`
- Delete: `src/lib/features/landing/services/sequence-data-serializer.ts` (after this task)

PlayWithItInner (~640 lines) is library-only with history, copy, effect switcher, prop randomizer, effort cycler, TempoControl, virtualized beat strip. Has inline `applyPropTypeToSequence`, `extractEndState`, `toCompactDebug` copy, `HistoryEntry` type, preload/chain effects.

- [ ] **Step 1: Replace imports**

Remove:
```typescript
import { toCompactDebug } from "$lib/features/landing/services/sequence-data-serializer";
import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
```

Add:
```typescript
import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
import type { SourceMode } from "$lib/shared/animation-engine/domain/chaining-types";
import * as propTypeApplier from "$lib/shared/landing/services/prop-type-applier";
```

- [ ] **Step 2: Replace initialization**

In `onMount`, replace the EndlessSpinnerOrchestrator construction with factory:

```typescript
const spinnerOrch = new EndlessSpinnerOrchestrator(
  browseLoader, generationOrchestrator, sequenceTransformer as any,
  startPositionDeriverInstance, orientationCalculatorInstance as any, gridPositionDeriverInstance as any
);
const noopInfinite = {
  generateInitial: async () => null,
  generateFromEndState: async () => null,
  getSessionCount: () => 0,
};

playback = createEndlessPlayback({
  modes: ["library"],
  defaultMode: "library",
  propType: currentPropType,
  spinnerOrchestrator: spinnerOrch,
  infiniteGenerator: noopInfinite,
  playbackController: pc,
});
await playback.initialize();
```

- [ ] **Step 3: Delete inline functions**

Delete:
- `applyPropTypeToSequence()` function
- `extractEndState()` function
- `preloadNextSequence()` function
- `chainToNextSequence()` function
- `hotSwapSequence()` function
- `loadSequence()` function
- `pushToHistory()` function (factory handles history)
- `copySequenceData()` function (use `playback.copyForAI()`)
- `HistoryEntry` interface (use `PlaybackHistoryEntry` from chaining-types)

- [ ] **Step 4: Delete inline derived values + effects**

Delete `derivedStartPosition`, `currentLetter`, `currentStepData`, `gridMode` blocks. Delete the preload and chain `$effect()` blocks.

- [ ] **Step 5: Update copy to use factory**

Replace `copySequenceData` with:
```typescript
async function copySequenceData() {
  if (!playback) return;
  const result = await playback.copyForAI();
  showCopyFeedback(result.success ? "Copied!" : "Copy failed");
}
```

For history copy:
```typescript
async function copyHistoryEntry(index: number) {
  if (!playback) return;
  const result = await playback.copyHistoryEntry(index);
  showCopyFeedback(result.success ? "Copied!" : "Copy failed");
}
```

- [ ] **Step 6: Update history display**

Replace local `sequenceHistory` array with reads from `playback.history`. The template iterates `playback?.history ?? []` instead of the local array.

- [ ] **Step 7: Update prop switching**

```typescript
function handleChangeProp() {
  // ... existing prop selection ...
  currentPropType = newProp;
  playback?.setPropType(newProp);
  if (playback?.animationState.sequenceData) {
    const updated = propTypeApplier.applyToSequence(playback.animationState.sequenceData, newProp);
    playback.animationState.setSequenceData(updated);
  }
}
```

- [ ] **Step 8: Delete sequence-data-serializer.ts**

After this migration, `toCompactDebug` is no longer imported anywhere. Verify:
```bash
grep -r "sequence-data-serializer" src/ --include="*.ts" --include="*.svelte" -l
```

If only the `/endless-spinner` page still imports it, leave deletion for Task 8. Otherwise delete now.

- [ ] **Step 9: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/routes/landing/components/PlayWithItInner.svelte
git commit -m "refactor: migrate PlayWithItInner to createEndlessPlayback factory, replace toCompactDebug with ClaudeCodeCopier"
```

---

## Task 8: Migrate /endless-spinner (heaviest — 3 modes + Live)

**Files:**
- Modify: `src/routes/endless-spinner/+page.svelte`
- Delete (after): `src/routes/endless-spinner/components/SequenceHistoryPanel.svelte`
- Delete (after): `src/lib/features/landing/services/sequence-data-serializer.ts`

The /endless-spinner page (~970 lines) exercises every feature: Library, Infinite, Live modes, broadcast sync, debug panel, stats bar, step grid, history panel. This is the most complex migration.

- [ ] **Step 1: Replace imports**

Remove:
```typescript
import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
import { InfiniteSequenceGenerator } from "$lib/features/landing/services/InfiniteSequenceGenerator";
import { SpinnerMetricsRepository } from "$lib/features/landing/services/SpinnerMetricsRepository";
import { BroadcastRepository } from "$lib/features/landing/services/BroadcastRepository";
import * as broadcastSequenceConverter from "$lib/features/landing/services/broadcast-sequence-converter";
import * as sequenceDataSerializer from "$lib/features/landing/services/sequence-data-serializer";
import type { SequenceHistoryEntry } from "./components/SequenceHistoryPanel.svelte";
```

Add:
```typescript
import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
import type { SourceMode, PlaybackHistoryEntry } from "$lib/shared/animation-engine/domain/chaining-types";
```

- [ ] **Step 2: Replace state variables**

Remove all inline chaining state:
- `preloadedSequence`, `isPreloading`, `isChainingNow`, `lastStep`
- `sequenceHistory` (use factory history)
- `broadcastRepository`, `broadcastState`, `broadcastUnsubscribe`, `stepSyncInterval`
- `infiniteGenerator`, `metricsRepository`

Keep:
- `spinnerMode` (maps to `playback.sourceMode`)
- `showDebugPanel`, `showStepGrid`, `showHistory` (UI toggles)
- `stats`, `globalMetrics`, `currentGeneratedInfo` (surface-specific display state)

- [ ] **Step 3: Replace onMount initialization**

```typescript
const spinnerOrch = new EndlessSpinnerOrchestrator(
  browseLoader, generationOrchestrator, sequenceTransformer,
  startPositionDeriver, orientationCalculator, gridPositionDeriver
);
const metricsRepo = new SpinnerMetricsRepository();
const infiniteGen = new InfiniteSequenceGenerator(
  generationOrchestrator, metricsRepo, orientationCycleExtender
);
const broadcastRepo = new BroadcastRepository();

playback = createEndlessPlayback({
  modes: ["library", "infinite", "live"],
  defaultMode: "library",
  spinnerOrchestrator: spinnerOrch,
  infiniteGenerator: infiniteGen,
  broadcastProvider: broadcastRepo,
  playbackController,
});
await playback.initialize();
```

- [ ] **Step 4: Replace mode switching**

Replace `handleModeChange()` (~60 lines managing subscriptions, cleanup, metrics) with:

```typescript
async function handleModeChange(newMode: SpinnerMode) {
  await playback?.setSourceMode(newMode as SourceMode);
  spinnerMode = newMode;
}
```

The factory handles broadcast subscription lifecycle internally.

- [ ] **Step 5: Delete inline functions**

Delete: `extractEndState`, `preloadNextSequence`, `chainToNextSequence`, `hotSwapSequence`, `loadSequence` — all replaced by factory internals.

- [ ] **Step 6: Delete inline derived values + effects**

Delete `derivedStartPosition`, `currentLetter`, `currentStepData`, `gridMode` blocks and both chaining/preloading `$effect()` blocks.

- [ ] **Step 7: Update template**

Replace all `animationState.*` with `playback?.animationState.*`. Replace `currentSequence` with `playback?.currentSequence`. History panel reads `playback?.history`.

- [ ] **Step 8: Delete SequenceHistoryPanel.svelte**

This component is only used by /endless-spinner. With history now coming from the factory, the surface can render history inline or use a simpler shared component. Check if the Effects Lab's SequenceHistoryPanel is different:

```bash
grep -r "SequenceHistoryPanel" src/ --include="*.svelte" -l
```

Delete `src/routes/endless-spinner/components/SequenceHistoryPanel.svelte` if it's the only import site or if Effects Lab uses a different one.

- [ ] **Step 9: Delete sequence-data-serializer.ts**

Final consumer removed. Delete `src/lib/features/landing/services/sequence-data-serializer.ts`.

Verify no remaining imports:
```bash
grep -r "sequence-data-serializer" src/ --include="*.ts" --include="*.svelte" -l
```

- [ ] **Step 10: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: migrate /endless-spinner to createEndlessPlayback factory, delete SequenceHistoryPanel + sequence-data-serializer"
```

---

## Task 9: Final cleanup and verification

**Files:**
- Verify all deleted files are gone
- Run full build

- [ ] **Step 1: Verify deleted files**

Confirm these files no longer exist:
- `src/lib/shared/animation-engine/components/EndlessSpinner.svelte`
- `src/lib/shared/animation-engine/getEndlessSpinnerOrchestrator.ts`
- `src/lib/features/landing/services/sequence-data-serializer.ts`
- `src/routes/endless-spinner/components/SequenceHistoryPanel.svelte`

```bash
ls src/lib/shared/animation-engine/components/EndlessSpinner.svelte 2>&1
ls src/lib/shared/animation-engine/getEndlessSpinnerOrchestrator.ts 2>&1
ls src/lib/features/landing/services/sequence-data-serializer.ts 2>&1
ls src/routes/endless-spinner/components/SequenceHistoryPanel.svelte 2>&1
```

Expected: All 4 should report "No such file"

- [ ] **Step 2: Grep for stale imports**

```bash
grep -r "EndlessSpinner" src/ --include="*.svelte" --include="*.ts" | grep -v "EndlessSpinnerOrchestrator" | grep -v "getEndlessSpinner"
grep -r "sequence-data-serializer" src/ --include="*.svelte" --include="*.ts"
grep -r "getEndlessSpinnerOrchestrator" src/ --include="*.svelte" --include="*.ts"
```

Expected: No matches (except possibly in test files or type-only references to `IEndlessSpinnerOrchestrator`)

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run all tests**

Run: `npm run test`
Expected: All tests pass, including the new orchestrator and factory tests

- [ ] **Step 5: Line count verification**

Count lines in the modified files to verify the reduction:

```bash
wc -l src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts
wc -l src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts
wc -l src/lib/shared/animation-engine/domain/chaining-types.ts
```

Shared plumbing should be ~300 lines total. Surface files should total ~2,200 lines (down from ~3,600).

- [ ] **Step 6: Commit final cleanup**

```bash
git add -A
git commit -m "chore: final cleanup after endless playback unification — verify deletions and stale imports"
```
