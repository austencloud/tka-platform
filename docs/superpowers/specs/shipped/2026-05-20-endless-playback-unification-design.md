# Endless Playback Unification

**Date:** 2026-05-20
**Status:** Draft
**Scope:** Unify 6 surfaces that auto-play sequences into shared plumbing while preserving each surface's distinct UI.

## Problem

Six surfaces auto-play sequences with ~800 lines of duplicated logic:

| Surface | Location | Lines | Modes |
|---------|----------|-------|-------|
| PlayWithItInner | `routes/landing/components/PlayWithItInner.svelte` | ~640 | Library |
| /endless-spinner | `routes/endless-spinner/+page.svelte` | ~970 | Library + Infinite + Live |
| EffectsLabPlaybackHost | `features/lab/effects-lab/components/EffectsLabPlaybackHost.svelte` | ~683 | Pick + Library + Infinite |
| LandingAnimationDemo | `routes/landing/components/LandingAnimationDemo.svelte` | ~723 | Library |
| EndlessSpinner.svelte | `shared/animation-engine/components/EndlessSpinner.svelte` | ~368 | Library |
| HowTkaAnimationCard | `routes/landing/components/HowTkaAnimationCard.svelte` | ~223 | Single (loops one sequence) |

### What's duplicated

- `extractEndState()` — 5 copies (4 inline + 1 in `SequenceChainingOrchestrator`)
- `applyPropTypeToSequence()` — 4 copies (3 inline + 1 in `prop-type-applier.ts`)
- Auto-advance `$effect()` (watch currentStep, detect loop-back, chain) — 4 copies
- Preload `$effect()` (start preloading at beat 2) — 3 copies
- `hotSwapSequence()` / `loadSequence()` — 4 copies
- Derived values block (~30 lines: `derivedStartPosition`, `currentLetter`, `currentStepData`, `gridMode`) — 6 copies
- `HistoryEntry` type — 3 different definitions
- `SequenceHistoryPanel` — 2 separate components
- Copy serialization — 3 different strategies

### What's already shared correctly

- `AnimatorCanvas` — universal renderer
- `AnimationPlaybackController` — shared service
- `AnimationPanelState` — shared state class
- `EndlessSpinnerOrchestrator` — library-mode chaining (used by all library surfaces)
- `InfiniteSequenceGenerator` — infinite-mode generation (used by 2 surfaces)
- `SequenceChainingOrchestrator` — orchestrates chaining (used by Effects Lab ONLY)

## Approach

Extend `SequenceChainingOrchestrator` as the single chaining engine. Wrap it in a `createEndlessPlayback()` state factory. Each surface calls the factory, gets reactive state, renders its own UI chrome. Delete `EndlessSpinner.svelte`.

## Design

### 1. Extended SourceMode

```typescript
// chaining-types.ts
type SourceMode = "pick" | "library" | "infinite" | "live";
```

### 2. IBroadcastProvider Interface

New interface in `chaining-types.ts` for the Live mode dependency:

```typescript
interface IBroadcastProvider {
  subscribe(onState: (state: BroadcastStateClient | null) => void): () => void;
  getServerTimeOffset(): number;
}
```

`BroadcastRepository` already implements this shape. The interface decouples the orchestrator from Firebase imports.

### 3. SequenceChainingOrchestrator Extensions

Changes to the existing class:

**Constructor:** Accept optional `IBroadcastProvider`:

```typescript
constructor(
  private readonly spinnerOrchestrator: IEndlessSpinnerOrchestrator,
  private readonly infiniteGenerator: IInfiniteSequenceGenerator,
  private readonly broadcastProvider?: IBroadcastProvider
)
```

**Configurable prop type:** Replace hardcoded `PropType.STAFF` in `doHotSwap()` with a `propType` property settable via `setPropType(type)`. Defaults to `PropType.STAFF`.

**Live mode in `startAutoMode()`:** When mode is `"live"`, subscribe to `broadcastProvider`. On each broadcast state update, call `doHotSwap()` with the broadcast sequence. `checkAndChain()` becomes a no-op in live mode (broadcast pushes, not step detection).

**History tracking:** Add internal `history: SequenceData[]` array (cap 30, LIFO). `doHotSwap()` pushes to history before swapping. Expose `getHistory(): readonly SequenceData[]`.

**`onSequenceSwapped` already exists** — surfaces use this callback for UI updates (updating word label, beat strip, etc). No change needed.

**Dispose:** Clean up broadcast subscription if active.

### 4. State Factory: `createEndlessPlayback()`

New file: `src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts`

```typescript
interface EndlessPlaybackConfig {
  modes: SourceMode[];           // which modes this surface supports
  defaultMode: SourceMode;
  historyCapacity?: number;      // default 30
  propType?: PropType;           // default STAFF
  broadcastProvider?: IBroadcastProvider;
  ephemeralVisibility?: boolean; // true = per-instance visibility manager
}

interface EndlessPlaybackState {
  // Reactive state ($state / $derived)
  readonly currentSequence: SequenceData | null;
  readonly sourceMode: SourceMode;
  readonly history: SequenceData[];
  readonly isChainingNow: boolean;
  readonly isPreloading: boolean;
  readonly derivedStartPosition: StartPositionData | null;
  readonly currentLetter: string | null;
  readonly currentStepData: StepData | null;
  readonly gridMode: GridMode;
  readonly totalSteps: number;

  // Animation state (pass-through)
  readonly animationState: AnimationPanelState;
  readonly playbackController: AnimationPlaybackController;

  // Actions
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

function createEndlessPlayback(config: EndlessPlaybackConfig): EndlessPlaybackState
```

**What the factory does:**

1. Creates `AnimationPanelState` and `AnimationPlaybackController` instances
2. Creates `EndlessSpinnerOrchestrator` and `InfiniteSequenceGenerator` internally (via existing factory registrations)
3. Creates `SequenceChainingOrchestrator` with above dependencies + optional broadcast provider
4. Wraps orchestrator state in `$state()` reactivity (via `onSequenceSwapped` callback updating `$state` variables)
5. Computes derived values (`derivedStartPosition`, `currentLetter`, `currentStepData`, `gridMode`) as `$derived` — eliminating the ~30-line block duplicated across 6 surfaces
6. Sets up the two `$effect()` blocks for `checkAndChain` and `checkAndPreload` — eliminating the most duplicated pattern
7. Manages `AnimationVisibilityStateManager` (ephemeral per-instance or global, per config)
8. Exposes `ClaudeCodeCopier`-based copy (via existing `getClaudeCodeCopier()` singleton) for both current sequence and history entries

### 5. Copy Strategy

`ClaudeCodeCopier` becomes the standard. Every surface gets `copyForAI()` and `copyHistoryEntry(index)` from the factory. These handle clipboard write + return success/failure.

Delete:
- Inline `toCompactDebug()` calls in PlayWithItInner
- `sequence-data-serializer.ts` (only used by /endless-spinner)

The copier already lives in `shared/browse/services/ClaudeCodeCopier.ts` — no move needed.

### 6. Unified HistoryEntry Type

```typescript
// In chaining-types.ts
interface PlaybackHistoryEntry {
  sequence: SequenceData;
  timestamp: number;
  sourceMode: SourceMode;
  loopType?: string;     // for infinite mode
  word?: string;         // sequence word
}
```

Replaces the 3 different `HistoryEntry` interfaces. The factory tracks these internally.

### 7. Delete List

Files to delete after migration:

- `src/lib/shared/animation-engine/components/EndlessSpinner.svelte` — replaced by factory
- `src/lib/shared/animation-engine/getEndlessSpinnerOrchestrator.ts` — factory registration for above
- `src/lib/features/landing/services/sequence-data-serializer.ts` — replaced by ClaudeCodeCopier
- `src/routes/endless-spinner/components/SequenceHistoryPanel.svelte` — surfaces render their own history using factory state

May be deletable after audit:
- `src/lib/features/lab/effects-lab/components/SequenceHistoryPanel.svelte` — if the surface rewrites its history UI using factory state

### 8. Inline Code to Remove Per Surface

**All 4 chaining surfaces** (PlayWithItInner, /endless-spinner, LandingAnimationDemo, EndlessSpinner.svelte):
- Delete inline `extractEndState()` function
- Delete inline `applyPropTypeToSequence()` function
- Delete auto-advance `$effect()` block
- Delete preload `$effect()` block
- Delete inline `loadSequence()` / `hotSwapSequence()`
- Delete inline derived values block (`derivedStartPosition`, `currentLetter`, etc.)
- Replace with factory creation + reads from factory state

**PlayWithItInner** specifically:
- Delete inline `toCompactDebug` copy logic → use `copyForAI()` from factory
- Delete inline history array management → use `history` from factory

**/endless-spinner** specifically:
- Delete inline Library/Infinite/Live mode management (~350 lines) → use `setSourceMode()` from factory
- Delete `sequence-data-serializer` imports → use `copyForAI()` from factory
- Delete inline `BroadcastRepository` management → factory handles via `IBroadcastProvider`

**EffectsLabPlaybackHost** — already uses `SequenceChainingOrchestrator`. Migration is lightest:
- Replace direct orchestrator usage with factory
- Delete inline derived values
- Delete inline localStorage persistence (move to factory config or keep in surface)

**HowTkaAnimationCard** — no chaining, loops one sequence. Does NOT use the factory. Stays independent. It's 223 lines of self-contained ambient display.

### 9. Migration Order

One surface at a time. Each migration is independently shippable.

1. **EffectsLabPlaybackHost** — already uses orchestrator, lightest migration. Validates factory API.
2. **EndlessSpinner.svelte** — simple, barely used. Migrate then delete component.
3. **LandingAnimationDemo** — library-only, moderate complexity.
4. **PlayWithItInner** — library-only + history + copy + effects + beat strip. Medium.
5. **/endless-spinner** — heaviest (3 modes, live broadcast, debug panel, stats). Last because it exercises every factory feature including Live mode.

HowTkaAnimationCard is not migrated — it doesn't chain sequences.

### 10. What Each Surface Keeps (UI chrome)

The factory provides state + actions. Each surface still owns:

| Surface | Unique UI retained |
|---------|-------------------|
| PlayWithItInner | Effect switcher toolbar, prop randomizer, effort cycler, TempoControl, virtualized beat strip |
| /endless-spinner | Mode toggle (Library/Infinite/Live), SpinnerControls, debug panel, stats bar, StepGrid side panel |
| EffectsLabPlaybackHost | SourceControls, SequencePickerModal, full EffectsPanel (16 effects), save-to-library, keyboard shortcuts, localStorage persistence |
| LandingAnimationDemo | Randomize button, prop switcher, dark mode toggle, fire/LED/trails toggles, ChoreoCard side panel, crossfade transition |
| HowTkaAnimationCard | (not migrated — stays independent) |

### 11. Testing

Existing behavior must not regress. Each migration step:

1. Verify chaining still works (sequences advance automatically)
2. Verify preloading still works (no gap between sequences)
3. Verify copy-to-clipboard produces valid output
4. Verify history tracks played sequences
5. For /endless-spinner: verify Live mode still syncs
6. For Effects Lab: verify localStorage persistence, save-to-library, keyboard shortcuts
7. For PlayWithIt: verify effect switching, prop randomization, effort cycling

### 12. Line Count Estimate

| Before | After (shared) | After (surfaces total) |
|--------|---------------|----------------------|
| ~3,607 across 6 surfaces | ~300 (factory + orchestrator extensions) | ~2,200 across 5 surfaces |

Net reduction: ~1,100 lines. More importantly: chaining logic exists in exactly 1 place.
