# Decompose Lab Tab Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Decompose" lab tab that plays sequences across three synchronized canvases — combined view (hero), blue-only, and red-only — with interactive swap between slots.

**Architecture:** Three `AnimatorCanvas` instances driven by a single playback controller. Hand isolation is achieved by passing `null` for the excluded prop — the render pipeline already handles null props correctly (trails, fire, LED all skip null hands). No changes to AnimationEngine internals needed.

**Tech Stack:** Svelte 5 runes, TypeScript, existing animation engine services, CSS transitions for swap animation.

**Spec:** `docs/superpowers/specs/2026-03-10-decompose-lab-tab-design.md`

### Spec Deviations (Deliberate)

| Spec Says | Plan Does | Rationale |
|-----------|-----------|-----------|
| Single rAF loop for all three canvases | Three independent AnimatorCanvas instances (each has its own engine/rAF) | Refactoring AnimationEngine to accept an external clock is a major change. All three canvases read the same animation state from one playback controller, so they render the same frame data. At 60fps, any rAF jitter between canvases is <16ms — imperceptible. |
| `DecomposeCanvas` wrapper with `handFilter` on render pipeline | Pass `null` for excluded prop at parent level | The render loop already handles null props: `effectiveBlueMotionVisible = visibility.blueMotionVisible && props.blueProp !== null`. Trails, fire, LED all check this. Simpler, no engine changes. |
| `DecomposeCanvas.svelte` as separate file | Inline AnimatorCanvas in DecomposePlaybackHost snippets | Three lines of prop filtering don't justify a wrapper component. |

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/features/decompose-lab/DecomposeLab.svelte` | Module root — creates state, sets context, renders layout |
| `src/lib/features/decompose-lab/components/DecomposePlaybackHost.svelte` | Playback orchestration — owns animation state, playback controller, chaining, three canvases |
| `src/lib/features/decompose-lab/components/DecomposeLayout.svelte` | Hero + two small canvas grid with swap CSS transitions |
| `src/lib/features/decompose-lab/components/DecomposeControls.svelte` | Source controls + effect mode bar + tuning panels |
| `src/lib/features/decompose-lab/state/decompose-state.svelte.ts` | Slot assignments, swap logic, active effect mode |
| `src/lib/features/decompose-lab/context/decompose-context.ts` | Context distribution for slot state |

### Extracted to Shared

| File | From | Responsibility |
|------|------|---------------|
| `src/lib/shared/animation-engine/components/SourceControls.svelte` | `effects-lab/components/` | Sequence source picker (Pick/Library/Infinite) |
| `src/lib/shared/animation-engine/components/EffectModeBar.svelte` | `effects-lab/components/` | Effect mode selector (Trails/Fire/Charcoal/LED) |
| `src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts` | `effects-lab/services/implementations/` | Auto-chaining between sequences |
| `src/lib/shared/animation-engine/services/contracts/ISequenceChainingOrchestrator.ts` | `effects-lab/services/contracts/` | Chaining orchestrator interface |

Effect tuning panels (FireControlsPanel, LedControlPanel, TrailControlsPanel, CharcoalControlsPanel) stay in effects-lab and are imported directly — they're pure presentational components with no effects-lab state dependencies, so cross-module import is acceptable.

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte` | Update import paths for extracted components/services |
| `src/lib/features/lab/LabModule.svelte` | Add "decompose" to tabComponents |
| `src/lib/shared/navigation/config/tab-definitions.ts` | Add "decompose" to LAB_TABS |

---

## Chunk 1: Extractions + State

### Task 1: Extract Shared Components and Services

**Files:**
- Move: `src/lib/features/effects-lab/components/SourceControls.svelte` → `src/lib/shared/animation-engine/components/SourceControls.svelte`
- Move: `src/lib/features/effects-lab/components/EffectModeBar.svelte` → `src/lib/shared/animation-engine/components/EffectModeBar.svelte`
- Move: `src/lib/features/effects-lab/services/implementations/SequenceChainingOrchestrator.ts` → `src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts`
- Move: `src/lib/features/effects-lab/services/contracts/ISequenceChainingOrchestrator.ts` → `src/lib/shared/animation-engine/services/contracts/ISequenceChainingOrchestrator.ts`
- Modify: `src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte` (update imports)

- [ ] **Step 1: Copy files to shared locations**

Copy each file to its new location. Update internal import paths within each file if they reference other effects-lab files. Key things to check:
- `SourceControls.svelte` imports `simplifyAndTruncate` from workspace-panel utils — keep this import path (it's already cross-module).
- `SourceControls.svelte` imports `SourceMode` type from the chaining orchestrator contract — update to new shared path.
- `EffectModeBar.svelte` — check its imports for effects-lab-specific dependencies.
- `SequenceChainingOrchestrator.ts` — check constructor dependencies. It uses `IEndlessSpinnerOrchestrator` and `IInfiniteSequenceGenerator` which live in `features/landing/`. These are passed as constructor args, so no import path change needed in the implementation — just ensure the interface file's imports are correct.

- [ ] **Step 2: Update all import references in EffectsLabPlaybackHost**

Change imports from local paths to new shared paths:
```typescript
// Before
import SourceControls from "./SourceControls.svelte";
import EffectModeBar from "./EffectModeBar.svelte";
import { SequenceChainingOrchestrator } from "../services/implementations/SequenceChainingOrchestrator";
import type { ISequenceChainingOrchestrator, SourceMode } from "../services/contracts/ISequenceChainingOrchestrator";

// After
import SourceControls from "$lib/shared/animation-engine/components/SourceControls.svelte";
import EffectModeBar from "$lib/shared/animation-engine/components/EffectModeBar.svelte";
import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import type { ISequenceChainingOrchestrator, SourceMode } from "$lib/shared/animation-engine/services/contracts/ISequenceChainingOrchestrator";
```

Also search for any other files that import from the old paths and update them.

- [ ] **Step 3: Delete old files**

Remove the originals from effects-lab.

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: extract SourceControls, EffectModeBar, and SequenceChainingOrchestrator to shared"
```

---

### Task 2: Create Decompose Slot State

**Files:**
- Create: `src/lib/features/decompose-lab/state/decompose-state.svelte.ts`
- Create: `src/lib/features/decompose-lab/context/decompose-context.ts`

- [ ] **Step 1: Create the state factory**

```typescript
// src/lib/features/decompose-lab/state/decompose-state.svelte.ts

export type HandView = "both" | "blue" | "red";

export type EffectMode = "trails" | "fire" | "charcoal" | "led";

export interface DecomposeSlotState {
  readonly heroView: HandView;
  readonly smallLeftView: HandView;
  readonly smallRightView: HandView;
  readonly activeEffectMode: EffectMode;
  swapWithHero(slot: "left" | "right"): void;
  setEffectMode(mode: EffectMode): void;
}

export function createDecomposeSlotState(): DecomposeSlotState {
  let heroView = $state<HandView>("both");
  let smallLeftView = $state<HandView>("blue");
  let smallRightView = $state<HandView>("red");
  let activeEffectMode = $state<EffectMode>("trails");

  function swapWithHero(slot: "left" | "right") {
    if (slot === "left") {
      const temp = heroView;
      heroView = smallLeftView;
      smallLeftView = temp;
    } else {
      const temp = heroView;
      heroView = smallRightView;
      smallRightView = temp;
    }
  }

  function setEffectMode(mode: EffectMode) {
    activeEffectMode = mode;
  }

  return {
    get heroView() { return heroView; },
    get smallLeftView() { return smallLeftView; },
    get smallRightView() { return smallRightView; },
    get activeEffectMode() { return activeEffectMode; },
    swapWithHero,
    setEffectMode,
  };
}
```

- [ ] **Step 2: Create the context**

```typescript
// src/lib/features/decompose-lab/context/decompose-context.ts

import { getContext, setContext } from "svelte";
import type { DecomposeSlotState } from "../state/decompose-state.svelte";

const DECOMPOSE_CTX_KEY = Symbol("decompose");

export interface DecomposeContext {
  slotState: DecomposeSlotState;
}

export function setDecomposeContext(ctx: DecomposeContext) {
  setContext(DECOMPOSE_CTX_KEY, ctx);
}

export function getDecomposeContext(): DecomposeContext {
  return getContext<DecomposeContext>(DECOMPOSE_CTX_KEY);
}
```

- [ ] **Step 3: Verify types**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(decompose): add slot state factory and context"
```

---

## Chunk 2: Layout and Swap Transitions

### Task 3: Create DecomposeLayout Component

**Files:**
- Create: `src/lib/features/decompose-lab/components/DecomposeLayout.svelte`

This component manages the visual grid: one hero canvas on top, two small canvases below. Tapping a small canvas swaps it with the hero.

- [ ] **Step 1: Create DecomposeLayout**

The layout renders three slots via Svelte 5 snippets. The swap is a CSS transition on the containers.

```svelte
<!-- src/lib/features/decompose-lab/components/DecomposeLayout.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HandView } from "../state/decompose-state.svelte";
  import { getDecomposeContext } from "../context/decompose-context";

  interface Props {
    heroCanvas: Snippet;
    smallLeftCanvas: Snippet;
    smallRightCanvas: Snippet;
  }

  let { heroCanvas, smallLeftCanvas, smallRightCanvas }: Props = $props();
  const { slotState } = getDecomposeContext();

  function handleSmallClick(slot: "left" | "right") {
    slotState.swapWithHero(slot);
  }

  function viewLabel(view: HandView): string {
    if (view === "both") return "Both";
    if (view === "blue") return "Blue";
    return "Red";
  }

  function viewColor(view: HandView): string {
    if (view === "blue") return "var(--prop-blue, #2196f3)";
    if (view === "red") return "var(--prop-red, #f44336)";
    return "var(--theme-text, #fff)";
  }
</script>

<div class="decompose-layout">
  <div class="hero-slot">
    <div class="slot-label" style="color: {viewColor(slotState.heroView)}">
      {viewLabel(slotState.heroView)}
    </div>
    {@render heroCanvas()}
  </div>

  <div class="small-slots">
    <button
      class="small-slot"
      onclick={() => handleSmallClick("left")}
      aria-label="Swap {viewLabel(slotState.smallLeftView)} to hero"
    >
      <div class="slot-label" style="color: {viewColor(slotState.smallLeftView)}">
        {viewLabel(slotState.smallLeftView)}
      </div>
      {@render smallLeftCanvas()}
    </button>

    <button
      class="small-slot"
      onclick={() => handleSmallClick("right")}
      aria-label="Swap {viewLabel(slotState.smallRightView)} to hero"
    >
      <div class="slot-label" style="color: {viewColor(slotState.smallRightView)}">
        {viewLabel(slotState.smallRightView)}
      </div>
      {@render smallRightCanvas()}
    </button>
  </div>
</div>

<style>
  .decompose-layout {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    height: 100%;
    container-type: size;
  }

  .hero-slot {
    position: relative;
    flex: 2;
    min-height: 0;
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .small-slots {
    display: flex;
    gap: 8px;
    flex: 1;
    min-height: 0;
  }

  .small-slot {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    padding: 0;
    cursor: pointer;
    transition: border-color 300ms ease;
  }

  .small-slot:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .small-slot:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .slot-label {
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    z-index: 1;
    pointer-events: none;
    opacity: 0.7;
  }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(decompose): add DecomposeLayout with swap interaction"
```

---

## Chunk 3: Playback Host (Core)

### Task 4: Create DecomposePlaybackHost

**Files:**
- Create: `src/lib/features/decompose-lab/components/DecomposePlaybackHost.svelte`

This is the largest and most complex component. Read `EffectsLabPlaybackHost.svelte` (at `src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte`) thoroughly before starting. The Decompose version mirrors its playback infrastructure but renders three filtered canvases.

- [ ] **Step 1: Read EffectsLabPlaybackHost completely**

Understand these sections before writing:
- **Lines 78-96:** Persisted state interface and localStorage key
- **Lines 196-208:** Core state variables (sequence, isPlaying, bpm, sourceMode)
- **Lines 215-260:** Effect config derivation ($derived blocks for fire, LED, charcoal)
- **Lines 272-280:** Animation state creation (`createAnimationPanelState()`)
- **Lines 412-440:** Auto-chaining frame check (`checkAndChain`, `checkAndPreload`)
- **Lines 449-500:** Service initialization (playback controller, chaining orchestrator)
- **Lines 515-530:** Cleanup/dispose
- **Lines 540-560:** Sequence loading and initialization
- **Lines 658-680:** AnimatorCanvas wiring

- [ ] **Step 2: Create DecomposePlaybackHost**

Structure the component in these sections:

**A. Imports:**
```typescript
import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
import SourceControls from "$lib/shared/animation-engine/components/SourceControls.svelte";
import EffectModeBar from "$lib/shared/animation-engine/components/EffectModeBar.svelte";
import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import type { ISequenceChainingOrchestrator, SourceMode } from "$lib/shared/animation-engine/services/contracts/ISequenceChainingOrchestrator";
import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceAnimationOrchestrator";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/implementations/AnimationStateManager";
import { AnimationLoop } from "$lib/shared/animation-engine/services/implementations/AnimationLoop";
import { StepCalculator } from "$lib/shared/animation-engine/services/implementations/StepCalculator";
// ... fire, LED, charcoal config imports (same as EffectsLabPlaybackHost)
// ... landing service imports for chaining (EndlessSpinnerOrchestrator, InfiniteSequenceGenerator, etc.)
import DecomposeLayout from "./DecomposeLayout.svelte";
import DecomposeControls from "./DecomposeControls.svelte";
import { getDecomposeContext } from "../context/decompose-context";
import type { HandView } from "../state/decompose-state.svelte";
```

**B. Core state** (mirror EffectsLabPlaybackHost lines 196-260):
- `sequence`, `isPlaying`, `bpm`, `sourceMode` — same reactive state
- Fire config `$derived` block — copy from EffectsLabPlaybackHost lines 215-231
- LED config `$derived` block — copy from lines 245-257
- Charcoal params — copy from line 260
- Use localStorage key `"decompose-lab-state"` (separate from effects lab)

**C. Animation state and services** (mirror lines 272-500):
- `createAnimationPanelState()` — one instance drives all three canvases
- Playback controller init — same composition as EffectsLabPlaybackHost
- Chaining orchestrator init — same, using shared import now

**D. Prop filtering — the key difference:**
```typescript
const { slotState } = getDecomposeContext();

function propsForView(view: HandView) {
  return {
    blueProp: view === "red" ? null : animationState.bluePropState,
    redProp: view === "blue" ? null : animationState.redPropState,
  };
}
```

**E. Template — three canvases via DecomposeLayout:**
```svelte
<div class="decompose-host">
  <DecomposeLayout>
    {#snippet heroCanvas()}
      <AnimatorCanvas
        blueProp={propsForView(slotState.heroView).blueProp}
        redProp={propsForView(slotState.heroView).redProp}
        sequenceData={animationState.sequenceData}
        currentStep={animationState.currentStep}
        isPlaying={isPlaying}
        fireConfig={activeMode === "fire" || activeMode === "charcoal" ? fireConfig : undefined}
        ledConfig={activeMode === "led" ? ledConfig : undefined}
        backgroundAlpha={0}
        focused={true}
      />
    {/snippet}
    {#snippet smallLeftCanvas()}
      <AnimatorCanvas
        blueProp={propsForView(slotState.smallLeftView).blueProp}
        redProp={propsForView(slotState.smallLeftView).redProp}
        sequenceData={animationState.sequenceData}
        currentStep={animationState.currentStep}
        isPlaying={isPlaying}
        fireConfig={activeMode === "fire" || activeMode === "charcoal" ? fireConfig : undefined}
        ledConfig={activeMode === "led" ? ledConfig : undefined}
        backgroundAlpha={0}
        focused={false}
      />
    {/snippet}
    {#snippet smallRightCanvas()}
      <AnimatorCanvas
        blueProp={propsForView(slotState.smallRightView).blueProp}
        redProp={propsForView(slotState.smallRightView).redProp}
        sequenceData={animationState.sequenceData}
        currentStep={animationState.currentStep}
        isPlaying={isPlaying}
        fireConfig={activeMode === "fire" || activeMode === "charcoal" ? fireConfig : undefined}
        ledConfig={activeMode === "led" ? ledConfig : undefined}
        backgroundAlpha={0}
        focused={false}
      />
    {/snippet}
  </DecomposeLayout>

  <DecomposeControls
    {sourceMode}
    {sequence}
    isChainingNow={chainingOrchestrator?.isChainingNow ?? false}
    onSourceChange={handleSourceChange}
    onPick={() => (showPicker = true)}
    onSkip={handleSkip}
    onShuffle={handleShuffle}
    activeEffectMode={slotState.activeEffectMode}
    onEffectModeChange={slotState.setEffectMode}
    {fireIntensity} {fireColorBlend}
    onFireIntensityChange={(v) => fireIntensity = v}
    onFireColorBlendChange={(v) => fireColorBlend = v}
    {ledBrightness} {ledPatternId} {ledPrimaryColor} {ledPatternSpeed}
    {ledGlowRadius} {ledBloomIntensity} {ledTrailFadeRate} {ledColorMode}
    {ledBlueHandColor} {ledRedHandColor}
    <!-- LED change handlers -->
  />
</div>

{#if showPicker}
  <SequencePickerModal onSelect={handleSequenceSelect} onClose={() => showPicker = false} />
{/if}
```

**F. Lifecycle:**
- `$effect` for auto-chaining frame checks (same as EffectsLabPlaybackHost lines 412-440)
- `$effect` for restoring persisted sequence on mount
- Dispose on destroy: playback controller, chaining orchestrator, animation state

- [ ] **Step 3: Verify types**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(decompose): add DecomposePlaybackHost with three-canvas rendering"
```

---

## Chunk 4: Controls, Module Root, Registration

### Task 5: Create DecomposeControls

**Files:**
- Create: `src/lib/features/decompose-lab/components/DecomposeControls.svelte`

This component composes the Source controls, effect mode bar, and effect tuning panels. All state is received via props from DecomposePlaybackHost.

- [ ] **Step 1: Create DecomposeControls**

```svelte
<!-- src/lib/features/decompose-lab/components/DecomposeControls.svelte -->
<script lang="ts">
  import SourceControls from "$lib/shared/animation-engine/components/SourceControls.svelte";
  import EffectModeBar from "$lib/shared/animation-engine/components/EffectModeBar.svelte";
  import FireControlsPanel from "$lib/features/effects-lab/components/FireControlsPanel.svelte";
  import LedControlPanel from "$lib/features/effects-lab/components/LedControlPanel.svelte";
  import TrailControlsPanel from "$lib/features/effects-lab/components/TrailControlsPanel.svelte";
  import CharcoalControlsPanel from "$lib/features/effects-lab/components/CharcoalControlsPanel.svelte";
  import type { SourceMode } from "$lib/shared/animation-engine/services/contracts/ISequenceChainingOrchestrator";
  import type { SequenceData } from "..."; // match EffectsLabPlaybackHost import
  import type { EffectMode } from "../state/decompose-state.svelte";

  interface Props {
    sourceMode: SourceMode;
    sequence: SequenceData | null;
    isChainingNow: boolean;
    onSourceChange: (mode: SourceMode) => void;
    onPick: () => void;
    onSkip: () => void;
    onShuffle: () => void;
    activeEffectMode: EffectMode;
    onEffectModeChange: (mode: EffectMode) => void;
    // Fire props
    fireIntensity: number;
    fireColorBlend: number;
    onFireIntensityChange: (v: number) => void;
    onFireColorBlendChange: (v: number) => void;
    // LED props — match what LedControlPanel expects
    // ... (check LedControlPanel.svelte for exact props)
  }

  let {
    sourceMode, sequence, isChainingNow,
    onSourceChange, onPick, onSkip, onShuffle,
    activeEffectMode, onEffectModeChange,
    fireIntensity, fireColorBlend,
    onFireIntensityChange, onFireColorBlendChange,
    // ... LED props
  }: Props = $props();
</script>

<div class="decompose-controls">
  <SourceControls
    {sourceMode} {sequence} {isChainingNow}
    {onSourceChange} {onPick} {onSkip} {onShuffle}
  />

  <EffectModeBar
    activeMode={activeEffectMode}
    onModeChange={onEffectModeChange}
  />

  {#if activeEffectMode === "fire"}
    <FireControlsPanel
      intensity={fireIntensity}
      colorBlend={fireColorBlend}
      onIntensityChange={onFireIntensityChange}
      onColorBlendChange={onFireColorBlendChange}
    />
  {:else if activeEffectMode === "charcoal"}
    <CharcoalControlsPanel />
  {:else if activeEffectMode === "led"}
    <LedControlPanel
      <!-- pass LED props — check LedControlPanel for exact interface -->
    />
  {:else if activeEffectMode === "trails"}
    <TrailControlsPanel />
  {/if}
</div>

<style>
  .decompose-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-lg, 12px);
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>
```

**Important:** Read the actual props interfaces of FireControlsPanel, LedControlPanel, TrailControlsPanel, and CharcoalControlsPanel before finalizing. The prop names shown above are approximations — match what each panel actually expects. Check `src/lib/features/effects-lab/components/` for each panel's interface.

- [ ] **Step 2: Verify types**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(decompose): add DecomposeControls panel"
```

---

### Task 6: Create DecomposeLab Module Root

**Files:**
- Create: `src/lib/features/decompose-lab/DecomposeLab.svelte`

- [ ] **Step 1: Create module root**

```svelte
<script lang="ts">
  import { createDecomposeSlotState } from "./state/decompose-state.svelte";
  import { setDecomposeContext } from "./context/decompose-context";
  import DecomposePlaybackHost from "./components/DecomposePlaybackHost.svelte";

  const slotState = createDecomposeSlotState();
  setDecomposeContext({ slotState });
</script>

<DecomposePlaybackHost />
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(decompose): add DecomposeLab module root"
```

---

### Task 7: Register as Lab Tab

**Files:**
- Modify: `src/lib/features/lab/LabModule.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`

- [ ] **Step 1: Add to LAB_TABS in tab-definitions.ts**

Add a new entry to the `LAB_TABS` array:

```typescript
{
  id: "decompose",
  label: "Decompose",
  icon: '<i class="fas fa-layer-group" aria-hidden="true"></i>',
  description: "Isolate and study individual hand paths",
  color: "#06b6d4",
  gradient: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
},
```

- [ ] **Step 2: Add to tabComponents in LabModule.svelte**

In the `tabComponents` record, add:

```typescript
decompose: () => import("$lib/features/decompose-lab/DecomposeLab.svelte"),
```

- [ ] **Step 3: Verify build**

Run: `npm run check && npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(decompose): register as lab tab"
```

---

## Chunk 5: Manual Testing and Polish

### Task 8: End-to-End Verification

- [ ] **Step 1: Navigate to Lab → Decompose**

Verify:
- Tab appears in Lab sidebar/tab bar
- Three canvas slots render (hero + two small)
- Labels show "Both" (hero), "Blue" (left), "Red" (right)

- [ ] **Step 2: Load a sequence**

Use Source → Pick or Source → Infinite. Verify:
- All three canvases show the sequence playing
- Hero shows both props
- Left shows only blue prop (no red prop, no red trails)
- Right shows only red prop (no blue prop, no blue trails)

- [ ] **Step 3: Test swap**

Click the left small canvas. Verify:
- Blue view moves to hero, Both view moves to left small
- Labels update correctly
- Animation continues uninterrupted

Click the right small canvas. Verify same.

- [ ] **Step 4: Test effects**

Switch to Fire mode — fire renders only on visible props per canvas.
Switch to LED — same check.
Switch to Trails — trails only for visible hand per canvas.

- [ ] **Step 5: Test auto-chaining**

Source → Infinite. Let a sequence finish. Verify:
- New sequence loads automatically
- All three canvases update together

- [ ] **Step 6: Test mobile layout**

Resize to mobile width. Verify:
- Hero stacks on top, two small canvases side-by-side below
- Tap interaction works

- [ ] **Step 7: Commit polish**

```bash
git add -A && git commit -m "fix(decompose): polish from manual testing"
```

---

## Performance Notes

- Three AnimatorCanvas instances = three AnimationEngine instances = three rAF loops. All read the same animation state from one playback controller, so they're data-synchronized. At 60fps, rAF jitter between canvases is <16ms — imperceptible.
- Isolated canvases render ~half the props each, so total GPU/CPU work is ~2x one canvas.
- If frame budget is tight, small canvases can render at reduced resolution.
- `FrameBudgetMonitor` exists per engine and logs warnings if budget is exceeded.

## Future Enhancements (Not In Scope)

- Keyboard shortcuts for swapping (1/2/3 to focus a view)
- Slow motion / frame-step synced across all three
- Side-by-side horizontal layout option for ultrawide screens
- Recording/export of the decomposed view
