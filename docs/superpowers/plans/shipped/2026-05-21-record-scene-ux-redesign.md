# Record Scene UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Record Scene performer-reset bug and separate recording mode (Free/Orbit) from view-snapping, with a compact inline toggle next to the Record button.

**Architecture:** Remove `jumpToStep(0)` and forced playback from ExportCoordinator. Create a new `RecordingModeToggle` component following the CameraPresetBar pattern. Strip the 7-tile camera grid from ExportPopover. The toggle writes to the existing `cameraChoreography.activePresetId` state, constrained to `"free" | "auto-orbit"`.

**Tech Stack:** Svelte 5 (runes), TypeScript, existing camera-choreography state

**Spec:** `docs/superpowers/specs/2026-05-21-record-scene-ux-redesign.md`

---

### Task 1: Fix the performer-reset bug in ExportCoordinator

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportCoordinator.svelte.ts:175-177`

- [ ] **Step 1: Remove jumpToStep(0) and forced playback start**

In `ExportCoordinator.svelte.ts`, replace lines 175–177:

```typescript
// BEFORE (lines 175-177):
      const pc = playbackController!;
      pc.jumpToStep(0);
      if (!isPlayingLocal) pc.togglePlayback();

// AFTER:
      const pc = playbackController!;
```

Remove `pc.jumpToStep(0)` entirely — recording captures the scene as-is.
Remove `if (!isPlayingLocal) pc.togglePlayback()` — don't force playback start. The user controls playback independently.

- [ ] **Step 2: Fix the post-recording playback toggle**

Line 214 currently reads:

```typescript
      if (isPlayingLocal) pc.togglePlayback();
```

This was the mirror of the forced-start: it stopped playback after recording if it was playing before. Since we no longer force-start, this line should be removed too — recording should leave playback state unchanged.

Replace line 214:

```typescript
// BEFORE:
      if (isPlayingLocal) pc.togglePlayback();

// AFTER:
      // (removed — recording doesn't alter playback state)
```

- [ ] **Step 3: Verify build passes**

Run: `npm run check`
Expected: No type errors related to ExportCoordinator.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportCoordinator.svelte.ts
git commit -m "fix(record-scene): remove jumpToStep(0) and forced playback — recording captures scene as-is"
```

---

### Task 2: Create RecordingModeToggle component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/record-scene/RecordingModeToggle.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import type { CameraPresetId } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";

  type RecordingMode = "free" | "auto-orbit";

  interface Props {
    mode: RecordingMode;
    onToggle: (mode: RecordingMode) => void;
  }

  let { mode, onToggle }: Props = $props();

  function handleClick() {
    onToggle(mode === "free" ? "auto-orbit" : "free");
  }
</script>

<div class="mode-segment" role="radiogroup" aria-label="Recording camera mode">
  <button
    type="button"
    class="segment-btn"
    class:seg-active={mode === "free"}
    onclick={handleClick}
    role="radio"
    aria-checked={mode === "free"}
    aria-label="Free camera — record manual camera movement"
  >
    <i class="fas fa-hand-paper segment-icon" aria-hidden="true"></i>
    {#if mode === "free"}
      <span class="segment-label">Free</span>
    {/if}
  </button>
  <button
    type="button"
    class="segment-btn"
    class:seg-active={mode === "auto-orbit"}
    onclick={handleClick}
    role="radio"
    aria-checked={mode === "auto-orbit"}
    aria-label="Orbit — camera auto-orbits during recording"
  >
    <i class="fas fa-sync-alt segment-icon" aria-hidden="true"></i>
    {#if mode === "auto-orbit"}
      <span class="segment-label">Orbit</span>
    {/if}
  </button>
</div>

<style>
  .mode-segment {
    display: flex;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 4px;
    backdrop-filter: blur(8px);
  }

  .segment-btn {
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: 0 0.75rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .segment-btn:hover {
    color: var(--theme-text, white);
    background: var(--theme-card-hover-bg);
  }

  .segment-btn.seg-active {
    color: white;
    background: var(--theme-accent);
  }

  .segment-icon {
    font-size: 13px;
  }

  .segment-label {
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .mode-segment {
      padding: 2px;
    }

    .segment-btn {
      padding: 0 0.5rem;
      font-size: var(--font-size-compact, 0.75rem);
    }
  }
</style>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run check`
Expected: No type errors. Component compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/record-scene/RecordingModeToggle.svelte
git commit -m "feat(record-scene): add RecordingModeToggle compact segmented control"
```

---

### Task 3: Wire RecordingModeToggle into RecordSceneChrome

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte:484-489`

- [ ] **Step 1: Update RecordSceneChrome to accept choreography state and render the toggle**

Replace the full contents of `RecordSceneChrome.svelte`:

```svelte
<script lang="ts">
  import RecordSceneRecordButton from "./RecordSceneRecordButton.svelte";
  import RecordingModeToggle from "./RecordingModeToggle.svelte";
  import type { CameraChoreographyState } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";

  interface Props {
    isExporting: boolean;
    canvasReady: boolean;
    onExport: () => void;
    choreography: CameraChoreographyState;
  }

  let { isExporting, canvasReady, onExport, choreography }: Props = $props();

  const currentMode = $derived(
    choreography.activePresetId === "auto-orbit" ? "auto-orbit" as const : "free" as const
  );

  function handleModeToggle(mode: "free" | "auto-orbit") {
    choreography.setPresetId(mode);
  }
</script>

<div class="chrome-root">
  <div class="bottom-right">
    <RecordingModeToggle
      mode={currentMode}
      onToggle={handleModeToggle}
    />
    <RecordSceneRecordButton
      {onExport}
      {isExporting}
      {canvasReady}
    />
  </div>
</div>

<style>
  .chrome-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }

  .bottom-right {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
    bottom: 68px;
    right: 16px;
  }

  @media (max-width: 600px) {
    .bottom-right {
      bottom: 60px;
      right: 12px;
    }
  }
</style>
```

Note: changed `.bottom-right` from `align-items: flex-start` to `align-items: center` so the toggle and button align vertically.

- [ ] **Step 2: Pass choreography prop from SequenceViewerDrawerHost**

In `SequenceViewerDrawerHost.svelte`, find lines 484–489:

```svelte
                  {#if isRecordSceneActive && ctx.effectiveSequence}
                    <RecordSceneChrome
                      isExporting={ctx.isExporting}
                      canvasReady={ctx.canvasReady}
                      onExport={ctx.handleExport}
                    />
```

Replace with:

```svelte
                  {#if isRecordSceneActive && ctx.effectiveSequence}
                    <RecordSceneChrome
                      isExporting={ctx.isExporting}
                      canvasReady={ctx.canvasReady}
                      onExport={ctx.handleExport}
                      choreography={ctx.viewer3DState.cameraChoreography}
                    />
```

- [ ] **Step 3: Verify build passes**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(record-scene): wire RecordingModeToggle into RecordSceneChrome"
```

---

### Task 4: Remove camera grid from ExportPopover

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportPopover.svelte`

- [ ] **Step 1: Remove camera-related imports, types, and state**

In `ExportPopover.svelte`, remove from the `<script>` block:

1. Remove the import on line 9:
```typescript
  import type { CameraPresetId } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";
```

2. Remove the `PresetTile` type and `CAMERA_PRESETS` array (lines 32–46):
```typescript
  type PresetTile = {
    id: CameraPresetId;
    label: string;
    icon: string;
    tint?: string;
  };
  const CAMERA_PRESETS: PresetTile[] = [
    { id: "free", label: "Free", icon: "fa-hand-paper" },
    { id: "auto-orbit", label: "Auto-orbit", icon: "fa-sync-alt" },
    { id: "plane-wall", label: "Wall", icon: "fa-square", tint: "var(--plane-wall, #4a9eff)" },
    { id: "plane-wheel", label: "Wheel", icon: "fa-circle", tint: "var(--plane-wheel, #ff9e4a)" },
    { id: "plane-floor", label: "Floor", icon: "fa-th-large", tint: "var(--plane-floor, #4affa0)" },
    { id: "quad-plane-tour", label: "Tour", icon: "fa-film" },
    { id: "ensemble-focus", label: "Ensemble", icon: "fa-users" },
  ];
```

3. Remove `performerCount`, `activePresetId`, `isDisabled`, `tooltipFor`, and `pickPreset` (lines 48–65):
```typescript
  const performerCount = $derived(viewer.performerManager.performers.length);
  const activePresetId = $derived(viewer.cameraChoreography.activePresetId);

  function isDisabled(id: CameraPresetId): boolean {
    return id === "ensemble-focus" && performerCount !== 4;
  }

  function tooltipFor(id: CameraPresetId): string | undefined {
    if (id === "ensemble-focus" && performerCount !== 4) {
      return "Needs exactly 4 performers";
    }
    return undefined;
  }

  function pickPreset(id: CameraPresetId) {
    if (isDisabled(id)) return;
    viewer.cameraChoreography.setPresetId(id);
  }
```

- [ ] **Step 2: Remove the Camera row from the template**

Remove lines 132–153 (the Camera row with `camera-grid`):

```svelte
      <div class="row">
        <div class="row-label">Camera</div>
        <div class="camera-grid">
          {#each CAMERA_PRESETS as preset (preset.id)}
            {@const disabled = isDisabled(preset.id)}
            {@const active = activePresetId === preset.id}
            <button
              type="button"
              class="cam-tile"
              class:active
              disabled={disabled}
              aria-pressed={active}
              title={tooltipFor(preset.id)}
              style={preset.tint ? `--tile-accent: ${preset.tint};` : undefined}
              onclick={() => pickPreset(preset.id)}
            >
              <i class="fas {preset.icon}"></i>
              <span class="cam-label">{preset.label}</span>
            </button>
          {/each}
        </div>
      </div>
```

- [ ] **Step 3: Remove camera-grid styles**

Remove the `.camera-grid` and `.cam-tile` style rules (lines 239–273):

```css
  .camera-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cam-tile { ... }
  .cam-tile:hover:not(:disabled) { ... }
  .cam-tile:disabled { ... }
  .cam-tile.active { ... }
  .cam-tile i { ... }
  .cam-label { ... }
```

- [ ] **Step 4: Remove viewer context import if no longer used**

Check if `getViewer3DContext` import (line 2) is still used elsewhere in the file. If the only usage was for `viewer.cameraChoreography` and `viewer.performerManager`, remove:

```typescript
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  // ...
  const viewer = getViewer3DContext();
```

If other parts of ExportPopover still reference `viewer`, keep the import.

- [ ] **Step 5: Verify build passes**

Run: `npm run check`
Expected: No type errors. No unused import warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportPopover.svelte
git commit -m "refactor(export-popover): remove camera preset grid — mode moved to RecordingModeToggle"
```

---

### Task 5: Simplify ExportCoordinator preset logic

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportCoordinator.svelte.ts:149-170`

- [ ] **Step 1: Simplify the preset evaluation block**

The current code (lines 149–170) evaluates any of the 7 presets. Since the UI now only exposes `"free"` and `"auto-orbit"`, simplify the logic. Replace lines 149–170:

```typescript
// BEFORE (lines 149-170):
      // ── Pass 1: Camera Performance Recording ──
      const cameraKeyframes = new CameraKeyframeBuffer();

      const choreography = viewer3DState.cameraChoreography;
      const activePresetId = choreography.activePresetId;
      const activePreset = choreography.activePreset;
      const presetEligible =
        activePreset &&
        choreography.evaluate(activePresetId, viewer3DState.performerManager.performers.length).eligible;
      const usePreset = activePresetId !== "free" && !!activePreset && presetEligible;

      const primaryAvatar = viewer3DState.performerManager.performers[0] ?? null;
      const presetTotalLoops = usePreset ? activePreset!.totalLoops : 1;
      const presetDurationSec = usePreset ? singleLoopSec * presetTotalLoops : 0;

      const disposeDriver: (() => void) | null = usePreset
        ? choreography.applyPreset(activePresetId, {
            performers: viewer3DState.performerManager.performers,
            sequenceDurationSec: singleLoopSec,
          })
        : null;
      const driverActive = !!disposeDriver;

// AFTER:
      // ── Pass 1: Camera Performance Recording ──
      const cameraKeyframes = new CameraKeyframeBuffer();

      const choreography = viewer3DState.cameraChoreography;
      const useOrbit = choreography.activePresetId === "auto-orbit";

      const primaryAvatar = viewer3DState.performerManager.performers[0] ?? null;
      const orbitPreset = useOrbit ? choreography.activePreset : null;
      const presetTotalLoops = orbitPreset?.totalLoops ?? 1;
      const presetDurationSec = useOrbit ? singleLoopSec * presetTotalLoops : 0;

      const disposeDriver: (() => void) | null = useOrbit
        ? choreography.applyPreset("auto-orbit", {
            performers: viewer3DState.performerManager.performers,
            sequenceDurationSec: singleLoopSec,
          })
        : null;
      const driverActive = !!disposeDriver;
```

- [ ] **Step 2: Update references from `usePreset` to `useOrbit`**

Search the rest of the function for any references to the old `usePreset` variable. There should be none since we renamed to `useOrbit` and the `driverActive` variable still works identically.

Verify no other references exist:

Run: `grep -n "usePreset" src/lib/shared/sequence-viewer/components/ExportCoordinator.svelte.ts`
Expected: No matches.

- [ ] **Step 3: Verify build passes**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportCoordinator.svelte.ts
git commit -m "refactor(export-coordinator): simplify preset logic to free/orbit binary"
```

---

### Task 6: Clean up playground file

**Files:**
- Delete: `playground-record-scene-ux.html`

- [ ] **Step 1: Remove the playground file**

```bash
rm playground-record-scene-ux.html
```

- [ ] **Step 2: Final build verification**

Run: `npm run check`
Expected: Full pass, no errors.

- [ ] **Step 3: Commit**

```bash
git add -u playground-record-scene-ux.html
git commit -m "chore: remove record-scene UX playground file"
```
