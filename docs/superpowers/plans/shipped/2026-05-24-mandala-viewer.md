# Mandala Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mandala" content pane to the sequence viewer that displays the current sequence's mandala with real-time breathing animation and path shape controls.

**Architecture:** New `"mandala"` ContentType wired into the existing split-pane system. A `MandalaPane.svelte` renders `SequenceMandala` full-size with animation props. A `MandalaViewerControls.svelte` right-panel provides path shape and tuning controls using the same popover pattern as `RightRail`.

**Tech Stack:** Svelte 5, existing `SequenceMandala` component, existing `MandalaGeometryCalculator` with path shape support, CSS transitions for panel disclosure.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts` | Add `'mandala'` to `ContentType` |
| Modify | `src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte` | Add mandala option to dropdown |
| Modify | `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Add `{:else if}` branch for mandala pane |
| Create | `src/lib/shared/sequence-viewer/components/MandalaPane.svelte` | Full-pane mandala with responsive sizing |
| Create | `src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte` | Right-panel settings (path shape, easing, rotation, period) |

---

### Task 1: Add `"mandala"` to ContentType

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts`

- [ ] **Step 1: Update ContentType union**

In `viewer-state-persistence.ts`, change line 1:

```ts
export type ContentType = 'animation' | 'animation-3d' | 'card' | 'videos' | 'mandala';
```

- [ ] **Step 2: Update `isValidContentType` guard**

Change line 89-91:

```ts
function isValidContentType(value: unknown): value is ContentType {
	return value === 'animation' || value === 'animation-3d' || value === 'card' || value === 'videos' || value === 'mandala';
}
```

- [ ] **Step 3: Update `loadViewerMode` validation**

Change line 47:

```ts
if (raw === 'animation' || raw === 'animation-3d' || raw === 'card' || raw === 'videos' || raw === 'mandala' || raw === 'split') {
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No new errors (existing ocean scene-configs error is pre-existing)

- [ ] **Step 5: Commit**

```
git add src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts
git commit -m "feat(mandala-viewer): add 'mandala' to ContentType union"
```

---

### Task 2: Add mandala option to PaneContentSelector

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte`

- [ ] **Step 1: Add mandala to options array**

In `PaneContentSelector.svelte`, add to the `options` array (after the `card` entry):

```ts
const options: { id: ContentType; icon: string; label: string }[] = [
  { id: 'animation', icon: 'fa-play', label: '2D Animation' },
  { id: 'animation-3d', icon: 'fa-cube', label: '3D Animation' },
  { id: 'card', icon: 'fa-grip', label: 'Card' },
  { id: 'mandala', icon: 'fa-dharmachakra', label: 'Mandala' },
];
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Clean (no new errors)

- [ ] **Step 3: Commit**

```
git add src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte
git commit -m "feat(mandala-viewer): add Mandala option to pane content selector"
```

---

### Task 3: Create MandalaPane component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/MandalaPane.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { UndulationEasing, MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);

  // Animation settings (controlled by MandalaViewerControls via bindable)
  let paused: boolean = $state(false);
  let pathShape: MandalaPathShape = $state("arc");
  let easing: UndulationEasing = $state("breathe");
  let rotation: number = $state(90);
  let period: number = $state(5);
  let rangeMin: number = $state(0);
  let rangeMax: number = $state(250);

  // Responsive sizing
  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      containerSize = Math.floor(Math.min(width, height) - 32);
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div class="mandala-pane" bind:this={containerEl}>
  <div class="mandala-stage">
    <SequenceMandala
      {sequence}
      animate={!paused}
      animateMin={rangeMin}
      animateMax={rangeMax}
      animatePeriod={period}
      animateEasing={easing}
      animateRotation={rotation}
      {pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="gallery"
      style="stroke"
      show="both"
    />
  </div>
</div>

<style>
  .mandala-pane {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a1a;
    position: relative;
    overflow: hidden;
  }

  .mandala-stage {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Clean

- [ ] **Step 3: Commit**

```
git add src/lib/shared/sequence-viewer/components/MandalaPane.svelte
git commit -m "feat(mandala-viewer): create MandalaPane component with responsive sizing"
```

---

### Task 4: Create MandalaViewerControls component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte`

- [ ] **Step 1: Create the controls panel**

```svelte
<script lang="ts">
  import type { UndulationEasing, MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props {
    paused: boolean;
    pathShape: MandalaPathShape;
    easing: UndulationEasing;
    rotation: number;
    period: number;
    rangeMin: number;
    rangeMax: number;
    onPausedChange: (v: boolean) => void;
    onPathShapeChange: (v: MandalaPathShape) => void;
    onEasingChange: (v: UndulationEasing) => void;
    onRotationChange: (v: number) => void;
    onPeriodChange: (v: number) => void;
    onRangeMinChange: (v: number) => void;
    onRangeMaxChange: (v: number) => void;
  }

  let {
    paused,
    pathShape,
    easing,
    rotation,
    period,
    rangeMin,
    rangeMax,
    onPausedChange,
    onPathShapeChange,
    onEasingChange,
    onRotationChange,
    onPeriodChange,
    onRangeMinChange,
    onRangeMaxChange,
  }: Props = $props();

  let tuneExpanded: boolean = $state(false);

  const PATH_SHAPES: { id: MandalaPathShape; label: string }[] = [
    { id: "arc", label: "Arc" },
    { id: "linear", label: "Linear" },
    { id: "concave", label: "Concave" },
    { id: "motion-aware", label: "Motion" },
  ];

  const EASINGS: { id: UndulationEasing; label: string }[] = [
    { id: "sine", label: "Sine" },
    { id: "ease", label: "Ease" },
    { id: "soft-elastic", label: "Elastic" },
    { id: "breathe", label: "Breathe" },
    { id: "heartbeat", label: "Heart" },
    { id: "drift", label: "Drift" },
    { id: "bloom", label: "Bloom" },
    { id: "tidal", label: "Tidal" },
  ];

  const ROTATIONS: { value: number; label: string }[] = [
    { value: 0, label: "None" },
    { value: 45, label: "45°" },
    { value: 90, label: "90°" },
    { value: 180, label: "180°" },
    { value: 360, label: "360°" },
  ];
</script>

<div class="mandala-controls">
  <div class="control-section">
    <button
      class="play-toggle"
      onclick={() => onPausedChange(!paused)}
      aria-label={paused ? "Play" : "Pause"}
    >
      <i class="fas {paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
    </button>
  </div>

  <div class="control-section">
    <span class="section-label">Path</span>
    <div class="btn-group">
      {#each PATH_SHAPES as shape}
        <button
          class="ctrl-btn"
          class:active={pathShape === shape.id}
          onclick={() => onPathShapeChange(shape.id)}
        >
          {shape.label}
        </button>
      {/each}
    </div>
  </div>

  <button
    class="tune-toggle"
    onclick={() => { tuneExpanded = !tuneExpanded; }}
    aria-expanded={tuneExpanded}
  >
    <i class="fas fa-sliders" aria-hidden="true"></i>
    Tune
    <i class="fas fa-chevron-{tuneExpanded ? 'up' : 'down'}" aria-hidden="true"></i>
  </button>

  {#if tuneExpanded}
    <div class="tune-panel">
      <div class="control-section">
        <span class="section-label">Easing</span>
        <div class="btn-group wrap">
          {#each EASINGS as e}
            <button
              class="ctrl-btn"
              class:active={easing === e.id}
              onclick={() => onEasingChange(e.id)}
            >
              {e.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-section">
        <span class="section-label">Rotation</span>
        <div class="btn-group">
          {#each ROTATIONS as r}
            <button
              class="ctrl-btn"
              class:active={rotation === r.value}
              onclick={() => onRotationChange(r.value)}
            >
              {r.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-section">
        <span class="section-label">Period</span>
        <input
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={period}
          oninput={(e) => onPeriodChange(Number((e.target as HTMLInputElement).value))}
          class="range-input"
        />
        <span class="range-value">{period}s</span>
      </div>

      <div class="control-section">
        <span class="section-label">Range</span>
        <div class="range-pair">
          <input
            type="number"
            min="0"
            max="150"
            value={rangeMin}
            oninput={(e) => onRangeMinChange(Number((e.target as HTMLInputElement).value))}
            class="num-input"
          />
          <span>–</span>
          <input
            type="number"
            min="100"
            max="300"
            value={rangeMax}
            oninput={(e) => onRangeMaxChange(Number((e.target as HTMLInputElement).value))}
            class="num-input"
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mandala-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    color: var(--theme-text, #e2e8f0);
    font-size: 0.75rem;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
  }

  .play-toggle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.1);
    color: #c4b5fd;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    transition: all 0.2s;
  }

  .play-toggle:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .btn-group {
    display: flex;
    gap: 3px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 2px;
  }

  .btn-group.wrap {
    flex-wrap: wrap;
  }

  .ctrl-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 0.65rem;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .ctrl-btn.active {
    background: rgba(139, 92, 246, 0.25);
    opacity: 1;
    color: #c4b5fd;
  }

  .ctrl-btn:hover {
    opacity: 0.9;
  }

  .tune-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    font-size: 0.68rem;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .tune-toggle:hover {
    opacity: 1;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .tune-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .range-input {
    width: 100%;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    cursor: pointer;
  }

  .range-input::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #a78bfa;
    cursor: pointer;
  }

  .range-value {
    font-size: 0.6rem;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }

  .range-pair {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .num-input {
    width: 48px;
    padding: 3px 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    color: inherit;
    font-size: 0.68rem;
    text-align: center;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Clean

- [ ] **Step 3: Commit**

```
git add src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte
git commit -m "feat(mandala-viewer): create MandalaViewerControls panel component"
```

---

### Task 5: Wire MandalaPane into ViewerSplitPane

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

- [ ] **Step 1: Add imports**

Add at the top of the `<script>` block (near the other component imports around line 23-25):

```ts
import MandalaPane from "./MandalaPane.svelte";
```

- [ ] **Step 2: Add mandala branch to left pane**

After the `{:else if splitConfig.leftPane === 'videos'}` block (around line 405-409), add before the closing `{/if}`:

```svelte
    {:else if splitConfig.leftPane === 'mandala'}
      <div class="media-pane">
        <MandalaPane
          {sequence}
          bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : undefined}
          redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : undefined}
        />
      </div>
```

- [ ] **Step 3: Add mandala branch to right pane**

After the `{:else if splitConfig.rightPane === 'videos'}` block (around line 531-534), add before the closing `{/if}`:

```svelte
      {:else if splitConfig.rightPane === 'mandala'}
        <div class="media-pane">
          <MandalaPane
            {sequence}
            bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : undefined}
            redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : undefined}
          />
        </div>
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Clean

- [ ] **Step 5: Commit**

```
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(mandala-viewer): wire MandalaPane into split pane content routing"
```

---

### Task 6: Add controls panel to MandalaPane

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/MandalaPane.svelte`

- [ ] **Step 1: Import and wire MandalaViewerControls**

Add import at top of script:

```ts
import MandalaViewerControls from "./MandalaViewerControls.svelte";
```

Update the template to include the controls panel:

```svelte
<div class="mandala-pane" bind:this={containerEl}>
  <div class="mandala-stage">
    <SequenceMandala
      {sequence}
      animate={!paused}
      animateMin={rangeMin}
      animateMax={rangeMax}
      animatePeriod={period}
      animateEasing={easing}
      animateRotation={rotation}
      {pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="gallery"
      style="stroke"
      show="both"
    />
  </div>

  <aside class="controls-rail">
    <MandalaViewerControls
      {paused}
      {pathShape}
      {easing}
      {rotation}
      {period}
      {rangeMin}
      {rangeMax}
      onPausedChange={(v) => { paused = v; }}
      onPathShapeChange={(v) => { pathShape = v; }}
      onEasingChange={(v) => { easing = v; }}
      onRotationChange={(v) => { rotation = v; }}
      onPeriodChange={(v) => { period = v; }}
      onRangeMinChange={(v) => { rangeMin = v; }}
      onRangeMaxChange={(v) => { rangeMax = v; }}
    />
  </aside>
</div>
```

Add styles for the controls rail:

```css
.controls-rail {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 200px;
  overflow-y: auto;
  background: rgba(10, 10, 26, 0.85);
  backdrop-filter: blur(8px);
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Clean

- [ ] **Step 3: Commit**

```
git add src/lib/shared/sequence-viewer/components/MandalaPane.svelte
git commit -m "feat(mandala-viewer): wire controls panel into MandalaPane"
```

---

### Task 7: Verify in browser

- [ ] **Step 1: Open sequence viewer, select Mandala from pane selector**

Navigate to any sequence in the viewer. Click the content type dropdown (top-left). Select "Mandala". Verify:
- Mandala appears, breathing immediately (undulating 0–250, breathe easing)
- Mandala fills available pane space
- Controls rail visible on right edge
- Path shape buttons work (Arc/Linear/Concave/Motion)
- Tune section expands with easing/rotation/period/range controls

- [ ] **Step 2: Test split mode**

Set viewer to split mode with mandala on one side and card/animation on the other. Verify mandala resizes responsively.

- [ ] **Step 3: Final commit with any fixes**

```
git add -u
git commit -m "fix(mandala-viewer): polish from browser verification"
```
