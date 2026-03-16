# Path Shape Toggle (Arc vs Linear) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an arc/linear path shape toggle to the animation system, allowing shifts to render as straight lines instead of arcs, with per-sequence metadata storage.

**Architecture:** Path shape is a performance-layer property (like prop type, grip, effects) — not notated in pictographs. A `pathShape` setting in `AnimationVisibilityStateManager` controls global interpolation behavior. Per-sequence preferences are stored in `SequenceData.metadata`. Three interpolation sites (2D prop, 2D hand path, 3D prop) branch on this setting. Context menu and canvas settings modal expose the toggle.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, localStorage persistence

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/animation-engine/components/canvas-settings-modal/categories/PathShapeCategory.svelte` | Path shape toggle UI in canvas settings modal |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` | Add `pathShape` to settings, getter/setter, persistence/migration |
| `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts` | Add Path Shape submenu (Arc/Linear radio) |
| `src/lib/features/hand-path-builder/services/HandPathAnimator.ts` | Read `pathShape` setting; use linear interpolation for shifts when `"linear"` |
| `src/lib/features/compose/services/implementations/PropInterpolator.ts` | Read `pathShape` setting; use Cartesian interpolation for non-dash motions when `"linear"` |
| `src/lib/shared/3d-animation/services/implementations/PropStateInterpolator.ts` | Read `pathShape` setting; use Cartesian interpolation for non-dash motions when `"linear"` |
| `src/lib/shared/animation-engine/components/canvas-settings-modal/CanvasSettingsModal.svelte` | Add PathShapeCategory to modal layout |
| `src/lib/shared/foundation/domain/models/SequenceData.ts` | Document `metadata.pathShape` convention (comment only, no interface change — uses existing `metadata` bag) |

---

## Chunk 1: Animation State + Interpolation

### Task 1: Add pathShape to AnimationVisibilityStateManager

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

- [ ] **Step 1: Add pathShape to the settings interface and defaults**

In `AnimationVisibilitySettings`, add after `effortPreset`:

```typescript
  /** Path shape for shift interpolation: "arc" (default) or "linear" */
  pathShape: "arc" | "linear";
```

In `getDefaultSettings()`, add:

```typescript
  pathShape: "arc",
```

- [ ] **Step 2: Add getter and setter**

After the effort preset getter/setter block (~line 809), add:

```typescript
  // ============================================================================
  // PATH SHAPE
  // ============================================================================

  getPathShape(): "arc" | "linear" {
    return this.settings.pathShape;
  }

  setPathShape(shape: "arc" | "linear"): void {
    this.settings.pathShape = shape;
    this.saveToStorage();
    this.notifyObservers();
  }

  togglePathShape(): void {
    this.setPathShape(this.settings.pathShape === "arc" ? "linear" : "arc");
  }
```

- [ ] **Step 3: Exclude pathShape from the boolean getVisibility/setVisibility/toggleVisibility type unions**

Add `"pathShape"` to the `Exclude<>` union in the three methods: `getVisibility`, `setVisibility`, `toggleVisibility`. Same pattern as `effortPreset`.

- [ ] **Step 4: Add migration guard in loadFromStorage**

After the existing migration blocks (around line 233), add:

```typescript
  if (!("pathShape" in parsed)) parsed.pathShape = "arc";
```

This ensures users with existing localStorage don't get `undefined`.

- [ ] **Step 5: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors related to pathShape

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "feat: add pathShape setting to animation visibility state"
```

---

### Task 2: Update HandPathAnimator to respect pathShape

**Files:**
- Modify: `src/lib/features/hand-path-builder/services/HandPathAnimator.ts`

The key insight: currently `isDash` determines whether to use Cartesian (linear) or angular (arc) interpolation. With path shape toggle, non-dash motions (shifts) can ALSO use Cartesian interpolation when `pathShape === "linear"`.

- [ ] **Step 1: Add helper to determine if linear interpolation should be used**

After the `applyEasing` function (~line 57), add:

```typescript
/** Should this motion use linear (Cartesian) interpolation? */
function shouldUseLinear(isDash: boolean): boolean {
  if (isDash) return true; // Dashes are always linear
  return getAnimationVisibilityManager().getPathShape() === "linear";
}
```

- [ ] **Step 2: Update getPathPoints to use shouldUseLinear**

Replace line 72 (`const isDash = isOpposite(from, to);`) and the branching logic:

```typescript
  const isDash = isOpposite(from, to);
  const useLinear = shouldUseLinear(isDash);

  const points: Array<{ x: number; y: number }> = [];

  if (useLinear) {
    // Straight line (through center for dashes, direct for linear shifts)
    const sx = Math.cos(startAngle);
    const sy = Math.sin(startAngle);
    const ex = Math.cos(endAngle);
    const ey = Math.sin(endAngle);
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const cx = sx + (ex - sx) * t;
      const cy = sy + (ey - sy) * t;
      points.push({
        x: CENTER + cx * GRID_RADIUS,
        y: CENTER + cy * GRID_RADIUS,
      });
    }
  } else {
    // Arc along the grid circle
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const angle = lerpAngle(startAngle, endAngle, t);
      points.push({
        x: CENTER + Math.cos(angle) * GRID_RADIUS,
        y: CENTER + Math.sin(angle) * GRID_RADIUS,
      });
    }
  }
```

- [ ] **Step 3: Update animate() to use shouldUseLinear**

In the `animate` method, replace the `isDash` usage with `useLinear`:

After line 141 (`const isDash = !isSamePoint && isOpposite(startPosition, endPosition);`), add:

```typescript
    const useLinear = shouldUseLinear(isDash);
```

Update the Cartesian pre-computation (lines 143-146):

```typescript
    const startX = useLinear ? Math.cos(startAngle) : 0;
    const startY = useLinear ? Math.sin(startAngle) : 0;
    const endX = useLinear ? Math.cos(endAngle) : 0;
    const endY = useLinear ? Math.sin(endAngle) : 0;
```

In the tick function, replace `if (isDash)` with `if (useLinear)`:

```typescript
        if (useLinear) {
          cartX = startX + (endX - startX) * t;
          cartY = startY + (endY - startY) * t;
          angle = Math.atan2(cartY, cartX);
        } else {
          angle = lerpAngle(startAngle, endAngle, t);
        }
```

- [ ] **Step 4: Update applyPosition to use useLinear**

The `applyPosition` call and method use `isDash` to determine coordinate calculation. Change the parameter and branching:

In the tick function call: `this.applyPosition(element, angle, useLinear, cartX, cartY, handCenter);`

In applyPosition method signature, rename `isDash` to `useLinear`:

```typescript
  private applyPosition(
    element: SVGGElement,
    centerAngle: number,
    useLinear: boolean,
    cartX: number,
    cartY: number,
    handCenter: { x: number; y: number },
  ): void {
    let x: number;
    let y: number;

    if (useLinear) {
```

Also update the instant-position call at line 149: `this.applyPosition(element, endAngle, useLinear, endX, endY, handCenter);`

- [ ] **Step 5: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/hand-path-builder/services/HandPathAnimator.ts
git commit -m "feat: HandPathAnimator respects pathShape setting for linear shifts"
```

---

### Task 3: Update PropInterpolator (2D) to respect pathShape

**Files:**
- Modify: `src/lib/features/compose/services/implementations/PropInterpolator.ts`

Currently, `interpolatePropAngles` branches on `motionType === MotionType.DASH`. With pathShape, non-dash shifts should also use Cartesian interpolation when linear.

- [ ] **Step 1: Import the visibility manager**

Add at the top of the file:

```typescript
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
```

- [ ] **Step 2: Add shouldUseLinear helper**

Before the class definition:

```typescript
function shouldUseLinear(motionType: MotionType): boolean {
  if (motionType === MotionType.DASH) return true;
  // Only shifts can toggle between arc and linear. Static and other types are unaffected.
  if (motionType === MotionType.SHIFT) {
    return getAnimationVisibilityManager().getPathShape() === "linear";
  }
  return false;
}
```

- [ ] **Step 3: Update interpolatePropAngles to use shouldUseLinear**

Replace the blue interpolation block (lines 50-63):

```typescript
      const blueDash = shouldUseLinear(blueMotion.motionType);
      blueAngles = blueDash
        ? this.interpolateDashMotion(blueEndpoints, stepProgress)
        : {
            centerPathAngle: this.angleCalculator.lerpAngle(
              blueEndpoints.startCenterAngle,
              blueEndpoints.targetCenterAngle,
              stepProgress
            ),
            staffRotationAngle: this.angleCalculator.normalizeAnglePositive(
              blueEndpoints.startStaffAngle +
                blueEndpoints.staffRotationDelta * stepProgress
            ),
          };
```

Replace the red interpolation block (lines 71-84) with the same pattern:

```typescript
      const redDash = shouldUseLinear(redMotion.motionType);
      redAngles = redDash
        ? this.interpolateDashMotion(redEndpoints, stepProgress)
        : {
            centerPathAngle: this.angleCalculator.lerpAngle(
              redEndpoints.startCenterAngle,
              redEndpoints.targetCenterAngle,
              stepProgress
            ),
            staffRotationAngle: this.angleCalculator.normalizeAnglePositive(
              redEndpoints.startStaffAngle +
                redEndpoints.staffRotationDelta * stepProgress
            ),
          };
```

- [ ] **Step 4: Rename interpolateDashMotion to interpolateLinearMotion**

The method now handles both dashes and linear shifts. Rename for clarity:

```typescript
  private interpolateLinearMotion(
    endpoints: MotionEndpoints,
    progress: number
  ): { ... }
```

Update both call sites to use `this.interpolateLinearMotion(...)`.

Update the JSDoc:

```typescript
  /**
   * Interpolate motion using Cartesian coordinates (straight line path)
   * Used for DASH motions and shifts when pathShape is "linear"
   */
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/compose/services/implementations/PropInterpolator.ts
git commit -m "feat: PropInterpolator respects pathShape setting for linear shifts"
```

---

### Task 4: Update PropStateInterpolator (3D) to respect pathShape

**Files:**
- Modify: `src/lib/shared/3d-animation/services/implementations/PropStateInterpolator.ts`

Same pattern as Task 3 but for the 3D renderer.

- [ ] **Step 1: Import the visibility manager**

```typescript
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
```

- [ ] **Step 2: Update calculatePropState to branch on pathShape**

Replace line 119 (`if (config.motionType === MotionType.DASH)`) with:

```typescript
    const useLinear =
      config.motionType === MotionType.DASH ||
      (config.motionType === MotionType.SHIFT &&
        getAnimationVisibilityManager().getPathShape() === "linear");

    if (useLinear) {
```

Note: explicitly check `MotionType.SHIFT` rather than `!== STATIC`, so future motion types don't accidentally get linear interpolation.

The rest of the dash interpolation block stays the same — `interpolateDashPosition` already does Cartesian interpolation, which is exactly what linear shifts need.

- [ ] **Step 3: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d-animation/services/implementations/PropStateInterpolator.ts
git commit -m "feat: 3D PropStateInterpolator respects pathShape setting"
```

---

## Chunk 2: UI Integration

### Task 5: Add Path Shape to context menu

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts`

- [ ] **Step 1: Add buildPathShapeChildren function**

After `buildEffortChildren` (~line 105):

```typescript
function buildPathShapeChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const current = vm.getPathShape();
  return [
    {
      id: "path-arc",
      label: "Arc",
      icon: "fa-bezier-curve",
      checked: current === "arc",
      action: () => vm.setPathShape("arc"),
    },
    {
      id: "path-linear",
      label: "Linear",
      icon: "fa-arrows-alt-h",
      checked: current === "linear",
      action: () => vm.setPathShape("linear"),
    },
  ];
}
```

- [ ] **Step 2: Add Path Shape submenu to the menu items**

In `buildCanvasContextMenuItems`, after the efforts submenu entry (line 126), add:

```typescript
    {
      id: "path-shape-submenu",
      label: "Path Shape",
      icon: "fa-draw-polygon",
      children: buildPathShapeChildren(vm),
    },
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts
git commit -m "feat: add Path Shape submenu to canvas context menu"
```

---

### Task 6: Create PathShapeCategory for canvas settings modal

**Files:**
- Create: `src/lib/shared/animation-engine/components/canvas-settings-modal/categories/PathShapeCategory.svelte`

- [ ] **Step 1: Create the component**

Follow the exact pattern of `EffortCategory.svelte`:

```svelte
<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";

  const vm = getAnimationVisibilityManager();

  let pathShape = $state(vm.getPathShape());

  function handleVisibilityChange(): void {
    pathShape = vm.getPathShape();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  const options = [
    { id: "arc" as const, label: "Arc", color: "#60a5fa" },
    { id: "linear" as const, label: "Linear", color: "#f97316" },
  ];
</script>

<div class="path-shape-grid">
  {#each options as option}
    <button
      class="path-btn"
      class:active={pathShape === option.id}
      type="button"
      aria-pressed={pathShape === option.id}
      onclick={() => vm.setPathShape(option.id)}
      style:--path-color={option.color}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .path-shape-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .path-btn {
    min-height: var(--min-touch-target, 44px);
    padding: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .path-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .path-btn.active {
    background: color-mix(in srgb, var(--path-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--path-color) 50%, transparent);
    color: var(--theme-text, white);
  }

  .path-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--path-color) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .path-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/canvas-settings-modal/categories/PathShapeCategory.svelte
git commit -m "feat: add PathShapeCategory component for canvas settings modal"
```

---

### Task 7: Add PathShapeCategory to CanvasSettingsModal

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-settings-modal/CanvasSettingsModal.svelte`

- [ ] **Step 1: Import PathShapeCategory**

Add to the imports in `CanvasSettingsModal.svelte`:

```typescript
import PathShapeCategory from "./categories/PathShapeCategory.svelte";
```

- [ ] **Step 2: Add Path Shape control group inside the Motion collapsible section**

The modal uses collapsible sections with `<div class="control-group">` + `<span class="group-label">` for sub-sections. Path Shape goes inside the `{#if motionOpen}` block, after the Effort control-group (after line 258).

Insert after the closing `</div>` of the Effort control-group:

```svelte
          <div class="control-group">
            <span class="group-label">Path Shape</span>
            <PathShapeCategory />
          </div>
```

This places it inside the Motion collapsible section alongside Playback and Effort, which is semantically correct — path shape is a motion/interpolation property.

- [ ] **Step 4: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/canvas-settings-modal/CanvasSettingsModal.svelte
git commit -m "feat: add Path Shape section to canvas settings modal"
```

---

## Chunk 3: Choreo Card Metadata

### Task 8: Store pathShape in sequence metadata on save

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (save + load)
- Modify: `src/lib/shared/foundation/domain/models/SequenceData.ts` (documentation comment)

The `intendedProp` is captured in `handleSave()` (~line 1018) and `handleSetAsIntended()` (~line 1058). PathShape should be captured at both sites.

- [ ] **Step 1: Import the visibility manager in SequenceViewerOrchestrator.svelte**

Add to the existing imports:

```typescript
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
```

(Check if already imported — it may be, since the orchestrator handles animation.)

- [ ] **Step 2: Capture pathShape in handleSave()**

In `handleSave()` (~line 1031), where `createSequenceData` is called with `intendedProp`, also inject pathShape into the metadata bag:

```typescript
    const currentPathShape = getAnimationVisibilityManager().getPathShape();
    const pathShapeMetadata = currentPathShape !== "arc"
      ? { ...sequence.metadata, pathShape: currentPathShape }
      : sequence.metadata;

    const sequenceWithIntent = createSequenceData({
      ...sequence,
      metadata: pathShapeMetadata,
      intendedProp: {
        bluePropType: bluePropType ?? PropType.STAFF,
        redPropType: redPropType ?? PropType.STAFF,
        catDogMode: catDogModeEnabled ?? false,
      },
    });
```

- [ ] **Step 3: Capture pathShape in handleSetAsIntended()**

Apply the same pattern in `handleSetAsIntended()` (~line 1058). This function updates intended prop on existing sequences — pathShape should be updated too.

- [ ] **Step 4: Restore pathShape when sequence is selected for playback**

In the same orchestrator file, find where the `sequence` prop/state changes trigger playback setup. Add an `$effect` or insert into the existing sequence-change handler:

```typescript
// Restore path shape from sequence metadata when loading
const savedPathShape = sequence?.metadata?.pathShape;
if (savedPathShape === "arc" || savedPathShape === "linear") {
  getAnimationVisibilityManager().setPathShape(savedPathShape);
}
```

This should run when the sequence changes, not on every render. Look for existing `$effect` blocks that react to `sequence` changes and add it there.

- [ ] **Step 5: Add documentation comment to SequenceData.ts**

In `src/lib/shared/foundation/domain/models/SequenceData.ts`, replace the comment above `metadata` (~line 80):

```typescript
  /**
   * Extensible metadata bag for stylistic/performance properties.
   *
   * Known keys:
   * - `pathShape`: "arc" | "linear" — creator's intended path shape for shift interpolation.
   *   Absent or "arc" = default arc behavior. "linear" = straight-line shifts.
   */
  readonly metadata: Record<string, unknown>;
```

- [ ] **Step 6: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte src/lib/shared/foundation/domain/models/SequenceData.ts
git commit -m "feat: capture and restore pathShape in sequence metadata"
```

---

### Task 9: Display pathShape in choreo card footer

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

- [ ] **Step 1: Read the ChoreoCard to understand footer structure**

Read `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` and find:
1. The `showFooter` derived value (likely `showCreatorName || showNotes || showBirthday`)
2. The `{#if showFooter}` template block
3. The existing footer CSS classes (`.footer-name`, `.footer-notes`, `.footer-birthday`)

- [ ] **Step 2: Add hasPathShapeMetadata derived and update showFooter**

Add a derived for detecting non-default path shape:

```typescript
const hasPathShapeMetadata = $derived(sequence?.metadata?.pathShape === "linear");
```

Update the `showFooter` derived to include this:

```typescript
const showFooter = $derived(showCreatorName || showNotes || showBirthday || hasPathShapeMetadata);
```

- [ ] **Step 3: Add pathShape display to footer template**

Inside the `{#if showFooter}` block, after the existing footer items, add:

```svelte
    {#if hasPathShapeMetadata}
      <span class="footer-path-shape">Linear shifts</span>
    {/if}
```

- [ ] **Step 4: Add CSS for footer-path-shape**

Match the existing footer text styling (look at `.footer-notes` for reference). Add to the `<style>` block:

```css
  .footer-path-shape {
    font-size: inherit;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }
```

The `font-size: inherit` picks up the responsive `footerFontSize` set on the parent `.footer-section`.

- [ ] **Step 3: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat: display path shape preference in choreo card footer"
```

---

## Verification

After all tasks complete:

- [ ] **Manual test 1:** Open canvas, right-click → Path Shape → Linear. Play a sequence with shifts. Shifts should move in straight lines between grid points instead of arcing.
- [ ] **Manual test 2:** Switch back to Arc. Shifts should arc normally.
- [ ] **Manual test 3:** Open Canvas Settings modal. Path Shape section should show Arc/Linear toggle.
- [ ] **Manual test 4:** Close and reopen the app. Path shape preference should persist (localStorage).
- [ ] **Manual test 5:** Save a sequence with Linear path shape. Reopen it — the path shape should restore from metadata.
- [ ] **Manual test 6:** View a choreo card for a linear-saved sequence. Footer should show "Linear shifts".
- [ ] **Manual test 7:** View existing sequences (no metadata.pathShape). Should render normally with arc default.
