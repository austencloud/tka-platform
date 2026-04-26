# 3D Viewer Settings Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the 3D viewer settings popover (`Viewer3DGearPopover.svelte`) as a unified Camera + Planes control with a round-dot visibility toggle, inline hand assignment slots, and derived dual-wheel mode. Remove dropdown pickers, the DW button, and the beat-scope toggle.

**Architecture:** The popover becomes a self-contained component that inlines the plane matrix (no `PlaneModeToggle` dependency). The underlying avatar state gets one new behavior: `setHandPlane` now derives `PlaneMode` from the combined hand assignments instead of always setting `CUSTOM`. `Viewer3DViewPresets` gets a new `grid` variant that renders as a 2×3 grid instead of a single row. The orphaned `SceneOverlayControls.svelte` (already broken after earlier refactors) gets deleted.

**Tech Stack:** Svelte 5 runes, TypeScript, existing `PLANE_COLORS` enum, existing `avatarState` API (no new methods — `clearBeatPlaneOverrides` already exists).

**Design Source:** `docs/superpowers/specs/2026-04-10-3d-viewer-settings-popover-design.md`. Visual mockup: `.superpowers/brainstorm/71602-1775861114/content/final-tight.html` (this is the visual source of truth — when in doubt, match the mockup).

---

## File Structure

### Files to modify

- `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` — modify `setHandPlane` to derive `PlaneMode`
- `src/lib/shared/3d/components/Viewer3DViewPresets.svelte` — add 2×3 grid variant
- `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` — full rewrite: inline plane matrix, new layout

### Files to delete

- `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte` — orphaned dead code, already broken (grep confirmed no imports elsewhere)

### Files to create

- `tests/unit/avatar-plane-mode-derivation.test.ts` — unit test for the derived `PlaneMode` logic (pure transformation, silent-bug risk per the testing philosophy)

### Files that stay untouched

- `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte` — still used by `Viewer3DCanvas.svelte`'s top control bar (fullscreen mode). Out of scope for this plan.
- `src/lib/shared/3d/components/Viewer3DCanvas.svelte` — out of scope. Its own top control bar is a separate UI surface.

---

## Task 1: Derive PlaneMode from hand assignments

**Goal:** When both hands are on `Plane.WHEEL`, `planeMode` becomes `DUAL_WHEEL`. When both are on `Plane.WALL`, it becomes `WALL`. Otherwise it stays `CUSTOM`. This derivation happens inside `setHandPlane` after the plane assignment is updated.

**Files:**
- Modify: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts:358-374` (the existing `setHandPlane` function)
- Create: `tests/unit/avatar-plane-mode-derivation.test.ts`

### - [ ] Step 1: Write the failing unit test

Create `tests/unit/avatar-plane-mode-derivation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { PlaneMode } from "$lib/shared/3d/domain/enums/PlaneMode";
import { derivePlaneModeFromHands } from "$lib/shared/3d/state/avatar-instance-state.svelte";

describe("derivePlaneModeFromHands", () => {
  it("returns WALL when both hands are on Wall", () => {
    expect(derivePlaneModeFromHands(Plane.WALL, Plane.WALL)).toBe(PlaneMode.WALL);
  });

  it("returns DUAL_WHEEL when both hands are on Wheel", () => {
    expect(derivePlaneModeFromHands(Plane.WHEEL, Plane.WHEEL)).toBe(PlaneMode.DUAL_WHEEL);
  });

  it("returns CUSTOM when hands are on different planes", () => {
    expect(derivePlaneModeFromHands(Plane.WALL, Plane.WHEEL)).toBe(PlaneMode.CUSTOM);
    expect(derivePlaneModeFromHands(Plane.WHEEL, Plane.FLOOR)).toBe(PlaneMode.CUSTOM);
    expect(derivePlaneModeFromHands(Plane.FLOOR, Plane.WALL)).toBe(PlaneMode.CUSTOM);
  });

  it("returns CUSTOM when both hands are on Floor (no matching preset)", () => {
    expect(derivePlaneModeFromHands(Plane.FLOOR, Plane.FLOOR)).toBe(PlaneMode.CUSTOM);
  });
});
```

### - [ ] Step 2: Run test — verify it fails

Run: `npx vitest run tests/unit/avatar-plane-mode-derivation.test.ts`
Expected: FAIL — `derivePlaneModeFromHands is not a function` or `Cannot find module`.

### - [ ] Step 3: Add the exported helper and integrate into setHandPlane

In `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`, add this top-level exported function above the factory function (outside the `createAvatarInstanceState` closure). Place it right after the imports, before `createAvatarInstanceState`:

```typescript
/**
 * Derive the PlaneMode that matches a given pair of hand-plane assignments.
 *
 * When both hands are on the same preset plane, use the matching preset mode
 * (WALL or DUAL_WHEEL) so the renderer produces the intended spatial layout.
 * DUAL_WHEEL is required when both hands are on WHEEL — a single wheel plane
 * can't hold both hands without overlap through the avatar.
 *
 * Any other combination falls back to CUSTOM (per-hand independent).
 */
export function derivePlaneModeFromHands(bluePlane: Plane, redPlane: Plane): PlaneMode {
  if (bluePlane === Plane.WALL && redPlane === Plane.WALL) return PlaneMode.WALL;
  if (bluePlane === Plane.WHEEL && redPlane === Plane.WHEEL) return PlaneMode.DUAL_WHEEL;
  return PlaneMode.CUSTOM;
}
```

Then replace the existing `setHandPlane` body (lines 362-374) with:

```typescript
  /**
   * Set a single hand's plane independently. The PlaneMode is derived from
   * the combined assignment — both hands on Wheel becomes DUAL_WHEEL (needed
   * for lateral rendering), both on Wall becomes WALL, anything else becomes
   * CUSTOM. Re-converts the sequence with the effective config.
   */
  function setHandPlane(hand: "blue" | "red", plane: Plane) {
    if (hand === "blue") customBluePlane = plane;
    else customRedPlane = plane;

    planeMode = derivePlaneModeFromHands(customBluePlane, customRedPlane);

    reconvertWithConfig(getEffectiveModeConfig(planeMode));
  }
```

### - [ ] Step 4: Run test — verify it passes

Run: `npx vitest run tests/unit/avatar-plane-mode-derivation.test.ts`
Expected: PASS — all four test cases green.

### - [ ] Step 5: Run svelte-check on the modified file

Run: `npx svelte-check --threshold error 2>&1 | grep "avatar-instance-state" | head -5`
Expected: no errors for `avatar-instance-state.svelte.ts`.

### - [ ] Step 6: Commit

```bash
git add src/lib/shared/3d/state/avatar-instance-state.svelte.ts tests/unit/avatar-plane-mode-derivation.test.ts
git commit -m "feat(3d): derive PlaneMode from hand assignments in setHandPlane

Both hands on Wheel now auto-activates DUAL_WHEEL mode (required for
lateral rendering — a single wheel plane can't hold both hands without
overlap). Both on Wall → WALL. Any other combination → CUSTOM."
```

---

## Task 2: Add 2×3 grid variant to Viewer3DViewPresets

**Goal:** The camera preset bar currently renders as a single horizontal row. Add a `grid` prop that switches it to a 2-row × 3-column CSS grid. The existing `compact` and `flat` variants stay functional.

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DViewPresets.svelte`

### - [ ] Step 1: Add the `grid` prop to the component interface

In `Viewer3DViewPresets.svelte`, find the existing props line (~line 18):

```svelte
  const { compact = false, flat = false }: { compact?: boolean; flat?: boolean } = $props();
```

Replace it with:

```svelte
  const { compact = false, flat = false, grid = false }: { compact?: boolean; flat?: boolean; grid?: boolean } = $props();
```

### - [ ] Step 2: Add the `grid` modifier class and reorder presets for row-major fill

Find the existing `{#if flat} ... {:else} <div class="presets-bar" class:compact> ... {/if}` block. Replace the `{:else}` branch (not the flat branch) with:

```svelte
{:else}
  <div class="presets-bar" class:compact class:grid>
    {#each activePresets as preset}
      <button
        class="preset-button"
        class:active={activeCameraPreset === preset.id}
        onclick={() => handleCameraPreset(preset.id)}
        aria-label={`Camera: ${preset.label}`}
      >{preset.label}</button>
    {/each}
  </div>
{/if}
```

Then find the `activePresets` array (currently in display order: main, back, left, right, top, threequarter). For the grid variant, row-major order should be: **Front, Back, Top** (row 1), **Left, Right, 3/4** (row 2). The label order stays the same because CSS grid will handle row-major layout. Verify the current `activePresets` array order matches:

```typescript
  const activePresets: { id: string; label: string }[] = [
    { id: "main",         label: "Front" },
    { id: "back",         label: "Back" },
    { id: "left",         label: "Left" },
    { id: "right",        label: "Right" },
    { id: "top",          label: "Top" },
    { id: "threequarter", label: "3/4" },
  ];
```

This order is wrong for the grid layout — it would produce row 1: Front/Back/Left, row 2: Right/Top/3/4. Reorder to match the mockup (Front/Back/Top in row 1, Left/Right/3/4 in row 2):

```typescript
  const activePresets: { id: string; label: string }[] = [
    { id: "main",         label: "Front" },
    { id: "back",         label: "Back" },
    { id: "top",          label: "Top" },
    { id: "left",         label: "Left" },
    { id: "right",        label: "Right" },
    { id: "threequarter", label: "3/4" },
  ];
```

**Note:** this reordering also affects the non-grid (horizontal) variants. The existing single-row bar now reads Front / Back / Top / Left / Right / 3/4 instead of Front / Back / Left / Right / Top / 3/4. That's acceptable because: (a) the gear popover will use `grid`, (b) the other consumers render the flat variant in a toolbar where ordering is cosmetic.

### - [ ] Step 3: Add the grid CSS

Find the existing `<style>` block in `Viewer3DViewPresets.svelte`. Locate the `.presets-bar` rule and the `.compact .preset-button` rule. After the existing `.preset-button.active` rule, add:

```css
  .presets-bar.grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3px;
  }

  .grid .preset-button {
    min-height: 36px;
    padding: 8px 10px;
    font-size: 13px;
  }
```

### - [ ] Step 4: Run svelte-check on the file

Run: `npx svelte-check --threshold error 2>&1 | grep "Viewer3DViewPresets" | head -5`
Expected: no errors.

### - [ ] Step 5: Commit

```bash
git add src/lib/shared/3d/components/Viewer3DViewPresets.svelte
git commit -m "feat(3d): add grid variant to Viewer3DViewPresets

New 'grid' prop renders camera presets as 2x3 grid instead of single
row, for use inside the redesigned gear popover. Row-major order
reflows to Front/Back/Top, Left/Right/3/4."
```

---

## Task 3: Rewrite Viewer3DGearPopover with unified Planes matrix

**Goal:** Full rewrite. Remove `PlaneModeToggle` import and usage. Replace the Grid Planes section and Hand Planes section with a single unified Planes matrix. Camera section uses the new `grid` variant. Add a reset button that only appears when state is non-default, and clears both custom planes AND beat overrides.

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` (full rewrite of template + styles + most of script)

### - [ ] Step 1: Replace the full contents of Viewer3DGearPopover.svelte

Replace the entire file contents with:

```svelte
<script lang="ts">
  /**
   * Viewer3DGearPopover
   *
   * Single gear icon for the sequence-viewer 3D popover. Contains:
   * 1. Camera presets (2×3 grid)
   * 2. Unified Planes matrix — one row per plane, showing which hands are
   *    on it and whether it's visible. The plane color dot doubles as the
   *    visibility toggle. Hand slots on the right are drop targets for
   *    assigning each hand to a plane.
   *
   * Sequence-wide only — per-beat plane overrides are not editable here.
   * PlaneMode is derived from the hand assignments in setHandPlane.
   */

  import { Plane, PLANE_COLORS } from "../domain/enums/Plane";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const viewer3DState = getViewer3DContext();
  const avatarState = $derived(viewer3DState.avatarState);

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  // Sequence-wide hand plane assignments (falls back to Wall if no avatar)
  const bluePlane = $derived(avatarState?.customBluePlane ?? Plane.WALL);
  const redPlane = $derived(avatarState?.customRedPlane ?? Plane.WALL);

  // A plane is "implicit" when a hand is on it — visibility is locked on
  function isImplicit(plane: Plane): boolean {
    return bluePlane === plane || redPlane === plane;
  }

  // A plane is "force-shown" when it's in visiblePlanes but no hand is on it
  function isForceShown(plane: Plane): boolean {
    return viewer3DState.visiblePlanes.has(plane) && !isImplicit(plane);
  }

  // A plane is visually "visible" if it's either implicit or force-shown
  function isVisible(plane: Plane): boolean {
    return isImplicit(plane) || isForceShown(plane);
  }

  // Reset is only offered when any state deviates from defaults
  const isNonDefault = $derived(
    (avatarState?.customBluePlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.customRedPlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.hasBeatOverrides ?? false) ||
    PLANES.some(({ plane }) => isForceShown(plane))
  );

  const hasBeatOverrides = $derived(avatarState?.hasBeatOverrides ?? false);

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handlePlaneToggleClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    // Locked when a hand is on the plane
    if (isImplicit(plane)) return;
    viewer3DState.togglePlane(plane);
  }

  function handleHandSlotClick(e: MouseEvent, hand: "blue" | "red", plane: Plane) {
    e.stopPropagation();
    if (!avatarState) return;
    const currentPlane = hand === "blue" ? bluePlane : redPlane;
    // No-op if this hand is already on this plane
    if (currentPlane === plane) return;
    avatarState.setHandPlane(hand, plane);
  }

  function handleResetClick(e: MouseEvent) {
    e.stopPropagation();
    if (!avatarState) return;
    // Reset sequence-wide planes to Wall
    avatarState.setHandPlane("blue", Plane.WALL);
    avatarState.setHandPlane("red", Plane.WALL);
    // Clear any per-beat overrides that exist
    avatarState.clearBeatPlaneOverrides();
    // Clear any force-shown planes
    for (const { plane } of PLANES) {
      if (isForceShown(plane)) {
        viewer3DState.togglePlane(plane);
      }
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      open = false;
    }
  }
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
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
      in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
      out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <!-- Camera presets -->
      <div class="section">
        <div class="section-label">Camera</div>
        <Viewer3DViewPresets grid />
      </div>

      <div class="divider"></div>

      <!-- Unified Planes matrix -->
      <div class="section">
        <div class="section-label">Planes</div>
        <div class="plane-matrix">
          {#each PLANES as { plane, label }}
            {@const implicit = isImplicit(plane)}
            {@const visible = isVisible(plane)}
            {@const color = PLANE_COLORS[plane]}
            <div
              class="plane-row"
              class:with-hand={implicit}
              class:hidden-row={!visible}
            >
              <div class="plane-left">
                <button
                  class="plane-toggle"
                  class:visible
                  class:hidden={!visible}
                  class:implicit
                  style="--dot-color: {color};"
                  onclick={(e) => handlePlaneToggleClick(e, plane)}
                  aria-pressed={visible}
                  aria-disabled={implicit}
                  aria-label={`${label} plane — ${implicit ? 'locked visible, hand assigned' : (visible ? 'force-shown, click to hide' : 'hidden, click to show')}`}
                ></button>
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

        {#if isNonDefault}
          <div class="reset-row">
            <button
              class="reset-btn"
              class:with-overrides={hasBeatOverrides}
              onclick={handleResetClick}
              aria-label={hasBeatOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
              title={hasBeatOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
              </svg>
              {#if hasBeatOverrides}
                <span class="override-badge" aria-hidden="true"></span>
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .gear-root {
    position: relative;
  }

  .gear-button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
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
    width: 288px;
    border-radius: 10px;
    transform-origin: top right;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    padding: 12px;
  }

  .section {
    display: flex;
    flex-direction: column;
  }

  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
    margin-bottom: 6px;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 12px 0 10px 0;
  }

  .plane-matrix {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .plane-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    min-height: 48px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .plane-row.with-hand {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .plane-row.hidden-row {
    opacity: 0.55;
  }

  .plane-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .plane-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* Plane toggle — round 32px color dot that doubles as visibility control */
  .plane-toggle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    background: transparent;
    flex-shrink: 0;
    padding: 0;
  }

  .plane-toggle.visible {
    background: var(--dot-color);
    border-color: var(--dot-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .plane-toggle.hidden {
    background: transparent;
    border-color: color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .plane-toggle.implicit {
    cursor: default;
  }

  .plane-toggle.implicit::after {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.65);
  }

  .plane-toggle:hover:not(.implicit) {
    transform: scale(1.08);
  }

  .plane-label {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.88);
  }

  .plane-row.hidden-row .plane-label {
    color: rgba(255, 255, 255, 0.55);
  }

  /* Hand slots — 32px round dashed/filled circles */
  .hand-slot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px dashed;
    cursor: pointer;
    background: transparent;
    transition: border-color 0.15s ease;
    flex-shrink: 0;
    padding: 0;
  }

  .hand-slot.blue { border-color: rgba(74, 144, 217, 0.4); }
  .hand-slot.red { border-color: rgba(217, 74, 74, 0.4); }

  .hand-slot.filled.blue {
    background: #4a90d9;
    border: 2px solid #4a90d9;
    box-shadow: 0 0 10px rgba(74, 144, 217, 0.6);
  }

  .hand-slot.filled.red {
    background: #d94a4a;
    border: 2px solid #d94a4a;
    box-shadow: 0 0 10px rgba(217, 74, 74, 0.6);
  }

  .hand-slot:hover:not(.filled) {
    border-color: rgba(255, 255, 255, 0.5);
  }

  /* Reset button — only rendered when state is non-default */
  .reset-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .reset-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    position: relative;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .reset-btn.with-overrides .override-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    border: 1.5px solid rgba(14, 14, 24, 1);
  }
</style>
```

### - [ ] Step 2: Run svelte-check on the file

Run: `npx svelte-check --threshold error 2>&1 | grep "Viewer3DGearPopover" | head -10`
Expected: no errors for `Viewer3DGearPopover.svelte`.

### - [ ] Step 3: Run the full svelte-check to make sure no consumers broke

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: no NEW errors (the SceneOverlayControls error from Task 4 may still exist — that's addressed next).

### - [ ] Step 4: Visual verification

The user's dev server runs on port 5173. Use Chrome DevTools MCP to navigate to the sequence viewer and take a screenshot of the opened popover. Compare against `.superpowers/brainstorm/71602-1775861114/content/final-tight.html` — the mockup is the visual source of truth.

Run (via Chrome DevTools MCP):
1. `navigate_page` to `http://localhost:5173` and wait for the app to load
2. Navigate to a page that shows the sequence viewer with 3D mode active
3. Click the gear button in the top-right of the 3D viewer
4. Take a screenshot of the open popover

Expected: the popover should show the Camera 2×3 grid, a divider, then the Planes matrix with three rows (Wall filled purple with a small white inner dot and both hand slots filled, Wheel as an outlined blue circle with dimmed row, Floor similar). All interactive elements should visually match the mockup. No dropdowns, no DW button, no ALL toggle.

If the user hasn't granted Chrome DevTools MCP permission for this session, ask them: "Can you open the sequence viewer, click the 3D gear button, and tell me what you see?"

### - [ ] Step 5: Commit

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "refactor(3d): rewrite gear popover with unified Planes matrix

- Camera presets now use the grid variant (2x3 layout)
- Grid Planes + Hand Planes merged into one Planes matrix
- Plane color dot doubles as visibility toggle (round, 32px)
- Hand slots are 32px color-coded round buttons
- DW toggle removed (now derived from hand assignments)
- Beat scope toggle removed (sequence-wide only)
- Reset button appears only when state is non-default, clears
  both custom planes and beat overrides, shows indicator badge
  when beat overrides exist"
```

---

## Task 4: Delete orphaned SceneOverlayControls.svelte

**Goal:** `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte` was broken by earlier edits to `PlaneModeToggle.svelte` (it passes only `mode` and `onModeChange`, but `PlaneModeToggle` now requires 8+ props). Verify no consumers reference it, then delete it.

**Files:**
- Delete: `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte`

### - [ ] Step 1: Verify no consumers import it

Use the Grep tool:
- Pattern: `SceneOverlayControls`
- Glob: `**/*.{svelte,ts,js}`
- Path: `src/`

Expected: the only match is the file itself. If anything else imports it, STOP and report to the user — do not delete.

### - [ ] Step 2: Delete the file

Run: `rm /e/tka-platform/src/lib/shared/3d/components/panels/SceneOverlayControls.svelte`

### - [ ] Step 3: Run svelte-check to confirm the error is gone

Run: `npx svelte-check --threshold error 2>&1 | tail -10`
Expected: the `SceneOverlayControls.svelte:143:22` error that existed before is no longer listed.

### - [ ] Step 4: Commit

```bash
git add -A src/lib/shared/3d/components/panels/
git commit -m "chore(3d): delete orphaned SceneOverlayControls

File was broken by an earlier PlaneModeToggle prop-signature
change and was not imported anywhere. Removing rather than fixing
because it has no live consumers."
```

---

## Task 5: Full verification

**Goal:** Run the full build/check pipeline and visually confirm the popover works end to end.

**Files:** none (verification only)

### - [ ] Step 1: Run svelte-check

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: no errors related to the files touched in this plan (`Viewer3DGearPopover`, `Viewer3DViewPresets`, `avatar-instance-state`). Pre-existing errors elsewhere in the codebase may remain — those are out of scope.

### - [ ] Step 2: Run the unit tests

Run: `npx vitest run tests/unit/avatar-plane-mode-derivation.test.ts`
Expected: all 4 tests pass.

### - [ ] Step 3: Visual interaction test

Ask the user to confirm the interactions work end to end. Either use Chrome DevTools MCP to drive the flows yourself, or send the user this checklist to run manually:

- [ ] Open sequence viewer with a 3D-compatible sequence loaded
- [ ] Click the gear button (top-right of the 3D viewer)
- [ ] Popover opens with a visible camera 2×3 grid and planes matrix
- [ ] Wall row shows both hand slots filled, plane dot filled purple with white inner dot, row has "with-hand" highlight
- [ ] Wheel and Floor rows show empty dashed hand slots, outlined dots, rows are dimmed at 55% opacity
- [ ] Click the Wheel plane dot → Wheel row brightens, dot becomes filled blue (force-shown), no reset button yet appears? (It should appear — force-show is non-default.)
- [ ] Click the blue hand slot on the Wheel row → blue dot moves from Wall row to Wheel row. Wall row should still show red hand filled. Wheel row should now show blue filled.
- [ ] Click the red hand slot on the Wheel row → both hands now on Wheel. The renderer should switch to dual-wheel lateral layout (two grids, one per side).
- [ ] Click the reset button → both hands return to Wall, dual-wheel layout returns to single wall plane, reset button disappears.
- [ ] Press Escape → popover closes.
- [ ] Click outside the popover → popover closes.

Any checkbox that fails is a blocker — report the specific failure to the user and stop.

### - [ ] Step 4: No commit needed — verification only

---

## Self-Review Checklist

**1. Spec coverage:** Every spec section has at least one task.
- Problem (inconsistent typography, dropdowns, wasted space, repetition) → addressed by Task 3's rewrite
- Decision 1 (merge Grid + Hand Planes) → Task 3
- Decision 2 (visibility follows assignment) → Task 3 (`isImplicit` / `isForceShown` logic)
- Decision 3 (dot IS the toggle) → Task 3 (`.plane-toggle` component)
- Decision 4 (DW removed, derived) → Task 1 (state model) + Task 3 (no DW button in UI)
- Decision 5 (beat scope removed) → Task 3 (no scope toggle in UI)
- Decision 6 (2×3 camera) → Task 2
- Decision 7 (typography normalized) → Task 3 (consistent CSS)
- Visual design (all sizes, states, colors) → Task 3 (matches mockup)
- Interaction behavior tables → Task 3 (`handlePlaneToggleClick`, `handleHandSlotClick`)
- Derived state → Task 1 (`derivePlaneModeFromHands`)
- Open question (Option C: preserve overrides + indicator + reset clears all) → Task 3 (`reset-btn.with-overrides` + `clearBeatPlaneOverrides()` call)
- Out of scope items (per-beat UI, continuous plane transitions) → explicitly not in any task ✓

**2. Placeholder scan:** Plan has no TBD/TODO/fill-in-later. Every step has either exact code or exact commands. ✓

**3. Type consistency:**
- `setHandPlane(hand, plane)` signature matches between Task 1 (definition) and Task 3 (usage) ✓
- `derivePlaneModeFromHands(bluePlane, redPlane)` signature matches between Task 1's test and Task 1's implementation ✓
- `clearBeatPlaneOverrides()` — already exists in avatarState (verified via grep at lines 453 and 670 of avatar-instance-state.svelte.ts), signature matches usage in Task 3 ✓
- `customBluePlane`, `customRedPlane`, `hasBeatOverrides`, `visiblePlanes`, `togglePlane` — all existing API on avatarState/viewer3DState ✓
- CSS class names referenced in `class:` directives match `<style>` selectors (`.plane-toggle.visible`, `.plane-toggle.hidden`, `.plane-toggle.implicit`, `.hand-slot.blue.filled`, etc.) ✓
- `Viewer3DViewPresets grid` prop introduced in Task 2, consumed in Task 3 ✓
