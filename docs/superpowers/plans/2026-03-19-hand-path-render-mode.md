# Hand Path Render Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `handPathMode` flag to the rendering pipeline that shows pure spatial hand trajectories — hands instead of props, float arrows for shifts, dash arrows for dashes, no TKA, no reversals.

**Architecture:** The flag is added to `PreviewCellRenderOptions` and `PrepareOptions`. PreviewCellRenderer maps it to visibility overrides (TKA off, reversals off) and prop overrides (HAND). PictographPreparer transforms motions when the flag is set (pro/anti → float). PropPlacer already returns 0° rotation for HAND props, so no rotation manager changes needed.

**Tech Stack:** Svelte 5, TypeScript, Canvas 2D rendering pipeline

**Spec:** `docs/superpowers/specs/2026-03-19-hand-path-render-mode-design.md`

---

### Task 1: Add `handPathMode` to render option interfaces

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/contracts/IPreviewCellRenderer.ts:15-47`
- Modify: `src/lib/shared/pictograph/shared/services/contracts/IPictographPreparer.ts:19-41`

- [ ] **Step 1: Add `handPathMode` to `PreviewCellRenderOptions`**

In `IPreviewCellRenderer.ts`, add after the `showReversals` field (line 46):

```typescript
  /** When true, renders hand path visualization: HAND props, float arrows for shifts,
   *  no TKA overlay, no reversals. Shows pure spatial trajectory. */
  handPathMode?: boolean;
```

- [ ] **Step 2: Add `handPathMode` to `PrepareOptions`**

In `IPictographPreparer.ts`, add after the `useGridVersion` field (line 40):

```typescript
  /** When true, transforms motions for hand path visualization:
   *  pro/anti → float, propType → HAND, orientation → null. */
  handPathMode?: boolean;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -5`
Expected: No errors (new optional fields don't break existing callers)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/IPreviewCellRenderer.ts src/lib/shared/pictograph/shared/services/contracts/IPictographPreparer.ts
git commit -m "feat: add handPathMode to render option interfaces"
```

---

### Task 2: Add `handPathMode` to CellCacheKeyDeriver

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/implementations/CellCacheKeyDeriver.ts:42-74`

- [ ] **Step 1: Include handPathMode in cache key**

In `CellCacheKeyDeriver.ts`, add to the `keyParts` array after the `widthMultiplier` entry (line 71):

```typescript
      // Hand path mode renders completely different pictographs (float arrows, HAND props)
      options.handPathMode ? "hp1" : "",
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/implementations/CellCacheKeyDeriver.ts
git commit -m "feat: include handPathMode in cell cache key"
```

---

### Task 3: Wire `handPathMode` through PreviewCellRenderer

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts:40-95`

- [ ] **Step 1: Import PropType**

Add at the top of the file (after existing imports around line 19):

```typescript
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
```

- [ ] **Step 2: Update prepareSingle call to pass handPathMode**

Replace the `prepareSingle` call (lines 60-66) with:

```typescript
    // In hand path mode, override props to HAND for both hands.
    // PictographPreparer will handle the motion transform (pro/anti → float).
    const isHandPath = options.handPathMode ?? false;
    const effectiveBlueProp = isHandPath ? PropType.HAND : options.bluePropType;
    const effectiveRedProp = isHandPath
      ? PropType.HAND
      : (options.catDogModeEnabled ? options.redPropType : options.bluePropType);

    const prepared = await pictographPreparer.prepareSingle(pictographData, {
      themeMode: isDark ? "dark" : "light",
      bluePropType: effectiveBlueProp,
      redPropType: effectiveRedProp,
      handPathMode: isHandPath,
    });
```

- [ ] **Step 3: Update LayerRenderOptions to use effective prop types**

Replace the `renderOptions` block (lines 69-79) with:

```typescript
    const renderOptions: LayerRenderOptions = {
      size: options.size,
      widthMultiplier: options.widthMultiplier,
      darkMode: isDark,
      showNonRadialPoints: options.showNonRadialPoints ?? true,
      handPointVisibility: options.handPointVisibility ?? "all",
      bluePropType: effectiveBlueProp,
      redPropType: effectiveRedProp,
    };
```

- [ ] **Step 4: Update visibility to suppress TKA/reversals in hand path mode**

Replace the `visibility` block (lines 82-85) with:

```typescript
    const visibility: LayerVisibility = {
      showTKA: isHandPath ? false : (options.showTKA ?? true),
      showReversals: isHandPath ? false : (options.showReversals ?? true),
    };
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -5`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts
git commit -m "feat: wire handPathMode through PreviewCellRenderer"
```

---

### Task 4: Transform motions in PictographPreparer

This is the core change. When `handPathMode` is true, clone each motion and transform pro/anti → float before arrow/prop calculations.

**Files:**
- Modify: `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts:99-138` (doPrepare method)
- Modify: `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts:145-191` (deriveCacheKey method)

**Reference:**
- `src/lib/shared/pictograph/shared/domain/models/MotionData.ts` — MotionData interface
- `src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts` — MotionType, HandPath enums
- `packages/sequence-engine/src/core/orientation/OrientationCalculator.ts` — getHandpathDirection

- [ ] **Step 1: Add imports for hand path mode transform**

Add near the top of `PictographPreparer.ts` (after existing imports, around line 30):

```typescript
import { MotionType, HandPath } from "../../domain/enums/pictograph-enums";
```

Check if `MotionType` is already imported. If not, add it. The `HandPath` import is needed for the handpath derivation.

- [ ] **Step 2: Add the motion transform method**

Add this private method to the `PictographPreparer` class (after `getMotionsWithOverrides`, around line 311):

```typescript
  /**
   * Transform motions for hand path visualization.
   * Pro/anti become float (shows spatial trajectory without prop rotation).
   * Dash stays dash. Static stays static. Orientation is nulled out
   * because hands don't have orientation — PropPlacer already returns
   * 0° rotation for HAND propType.
   */
  private transformForHandPath(pictograph: PictographData): PictographData {
    const motions = pictograph.motions;
    if (!motions) return pictograph;

    const transform = (motion: MotionData): MotionData => {
      const isShift = motion.motionType === MotionType.PRO || motion.motionType === MotionType.ANTI;

      // Derive handpath direction from start→end locations.
      // This determines the float arrow direction.
      const handPath = this.deriveHandPath(motion.startLocation, motion.endLocation);

      return {
        ...motion,
        // Pro/anti → float. Dash and static stay as-is.
        motionType: isShift ? MotionType.FLOAT : motion.motionType,
        // Float uses "fl" turns marker, others keep their turns.
        turns: isShift ? ("fl" as const) : motion.turns,
        // Store handpath for float arrow direction derivation.
        handPath: isShift ? handPath : (motion.handPath ?? null),
        // Null out orientation — hands don't have prop orientation.
        // PropPlacer returns 0° for HAND propType regardless.
        startOrientation: undefined as any,
        endOrientation: undefined as any,
        // Force HAND prop type
        propType: PropType.HAND,
      };
    };

    return {
      ...pictograph,
      motions: {
        blue: motions.blue ? transform(motions.blue) : undefined,
        red: motions.red ? transform(motions.red) : undefined,
      } as PictographData["motions"],
    };
  }

  /**
   * Derive handpath direction from start/end locations.
   * Maps location pairs to CW, CCW, DASH, or STATIC.
   */
  private deriveHandPath(startLocation: string, endLocation: string): HandPath | null {
    const CW_PAIRS: [string, string][] = [
      ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
      ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
    ];
    const CCW_PAIRS: [string, string][] = [
      ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
      ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
    ];
    const DASH_PAIRS: [string, string][] = [
      ["s", "n"], ["w", "e"], ["n", "s"], ["e", "w"],
      ["ne", "sw"], ["se", "nw"], ["sw", "ne"], ["nw", "se"],
    ];

    const s = startLocation.toLowerCase();
    const e = endLocation.toLowerCase();

    if (s === e) return HandPath.STATIC;
    if (CW_PAIRS.some(([a, b]) => a === s && b === e)) return HandPath.CLOCKWISE;
    if (CCW_PAIRS.some(([a, b]) => a === s && b === e)) return HandPath.COUNTER_CLOCKWISE;
    if (DASH_PAIRS.some(([a, b]) => a === s && b === e)) return HandPath.DASH;

    return null;
  }
```

- [ ] **Step 3: Apply the transform in doPrepare**

In the `doPrepare` method (around line 99), add the hand path transform BEFORE the prop override logic. Insert after `const gridMode = this.deriveGridMode(pictograph);` (line 103):

```typescript
    // Hand path mode: transform motions before any position calculations.
    // Must happen FIRST so arrow lifecycle and prop placement see float motions.
    const effectivePictograph = options?.handPathMode
      ? this.transformForHandPath(pictograph)
      : pictograph;
```

Then change all subsequent references to `pictograph` in `doPrepare` to `effectivePictograph`:
- Line ~114: `const overriddenMotions = this.getMotionsWithOverrides(effectivePictograph, settings, options);`
- Line ~115-118: `const pictographWithPropOverrides: PictographData = { ...effectivePictograph, motions: ... };`
- Line ~125: `const { propPositions, propAssets } = await this.calculateProps(effectivePictograph, options);`

- [ ] **Step 4: Include handPathMode in cache key**

In the `deriveCacheKey` method (around line 145), add to the `parts` array after the last entry (line ~188):

```typescript
      // Hand path mode produces completely different motion transforms
      options?.handPathMode ? "hp" : "",
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -5`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts
git commit -m "feat: transform motions for hand path mode in PictographPreparer"
```

---

### Task 5: Verify end-to-end rendering

- [ ] **Step 1: Build the project**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 2: Manual verification**

Test by temporarily adding `handPathMode: true` to a choreo card render call, or by checking the user's running dev server. The hand path card should show:
- HAND prop SVGs (not staff)
- Float arrows for shift motions (CW/CCW trajectory arrows)
- Dash arrows for dash motions
- No arrows for static motions
- No TKA letter overlay
- No reversal indicators
- Hands always at 0° rotation (no orientation-based rotation)

- [ ] **Step 3: Commit any fixes needed**

---

### Task 6: Final commit

- [ ] **Step 1: Commit all changes**

If any unstaged fixes remain from verification:

```bash
git add -A
git commit -m "feat: hand path render mode - complete implementation"
```
