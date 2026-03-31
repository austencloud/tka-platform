# Render Core Unification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all duplicated rendering logic between the app and MCP server by making `packages/render-core` the single source of truth, then having both consumers import from it.

**Architecture:** The `@tka/render-core` package contains pure TypeScript functions (no Svelte, no browser APIs, no DI). Both the Svelte app and the MCP server depend on it. The MCP server's `vendor/render-core/` copy and all custom reimplementations in `mcp-server-pkg/src/core/` are deleted. The app's `PropPlacer` becomes a thin settings-resolver that delegates all calculation to render-core.

**Tech Stack:** Pure TypeScript, string literal types (not enums), npm workspace dependency

---

## Current State (The Problem)

There are **5 copies** of rendering logic:

| Location | Role | Status |
|----------|------|--------|
| `packages/render-core/src/` | Canonical shared package | INCOMPLETE: missing PropPlacer gates, Letter I maps, prop classification |
| `src/lib/shared/render/core/` | App re-export wrapper | OK (just re-exports) |
| `src/lib/shared/pictograph/prop/` | App's full prop placement | COMPLETE and tested, but uses app enums |
| `mcp-server-pkg/vendor/render-core/` | Vendored copy | Stale copy, should be a dependency |
| `mcp-server-pkg/src/core/*.ts` | Custom reimplementations | 2-3x larger, drifted, buggy |

### What render-core is MISSING (compared to app's PropPlacer)

1. **Letter I direction maps** (LETTER_I_RADIAL_MAP, LETTER_I_NON_RADIAL_MAP)
2. **Hybrid orientation skip** (one radial + one non-radial = no offset)
3. **Buugeng family nesting skip** (opposite chirality = no offset)
4. **Unilateral prop skip** (same type different orientation = no offset for clubs/hoops)
5. **Hand prop direction-aware positioning** (approach direction matters)
6. **Prop-type-specific offset distances** (clubs smaller than staves)
7. **Letter G/H dedicated handler** (red gets static/dash map, blue gets opposite)
8. **Letter I dedicated handler** (uses its own direction maps)
9. **BetaPropDirectionCalculator orchestration** (routes to correct handler by letter + motion type)

### What MCP has that should be DELETED

| File | Size | Canonical Equivalent | Action |
|------|------|---------------------|--------|
| `mcp-server-pkg/vendor/render-core/` | Full directory | `packages/render-core/` | Delete, use package dependency |
| `mcp-server-pkg/src/core/arrow-placement.ts` | 13K | `packages/render-core/src/calculations/arrow-placement.ts` (4.3K) | Delete |
| `mcp-server-pkg/src/core/dash-location.ts` | 16K | `packages/render-core/src/calculations/dash-location.ts` (7.5K) | Delete |
| `mcp-server-pkg/src/core/orientation-calculator.ts` | ~8K | `packages/render-core/src/calculations/orientation.ts` (11.7K) | Delete |
| `mcp-server-pkg/src/core/beta-offset.ts` | ~15K | `packages/render-core/src/calculations/beta-offset.ts` (10K, after upgrade) | Delete |
| `mcp-server-pkg/src/core/prop-placement.ts` | ~5K | `packages/render-core/src/calculations/prop-placement.ts` (2.4K) | Delete |
| `mcp-server-pkg/src/core/grid-coordinates.ts` | ~4K | `packages/render-core/src/constants/grid-coordinates.ts` (4.3K) | Delete |
| `mcp-server-pkg/src/core/enums.ts` | ~3K | `packages/render-core/src/types.ts` (4K) | Delete |

Files that stay in MCP (genuinely MCP-specific):
- `standalone-renderer.ts` — SVG assembly + resvg, imports from render-core
- `arrow-adjustment.ts` — prop geometry tier adjustments (MCP-only tuning layer)
- `sequence-builder.ts` — sequence generation (no app equivalent)
- `letter-transition-graph.ts` — constraint solver (no app equivalent)
- `text-renderer.ts` — SVG text rendering (MCP-only)
- `sequence-renderer.ts` — multi-beat choreo card assembly (MCP-only)
- `turn-allocator.ts`, `word-simplifier.ts`, `difficulty-calculator.ts` — generation logic
- `orientation-propagation.ts` — bridges builder to orientation calc (thin adapter, keep)

---

## File Structure

### New files in `packages/render-core/src/`

```
packages/render-core/src/
  calculations/
    beta-offset.ts          ← REWRITE: complete with all gates from PropPlacer
    prop-placement.ts       ← UNCHANGED
    arrow-placement.ts      ← UNCHANGED
    arrow-rotation.ts       ← UNCHANGED
    dash-location.ts        ← UNCHANGED
    grid-position.ts        ← UNCHANGED
    orientation.ts          ← UNCHANGED
    reversal-positions.ts   ← UNCHANGED
  constants/
    direction-maps.ts       ← ADD: Letter I maps, Letter G/H maps
    grid-coordinates.ts     ← UNCHANGED
    rotation-maps.ts        ← UNCHANGED
    dash-location-maps.ts   ← UNCHANGED
    glyph-positions.ts      ← UNCHANGED
    viewbox.ts              ← UNCHANGED
    prop-classification.ts  ← NEW: getBetaOffsetSize, isUnilateralProp, isBuugengFamilyProp
  types.ts                  ← ADD: BetaPropInput interface (expanded)
  index.ts                  ← UPDATE: export new items
```

### Deleted files

```
DELETE: mcp-server-pkg/vendor/render-core/     (entire directory)
DELETE: mcp-server-pkg/src/core/arrow-placement.ts
DELETE: mcp-server-pkg/src/core/dash-location.ts
DELETE: mcp-server-pkg/src/core/orientation-calculator.ts
DELETE: mcp-server-pkg/src/core/beta-offset.ts
DELETE: mcp-server-pkg/src/core/prop-placement.ts
DELETE: mcp-server-pkg/src/core/grid-coordinates.ts
DELETE: mcp-server-pkg/src/core/enums.ts
```

### Modified files

```
MODIFY: mcp-server-pkg/src/core/standalone-renderer.ts  ← imports from @tka/render-core
MODIFY: mcp-server-pkg/src/core/arrow-adjustment.ts     ← imports from @tka/render-core
MODIFY: mcp-server-pkg/src/core/orientation-propagation.ts ← imports from @tka/render-core
MODIFY: mcp-server-pkg/package.json                     ← add @tka/render-core dependency
MODIFY: mcp-server-pkg/tsconfig.json                    ← add path mapping
MODIFY: src/lib/shared/pictograph/prop/services/implementations/PropPlacer.ts ← delegate to render-core
MODIFY: src/lib/shared/render/core/                     ← update re-exports if needed
```

---

## Task 1: Add prop classification helpers to render-core

**Files:**
- Create: `packages/render-core/src/constants/prop-classification.ts`
- Modify: `packages/render-core/src/index.ts`
- Reference: `src/lib/shared/pictograph/prop/domain/enums/PropClassification.ts`

- [ ] **Step 1: Read the app's PropClassification to identify what render-core needs**

The functions needed by beta offset calculation:
- `getBetaOffsetSize(propType, gridMode)` — returns pixel distance
- `isUnilateralProp(propType)` — clubs, hoops, etc.
- `isBuugengFamilyProp(propType)` — buugeng, fractalgeng

- [ ] **Step 2: Create prop-classification.ts in render-core**

```typescript
// packages/render-core/src/constants/prop-classification.ts
// PORTED VERBATIM from src/lib/shared/pictograph/prop/domain/enums/PropClassification.ts

import type { GridMode } from "../types.js";

const VIEWBOX_SIZE = 950;

// ============================================================================
// PROP TYPE ARRAYS (exact lists from app's PropClassification.ts)
// ============================================================================

const BIG_UNILATERAL_PROPS = [
  "bighoop", "bigfan", "bigtriad", "bigtorch", "bigcontactball",
] as const;

const SMALL_UNILATERAL_PROPS = [
  "fan", "club", "minihoop", "triad", "ukulele",
  "triquetra", "triquetra2", "chicken", "torch", "contactball",
] as const;

const BIG_BILATERAL_PROPS = [
  "bigstaff", "bigbuugeng", "bigdoublestar", "bigeightrings",
  "bigclub", "bigchicken", "guitar", "sword", "bigdoublecontactball",
] as const;

const SMALL_BILATERAL_PROPS = [
  "staff", "simple_staff", "staff_v2", "buugeng", "trigeng",
  "doublestar", "quiad", "fractalgeng", "eightrings", "doublecontactball",
] as const;

const BUUGENG_FAMILY = [
  "buugeng", "bigbuugeng", "fractalgeng", "trigeng",
] as const;

const STRICT_PLACED = [
  "bighoop", "doublestar", "bigbuugeng", "bigdoublestar", "triquetra",
] as const;

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

export function isUnilateralProp(propType: string): boolean {
  const t = propType.toLowerCase();
  if (t === "hand") return false;
  return (BIG_UNILATERAL_PROPS as readonly string[]).includes(t)
      || (SMALL_UNILATERAL_PROPS as readonly string[]).includes(t);
}

export function isBuugengFamilyProp(propType: string): boolean {
  return (BUUGENG_FAMILY as readonly string[]).includes(propType.toLowerCase());
}

export function isStrictPlacedProp(propType: string): boolean {
  return (STRICT_PLACED as readonly string[]).includes(propType.toLowerCase());
}

export function pictographRequiresStrictHandpoints(
  bluePropType: string,
  redPropType: string
): boolean {
  return isStrictPlacedProp(bluePropType) && isStrictPlacedProp(redPropType);
}

/**
 * Get the beta offset size for a prop type.
 * Box mode applies diagonal compensation (÷√2).
 */
export function getBetaOffsetSize(propType: string, gridMode?: GridMode): number {
  const t = propType.toLowerCase();
  let base: number;

  if (t === "club" || t === "eightrings") {
    base = VIEWBOX_SIZE / 60;       // 15.83px
  } else if (t === "doublestar") {
    base = VIEWBOX_SIZE / 50;       // 19px
  } else {
    base = VIEWBOX_SIZE / 45;       // 21.11px
  }

  return gridMode === "box" ? base / Math.sqrt(2) : base;
}
```

- [ ] **Step 3: Export from index.ts**

Add to `packages/render-core/src/index.ts`:
```typescript
export { getBetaOffsetSize, isUnilateralProp, isBuugengFamilyProp } from "./constants/prop-classification.js";
```

- [ ] **Step 4: Build and verify**

Run: `cd packages/render-core && npm run build`
Expected: Clean build, no errors

- [ ] **Step 5: Commit**

```bash
git add packages/render-core/src/constants/prop-classification.ts packages/render-core/src/index.ts
git commit -m "feat(render-core): add prop classification helpers for beta offset"
```

---

## Task 2: Add Letter I direction maps to render-core

**Files:**
- Modify: `packages/render-core/src/constants/direction-maps.ts`
- Modify: `packages/render-core/src/index.ts`
- Reference: `src/lib/shared/pictograph/prop/domain/direction/DirectionMaps.ts:35-120`

- [ ] **Step 1: Add Letter I maps to direction-maps.ts**

Port from app's `DirectionMaps.ts`. Convert from enum keys to string literal keys:

```typescript
// Add to packages/render-core/src/constants/direction-maps.ts

/**
 * Letter I direction maps — Letter I (one pro + one anti, same trajectory)
 * has unique offset directions different from generic shift maps.
 */
export const LETTER_I_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  n: { red: "right", blue: "left" },
  e: { red: "down", blue: "up" },
  s: { red: "left", blue: "right" },
  w: { red: "down", blue: "up" },
  ne: { red: "downright", blue: "upleft" },
  se: { red: "upright", blue: "downleft" },
  sw: { red: "downright", blue: "upleft" },
  nw: { red: "upright", blue: "downleft" },
  c: { red: "up", blue: "down" },
};

export const LETTER_I_NON_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  n: { red: "up", blue: "down" },
  e: { red: "right", blue: "left" },
  s: { red: "down", blue: "up" },
  w: { red: "right", blue: "left" },
  ne: { red: "upright", blue: "downleft" },
  se: { red: "downright", blue: "upleft" },
  sw: { red: "upright", blue: "downleft" },
  nw: { red: "downright", blue: "upleft" },
  c: { red: "up", blue: "down" },
};
```

- [ ] **Step 2: Export the new maps from index.ts**

```typescript
export {
  // ... existing exports
  LETTER_I_RADIAL_MAP,
  LETTER_I_NON_RADIAL_MAP,
} from "./constants/direction-maps.js";
```

- [ ] **Step 3: Build and verify**

Run: `cd packages/render-core && npm run build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add packages/render-core/src/constants/direction-maps.ts packages/render-core/src/index.ts
git commit -m "feat(render-core): add Letter I direction maps"
```

Note: G/H do NOT need new maps. They reuse the DIAMOND/BOX RADIAL/NON_RADIAL maps with color-opposite logic.

---

## Task 3: Rewrite render-core's calculateBetaOffset with complete gate logic

This is the critical task. The current render-core `calculateBetaOffset` is a simplified version missing all the gates from the app's `PropPlacer.calculateBetaOffset()`.

**Files:**
- Rewrite: `packages/render-core/src/calculations/beta-offset.ts`
- Modify: `packages/render-core/src/types.ts` (expand BetaOffsetInput)
- Reference: `src/lib/shared/pictograph/prop/services/implementations/PropPlacer.ts:130-376`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/BetaPropDirectionCalculator.ts`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/LetterIHandler.ts`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/LetterGHHandler.ts`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/LetterYZHandler.ts`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/ShiftMotionHandler.ts`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/StaticDashMotionHandler.ts`
- Reference: `src/lib/shared/pictograph/prop/services/implementations/OrientationChecker.ts`

- [ ] **Step 1: Expand BetaMotionInput in types.ts**

The current `BetaMotionInput` is missing fields the gate logic needs:

```typescript
export interface BetaMotionInput {
  startLocation: string;
  endLocation: string;
  endOrientation?: string;
  motionType: string;
  color: "blue" | "red";
  propType?: string;         // Already exists
}

export interface BetaOffsetInput {
  blueMotion: BetaMotionInput;
  redMotion: BetaMotionInput;
  letter: string;
  gridMode: GridMode;
  // NEW: prop type overrides (from user settings — may differ from motion data)
  bluePropType?: string;     // Rendered prop type (settings override)
  redPropType?: string;      // Rendered prop type (settings override)
  blueBuugengFlipped?: boolean;
  redBuugengFlipped?: boolean;
}
```

- [ ] **Step 2: Rewrite beta-offset.ts with complete logic**

Port ALL gate logic from `PropPlacer.calculateBetaOffset()` (lines 130-376). The function must implement this exact sequence:

1. Check if both props end at same location. If not, return `{0, 0}`.
2. **Hand prop special case**: Direction-aware positioning based on approach direction.
3. **Hybrid orientation skip**: One radial + one non-radial = `{0, 0}`.
4. **Buugeng family nesting skip**: Both buugeng + opposite chirality = `{0, 0}`.
5. **Unilateral prop skip**: Same orientation type but different specific orientations + unilateral prop = `{0, 0}`.
6. **Trigeng skip**: Same type different orientation + trigeng = `{0, 0}`.
7. **Direction calculation**: Route to correct handler by letter type and motion type:
   - Letter I/I- → Letter I handler (uses LETTER_I_RADIAL/NON_RADIAL maps)
   - Letter G/H/G-/H- → G/H handler (red gets static/dash map, blue gets opposite)
   - Letter Y/Z/Y-/Z- → Y/Z handler (shift motion gets direction, non-shift gets opposite)
   - Shift motions (pro/anti/float) → Shift handler (uses SHIFT_RADIAL/NON_RADIAL maps)
   - Static/dash → Static/dash handler (uses DIAMOND/BOX RADIAL/NON_RADIAL maps)
8. Convert direction to pixel offset using prop-type-specific distance.

Critical: Read each app handler class (LetterIHandler, LetterGHHandler, etc.) before writing to ensure exact logic parity.

**ROUTING TABLE (must match BetaPropDirectionCalculator.ts exactly):**

```
1. Is Y or Z or Y- or Z-? → LetterYZHandler
   (shift motion gets SHIFT map direction, non-shift gets OPPOSITE)

2. Is shift motion (pro/anti/float)?
   a. Is G or H (NOT G- or H- — app bug, replicate for parity)? → LetterGHHandler
      - Uses DIAMOND/BOX RADIAL/NON_RADIAL maps (same as static/dash)
      - Red gets the base direction from the map
      - Blue gets the OPPOSITE direction
      - SPECIAL: South location always returns RIGHT as red's base direction
   b. Is I (NOT I- — app only checks "I")? → LetterIHandler
      - Uses LETTER_I_RADIAL_MAP / LETTER_I_NON_RADIAL_MAP
      - Direct color lookup (no opposite calculation)
   c. Otherwise → ShiftMotionHandler
      - Uses SHIFT_RADIAL_MAP / SHIFT_NON_RADIAL_MAP
      - Looks up [startLocation][endLocation]

3. Is static or dash? → StaticDashMotionHandler
   - Uses DIAMOND/BOX RADIAL/NON_RADIAL maps
   - Direct color lookup
```

**ORIENTATION CHECKER PARITY WARNING:**

The app's `OrientationChecker.isRadial()` has a logic bug:
```typescript
return (redIsInOrOut && blueIsIn) || blueIsOut;
```
This evaluates as: `(red=IN|OUT AND blue=IN) OR (blue=OUT regardless of red)`.
The symmetric check would be: `(blue=IN|OUT) AND (red=IN|OUT)`.

For exact parity, render-core MUST replicate this asymmetric behavior. The `isNonRadial()` method has the same pattern:
```typescript
return (redIsClockOrCounter && blueIsClock) || blueIsCounter;
```

**NOTE:** The hybrid orientation skip in PropPlacer (lines 238-250) uses a DIFFERENT check — it checks `radialOrientations.includes()` for each color independently, which IS symmetric. So the asymmetric `OrientationChecker` only affects which DIRECTION MAP is selected (radial vs non-radial), not whether the offset is applied.

Replicate the asymmetric logic in render-core for the direction map selection. Add a TODO comment noting this is a known parity requirement.

- [ ] **Step 3: Write tests for the complete beta offset**

Create: `packages/render-core/src/calculations/__tests__/beta-offset.test.ts`

Test cases derived from app behavior:
- Two props at same location, both radial → offset applied
- Two props at same location, hybrid orientation → zero offset
- Both buugeng, opposite chirality → zero offset
- Letter I at north, radial → red RIGHT, blue LEFT
- Letter G at south → correct static/dash map lookup
- Letter Y → shift motion gets direction, static gets opposite
- Hand props → direction-aware left/right

- [ ] **Step 4: Build and run tests**

Run: `cd packages/render-core && npm run build && npm test`

- [ ] **Step 5: Commit**

```bash
git add packages/render-core/src/calculations/beta-offset.ts packages/render-core/src/types.ts
git commit -m "feat(render-core): rewrite beta offset with complete gate logic from PropPlacer"
```

---

## Task 4: Wire MCP server to use render-core package directly

**Files:**
- Modify: `mcp-server-pkg/package.json`
- Modify: `mcp-server-pkg/tsconfig.json`
- Delete: `mcp-server-pkg/vendor/render-core/` (entire directory)
- Delete: `mcp-server-pkg/src/core/enums.ts`
- Delete: `mcp-server-pkg/src/core/beta-offset.ts`
- Delete: `mcp-server-pkg/src/core/prop-placement.ts`
- Delete: `mcp-server-pkg/src/core/grid-coordinates.ts`
- Delete: `mcp-server-pkg/src/core/arrow-placement.ts`
- Delete: `mcp-server-pkg/src/core/dash-location.ts`
- Delete: `mcp-server-pkg/src/core/orientation-calculator.ts`
- Modify: `mcp-server-pkg/src/core/standalone-renderer.ts`
- Modify: `mcp-server-pkg/src/core/arrow-adjustment.ts`
- Modify: `mcp-server-pkg/src/core/orientation-propagation.ts`

- [ ] **Step 1: Add render-core as dependency**

In `mcp-server-pkg/package.json`, add:
```json
"dependencies": {
  "@tka/render-core": "file:../packages/render-core",
  ...
}
```

In `mcp-server-pkg/tsconfig.json`, add path mapping:
```json
"paths": {
  "@tka/render-core": ["../packages/render-core/src/index.ts"]
}
```

- [ ] **Step 1b: Run npm install and update tsconfig**

```bash
cd mcp-server-pkg && npm install
```

Update `mcp-server-pkg/tsconfig.json`: remove `"vendor/**/*.ts"` from `include` array (directory no longer exists).

- [ ] **Step 2: Delete vendor/render-core directory**

```bash
rm -rf mcp-server-pkg/vendor/render-core/
```

- [ ] **Step 3: Delete redundant src/core files**

```bash
rm mcp-server-pkg/src/core/enums.ts
rm mcp-server-pkg/src/core/beta-offset.ts
rm mcp-server-pkg/src/core/prop-placement.ts
rm mcp-server-pkg/src/core/grid-coordinates.ts
rm mcp-server-pkg/src/core/arrow-placement.ts
rm mcp-server-pkg/src/core/dash-location.ts
rm mcp-server-pkg/src/core/orientation-calculator.ts
```

- [ ] **Step 4: Update standalone-renderer.ts imports**

Replace all imports from `"../../vendor/render-core/index.js"` and `"./enums.js"` with imports from `"@tka/render-core"`:

```typescript
import {
  // Types
  type GridLocation,
  type GridMode,
  type MotionType,
  type Orientation,
  type PropColor,
  type BetaOffsetInput,
  type BetaMotionInput,
  type OrientationInput,
  type DashLocationInput,
  // Grid
  getLayer2PointCoordinates,
  isCardinal,
  // Prop placement
  calculatePropPlacement,
  // Beta offset (now with full gate logic)
  calculateBetaOffset,
  // Orientation
  calculateOrientations,
  // Dash location
  calculateDashLocation,
  // Arrow (now from render-core too)
  calculateArrowPlacement,
  calculateArrowRotation,
  // Reversal
  calculateReversalPositions,
  // Colors
  BLUE_COLOR_DARK, BLUE_COLOR_LIGHT,
  RED_COLOR_DARK, RED_COLOR_LIGHT,
} from "@tka/render-core";
```

- [ ] **Step 5: Update orientation-propagation.ts imports**

Replace enum imports with render-core string literal types.

- [ ] **Step 6: Update arrow-adjustment.ts imports**

This file stays (MCP-specific tuning) but needs imports updated.

- [ ] **Step 7: Update standalone-renderer.ts beta offset call site**

The renderer currently calls `calculateBetaOffset` from the vendored copy. Update to pass the expanded `BetaOffsetInput` that includes prop type overrides:

```typescript
// In calculateBetaOffsetForProp method:
const betaInput: BetaOffsetInput = {
  blueMotion: { ... },
  redMotion: { ... },
  letter: pictographData.letter,
  gridMode,
  bluePropType: "staff",  // MCP always renders as staff
  redPropType: "staff",
};
const offset = calculateBetaOffset(betaInput, targetMotion);
```

- [ ] **Step 8: Fix all string literal conversions**

The MCP previously used enums (`GridLocation.NORTH`). Now it uses strings (`"n"`). Search for all enum references and convert. The data from JSON files already uses lowercase strings, so most conversions are just removing enum wrappers.

- [ ] **Step 9: Build MCP server**

Run: `cd mcp-server-pkg && npm run build`
Fix any compilation errors.

- [ ] **Step 10: Commit**

```bash
git add -A mcp-server-pkg/ packages/render-core/
git commit -m "refactor(mcp): replace vendor copy and reimplementations with @tka/render-core dependency"
```

---

## Task 5: Update app's PropPlacer to delegate to render-core

**Files:**
- Modify: `src/lib/shared/pictograph/prop/services/implementations/PropPlacer.ts`
- Reference: `packages/render-core/src/calculations/beta-offset.ts`

- [ ] **Step 1: Replace PropPlacer.calculateBetaOffset with render-core delegation**

The app's `PropPlacer.calculateBetaOffset()` (lines 130-376) should become a thin adapter that:
1. Resolves prop types from settings (app-specific)
2. Builds a `BetaOffsetInput` object
3. Calls `calculateBetaOffset()` from `@tka/render-core`
4. Returns the result

```typescript
import { calculateBetaOffset as coreCalculateBetaOffset } from "$lib/shared/render/core/calculations/beta-offset";
import type { BetaOffsetInput, BetaMotionInput } from "$lib/shared/render/core/calculations/beta-offset";

private async calculateBetaOffset(
  pictographData: PictographData,
  motionData: MotionData,
  gridMode: GridMode
): Promise<{ x: number; y: number }> {
  const needsBetaOffset = this.BetaDetector.endsWithBeta(pictographData);
  if (!needsBetaOffset) return { x: 0, y: 0 };

  const redMotion = pictographData.motions.red;
  const blueMotion = pictographData.motions.blue;
  if (!redMotion || !blueMotion) return { x: 0, y: 0 };

  // Resolve prop types from settings
  const globalSettings = this.settings ? null : getSettings();
  const settings = this.settings ?? {
    bluePropType: globalSettings?.bluePropType,
    redPropType: globalSettings?.redPropType,
    blueBuugengFlipped: globalSettings?.blueBuugengFlipped,
    redBuugengFlipped: globalSettings?.redBuugengFlipped,
  };

  const input: BetaOffsetInput = {
    blueMotion: {
      startLocation: blueMotion.startLocation,
      endLocation: blueMotion.endLocation,
      endOrientation: blueMotion.endOrientation,
      motionType: blueMotion.motionType,
      color: "blue",
      propType: blueMotion.propType,
    },
    redMotion: {
      startLocation: redMotion.startLocation,
      endLocation: redMotion.endLocation,
      endOrientation: redMotion.endOrientation,
      motionType: redMotion.motionType,
      color: "red",
      propType: redMotion.propType,
    },
    letter: pictographData.letter || "",
    gridMode: gridMode as string as any, // enum to string
    bluePropType: settings.bluePropType ?? blueMotion.propType ?? "staff",
    redPropType: settings.redPropType ?? redMotion.propType ?? "staff",
    blueBuugengFlipped: settings.blueBuugengFlipped,
    redBuugengFlipped: settings.redBuugengFlipped,
  };

  const target: BetaMotionInput = {
    startLocation: motionData.startLocation,
    endLocation: motionData.endLocation,
    endOrientation: motionData.endOrientation,
    motionType: motionData.motionType,
    color: motionData.color as "blue" | "red",
    propType: motionData.propType,
  };

  return coreCalculateBetaOffset(input, target);
}
```

- [ ] **Step 2: Remove now-unused imports**

Delete imports for: `BetaPropDirectionCalculator`, `VectorDirection`, `getBetaOffsetSize`, `isBuugengFamilyProp`, `isUnilateralProp` (these now live in render-core).

- [ ] **Step 3: Build and verify app**

Run: `npm run build && npm run check`
Expected: Clean build

- [ ] **Step 4: Visual verification**

Render G, H, and I via MCP tools. Confirm props are correctly offset (not overlapping) for beta positions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/prop/services/implementations/PropPlacer.ts
git commit -m "refactor(app): delegate PropPlacer beta offset to @tka/render-core"
```

---

## Task 6: Make app import from @tka/render-core package directly

The app's `src/lib/shared/render/core/` currently contains COPIES of the render-core source files. This is the exact duplication this plan eliminates. Instead, make the app import from the package.

**Files:**
- Modify: root `package.json` — add `@tka/render-core` workspace dependency
- Modify: `svelte.config.js` or `vite.config.ts` — add alias if needed
- Delete: `src/lib/shared/render/core/calculations/*.ts` (copies)
- Delete: `src/lib/shared/render/core/constants/*.ts` (copies)
- Modify: `src/lib/shared/render/core/index.ts` — re-export from `@tka/render-core`

- [ ] **Step 1: Add @tka/render-core as workspace dependency**

In root `package.json`:
```json
"dependencies": {
  "@tka/render-core": "file:packages/render-core",
  ...
}
```

Run: `npm install`

- [ ] **Step 2: Update src/lib/shared/render/core/index.ts to re-export**

Replace the barrel file contents with:
```typescript
export * from "@tka/render-core";
```

Or, if Vite resolves workspace packages, update individual import sites throughout the app to import from `@tka/render-core` directly and delete the `src/lib/shared/render/core/` wrapper entirely.

- [ ] **Step 3: Delete copied source files**

Once imports resolve through the package, delete the `.ts`, `.js`, and `.d.ts` copies in `src/lib/shared/render/core/calculations/` and `src/lib/shared/render/core/constants/`.

- [ ] **Step 4: Build and verify**

Run: `npm run build && npm run check`

If Vite can't resolve the workspace package, fall back to Vite `resolve.alias`:
```typescript
// vite.config.ts
resolve: {
  alias: {
    '@tka/render-core': path.resolve(__dirname, 'packages/render-core/src/index.ts')
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(app): import from @tka/render-core package, delete local copies"
```

---

## Task 7: Clean up dead code in app

**Files:**
- Potentially removable after delegation:
  - `src/lib/shared/pictograph/prop/services/implementations/BetaPropDirectionCalculator.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/LetterGHHandler.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/LetterIHandler.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/LetterYZHandler.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/ShiftMotionHandler.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/StaticDashMotionHandler.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/OrientationChecker.ts`
  - `src/lib/shared/pictograph/prop/services/implementations/DirectionUtils.ts`

- [ ] **Step 1: Check if any of these files are imported elsewhere**

Search for imports of each file. If they're ONLY consumed by PropPlacer (which now delegates to render-core), they're dead code.

- [ ] **Step 2: Delete dead files (with user confirmation)**

Only delete files confirmed unused. List them and ask for confirmation.

- [ ] **Step 3: Remove unused DI registrations**

If these handlers were registered in DI containers, remove those registrations.

- [ ] **Step 4: Build and verify**

Run: `npm run build && npm run check`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "cleanup: remove app handler classes now consolidated in render-core"
```

---

## Task 8: Verification — render G, H, I and confirm parity

- [ ] **Step 1: Render G via MCP**

```
generate_pictograph(letter: "G")
```

Confirm: two props visible, offset from each other at beta position.

- [ ] **Step 2: Render H via MCP**

```
generate_pictograph(letter: "H")
```

Confirm: two props visible, offset from each other.

- [ ] **Step 3: Render I via MCP**

```
generate_pictograph(letter: "I")
```

Confirm: two props visible, offset from each other.

- [ ] **Step 4: Render a beta letter with hybrid orientation (should NOT offset)**

Find or generate a pictograph where one prop ends radial and one ends non-radial. Confirm props overlap (no offset applied).

- [ ] **Step 5: Render in app and compare**

Open the app, navigate to a sequence with G/H/I letters. Visually compare prop positions between app and MCP renders.

---

## Summary

| Task | What | Risk |
|------|------|------|
| 1 | Add prop classification to render-core | Low — new file, no changes to existing |
| 2 | Add Letter I direction maps | Low — new constants |
| 3 | Rewrite beta offset with full gates | **High** — core logic rewrite, must match app exactly |
| 4 | Wire MCP to render-core package | **High** — many import changes, delete 7+ files |
| 5 | App PropPlacer delegates to render-core | Medium — changes tested pipeline |
| 6 | Sync app re-export wrapper | Low — mechanical copy |
| 7 | Clean up dead app code | Low — only after verification |
| 8 | Visual verification | Required — proof it works |
