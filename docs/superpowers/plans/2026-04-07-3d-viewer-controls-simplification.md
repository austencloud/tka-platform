# 3D Viewer Controls Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the 3D viewer overlay from 10+ controls to a single gear icon (half-screen) and direct controls (full-screen), remove Learn/Mirror mode, and unify tap-to-expand with the 2D viewer.

**Architecture:** Remove mirror mode state and color-swap logic entirely. Create a gear popover component that consolidates camera presets and grid plane toggles for half-screen mode. Add tap-to-expand (click without drag) to the 3D canvas so it behaves identically to the 2D viewer. In full-screen, show controls directly on viewport with a unified bottom panel.

**Tech Stack:** Svelte 5 (runes), TypeScript, Threlte (Three.js), CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-07-3d-viewer-controls-simplification-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | Modify | Remove mirrorMode state, storage key, getter, setter |
| `src/lib/shared/3d/components/Viewer3DViewPresets.svelte` | Modify | Remove Learn/Mirror toggle, sublabel, mirror position variants; add Front preset; single position per preset |
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Modify | Replace top-controls with gear popover (half-screen) or direct controls (full-screen); add tap-to-expand handler; remove PlaneModeToggle import |
| `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` | Create | Gear icon + popover containing camera presets + grid plane toggles |
| `src/lib/shared/3d/components/Viewer3DGridPopover.svelte` | Keep | No changes — reused inside gear popover and in full-screen |
| `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte` | Keep | No changes to file itself, just removed from Viewer3DCanvas overlay |
| `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Modify | Remove 3D click guard so tap-to-expand works in 3D mode |
| `src/app.css` | Modify | Add `--min-touch-target-compact: 32px` |

---

### Task 1: Add `--min-touch-target-compact` CSS Variable

**Files:**
- Modify: `src/app.css:237-238`

- [ ] **Step 1: Add the compact touch target variable**

In `src/app.css`, find:

```css
--min-touch-target: 44px;
--alt-touch-target: 36px;
```

Add after `--alt-touch-target`:

```css
--min-touch-target-compact: 32px;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app.css
git commit -m "feat(3d): add --min-touch-target-compact for viewport overlays"
```

---

### Task 2: Remove Mirror Mode from State

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Remove mirror mode state and persistence**

In `viewer-3d-state.svelte.ts`, delete the storage key constant:

```typescript
const STORAGE_KEY_MIRROR = "tka-viewer3d-mirrorMode";
```

Delete the `mirrorMode` state initialization (lines 143-146):

```typescript
let mirrorMode = $state((() => {
    if (typeof localStorage === "undefined") return false;
    try { return localStorage.getItem(STORAGE_KEY_MIRROR) === "true"; } catch { return false; }
  })());
```

- [ ] **Step 2: Remove mirrorMode getter and setMirrorMode from the return object**

Delete from the return object:

```typescript
    get mirrorMode() {
      return mirrorMode;
    },
    setMirrorMode(mirror: boolean) {
      mirrorMode = mirror;
      try { localStorage.setItem(STORAGE_KEY_MIRROR, String(mirror)); } catch {}
    },
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build may show errors in components that reference `mirrorMode` or `setMirrorMode`. Note these files — they'll be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "feat(3d): remove mirrorMode state from viewer-3d-state"
```

---

### Task 3: Simplify Viewer3DViewPresets — Remove Mirror, Add Front Preset

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DViewPresets.svelte`

- [ ] **Step 1: Replace the entire component with simplified version**

The current file has learn/mirror position variants, mode toggle, and sublabel. Replace the full `<script>` block with:

```typescript
<script lang="ts">
  import { getViewer3DContext } from "../context/viewer-3d-context";

  const viewer3DState = getViewer3DContext();

  const GRID_CENTER = { x: 0, y: 1.55, z: -0.3 };
  const D = 2.4;
  const Y = 1.59;
  const GZ = -0.3;

  // Single position per preset — no learn/mirror variants.
  // "Main" = behind performer (camera at -Z, looking at back)
  // "Front" = facing performer (camera at +Z, looking at face) — no color swap
  const CAMERA_POSITIONS: Record<string, { x: number; y: number; z: number }> = {
    main:         { x: 0,         y: Y,       z: GZ - D },
    front:        { x: 0,         y: Y,       z: GZ + D },
    side:         { x: D,         y: Y,       z: GZ },
    top:          { x: 0,         y: GRID_CENTER.y + 3.0, z: GZ - 0.01 },
    threequarter: { x: D * 0.6,   y: Y + 1.0, z: GZ - D * 0.8 },
  };

  type CameraPresetId = keyof typeof CAMERA_POSITIONS;

  const CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
    { id: "main", label: "Main" },
    { id: "front", label: "Front" },
    { id: "side", label: "Side" },
    { id: "top", label: "Top" },
    { id: "threequarter", label: "3/4" },
  ];

  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  const activeCameraPreset = $derived(viewer3DState.activeCameraPreset);

  function handleCameraPreset(presetId: CameraPresetId) {
    const pos = CAMERA_POSITIONS[presetId];
    viewer3DState.setActiveCameraPreset(presetId);
    viewer3DState.snapCameraTo(pos, GRID_CENTER);
  }
</script>
```

- [ ] **Step 2: Replace the template and styles**

Replace the entire template and `<style>` block:

```svelte
<div class="camera-presets" class:compact>
  {#each CAMERA_PRESETS as preset}
    <button
      class="preset-button"
      class:active={activeCameraPreset === preset.id}
      onclick={() => handleCameraPreset(preset.id)}
      aria-label={`Camera: ${preset.label}`}
    >{preset.label}</button>
  {/each}
</div>

<style>
  .camera-presets {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
  }

  .preset-button {
    padding: 6px 11px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    min-height: var(--min-touch-target-compact, 32px);
  }

  .preset-button:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.08);
  }

  .preset-button.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .compact .preset-button {
    padding: 4px 7px;
    font-size: 10px;
  }
</style>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. The sublabel and mode toggle are gone.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DViewPresets.svelte
git commit -m "feat(3d): simplify ViewPresets — remove mirror mode, add Front preset"
```

---

### Task 4: Create Viewer3DGearPopover

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`

- [ ] **Step 1: Create the gear popover component**

This component combines the gear icon button with a popover containing camera presets and grid plane toggles. It reuses `Viewer3DViewPresets` for camera buttons and `Viewer3DGridPopover`'s plane toggle logic inline (since the grid popover is its own button+popover, we extract just the plane list).

```svelte
<script lang="ts">
  /**
   * Viewer3DGearPopover
   *
   * Single gear icon for half-screen 3D mode. Opens a popover with:
   * 1. Camera presets (Main, Front, Side, Top, 3/4)
   * 2. Grid plane toggles (Wall, Wheel, Floor)
   */

  import { Plane, PLANE_COLORS } from "../domain/enums/Plane";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const viewer3DState = getViewer3DContext();

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handlePlaneClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    viewer3DState.togglePlane(plane);
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      open = false;
    }
  }

  const anyPlaneVisible = $derived(viewer3DState.visiblePlanes.size > 0);
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="gear-root" bind:this={rootEl}>
  <button
    class="gear-button"
    class:active={open}
    onclick={toggleOpen}
    aria-label="3D viewer settings"
    aria-expanded={open}
    aria-haspopup="true"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  </button>

  {#if open}
    <div
      class="gear-popover"
      role="dialog"
      aria-label="3D viewer settings"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
    >
      <!-- Camera presets -->
      <div class="section">
        <div class="section-label">Camera</div>
        <Viewer3DViewPresets compact />
      </div>

      <div class="divider"></div>

      <!-- Grid planes -->
      <div class="section">
        <div class="section-label">Grid Planes</div>
        <div class="plane-list">
          {#each PLANES as { plane, label }}
            {@const isVisible = viewer3DState.visiblePlanes.has(plane)}
            {@const color = PLANE_COLORS[plane]}
            <button
              class="plane-row"
              class:plane-active={isVisible}
              onclick={(e) => handlePlaneClick(e, plane)}
              aria-pressed={isVisible}
              aria-label="{label} plane — {isVisible ? 'visible' : 'hidden'}"
            >
              <span class="plane-dot" style="background: {color}; box-shadow: 0 0 4px {color}60;"></span>
              <span class="plane-label">{label}</span>
              {#if isVisible}
                <svg class="plane-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3e635" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .gear-root {
    position: relative;
  }

  .gear-button {
    width: var(--min-touch-target-compact, 32px);
    height: var(--min-touch-target-compact, 32px);
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }

  .gear-button:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.9);
  }

  .gear-button.active {
    background: rgba(139, 139, 255, 0.2);
    border-color: rgba(139, 139, 255, 0.3);
    color: #fff;
  }

  .gear-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    min-width: 200px;
    border-radius: 10px;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    padding: 10px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .section-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.35);
    font-weight: 600;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 8px 0;
  }

  .plane-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .plane-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 5px;
    background: transparent;
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    text-align: left;
  }

  .plane-row:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .plane-row.plane-active {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .plane-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .plane-label {
    flex: 1;
  }

  .plane-check {
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. Component is created but not yet used.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "feat(3d): create Viewer3DGearPopover for half-screen mode"
```

---

### Task 5: Update Viewer3DCanvas — Gear Popover + Conditional Controls

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

- [ ] **Step 1: Add fullScreen prop and swap imports**

In the `<script>` block, add the new import and prop:

Replace:
```typescript
import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
import Viewer3DGridPopover from "./Viewer3DGridPopover.svelte";
import PlaneModeToggle from "./controls/PlaneModeToggle.svelte";
```

With:
```typescript
import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
import Viewer3DGridPopover from "./Viewer3DGridPopover.svelte";
import Viewer3DGearPopover from "./Viewer3DGearPopover.svelte";
```

Remove `PlaneModeToggle` import (no longer used on viewport).

In the Props interface, add:

```typescript
fullScreen?: boolean;
```

And destructure it:

```typescript
let { sequenceData, currentStep, isPlaying, hideOverlays = false, fullScreen = false, onCameraStateChange }: Props = $props();
```

- [ ] **Step 2: Remove handlePlaneModeChange function**

Delete the entire `handlePlaneModeChange` function (lines 55-69) since PlaneModeToggle is no longer on the viewport.

- [ ] **Step 3: Replace the overlay template**

Replace the `{#if !hideOverlays}` block (lines 88-128) with:

```svelte
    {#if !hideOverlays}
      {#if fullScreen}
        <!-- Full-screen: show controls directly on viewport -->
        <div class="top-controls">
          <Viewer3DGridPopover {sequenceData} />
          <Viewer3DViewPresets />
        </div>
        <!-- Back button -->
        <button
          class="back-button"
          onclick={() => {/* handled by parent via event */}}
          aria-label="Exit full-screen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
      {:else}
        <!-- Half-screen: gear icon only -->
        <div class="top-controls">
          <Viewer3DGearPopover />
        </div>
      {/if}
      {#if avatarState && avatarState.totalSteps > 1 && avatarState.beatEditMode}
        <div class="beat-strip-container">
          <BeatPlaneStrip
            totalBeats={avatarState.totalSteps}
            currentBeatIndex={avatarState.currentStepIndex}
            beatPlaneOverrides={avatarState.beatPlaneOverrides}
            onBeatClick={(i) => avatarState.goToStep(i)}
          />
        </div>
      {/if}
    {/if}
```

- [ ] **Step 4: Add back-button styles**

Add to the `<style>` block:

```css
  .back-button {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
    width: var(--min-touch-target-compact, 32px);
    height: var(--min-touch-target-compact, 32px);
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.95);
  }
```

- [ ] **Step 5: Remove the rotation-variant-btn styles**

Delete the `.rotation-variant-btn` CSS rules since the DW toggle and its rotation variant button have been removed from the viewport.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds. The back button's onclick is a placeholder — wiring happens in Task 6.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "feat(3d): swap viewport controls for gear popover / direct controls"
```

---

### Task 6: Enable Tap-to-Expand in ViewerSplitPane

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

- [ ] **Step 1: Remove the 3D click guard**

In `ViewerSplitPane.svelte`, find `handleAnimationClick()` (lines 87-95):

```typescript
  function handleAnimationClick() {
    // In 3D mode, don't intercept clicks — OrbitControls needs them
    if (renderMode === '3d') return;
    if (layout.focusedPane === "animation") {
      onUnfocusPane();
    } else {
      onFocusPane("animation");
    }
  }
```

Replace with a version that distinguishes tap from drag for 3D mode:

```typescript
  let pointerDownPos: { x: number; y: number } | null = null;

  function handlePointerDown(e: PointerEvent) {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  function handleAnimationClick(e: MouseEvent) {
    // For 3D mode, only expand on tap (no drag movement).
    // OrbitControls use drag — a click without movement means "tap to expand".
    if (renderMode === '3d' && pointerDownPos) {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      // If pointer moved more than 5px, it was a drag (orbit), not a tap
      if (dx > 5 || dy > 5) {
        pointerDownPos = null;
        return;
      }
    }
    pointerDownPos = null;

    if (layout.focusedPane === "animation") {
      onUnfocusPane();
    } else {
      onFocusPane("animation");
    }
  }
```

- [ ] **Step 2: Add pointerdown handler to the animation pane element**

Find the animation pane's click handler in the template. It will be on a `<div>` or `<button>` element that calls `handleAnimationClick`. Add `onpointerdown={handlePointerDown}` alongside the existing `onclick={handleAnimationClick}`.

Look for something like:
```svelte
onclick={handleAnimationClick}
```

Add the pointerdown handler to the same element:
```svelte
onpointerdown={handlePointerDown}
onclick={handleAnimationClick}
```

- [ ] **Step 3: Pass fullScreen prop to Viewer3DCanvas**

Find where `Viewer3DCanvas` is rendered in the template and add the `fullScreen` prop:

```svelte
<Viewer3DCanvas
  {sequenceData}
  {currentStep}
  {isPlaying}
  fullScreen={layout.focusedPane === "animation"}
/>
```

The exact prop names may differ — match the existing pattern in the file.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(3d): enable tap-to-expand in 3D mode via drag detection"
```

---

### Task 7: Clean Up Mirror Mode References

**Files:**
- Modify: Any files that still reference `mirrorMode` or `setMirrorMode`

- [ ] **Step 1: Search for remaining mirror mode references**

Run: `grep -r "mirrorMode\|setMirrorMode\|STORAGE_KEY_MIRROR\|mirror.*mode" src/lib/shared/3d/ --include="*.ts" --include="*.svelte" -l`

For each file found (other than the ones already modified in Tasks 2-3), remove the references. Common patterns:
- Context menu items that toggle mirror mode
- Camera components that read mirror mode for position calculation
- Any component that calls `viewer3DState.setMirrorMode()` or reads `viewer3DState.mirrorMode`

- [ ] **Step 2: Search for mirror mode references outside 3d directory**

Run: `grep -r "mirrorMode\|setMirrorMode" src/ --include="*.ts" --include="*.svelte" -l`

Remove any remaining references.

- [ ] **Step 3: Verify clean build**

Run: `npm run build`
Expected: Build succeeds with zero TypeScript errors related to mirrorMode.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(3d): remove all remaining mirrorMode references"
```

---

### Task 8: Verify Full Flow

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Type check**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 3: Manual verification checklist**

Ask the user to verify in the browser:

1. **Half-screen 3D viewer:** Only gear icon visible in top-right corner
2. **Gear popover:** Tap gear → shows Camera presets (Main/Front/Side/Top/3/4) and Grid plane toggles (Wall/Wheel/Floor)
3. **Camera presets work:** Tapping each preset snaps camera to correct position
4. **Grid toggles work:** Toggling planes shows/hides grid planes in scene
5. **Tap to expand:** Tapping (not dragging) the 3D scene expands to full-screen
6. **Drag still orbits:** Dragging in both half-screen and full-screen orbits the camera
7. **Full-screen controls:** Grid button and camera presets shown directly on viewport (no gear)
8. **Back button:** Returns to half-screen
9. **No color swap:** Colors stay consistent regardless of camera angle — blue is always blue-hand side

- [ ] **Step 4: Commit any fixes from verification**

If any issues found during verification, fix and commit.
