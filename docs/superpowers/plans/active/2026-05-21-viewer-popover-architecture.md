# Viewer Popover Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 9 hand-rolled popovers with a shared Bits UI `ViewerPopover` component, add dark-mode support to PropCompositionPreview, and make PropPopover registry-driven with a dedicated per-performer size slider.

**Architecture:** Three independent subsystems executed sequentially. Subsystem 1 builds the shared ViewerPopover wrapper on Bits UI Popover and migrates all 9 popovers. Subsystem 2 adds a `darkBackground` prop to PropCompositionPreview. Subsystem 3 adds registry-driven prop categories and a dedicated PerformerPropSizeSlider, then rewrites PropPopover as content-only.

**Tech Stack:** Svelte 5 (runes), bits-ui@^2.14.4 (Popover primitive), TypeScript, existing viewer-3d-state

**Spec:** `docs/superpowers/specs/2026-05-21-viewer-popover-architecture-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/components/controls/ViewerPopover.svelte` | Bits UI Popover wrapper — chip trigger + portal + content panel with standard styling |
| `src/lib/shared/3d/components/controls/PerformerPropSizeSlider.svelte` | Per-performer staff length slider (no link toggle, no global mode) |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/shared/sequence-viewer/components/RightRail.svelte` | Replace chip+popover pairs with `<ViewerPopover>`, delete document click handler |
| `src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte` | Add `darkBackground` prop + CSS class |
| `src/lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts` | Add `PropCategory` type, `category` field, `PROP_CATEGORIES`, `getBasePropsByCategory()` |
| `src/lib/shared/3d/components/controls/PropPopover.svelte` | Rewrite as content-only (remove positioning/animation/escape/styling boilerplate, use registry categories) |
| `src/lib/shared/3d/components/controls/FormationPopover.svelte` | Strip to content-only |
| `src/lib/shared/3d/components/controls/EffectsPopover.svelte` | Strip to content-only |
| `src/lib/shared/3d/components/controls/EffortPopover.svelte` | Strip to content-only |
| `src/lib/shared/3d/components/CameraPopover.svelte` | Strip to content-only |
| `src/lib/shared/3d/components/PlanesPopover.svelte` | Strip to content-only |
| `src/lib/shared/3d/components/SceneSelectorPopover.svelte` | Strip to content-only |
| `src/lib/shared/sequence-viewer/components/TempoPopover.svelte` | Strip to content-only |
| `src/lib/shared/sequence-viewer/components/ExportPopover.svelte` | Strip to content-only |

### Possibly Deleted
| File | Condition |
|------|-----------|
| `src/lib/shared/sequence-viewer/components/PropSizeControl.svelte` | If no consumers remain after PerformerPropSizeSlider replaces its only use in PropPopover |

---

## Task 1: Create ViewerPopover Component

The shared wrapper that all 9 popovers will use. Built on Bits UI Popover with bidirectional state sync to `viewer.activePopover`.

**Files:**
- Create: `src/lib/shared/3d/components/controls/ViewerPopover.svelte`

- [ ] **Step 1: Create the ViewerPopover component**

```svelte
<script lang="ts">
  import { Popover } from "bits-ui";
  import { getViewer3DContext, type PopoverId } from "../../context/viewer-3d-context";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  interface Props {
    id: PopoverId;
    title: string;
    accentColor?: string;
    width?: number;
    icon: string;
    tooltip: string;
    performerScoped?: boolean;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    id,
    title,
    accentColor,
    width = 420,
    icon,
    tooltip,
    performerScoped = false,
    children,
    footer,
  }: Props = $props();

  const viewer = getViewer3DContext();

  let popoverOpen = $state(false);

  $effect(() => {
    const shouldBeOpen = viewer.activePopover === id;
    if (popoverOpen !== shouldBeOpen) {
      popoverOpen = shouldBeOpen;
    }
  });

  function handleOpenChange(open: boolean) {
    if (open) {
      viewer.openPopover(id);
    } else if (viewer.activePopover === id) {
      viewer.closePopover();
    }
  }
</script>

<Popover.Root bind:open={popoverOpen} onOpenChange={handleOpenChange}>
  <Popover.Trigger asChild>
    {#snippet child({ props })}
      <button
        {...props}
        class="rail-chip"
        class:performer-scoped={performerScoped}
        aria-label={tooltip}
        data-tooltip={tooltip}
        style:--chip-tint={accentColor}
      >
        <i class="fas {icon}"></i>
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      side="left"
      sideOffset={10}
      align="start"
      avoidCollisions={true}
      collisionPadding={12}
      forceMount
      onInteractOutside={() => handleOpenChange(false)}
    >
      {#snippet content({ open })}
        {#if open}
          <div
            class="viewer-popover-panel"
            style:--popover-width="{width}px"
            in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
            out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
          >
            <header class="pop-header">
              <span class="pop-title">{title}</span>
              {#if accentColor}
                <span class="pop-badge" style:background={accentColor}></span>
              {/if}
            </header>
            <div class="pop-body">
              {@render children()}
            </div>
            {#if footer}
              <div class="pop-footer">
                {@render footer()}
              </div>
            {/if}
          </div>
        {/if}
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  .viewer-popover-panel {
    width: var(--popover-width, 420px);
    border-radius: 18px;
    background: #0c0e16;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }
  .pop-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-body {
    padding: 12px 14px 14px;
  }
  .pop-footer {
    padding: 10px 14px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
```

**Important Bits UI notes for the implementer:**
- `Popover.Content` accepts a `content` snippet (NOT `child`) that receives `{ open }`. Check the actual Bits UI version's snippet API — if the version uses `child` instead of `content`, adjust accordingly. The key signature to look for in the Bits UI types is `FloatingContentSnippetProps` which has `{ open: boolean }`.
- `forceMount` keeps the DOM node alive so Svelte transitions work (the `{#if open}` inside handles actual visibility).
- `onInteractOutside` fires on clicks outside the popover — we use it to sync back to viewer state.
- The `bind:open` + `onOpenChange` combo creates bidirectional sync: viewer state drives Bits UI open state via the `$effect`, and Bits UI drives viewer state via `onOpenChange`.
- The chip button styles (`rail-chip`, `performer-scoped`) are NOT defined here — they come from RightRail.svelte's existing styles. ViewerPopover uses `asChild` on the trigger so the chip renders in RightRail's DOM, inheriting its styles.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors from ViewerPopover.svelte. Pre-existing errors in ScenePostProcessing.svelte, Grid3D, ComposedObject, VoidLab are known and unrelated.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/ViewerPopover.svelte
git commit -m "feat(viewer): add ViewerPopover shared component on Bits UI Popover"
```

---

## Task 2: Migrate FormationPopover to Content-Only

First migration — proves the ViewerPopover pattern works. FormationPopover is a simple global popover (no performer scoping, no accent color).

**Files:**
- Modify: `src/lib/shared/3d/components/controls/FormationPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

- [ ] **Step 1: Strip FormationPopover to content-only**

Remove from `FormationPopover.svelte`:
- The outer `{#if open}` conditional
- The `<div class="formation-popover" role="dialog" ...>` wrapper with all its positioning, animation, escape, and click-stop logic
- The `<div class="pop-header">` section
- All `<style>` rules (the entire `<style>` block)
- The `scale` and easing imports
- The `open` derived state

Keep:
- The `getViewer3DContext()` call (needed for `viewer.activeFormation` and `viewer.applyFormationFromUI`)
- The `FormationSelector` import and usage
- The `PRESET_VALID_COUNTS` import and `disabledPresets` derived
- The `handleFormationChange` function

The file becomes:

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import FormationSelector from "./FormationSelector.svelte";
  import { PRESET_VALID_COUNTS } from "@austencloud/scene-3d";
  import type { FormationPreset } from "@austencloud/scene-3d";

  const viewer = getViewer3DContext();
  const performerCount = $derived(viewer.performerManager.performers.length);

  const disabledPresets = $derived.by(() => {
    const disabled = new Set<FormationPreset>();
    for (const [preset, validCounts] of Object.entries(PRESET_VALID_COUNTS)) {
      if (!validCounts.includes(performerCount)) {
        disabled.add(preset as FormationPreset);
      }
    }
    return disabled;
  });

  function handleFormationChange(preset: FormationPreset) {
    viewer.applyFormationFromUI(preset);
  }
</script>

<div
  style="--theme-panel-bg: rgba(0,0,0,0.3); --theme-stroke: rgba(255,255,255,0.08); --theme-text-dim: rgba(255,255,255,0.5); --theme-text: rgba(255,255,255,0.9); --theme-card-hover-bg: rgba(255,255,255,0.08); --theme-accent: color-mix(in srgb, #60a5fa 30%, transparent);"
>
  <FormationSelector
    value={viewer.activeFormation === "manual" ? "grid-2x2" : viewer.activeFormation}
    {performerCount}
    {disabledPresets}
    onchange={handleFormationChange}
  />
</div>
```

The CSS vars were previously set on `.pop-body` — FormationSelector reads them for theming. The wrapper div preserves them.

The old FormationPopover also had a `:global(.formation-btn.active)` style rule. Check if FormationSelector already handles its own active state styling. If it does, no additional style needed here. If not, add:

```svelte
<style>
  div :global(.formation-btn.active) {
    background: color-mix(in srgb, #60a5fa 25%, transparent);
    border: 1px solid color-mix(in srgb, #60a5fa 45%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, #60a5fa 18%, transparent);
  }
</style>
```

- [ ] **Step 2: Update RightRail to use ViewerPopover for formation**

In `RightRail.svelte`:

Add import:
```typescript
import ViewerPopover from "$lib/shared/3d/components/controls/ViewerPopover.svelte";
```

Replace the formation chip+popover block (lines ~87-98). The current pattern:
```svelte
<div class="chip-wrap">
  <button class="rail-chip" aria-pressed={viewer.activePopover === chip.id} ...>
    <i class="fas {chip.icon}"></i>
  </button>
  {#if chip.id === "formation"}
    <FormationPopover />
  {:else if ...}
```

Changes to a two-pass approach. First, update the global chips loop. Replace the `{#each CHIPS_3D_GLOBAL as chip}` block with individual `<ViewerPopover>` calls for each chip, since each popover has different content. The chip button is now owned by ViewerPopover (via `asChild` trigger), so the `<button class="rail-chip">` inside the loop is removed for migrated popovers.

For formation specifically:
```svelte
<ViewerPopover id="formation" title="Formation" icon="fa-users" tooltip="Formation">
  <FormationPopover />
</ViewerPopover>
```

**Do NOT migrate all 9 popovers in this step.** Only formation. The remaining global chips keep the old pattern for now. The `{#each}` loop will be progressively replaced in subsequent tasks.

To make this work incrementally: extract formation out of the loop and render it before the loop. The loop continues for the remaining 5 global chips:

```svelte
{#if renderMode === "3d"}
  <!-- Formation: migrated to ViewerPopover -->
  <ViewerPopover id="formation" title="Formation" icon="fa-users" tooltip="Formation">
    <FormationPopover />
  </ViewerPopover>

  <!-- Remaining global chips (not yet migrated) -->
  {#each CHIPS_3D_GLOBAL.filter(c => c.id !== "formation") as chip (chip.id)}
    <div class="chip-wrap">
      <!-- ... existing pattern ... -->
    </div>
  {/each}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/controls/FormationPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "refactor(viewer): migrate FormationPopover to ViewerPopover (Bits UI)"
```

---

## Task 3: Migrate TempoPopover and ExportPopover

Two simple global popovers with no performer scoping. Tempo has custom width (340px) and passes through `bpm`/`onBpmChange` props. Export also uses 340px width.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/TempoPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ExportPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

- [ ] **Step 1: Strip TempoPopover to content-only**

```svelte
<script lang="ts">
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";

  interface Props {
    bpm: number;
    onBpmChange: (bpm: number) => void;
  }
  let { bpm, onBpmChange }: Props = $props();
</script>

<BpmChips {bpm} variant="full" {onBpmChange} />
```

Remove: viewer context import (no longer needed), `open` derived, all positioning/animation/escape logic, entire `<style>` block.

- [ ] **Step 2: Strip ExportPopover to content-only**

Remove the outer `<div class="pop">` wrapper, `pop-header`, all positioning/animation styles. Keep all the export content (resolution chips, quality chips, FPS chips, advanced toggle, loop count stepper) and their styles.

The component keeps its own `<style>` block for the content-specific styles (`.row`, `.row-label`, `.chips`, `.chip`, `.advanced-toggle`, `.stepper`, etc.) but removes the `.pop` and `.pop-header` rules.

```svelte
<script lang="ts">
  import {
    getExportOptionsState,
    type VideoFps,
    type VideoResolution,
    type VideoQuality,
  } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";
  import { slide } from "svelte/transition";

  const opts = getExportOptionsState();

  let advancedOpen = $state(false);

  const RESOLUTIONS: VideoResolution[] = [720, 1080, 2160, 4320];
  function resLabel(r: VideoResolution): string {
    return r === 2160 ? "4K" : r === 4320 ? "8K" : String(r);
  }
  const QUALITIES: VideoQuality[] = ["standard", "cinema"];
  function qualityLabel(q: VideoQuality): string {
    return q === "cinema" ? "Cinema" : "Standard";
  }
  const FPS_OPTIONS: VideoFps[] = [30, 60, 120];
</script>

<div class="export-content">
  <div class="row">
    <div class="row-label">Resolution</div>
    <div class="chips">
      {#each RESOLUTIONS as r (r)}
        <button
          class="chip"
          class:active={opts.videoResolution === r}
          onclick={() => opts.setVideoResolution(r)}
          aria-pressed={opts.videoResolution === r}
        >
          {resLabel(r)}
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <div class="row-label">Quality</div>
    <div class="chips">
      {#each QUALITIES as q (q)}
        <button
          class="chip"
          class:active={opts.videoQuality === q}
          onclick={() => opts.setVideoQuality(q)}
          aria-pressed={opts.videoQuality === q}
        >
          {qualityLabel(q)}
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <div class="row-label">FPS</div>
    <div class="chips">
      {#each FPS_OPTIONS as f (f)}
        <button
          class="chip"
          class:active={opts.videoFps === f}
          onclick={() => opts.setVideoFps(f)}
          aria-pressed={opts.videoFps === f}
        >
          {f}
        </button>
      {/each}
    </div>
  </div>

  <button
    class="advanced-toggle"
    onclick={() => (advancedOpen = !advancedOpen)}
    aria-expanded={advancedOpen}
  >
    <i class="fas fa-chevron-{advancedOpen ? 'down' : 'right'}"></i>
    Advanced
  </button>

  {#if advancedOpen}
    <div class="advanced" transition:slide={{ duration: 180 }}>
      <div class="row">
        <div class="row-label">Loop count</div>
        <div class="stepper">
          <button
            class="step-btn"
            onclick={() => opts.setVideoLoopCount(opts.videoLoopCount - 1)}
            aria-label="Decrease loop count"
            disabled={opts.videoLoopCount <= 1}
          >
            <i class="fas fa-minus"></i>
          </button>
          <span class="step-value">{opts.videoLoopCount}</span>
          <button
            class="step-btn"
            onclick={() => opts.setVideoLoopCount(opts.videoLoopCount + 1)}
            aria-label="Increase loop count"
            disabled={opts.videoLoopCount >= 10}
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .export-content { display: flex; flex-direction: column; gap: 14px; }
  .row { display: flex; flex-direction: column; gap: 8px; }
  .row-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: rgba(255,255,255,0.52);
  }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    flex: 1 1 auto; min-width: 56px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    color: rgba(255,255,255,0.72);
    font-size: 12px; font-weight: 600;
    cursor: pointer;
    transition: all 140ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .chip:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.95); }
  .chip.active {
    background: color-mix(in srgb, #4a9eff 22%, transparent);
    border-color: color-mix(in srgb, #4a9eff 55%, transparent);
    color: #cfe4ff;
  }
  .advanced-toggle {
    background: none; border: none;
    padding: 4px 0; margin-top: 2px;
    color: rgba(255,255,255,0.58);
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    align-self: flex-start;
  }
  .advanced-toggle:hover { color: rgba(255,255,255,0.92); }
  .advanced-toggle i { font-size: 10px; width: 10px; }
  .advanced { display: flex; flex-direction: column; gap: 14px; }
  .stepper {
    display: flex; align-items: center; gap: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    padding: 4px;
    align-self: flex-start;
  }
  .step-btn {
    width: 28px; height: 28px;
    background: transparent; border: none; border-radius: 8px;
    color: rgba(255,255,255,0.82);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
  }
  .step-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  .step-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .step-value {
    min-width: 24px; text-align: center;
    color: rgba(255,255,255,0.95);
    font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
</style>
```

Remove: viewer context, `open` derived, `scale`/`backOut`/`cubicOut` imports, the `.pop` and `.pop-header` style rules, the outer `role="dialog"` div with all event handlers.

- [ ] **Step 3: Update RightRail for tempo and export**

Extract tempo and export from the loop, render as ViewerPopover:

```svelte
<ViewerPopover id="tempo" title="Tempo" icon="fa-gauge" tooltip="Speed" width={340}>
  <TempoPopover {bpm} {onBpmChange} />
</ViewerPopover>

<ViewerPopover id="export" title="Export" icon="fa-arrow-up-from-bracket" tooltip="Export" width={340}>
  <ExportPopover />
</ViewerPopover>
```

Update the CHIPS_3D_GLOBAL filter to exclude "tempo" and "export" as well.

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/TempoPopover.svelte src/lib/shared/sequence-viewer/components/ExportPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "refactor(viewer): migrate TempoPopover and ExportPopover to ViewerPopover"
```

---

## Task 4: Migrate CameraPopover, PlanesPopover, SceneSelectorPopover

Three more global popovers. Camera uses 300px width. Planes uses 320px. Scene uses 320px.

**Files:**
- Modify: `src/lib/shared/3d/components/CameraPopover.svelte`
- Modify: `src/lib/shared/3d/components/PlanesPopover.svelte`
- Modify: `src/lib/shared/3d/components/SceneSelectorPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

- [ ] **Step 1: Strip CameraPopover to content-only**

```svelte
<script lang="ts">
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
</script>

<Viewer3DViewPresets grid />
```

Remove: viewer context, `open` derived, all positioning/animation/escape, entire `<style>` block.

- [ ] **Step 2: Strip PlanesPopover to content-only**

Keep all the plane matrix UI, hand slots, label toggle, reset button, and their styles. Remove: the outer `.planes-popover` wrapper with positioning/animation/escape, the `.pop-header` section.

The component keeps its `<script>` (viewer context needed for plane state), its content markup, and its content-specific styles. Remove only:
- The outer `{#if open}` guard
- The `<div class="planes-popover" role="dialog" ...>` wrapper
- The `<div class="pop-header">` section
- The `.planes-popover`, `.pop-header`, `.pop-title` style rules
- The `open` derived, `scale`/easing imports

```svelte
<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";
  import { getViewer3DContext } from "../context/viewer-3d-context";

  const viewer = getViewer3DContext();
  const avatarState = $derived(viewer.performerManager.performers[0] ?? null);

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  const bluePlane = $derived(avatarState?.customBluePlane ?? Plane.WALL);
  const redPlane = $derived(avatarState?.customRedPlane ?? Plane.WALL);

  function hasHandOnPlane(plane: Plane): boolean {
    return bluePlane === plane || redPlane === plane;
  }

  function isVisible(plane: Plane): boolean {
    return viewer.visiblePlanes.has(plane);
  }

  const isPlaneStateNonDefault = $derived(
    (avatarState?.customBluePlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.customRedPlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.hasStepOverrides ?? false) ||
    viewer.visiblePlanes.size > 0
  );

  const hasStepOverrides = $derived(avatarState?.hasStepOverrides ?? false);

  function handlePlaneToggleClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    viewer.togglePlane(plane);
  }

  function handleHandSlotClick(e: MouseEvent, hand: "blue" | "red", plane: Plane) {
    e.stopPropagation();
    if (!avatarState) return;
    const currentPlane = hand === "blue" ? bluePlane : redPlane;
    if (currentPlane === plane) return;
    viewer.setHandPlaneScoped(hand, plane);
  }

  function handleResetPlanesClick(e: MouseEvent) {
    e.stopPropagation();
    if (!avatarState) return;
    viewer.setHandPlaneScoped("blue", Plane.WALL);
    viewer.setHandPlaneScoped("red", Plane.WALL);
    for (const p of viewer.scopedPerformers()) {
      p.clearBeatPlaneOverrides();
    }
    viewer.hideAllPlanes();
  }
</script>

<div class="planes-content">
  <div class="plane-matrix">
    {#each PLANES as { plane, label }}
      {@const handAssigned = hasHandOnPlane(plane)}
      {@const visible = isVisible(plane)}
      {@const color = PLANE_COLORS[plane]}
      <div
        class="plane-row"
        class:with-hand={handAssigned}
        class:hidden-row={!visible}
      >
        <div class="plane-left">
          <button
            class="plane-toggle"
            class:visible
            class:hidden={!visible}
            style="--dot-color: {color};"
            onclick={(e) => handlePlaneToggleClick(e, plane)}
            aria-pressed={visible}
            aria-label={`${label} plane - ${visible ? 'visible, click to hide' : 'hidden, click to show'}`}
          >
            <i
              class="plane-eye {visible ? 'fas fa-eye' : 'fas fa-eye-slash'}"
              aria-hidden="true"
            ></i>
          </button>
          <span class="plane-label">{label}</span>
        </div>
        <div class="plane-right">
          <button
            class="hand-slot blue"
            class:filled={bluePlane === plane}
            onclick={(e) => handleHandSlotClick(e, "blue", plane)}
            aria-pressed={bluePlane === plane}
            aria-label={`Blue hand on ${label}`}
          ></button>
          <button
            class="hand-slot red"
            class:filled={redPlane === plane}
            onclick={(e) => handleHandSlotClick(e, "red", plane)}
            aria-pressed={redPlane === plane}
            aria-label={`Red hand on ${label}`}
          ></button>
        </div>
      </div>
    {/each}
  </div>

  <div class="label-toggle-row">
    <span class="toggle-label">Location labels</span>
    <button
      class="label-toggle"
      class:active={viewer.showGridLabels}
      onclick={(e) => { e.stopPropagation(); viewer.toggleGridLabels(); }}
      aria-pressed={viewer.showGridLabels}
      aria-label="Toggle grid location labels"
    >
      <span class="toggle-track">
        <span class="toggle-thumb"></span>
      </span>
    </button>
  </div>

  {#if isPlaneStateNonDefault}
    <div class="planes-footer">
      <button
        class="reset-btn"
        class:with-overrides={hasStepOverrides}
        onclick={handleResetPlanesClick}
        aria-label={hasStepOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
        title={hasStepOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
        </svg>
        Reset
        {#if hasStepOverrides}
          <span class="override-badge" aria-hidden="true"></span>
        {/if}
      </button>
    </div>
  {/if}
</div>

<!-- Keep all content-specific styles, remove only .planes-popover, .pop-header, .pop-title -->
```

Rename `.pop-footer` to `.planes-footer` to avoid collision with ViewerPopover's `.pop-footer`.

- [ ] **Step 3: Strip SceneSelectorPopover to content-only**

```svelte
<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";
  import SceneFeatureTiles from "../scene-features/components/SceneFeatureTiles.svelte";
  import { tryGetSceneFeatureContext } from "../scene-features/context/scene-feature-context";

  const currentBg = $derived(settingsService.settings.backgroundType);
  const hasSceneFeatures = tryGetSceneFeatureContext() !== undefined;

  function selectScene(e: MouseEvent, type: BackgroundType) {
    e.stopPropagation();
    settingsService.updateSetting("backgroundType", type);
  }
</script>

<div class="scene-content">
  <div class="scene-grid">
    {#each ANIMATED_BACKGROUNDS as bg}
      <button
        class="scene-tile"
        class:active={currentBg === bg.type}
        onclick={(e) => selectScene(e, bg.type)}
        aria-pressed={currentBg === bg.type}
        aria-label={bg.label}
        title={bg.label}
      >
        <i class="fas {bg.icon}" aria-hidden="true"></i>
        <span class="tile-label">{bg.label}</span>
      </button>
    {/each}
  </div>

  {#if hasSceneFeatures}
    <div class="section-divider"></div>
    <SceneFeatureTiles />
  {/if}
</div>

<!-- Keep scene-grid, scene-tile, section-divider styles -->
<!-- Remove .scene-popover, .pop-header, .pop-title rules -->
```

Remove: viewer context (no longer needed), `open` derived, all positioning/animation/escape.

- [ ] **Step 4: Update RightRail for camera, planes, scene**

```svelte
<ViewerPopover id="camera" title="Camera" icon="fa-video" tooltip="Camera" width={300}>
  <CameraPopover />
</ViewerPopover>

<ViewerPopover id="planes" title="Planes" icon="fa-layer-group" tooltip="Planes" width={320}>
  <PlanesPopover />
</ViewerPopover>

<ViewerPopover id="scene" title="Scene" icon="fa-mountain-sun" tooltip="Scene" width={320}>
  <SceneSelectorPopover />
</ViewerPopover>
```

Now all 6 global chips are migrated. The `CHIPS_3D_GLOBAL` loop is gone entirely. Remove the `CHIPS_3D_GLOBAL` constant and the `onChipClick` function (ViewerPopover handles click via Bits UI trigger).

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/CameraPopover.svelte src/lib/shared/3d/components/PlanesPopover.svelte src/lib/shared/3d/components/SceneSelectorPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "refactor(viewer): migrate Camera, Planes, Scene popovers to ViewerPopover"
```

---

## Task 5: Migrate EffectsPopover and EffortPopover (Performer-Scoped)

These are performer-scoped popovers — they use `accentColor` (performer color) and `performerScoped` flag.

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EffectsPopover.svelte`
- Modify: `src/lib/shared/3d/components/controls/EffortPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

- [ ] **Step 1: Strip EffectsPopover to content-only**

```svelte
<script lang="ts">
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
</script>

<div class="effects-content">
  <MobileEffectsPanel layout="grid" />
</div>

<style>
  .effects-content {
    max-height: 70vh;
    overflow-y: auto;
  }
</style>
```

Remove: viewer context, `open`/`selectedIndex`/`performerColor`/`performerLabel` derived states, all positioning/animation/escape, all popover-level styles. Keep max-height scroll on the content wrapper — the effects panel can be tall and needs internal scrolling. The performer label and badge are now handled by ViewerPopover's `title` and `accentColor` props.

- [ ] **Step 2: Strip EffortPopover to content-only**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });
</script>

{#if selected}
  <EffortPalette
    selectedEffort={selected.settings.effortId ?? "linear"}
    onSelect={(e) => selected.setEffort(e)}
  />
{/if}
```

Keep: viewer context (needed for `selected` performer), `selected` derived. Remove: `open`, `performerColor`, `performerLabel`, positioning/animation/escape, all popover styles.

Add CSS vars that EffortPalette needs as a wrapper div if they were previously set on `.pop-body`:

```svelte
{#if selected}
  <div style="--theme-stroke: rgba(255,255,255,0.1); --theme-card-bg: rgba(255,255,255,0.04); --theme-text-dim: rgba(255,255,255,0.5);">
    <EffortPalette
      selectedEffort={selected.settings.effortId ?? "linear"}
      onSelect={(e) => selected.setEffort(e)}
    />
  </div>
{/if}
```

- [ ] **Step 3: Update RightRail for effects and effort performer-scoped popovers**

Replace the performer chips loop. ViewerPopover needs performer color and scoping info:

```svelte
{#if hasPerformerSelected}
  <div
    class="performer-separator"
    transition:slide|local={{ duration: 220, axis: "y" }}
    aria-hidden="true"
  >
    <div class="separator-line"></div>
  </div>

  <div transition:slide|local={{ duration: 220, axis: "y" }}>
    <ViewerPopover
      id="effects"
      title={`Performer ${(selectedIndex ?? 0) + 1}`}
      icon="fa-wand-magic-sparkles"
      tooltip="Effects"
      accentColor={performerColor}
      performerScoped
    >
      <EffectsPopover />
    </ViewerPopover>
  </div>

  <div transition:slide|local={{ duration: 220, axis: "y" }}>
    <ViewerPopover
      id="prop"
      title={`Performer ${(selectedIndex ?? 0) + 1}`}
      icon="fa-staff-snake"
      tooltip="Prop"
      accentColor={performerColor}
      performerScoped
    >
      <PropPopover />
    </ViewerPopover>
  </div>

  <div transition:slide|local={{ duration: 220, axis: "y" }}>
    <ViewerPopover
      id="effort"
      title={`Performer ${(selectedIndex ?? 0) + 1}`}
      icon="fa-wave-square"
      tooltip="Effort"
      accentColor={performerColor}
      performerScoped
    >
      <EffortPopover />
    </ViewerPopover>
  </div>
{/if}
```

The `CHIPS_PERFORMER` constant and the performer chips `{#each}` loop are now gone. Remove `CHIPS_PERFORMER`.

**Note:** PropPopover is NOT yet migrated to content-only in this task — it still renders its own wrapper internally. That's fine. ViewerPopover wraps it in a Bits UI popover, and PropPopover's internal `{#if open}` will need to be removed in Task 8. For now, PropPopover opens when `viewer.activePopover === "prop"` via its own `open` derived — it will render its content inside ViewerPopover's portal. This creates a double-wrapper temporarily but is correct because ViewerPopover provides positioning and PropPopover provides content. The old positioning CSS in PropPopover (`.prop-popover { position: absolute; right: calc(...) }`) will be overridden by the portal positioning, so it will visually work but be messy. Better approach: temporarily guard PropPopover's content with a simple check and remove the absolute positioning in this task:

Actually, the cleaner approach: in this step, also strip PropPopover of its outer positioning wrapper. Remove:
- `position: absolute; right: calc(100% + 10px); top: 0; z-index: 100;` from `.prop-popover`
- The `in:scale` and `out:scale` transitions (ViewerPopover handles animation)
- The `.pop-header` section (ViewerPopover handles header)

But keep the `{#if open && selected}` guard for now — it ensures the content only renders when the popover is actually open and a performer is selected. This guard will be removed in Task 8 when PropPopover is fully rewritten.

Minimal changes to PropPopover in this step:
```css
/* Remove these lines from .prop-popover */
position: absolute;
right: calc(100% + 10px);
top: 0;
z-index: 100;
transform-origin: top right;
```

Remove the `in:scale` and `out:scale` transition directives from the outer div. Remove the `.pop-header` div.

- [ ] **Step 4: Delete the document-level click handler from RightRail**

Now that all popovers use Bits UI (which handles `onInteractOutside` natively), the `onDocClick` handler in `onMount` is dead code. Remove:

```typescript
// DELETE this entire block from onMount:
function onDocClick(e: MouseEvent) {
  if (!viewer.activePopover) return;
  const target = e.target as Node | null;
  if (!target) return;
  if (rootEl && rootEl.contains(target)) return;
  const popovers = document.querySelectorAll('[role="dialog"]');
  for (const p of popovers) if (p.contains(target)) return;
  viewer.closePopover();
}
document.addEventListener("click", onDocClick);
// And update the cleanup return to remove the removeEventListener line
```

Also remove the `rootEl` state variable and `bind:this={rootEl}` from the root div (no longer needed for click-outside detection).

Remove the `onMount` import if `cleanupKeyboard` can be set up differently — but if keyboard handler still needs `onMount`, keep the import and just the click handler part. Check: `createViewer3DKeyboardHandler` returns a cleanup function, so `onMount` is still needed for that. Keep `onMount`, just remove the click handler code inside it.

- [ ] **Step 5: Clean up RightRail — remove unused constants and functions**

Delete from RightRail:
- `CHIPS_3D_GLOBAL` constant
- `CHIPS_PERFORMER` constant
- `onChipClick` function
- `rootEl` state variable
- `bind:this={rootEl}` from the root div
- The `Chip` interface (no longer used)
- The `onDocClick` function and its event listener setup/teardown

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffectsPopover.svelte src/lib/shared/3d/components/controls/EffortPopover.svelte src/lib/shared/3d/components/controls/PropPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "refactor(viewer): migrate Effects, Effort, Prop popovers to ViewerPopover; delete document click handler"
```

---

## Task 6: Add darkBackground Prop to PropCompositionPreview

Centralize the brightness/saturation filter so consumers don't each hand-roll it.

**Files:**
- Modify: `src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte`

- [ ] **Step 1: Add darkBackground prop and CSS class**

In PropCompositionPreview.svelte, add the prop:

```typescript
let {
  propType,
  size = 64,
  recipeOverride = undefined,
  darkBackground = false,
}: {
  propType: PropType;
  size?: number;
  recipeOverride?: CompositionRecipe;
  darkBackground?: boolean;
} = $props();
```

Add the class to the SVG element:

```svelte
<svg
  class="prop-composition-preview"
  class:dark-bg={darkBackground}
  width={size}
  height={size}
  viewBox="0 0 100 100"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
```

Add CSS rules:

```css
.prop-composition-preview.dark-bg {
  filter: brightness(1.8) saturate(1.4);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte
git commit -m "feat(prop): add darkBackground prop to PropCompositionPreview"
```

---

## Task 7: Add Registry-Driven Prop Categories

Add `PropCategory` type and `getBasePropsByCategory()` to the registry so PropPopover can derive its grid from data instead of hardcoding.

**Files:**
- Modify: `src/lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts`

- [ ] **Step 1: Add PropCategory type, category field, and PROP_CATEGORIES array**

At the top of `PropTypeDisplayRegistry.ts`, after the `PropType` import, add:

```typescript
export type PropCategory = "staves-clubs" | "curved" | "novelty" | "singles";

export const PROP_CATEGORIES: { id: PropCategory; label: string }[] = [
  { id: "staves-clubs", label: "Staves & Clubs" },
  { id: "curved", label: "Curved Props" },
  { id: "novelty", label: "Novelty" },
  { id: "singles", label: "Singles" },
];
```

Extend `PropTypeDisplayInfo`:

```typescript
export interface PropTypeDisplayInfo {
  label: string;
  image: string;
  category?: PropCategory;
}
```

Add `category` to each BASE prop entry in `PROP_TYPE_DISPLAY_REGISTRY`. Variant props do NOT get a category — they inherit from their base via `getBasePropType()`.

```typescript
// === STAFF FAMILY ===
[PropType.STAFF]: { label: "Staff", image: "/images/props/buttons/staff.svg?v=2", category: "staves-clubs" },
[PropType.SIMPLESTAFF]: { label: "Simple Staff", image: "/images/props/buttons/simple_staff.svg?v=2" },
[PropType.BIGSTAFF]: { label: "Big Staff", image: "/images/props/buttons/bigstaff.svg?v=2" },
[PropType.STAFF2]: { label: "Staff V2", image: "/images/props/buttons/staff_v2.svg?v=2" },

// === CLUB FAMILY ===
[PropType.CLUB]: { label: "Club", image: "/images/props/buttons/club.svg", category: "staves-clubs" },
[PropType.BIGCLUB]: { label: "Big Club", image: "/images/props/buttons/bigclub.svg" },

// === FAN FAMILY ===
[PropType.FAN]: { label: "Fan", image: "/images/props/buttons/fan.svg", category: "staves-clubs" },
[PropType.BIGFAN]: { label: "Big Fan", image: "/images/props/buttons/bigfan.svg" },

// === TRIAD FAMILY ===
[PropType.TRIAD]: { label: "Triad", image: "/images/props/buttons/triad.svg", category: "curved" },
[PropType.BIGTRIAD]: { label: "Big Triad", image: "/images/props/buttons/bigtriad.svg" },

// === HOOP FAMILY ===
[PropType.MINIHOOP]: { label: "Mini Hoop", image: "/images/props/buttons/minihoop.svg", category: "curved" },
[PropType.BIGHOOP]: { label: "Big Hoop", image: "/images/props/buttons/bighoop.svg" },

// === BUUGENG FAMILY ===
[PropType.BUUGENG]: { label: "Buugeng", image: "/images/props/buttons/buugeng.svg", category: "curved" },
[PropType.BIGBUUGENG]: { label: "Big Buugeng", image: "/images/props/buttons/bigbuugeng.svg" },
[PropType.FRACTALGENG]: { label: "Fractalgeng", image: "/images/props/buttons/fractalgeng.svg" },

// === TRIGENG FAMILY ===
[PropType.TRIGENG]: { label: "Trigeng", image: "/images/props/buttons/trigeng.svg", category: "curved" },

// === TRIQUETRA FAMILY ===
[PropType.TRIQUETRA]: { label: "Triquetra", image: "/images/props/buttons/triquetra.svg", category: "curved" },
[PropType.TRIQUETRA2]: { label: "Triquetra 2", image: "/images/props/buttons/triquetra2.svg" },

// === HAND ===
[PropType.HAND]: { label: "Hand", image: "/images/props/buttons/hand.svg", category: "singles" },

// === SWORD ===
[PropType.SWORD]: { label: "Sword", image: "/images/props/buttons/sword.svg", category: "singles" },

// === CHICKEN FAMILY ===
[PropType.CHICKEN]: { label: "Chicken", image: "/images/props/buttons/chicken.svg", category: "novelty" },
[PropType.BIGCHICKEN]: { label: "Big Chicken", image: "/images/props/buttons/bigchicken.svg" },

// === GUITAR FAMILY ===
[PropType.GUITAR]: { label: "Guitar", image: "/images/props/buttons/guitar.svg", category: "novelty" },
[PropType.UKULELE]: { label: "Ukulele", image: "/images/props/buttons/ukulele.svg" },

// === DOUBLESTAR FAMILY ===
[PropType.DOUBLESTAR]: { label: "Double Star", image: "/images/props/buttons/doublestar.svg", category: "novelty" },
[PropType.BIGDOUBLESTAR]: { label: "Big Double Star", image: "/images/props/buttons/bigdoublestar.svg" },

// === EIGHTRINGS FAMILY ===
[PropType.EIGHTRINGS]: { label: "Eight Rings", image: "/images/props/buttons/eightrings.svg", category: "novelty" },
[PropType.BIGEIGHTRINGS]: { label: "Big Eight Rings", image: "/images/props/buttons/bigeightrings.svg" },

// === QUIAD ===
[PropType.QUIAD]: { label: "Quiad", image: "/images/props/buttons/quiad.svg", category: "singles" },

// === TORCH FAMILY ===
[PropType.TORCH]: { label: "Torch", image: "/images/props/buttons/torch.svg", category: "novelty" },
[PropType.BIGTORCH]: { label: "Big Torch", image: "/images/props/buttons/bigtorch.svg" },

// === CONTACT BALL FAMILY ===
[PropType.CONTACTBALL]: { label: "Contact Ball", image: "/images/props/buttons/contactball.svg", category: "novelty" },
[PropType.BIGCONTACTBALL]: { label: "Big Contact Ball", image: "/images/props/buttons/bigcontactball.svg" },
[PropType.DOUBLECONTACTBALL]: { label: "Double Contact Ball", image: "/images/props/buttons/doublecontactball.svg", category: "novelty" },
[PropType.BIGDOUBLECONTACTBALL]: { label: "Big Double Contact Ball", image: "/images/props/buttons/bigdoublecontactball.svg" },

// === POI FAMILY ===
[PropType.POI]: { label: "Poi", image: "/images/props/buttons/club.svg", category: "novelty" },
```

Note: `DOUBLECONTACTBALL` gets its own `category` because it's now standalone (its base `CONTACTBALL` is deactivated).

- [ ] **Step 2: Add getBasePropsByCategory() function**

After the existing exports at the bottom of the file:

```typescript
export function getBasePropsByCategory(): Map<PropCategory, PropType[]> {
  const result = new Map<PropCategory, PropType[]>();
  for (const cat of PROP_CATEGORIES) {
    result.set(cat.id, []);
  }

  for (const [propTypeStr, info] of Object.entries(PROP_TYPE_DISPLAY_REGISTRY)) {
    const propType = propTypeStr as PropType;
    if (!info.category) continue;
    if (!isPropActive(propType)) continue;
    if (VARIANT_PROP_TYPES.includes(propType)) continue;
    result.get(info.category)?.push(propType);
  }

  return result;
}
```

This returns base props grouped by category, filtered by `isPropActive` and excluding variants.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors. The `category` field is optional so existing code compiles without changes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts
git commit -m "feat(prop): add PropCategory type and getBasePropsByCategory() to registry"
```

---

## Task 8: Create PerformerPropSizeSlider

A dedicated per-performer prop size slider with no link toggle, no global mode.

**Files:**
- Create: `src/lib/shared/3d/components/controls/PerformerPropSizeSlider.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { inchesToCm } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "../../state/avatar-instance-state.svelte";

  let { performer }: { performer: AvatarInstanceState } = $props();

  const currentCm = $derived(performer.settings.staffLengthCm ?? 81);
  const displayInches = $derived(Math.round(currentCm / 2.54));
</script>

<div class="prop-size">
  <div class="size-header">
    <span class="size-label">Prop size</span>
    <span class="size-value">{displayInches} in</span>
  </div>
  <input
    type="range"
    class="size-slider"
    min={inchesToCm(24)}
    max={inchesToCm(60)}
    step="1"
    value={currentCm}
    oninput={(e) => performer.setStaffLengthCm(Number(e.currentTarget.value))}
    aria-label="Prop size"
  />
</div>

<style>
  .prop-size {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .size-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .size-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.72);
  }
  .size-value {
    font-size: 12px;
    font-weight: 700;
    color: #cfe4ff;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }
  .size-slider {
    width: 100%;
    height: 6px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    transition: background 180ms;
  }
  .size-slider:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .size-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
    transition: box-shadow 180ms, transform 180ms;
  }
  .size-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 16px rgba(96, 165, 250, 0.55);
    transform: scale(1.1);
  }
  .size-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
  }
</style>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerPropSizeSlider.svelte
git commit -m "feat(viewer): add PerformerPropSizeSlider component"
```

---

## Task 9: Rewrite PropPopover as Content-Only

Replace the hand-rolled positioning, hardcoded `PROP_FAMILIES`, and `forceIndividual` PropSizeControl with registry-driven categories, `darkBackground` on PropCompositionPreview, and PerformerPropSizeSlider in the footer.

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PropPopover.svelte`

- [ ] **Step 1: Rewrite PropPopover**

The entire file becomes content-only. No `{#if open}`, no positioning, no animation, no escape handling, no header, no background styling. ViewerPopover handles all of that.

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    isPropActive,
    getBasePropsByCategory,
    PROP_CATEGORIES,
    type PropCategory,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import PerformerPropSizeSlider from "./PerformerPropSizeSlider.svelte";
  import { getPerformerColor } from "../../constants/performer-colors";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const propCategories = $derived(getBasePropsByCategory());
  const selectedBase = $derived(getBasePropType(selected?.settings.prop ?? PropType.STAFF));
  let expandedFamily = $state<PropType | null>(null);

  const familyVariants = $derived(
    expandedFamily ? getAllVariations(expandedFamily).filter(isPropActive) : [],
  );

  function variantCount(base: PropType): number | undefined {
    const count = getAllVariations(base).filter(isPropActive).length;
    return count > 1 ? count : undefined;
  }

  function handleFamilyClick(base: PropType) {
    if (!selected) return;
    const activeVariants = getAllVariations(base).filter(isPropActive);
    if (activeVariants.length <= 1) {
      selected.setProp(base);
      expandedFamily = null;
    } else {
      expandedFamily = base;
    }
  }

  function handleVariantClick(variant: PropType) {
    if (!selected) return;
    selected.setProp(variant);
  }
</script>

{#if selected}
  <div class="prop-content" style:--pop-accent={performerColor}>
    {#each PROP_CATEGORIES as cat, ci}
      {@const bases = propCategories.get(cat.id) ?? []}
      {#if bases.length > 0}
        {#if ci > 0}
          <div class="divider"></div>
        {/if}
        <div class="tile-row">
          {#each bases as base}
            {@const info = getPropTypeDisplayInfo(base)}
            {@const isSelected = expandedFamily !== null ? expandedFamily === base : selectedBase === base}
            {@const badge = variantCount(base)}
            <button
              class="tile"
              class:selected={isSelected}
              aria-pressed={isSelected}
              aria-label={info.label}
              title={info.label}
              onclick={() => handleFamilyClick(base)}
            >
              {#if badge}
                <span class="badge">{badge}</span>
              {/if}
              <div class="tile-icon">
                <PropCompositionPreview propType={base} size={40} darkBackground />
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  {#if expandedFamily && familyVariants.length > 1}
    <div class="variant-strip" transition:slide={{ duration: 180, easing: cubicOut }}>
      <span class="variant-label">{getPropTypeDisplayInfo(expandedFamily).label} Variants</span>
      <div class="variant-row">
        {#each familyVariants as variant}
          {@const vInfo = getPropTypeDisplayInfo(variant)}
          <button
            class="variant-chip"
            class:active={selected.settings.prop === variant}
            onclick={() => handleVariantClick(variant)}
          >
            <div class="variant-icon">
              <PropCompositionPreview propType={variant} size={32} darkBackground />
            </div>
            <span class="variant-name">{vInfo.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
{/if}

<style>
  .prop-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 0 4px;
  }
  .tile-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tile {
    width: 56px;
    height: 56px;
    background: #000;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    cursor: pointer;
    transition: all 160ms cubic-bezier(0.2, 0, 0.13, 1.5);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 0;
  }
  .tile:hover {
    background: #0a0c14;
    border-color: rgba(255, 255, 255, 0.35);
    transform: scale(1.05);
  }
  .tile.selected {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, #000);
    box-shadow: 0 0 16px color-mix(in srgb, var(--pop-accent) 35%, transparent);
  }
  .tile-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
  }
  .badge {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.14);
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    pointer-events: none;
  }
  .tile.selected .badge {
    background: color-mix(in srgb, var(--pop-accent) 40%, transparent);
    color: var(--pop-accent);
  }
  .variant-strip {
    background: #08090f;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 -14px -14px;
  }
  .variant-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.45);
    padding: 0 2px;
  }
  .variant-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .variant-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 5px;
    background: #000;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
    color: rgba(255, 255, 255, 0.8);
  }
  .variant-chip:hover {
    background: #0a0c14;
    border-color: rgba(255, 255, 255, 0.35);
    color: white;
  }
  .variant-chip.active {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, #000);
    color: white;
    box-shadow: 0 0 12px color-mix(in srgb, var(--pop-accent) 30%, transparent);
  }
  .variant-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .variant-name {
    font-size: 12px;
    font-weight: 600;
  }
</style>
```

Key changes from previous PropPopover:
1. **No outer wrapper with positioning/animation/escape** — ViewerPopover handles all of that
2. **`PROP_FAMILIES` hardcoded array → `getBasePropsByCategory()`** from registry
3. **`<PropCompositionPreview darkBackground />`** — no more per-consumer `filter: brightness(...)` CSS hacks
4. **No `PropSizeControl forceIndividual`** — removed from this file entirely
5. **No `.pop-header`** — ViewerPopover renders it
6. **No `.pop-footer`** — the footer with `PerformerPropSizeSlider` is passed via ViewerPopover's `footer` snippet from RightRail

The `filter: brightness(...)` CSS rules on `.tile-icon :global(.prop-composition-preview)` are REMOVED — the `darkBackground` prop handles this inside PropCompositionPreview itself.

- [ ] **Step 2: Update RightRail to pass footer snippet for PropPopover**

In RightRail.svelte, the prop ViewerPopover needs the footer snippet with the size slider:

```svelte
<ViewerPopover
  id="prop"
  title={`Performer ${(selectedIndex ?? 0) + 1}`}
  icon="fa-staff-snake"
  tooltip="Prop"
  accentColor={performerColor}
  performerScoped
>
  <PropPopover />
  {#snippet footer()}
    {#if viewer.performerManager.performers[selectedIndex ?? 0]}
      <PerformerPropSizeSlider
        performer={viewer.performerManager.performers[selectedIndex ?? 0]}
      />
    {/if}
  {/snippet}
</ViewerPopover>
```

Add import:
```typescript
import PerformerPropSizeSlider from "$lib/shared/3d/components/controls/PerformerPropSizeSlider.svelte";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/controls/PropPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "refactor(viewer): rewrite PropPopover as content-only with registry categories and darkBackground"
```

---

## Task 10: Clean Up — Delete PropSizeControl If Unused

Check if `PropSizeControl.svelte` has any remaining consumers. If not, delete it.

**Files:**
- Possibly delete: `src/lib/shared/sequence-viewer/components/PropSizeControl.svelte`

- [ ] **Step 1: Check for remaining consumers**

Run:
```bash
grep -r "PropSizeControl" src/ --include="*.svelte" --include="*.ts" -l
```

Expected: Only `PropSizeControl.svelte` itself. If PropPopover was the only consumer and we removed the import in Task 9, there are no remaining consumers.

If there ARE remaining consumers: do not delete. Leave PropSizeControl as-is for those consumers.

If there are NO remaining consumers:

- [ ] **Step 2: Delete PropSizeControl**

```bash
git rm src/lib/shared/sequence-viewer/components/PropSizeControl.svelte
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check`
Expected: No new errors. If errors appear referencing PropSizeControl, a consumer was missed — restore the file and skip deletion.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(viewer): delete PropSizeControl (replaced by PerformerPropSizeSlider)"
```

---

## Task 11: Final Verification

Verify all success criteria from the spec are met.

**Files:** None (verification only)

- [ ] **Step 1: Verify zero hand-rolled positioning**

```bash
grep -r "right: calc(100% + 10px)" src/ --include="*.svelte" -l
```

Expected: No results. All popovers now use Bits UI positioning.

- [ ] **Step 2: Verify no forceIndividual**

```bash
grep -r "forceIndividual" src/ --include="*.svelte" --include="*.ts" -l
```

Expected: Only `PropSizeControl.svelte` if it wasn't deleted (it still has the prop definition). If deleted, no results.

- [ ] **Step 3: Verify darkBackground is used**

```bash
grep -r "darkBackground" src/ --include="*.svelte" -l
```

Expected: `PropCompositionPreview.svelte` (definition) and `PropPopover.svelte` (usage).

- [ ] **Step 4: Verify registry-driven categories**

```bash
grep -r "PROP_FAMILIES" src/ --include="*.svelte" --include="*.ts" -l
```

Expected: No results. The hardcoded array is replaced by `getBasePropsByCategory()`.

- [ ] **Step 5: Full typecheck**

Run: `npm run check`
Expected: No new errors beyond the pre-existing 8 in ScenePostProcessing, Grid3D, ComposedObject, VoidLab.

- [ ] **Step 6: Full build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit (if any cleanup needed)**

Only if verification steps revealed issues that needed fixing. Otherwise, no commit needed.

---

## Spec Coverage Verification

| Spec Requirement | Task |
|---|---|
| All 9 popovers render via Bits UI | Tasks 2-5 |
| Zero hand-rolled `position: absolute; right: calc(100% + 10px)` | Tasks 2-5, verified in Task 11 |
| PropCompositionPreview `darkBackground` prop | Task 6 |
| PropPopover derives families from registry | Tasks 7, 9 |
| No `forceIndividual` flag | Tasks 8, 9 |
| Focus trapping (Bits UI built-in) | Task 1 (ViewerPopover uses Bits UI Popover) |
| Escape and click-outside dismissal (Bits UI built-in) | Task 1 (ViewerPopover), Task 5 (delete doc handler) |
| `npm run check` passes | Every task |
| PerformerPropSizeSlider replaces PropSizeControl in popover | Tasks 8, 9 |
| Document click handler deleted from RightRail | Task 5 |
| ViewerPopover state sync with viewer.activePopover | Task 1 |
