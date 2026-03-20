# Choreo Card Layout Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three improvements to choreo cards — start position as a top row instead of a left column, print layout mode for physical cards, and a mini-grid start position indicator on the card back.

**Architecture:** Change 1 modifies LayoutCalculator and ImageComposer to render start position as a row. Change 2 adds a `composeCardImage()` method for 5:7 print canvas. Change 3 replaces the α/β/γ glyph on CardBackV5 with an inline SVG mini-grid showing hand positions and grid mode.

**Tech Stack:** Svelte 5, TypeScript, Canvas 2D API, inline SVG

**Spec:** `docs/superpowers/specs/2026-03-20-choreo-card-layout-improvements.md`

---

## File Map

### Change 1: Start Position as Row

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/shared/render/services/implementations/LayoutCalculator.ts` | Add `LAYOUT_WITH_START_ROW` table, update `calculateLayout`, update fallback |
| Modify | `src/lib/shared/render/services/implementations/ImageComposer.ts` | Switch from column offset to row offset, update `getOccupiedCells` and `findEmptyCellForQR` |
| Create | `tests/unit/LayoutCalculator.test.ts` | Test new layout table derivation |

### Change 2: Print Layout Mode

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/shared/render/services/implementations/ImageComposer.ts` | Add `composeCardImage()` method |
| Modify | `src/lib/shared/render/services/contracts/IImageComposer.ts` | Add interface method |
| Modify | `src/lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte` | Pass print mode through to renderer |
| Modify | `src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts` | Call `composeCardImage` when print mode |

### Change 3: Mini-Grid on Card Back

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/features/choreo-card/components/card-back/card-back-data.ts` | Return `StartPositionInfo` instead of group string |
| Create | `src/lib/features/choreo-card/components/card-back/StartPositionMiniGrid.svelte` | Inline SVG component |
| Modify | `src/lib/features/choreo-card/components/card-back/CardBackV5.svelte` | Replace glyph `<img>` with mini-grid component |
| Create | `tests/unit/StartPositionInfo.test.ts` | Test grid mode derivation and location extraction |

---

## Task 1: Add Start-Row Layout Table to LayoutCalculator

**Files:**
- Modify: `src/lib/shared/render/services/implementations/LayoutCalculator.ts:23-272`
- Create: `tests/unit/LayoutCalculator.test.ts`

- [ ] **Step 1: Write failing test for new layout table**

Create `tests/unit/LayoutCalculator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { LayoutCalculator } from "../../src/lib/shared/render/services/implementations/LayoutCalculator";

describe("LayoutCalculator", () => {
  const calc = new LayoutCalculator();

  describe("calculateLayout with start row", () => {
    it("returns WITHOUT_START columns + 1 extra row for 16 steps", () => {
      // WITHOUT_START for 16 = [4, 4]
      // WITH_START_ROW should be [4, 5] — same columns, +1 row
      const layout = calc.calculateLayout(16, true);
      expect(layout).toEqual([4, 5]);
    });

    it("returns WITHOUT_START columns + 1 extra row for 8 steps", () => {
      // WITHOUT_START for 8 = [4, 2]
      // WITH_START_ROW should be [4, 3]
      const layout = calc.calculateLayout(8, true);
      expect(layout).toEqual([4, 3]);
    });

    it("returns WITHOUT_START columns + 1 extra row for 12 steps", () => {
      // WITHOUT_START for 12 = [3, 4]
      // WITH_START_ROW should be [3, 5]
      const layout = calc.calculateLayout(12, true);
      expect(layout).toEqual([3, 5]);
    });

    it("returns WITHOUT_START layout unchanged when no start position", () => {
      const layout = calc.calculateLayout(16, false);
      expect(layout).toEqual([4, 4]);
    });
  });

  describe("calculateGalleryAspectRatio with start row", () => {
    it("uses row-based layout for aspect ratio", () => {
      // 16 steps: [4, 5] with start row
      // Header = 1/3, Footer = 1/7, additional = 10/21
      // AR = 4 / (5 + 10/21) = 4 / 5.476 ≈ 0.731
      const ar = calc.calculateGalleryAspectRatio(16);
      expect(ar).toBeCloseTo(4 / (5 + 10 / 21), 3);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/LayoutCalculator.test.ts`
Expected: FAIL — current `calculateLayout(16, true)` returns `[5, 4]` (column-based), not `[4, 5]` (row-based).

- [ ] **Step 3: Add LAYOUT_WITH_START_ROW table, update calculateLayout, and update fallback**

In `LayoutCalculator.ts`, after the `LAYOUT_WITHOUT_START_POSITION` table (after line 168), add:

```typescript
/**
 * Layout table for sequences with start position as a TOP ROW.
 * Derived from WITHOUT_START by adding 1 row.
 * The start pictograph and QR code occupy cells in row 0.
 * Steps begin at row 1 using the same column count as WITHOUT_START.
 */
private readonly LAYOUT_WITH_START_ROW: Record<number, [number, number]> =
  Object.fromEntries(
    Object.entries(this.LAYOUT_WITHOUT_START_POSITION).map(
      ([stepCount, [cols, rows]]) => [stepCount, [cols, rows + 1]]
    )
  ) as Record<number, [number, number]>;
```

Update `calculateLayout` (lines 174-195) to use the new table:

```typescript
calculateLayout(
  stepCount: number,
  includeStartPosition: boolean
): [number, number] {
  if (!this.validateLayout(stepCount, includeStartPosition)) {
    throw new Error(
      `Invalid layout parameters: stepCount=${stepCount}, includeStartPosition=${includeStartPosition}`
    );
  }

  const layoutTable = includeStartPosition
    ? this.LAYOUT_WITH_START_ROW
    : this.LAYOUT_WITHOUT_START_POSITION;

  if (stepCount in layoutTable) {
    return layoutTable[stepCount]!;
  }

  return this.getFallbackLayout(stepCount, includeStartPosition);
}
```

Update `getFallbackLayout` (lines 254-272) to add an extra row instead of an extra cell:

```typescript
private getFallbackLayout(
  stepCount: number,
  includeStartPosition: boolean
): [number, number] {
  if (stepCount === 0) {
    return [1, 1];
  }

  // For large step counts, prefer roughly square layouts
  const aspectRatio = 1.2; // Slightly wider than square

  // Calculate ideal dimensions for the steps alone
  const idealHeight = Math.sqrt(stepCount / aspectRatio);
  const rows = Math.max(1, Math.round(idealHeight));
  const columns = Math.max(1, Math.ceil(stepCount / rows));

  // Add an extra row for start position (not an extra cell)
  if (includeStartPosition) {
    return [columns, rows + 1];
  }

  return [columns, rows];
}
```

Keep `LAYOUT_WITH_START_POSITION` in the file (for potential revert) but it's no longer referenced by `calculateLayout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/LayoutCalculator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/implementations/LayoutCalculator.ts tests/unit/LayoutCalculator.test.ts
git commit -m "feat: add start-row layout table to LayoutCalculator"
```

---

## Task 2: Update ImageComposer to Render Start Position as Row

**Files:**
- Modify: `src/lib/shared/render/services/implementations/ImageComposer.ts`
  - Step positioning: lines 363-372
  - `getOccupiedCells`: lines 903-930
  - `findEmptyCellForQR`: lines 938-957

- [ ] **Step 1: Update step positioning logic in the render loop**

In `ImageComposer.ts`, find the step rendering loop (lines 363-372). Replace the column offset with a row offset:

```typescript
// Old (column-based):
// const startColumn = options.includeStartPosition ? 1 : 0;
// const stepsPerRow = columns - startColumn;

// New (row-based): Start position is a top row, steps use full width starting at row 1
const startRow = options.includeStartPosition ? 1 : 0;
const stepsPerRow = columns; // Full width — no column reserved for start

for (let i = 0; i < sequence.steps.length; i++) {
  const col = i % stepsPerRow;
  const row = startRow + Math.floor(i / stepsPerRow);
```

The start position rendering at (0, 0) stays exactly the same (lines 341-352) — it's already at column 0, row 0.

- [ ] **Step 2: Update `getOccupiedCells` method**

In `ImageComposer.ts`, update the `getOccupiedCells` private method (lines 903-930) to use row offset instead of column offset:

```typescript
private getOccupiedCells(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  columns: number
): Set<string> {
  const occupied = new Set<string>();

  // Add start position if included (either explicit or derivable from beat 1)
  const hasStartPositionToRender =
    options.includeStartPosition &&
    (sequence.startPosition || sequence.steps?.length > 0);
  if (hasStartPositionToRender) {
    occupied.add("0,0");
  }

  // Steps use full width, offset by start row
  const startRow = options.includeStartPosition ? 1 : 0;
  const stepsPerRow = columns;

  for (let i = 0; i < (sequence.steps.length || 0); i++) {
    const col = i % stepsPerRow;
    const row = startRow + Math.floor(i / stepsPerRow);
    occupied.add(`${col},${row}`);
  }

  return occupied;
}
```

- [ ] **Step 3: Update `findEmptyCellForQR` to hard-code row 0 when start position is included**

The method currently has signature `findEmptyCellForQR(columns, rows, sequence, options)` (line 938). Keep the same signature but add the start-row shortcut:

```typescript
private findEmptyCellForQR(
  columns: number,
  rows: number,
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>
): { col: number; row: number } | null {
  // When start position is a top row, QR code goes in the rightmost cell of row 0
  if (options.includeStartPosition) {
    return { col: columns - 1, row: 0 };
  }

  // Without start position, scan from bottom-left for an empty cell
  const occupiedCells = this.getOccupiedCells(sequence, options, columns);
  for (let row = rows - 1; row >= 0; row--) {
    for (let col = 0; col < columns; col++) {
      if (!occupiedCells.has(`${col},${row}`)) {
        return { col, row };
      }
    }
  }
  return null;
}
```

The call site at line 415 already passes `(columns, rows, sequence, options)` — no change needed there.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Build and visually verify**

Run: `npm run build`
Expected: Build succeeds. The user will visually verify the start-as-row layout in the card designer.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/render/services/implementations/ImageComposer.ts
git commit -m "feat: render start position as top row instead of left column"
```

---

## Task 3: Refactor card-back-data to Return StartPositionInfo

**Files:**
- Modify: `src/lib/features/choreo-card/components/card-back/card-back-data.ts:38-52, 193-247, 249-296`
- Create: `tests/unit/StartPositionInfo.test.ts`

- [ ] **Step 1: Write failing test for StartPositionInfo derivation**

Create `tests/unit/StartPositionInfo.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deriveStartPositionInfo } from "../../src/lib/features/choreo-card/components/card-back/card-back-data";

describe("deriveStartPositionInfo", () => {
  it("returns box mode for cardinal hand locations", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "s",
      redLocation: "n",
    });
    expect(result.gridMode).toBe("box");
    expect(result.group).toBe("alpha");
    expect(result.blueLocation).toBe("s");
    expect(result.redLocation).toBe("n");
  });

  it("returns diamond mode for intercardinal hand locations", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "ne",
      redLocation: "sw",
    });
    expect(result.gridMode).toBe("diamond");
    expect(result.group).toBe("alpha");
  });

  it("returns mixed mode when locations span cardinal and intercardinal", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "n",
      redLocation: "ne",
    });
    expect(result.gridMode).toBe("mixed");
    expect(result.group).toBe("gamma");
  });

  it("returns beta for same locations", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "s",
      redLocation: "s",
    });
    expect(result.group).toBe("beta");
    expect(result.gridMode).toBe("box");
  });

  it("returns null info when no locations provided", () => {
    const result = deriveStartPositionInfo({
      blueLocation: null,
      redLocation: null,
    });
    expect(result.group).toBeNull();
    expect(result.blueLocation).toBeNull();
    expect(result.redLocation).toBeNull();
    expect(result.gridMode).toBe("box"); // default
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/StartPositionInfo.test.ts`
Expected: FAIL — `deriveStartPositionInfo` doesn't exist yet.

- [ ] **Step 3: Add StartPositionInfo interface and derivation function**

In `card-back-data.ts`, add the interface and export a pure derivation function. `deriveGroupFromLocations` (line 235) stays non-exported — `deriveStartPositionInfo` calls it internally.

```typescript
export interface StartPositionInfo {
  group: string | null;
  blueLocation: string | null;
  redLocation: string | null;
  gridMode: "box" | "diamond" | "mixed";
}

const CARDINAL = new Set(["n", "s", "e", "w"]);
const INTERCARDINAL = new Set(["ne", "se", "sw", "nw"]);

function deriveGridMode(blue: string | null, red: string | null): "box" | "diamond" | "mixed" {
  if (!blue || !red) return "box"; // default when unknown
  const blueIsCardinal = CARDINAL.has(blue);
  const redIsCardinal = CARDINAL.has(red);
  const blueIsIntercardinal = INTERCARDINAL.has(blue);
  const redIsIntercardinal = INTERCARDINAL.has(red);

  if (blueIsCardinal && redIsCardinal) return "box";
  if (blueIsIntercardinal && redIsIntercardinal) return "diamond";
  return "mixed";
}

export function deriveStartPositionInfo(locations: {
  blueLocation: string | null;
  redLocation: string | null;
}): StartPositionInfo {
  const { blueLocation, redLocation } = locations;

  const group =
    blueLocation && redLocation
      ? deriveGroupFromLocations(blueLocation, redLocation)
      : null;

  return {
    group,
    blueLocation,
    redLocation,
    gridMode: deriveGridMode(blueLocation, redLocation),
  };
}
```

- [ ] **Step 4: Update CardBackData interface and deriveCardBackData**

Replace `startPositionGroup: string | null` with `startPosition: StartPositionInfo | null` in the `CardBackData` interface (line 51).

Add `deriveStartPosition` which wraps the existing logic but also captures hand locations:

```typescript
function deriveStartPosition(sequence: SequenceData): StartPositionInfo | null {
  const explicitGroup = sequence.startingPositionGroup ?? null;

  // Extract hand locations from start position or first step
  let blueLocation: string | null = null;
  let redLocation: string | null = null;

  const sp = sequence.startPosition ?? sequence.startingPosition;
  if (sp?.motions) {
    blueLocation = (sp.motions as any).blue?.endLocation ?? null;
    redLocation = (sp.motions as any).red?.endLocation ?? null;
  }

  // Fall back to first step's motion start locations
  if (!blueLocation || !redLocation) {
    const step1 = sequence.steps?.[0];
    blueLocation = blueLocation ?? step1?.motions?.blue?.startLocation ?? null;
    redLocation = redLocation ?? step1?.motions?.red?.startLocation ?? null;
  }

  if (!blueLocation && !redLocation && !explicitGroup) return null;

  const info = deriveStartPositionInfo({ blueLocation, redLocation });

  // Prefer explicit group over derived when available
  if (explicitGroup) {
    return { ...info, group: explicitGroup };
  }

  return info;
}
```

Update `deriveCardBackData` (line 294) to use it:

```typescript
// Replace:
//   startPositionGroup: deriveStartPositionGroup(sequence),
// With:
startPosition: deriveStartPosition(sequence),
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/StartPositionInfo.test.ts`
Expected: All PASS

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: May have errors in CardBackV5.svelte where `d.startPositionGroup` is now `d.startPosition` — this is expected, fixed in Task 5.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/choreo-card/components/card-back/card-back-data.ts tests/unit/StartPositionInfo.test.ts
git commit -m "feat: derive StartPositionInfo with hand locations and grid mode"
```

---

## Task 4: Build StartPositionMiniGrid SVG Component

**Files:**
- Create: `src/lib/features/choreo-card/components/card-back/StartPositionMiniGrid.svelte`

- [ ] **Step 1: Create the mini-grid SVG component**

Create `StartPositionMiniGrid.svelte`:

```svelte
<!--
  Tiny inline SVG showing grid points and hand starting positions.
  Replaces the α/β/γ glyph in the card back bottom-right corner.

  Grid points are drawn as outline circles. Hand positions are filled
  circles in blue (#2E86DE) and red (#E74C3C). The arrangement of
  grid points communicates box vs. diamond mode.
-->
<script lang="ts">
  import type { StartPositionInfo } from "./card-back-data";

  interface Props {
    info: StartPositionInfo;
    size?: number;
  }

  let { info, size = 40 }: Props = $props();

  // Grid point positions in SVG coordinates
  // Center is at (size/2, size/2), points at ~80% radius
  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
  const r = $derived(size * 0.4); // radius from center to grid points
  const dotR = $derived(size * 0.1); // radius of each dot
  const centerDotR = $derived(size * 0.04); // tiny center anchor

  // Compass direction → angle in radians (0 = right/east, standard math convention)
  const ANGLES: Record<string, number> = {
    n: -Math.PI / 2,
    ne: -Math.PI / 4,
    e: 0,
    se: Math.PI / 4,
    s: Math.PI / 2,
    sw: (3 * Math.PI) / 4,
    w: Math.PI,
    nw: (-3 * Math.PI) / 4,
  };

  // Which grid points to show based on mode
  const gridPoints = $derived.by(() => {
    if (info.gridMode === "box") return ["n", "e", "s", "w"];
    if (info.gridMode === "diamond") return ["ne", "se", "sw", "nw"];
    // mixed: show all 8
    return ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  });

  function pos(direction: string): { x: number; y: number } {
    const angle = ANGLES[direction] ?? 0;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Starting position: {info.group ?? 'unknown'}"
>
  <!-- Center anchor dot -->
  <circle cx={cx} cy={cy} r={centerDotR} fill="rgba(255,255,255,0.3)" />

  <!-- Grid points (outline) -->
  {#each gridPoints as dir}
    {@const p = pos(dir)}
    <circle
      cx={p.x}
      cy={p.y}
      r={dotR}
      fill="none"
      stroke="rgba(255,255,255,0.3)"
      stroke-width="1"
    />
  {/each}

  <!-- Blue hand position -->
  {#if info.blueLocation}
    {@const bp = pos(info.blueLocation)}
    <circle cx={bp.x} cy={bp.y} r={dotR} fill="#2E86DE" />
  {/if}

  <!-- Red hand position -->
  {#if info.redLocation}
    {@const rp = pos(info.redLocation)}
    <circle cx={rp.x} cy={rp.y} r={dotR} fill="#E74C3C" />
  {/if}
</svg>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS (component compiles, no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/card-back/StartPositionMiniGrid.svelte
git commit -m "feat: add StartPositionMiniGrid SVG component"
```

---

## Task 5: Replace Glyph with Mini-Grid in CardBackV5

**Files:**
- Modify: `src/lib/features/choreo-card/components/card-back/CardBackV5.svelte:46-53, 147-156, 255-260`

- [ ] **Step 1: Update CardBackV5 to use StartPositionInfo**

In `CardBackV5.svelte`:

1. Remove the `POSITION_GLYPHS` record (lines 46-49) and the `startGlyph` derived (lines 51-53).

2. Add import for the mini-grid component at the top of the `<script>`:

```typescript
import StartPositionMiniGrid from "./StartPositionMiniGrid.svelte";
```

3. Replace the bottom-right corner badge (lines 147-156). Always render the mini-grid — pass a default empty info when `d.startPosition` is null:

```svelte
<!-- Bottom-right: Starting position mini-grid -->
<div class="corner bottom-right">
  <StartPositionMiniGrid
    info={d.startPosition ?? { group: null, blueLocation: null, redLocation: null, gridMode: "box" }}
    size={40}
  />
</div>
```

4. Remove the `.corner-position-img` CSS rule (lines 255-260) since it's no longer used.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/card-back/CardBackV5.svelte
git commit -m "feat: replace α/β/γ glyph with mini-grid on card back"
```

---

## Task 6: Add composeCardImage for Print Layout

**Files:**
- Modify: `src/lib/shared/render/services/implementations/ImageComposer.ts`
- Modify: `src/lib/shared/render/services/contracts/IImageComposer.ts`

- [ ] **Step 1: Add composeCardImage to the interface**

In `IImageComposer.ts`, add:

```typescript
/**
 * Compose a sequence image sized to a playing-card aspect ratio (5:7).
 * Header pins to top, footer pins to bottom, grid centers vertically.
 * Used for print/physical card export only.
 */
composeCardImage(
  sequence: SequenceData,
  options: SequenceExportOptions,
  onProgress?: CompositionProgressCallback
): Promise<HTMLCanvasElement>;
```

- [ ] **Step 2: Implement composeCardImage in ImageComposer**

This method renders the card from scratch on a 5:7 canvas rather than slicing a pre-rendered tight image, which avoids pixel-rounding fragility:

```typescript
async composeCardImage(
  sequence: SequenceData,
  options: SequenceExportOptions,
  onProgress?: CompositionProgressCallback
): Promise<HTMLCanvasElement> {
  // First, compose the tight image as normal
  const tightCanvas = await this.composeSequenceImage(sequence, options, onProgress);

  // Card dimensions: 5:7 ratio, width matches tight image
  const cardWidth = tightCanvas.width;
  const cardHeight = Math.round(cardWidth * (7 / 5));

  // If tight image is already taller than card, return as-is
  if (tightCanvas.height >= cardHeight) {
    return tightCanvas;
  }

  // Create card canvas
  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = cardWidth;
  cardCanvas.height = cardHeight;
  const ctx = cardCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for card canvas");

  // Fill background
  const isDarkMode = options.visibilityOverrides?.darkMode ?? false;
  ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Calculate layout dimensions
  const layout = this.layoutService.calculateLayout(
    sequence.steps?.length ?? 0,
    options.includeStartPosition
  );
  const [columns, rows] = layout;
  const stepSize = Math.floor(cardWidth / columns);
  const headerHeight = options.addWord
    ? this.calculateHeaderHeight(sequence.steps?.length ?? 0, stepSize)
    : 0;
  const showCreatorName = options.showCreatorName ?? options.addUserInfo;
  const showNotes = options.showNotes ?? options.addUserInfo;
  const showBirthday = options.showBirthday ?? options.addUserInfo;
  const hasFooter = showCreatorName || showNotes || showBirthday;
  const footerHeight = hasFooter ? this.calculateFooterHeight(stepSize) : 0;
  const gridHeight = rows * stepSize;

  // Available space between header and footer on the card
  const availableHeight = cardHeight - headerHeight - footerHeight;

  // Center the grid vertically
  const topPadding = Math.max(0, (availableHeight - gridHeight) / 2);

  // Source coordinates in the tight canvas
  const tightGridEnd = Math.min(headerHeight + gridHeight, tightCanvas.height);
  const tightFooterStart = tightGridEnd;
  const tightFooterEnd = Math.min(tightFooterStart + footerHeight, tightCanvas.height);

  // Draw header at top of card
  if (headerHeight > 0) {
    ctx.drawImage(
      tightCanvas,
      0, 0, cardWidth, headerHeight,
      0, 0, cardWidth, headerHeight
    );
  }

  // Draw grid centered vertically
  ctx.drawImage(
    tightCanvas,
    0, headerHeight, cardWidth, tightGridEnd - headerHeight,
    0, headerHeight + topPadding, cardWidth, tightGridEnd - headerHeight
  );

  // Draw footer pinned to bottom
  if (footerHeight > 0 && tightFooterEnd > tightFooterStart) {
    ctx.drawImage(
      tightCanvas,
      0, tightFooterStart, cardWidth, tightFooterEnd - tightFooterStart,
      0, cardHeight - footerHeight, cardWidth, footerHeight
    );
  }

  return cardCanvas;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/render/services/implementations/ImageComposer.ts src/lib/shared/render/services/contracts/IImageComposer.ts
git commit -m "feat: add composeCardImage for print layout (5:7 ratio)"
```

---

## Task 7: Wire Print Layout into Render Pipeline

**Files:**
- Modify: `src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts`
- Modify: `src/lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte`

**Context:** `ChoreoCard.svelte` doesn't call `composeSequenceImage` directly. The render chain is: `ChoreoCard` → `PropAwareThumbnail` → `ThumbnailRenderer` → `ImageComposer.composeSequenceImage()`. The print-mode swap needs to happen in `ThumbnailRenderer`.

- [ ] **Step 1: Read ThumbnailRenderer to find the composeSequenceImage call site**

Read `src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts` to find where `composeSequenceImage` is called. Identify the method and line number.

- [ ] **Step 2: Add print mode flag to the render path**

In `ThumbnailRenderer.ts`, find the method that calls `imageComposer.composeSequenceImage()`. Add a `printMode` parameter that, when true, calls `imageComposer.composeCardImage()` instead:

```typescript
// When printMode is true, use card layout for 5:7 aspect ratio
const canvas = printMode
  ? await this.imageComposer.composeCardImage(sequence, exportOptions, onProgress)
  : await this.imageComposer.composeSequenceImage(sequence, exportOptions, onProgress);
```

- [ ] **Step 3: Thread the printMode flag from PropAwareThumbnail**

In `PropAwareThumbnail.svelte`, accept a `printMode` prop and pass it through to `ThumbnailRenderer`. In `ChoreoCard.svelte`, the `printMode` prop is already defined (line 24) and `PropAwareThumbnail` already has `lightMode={printMode}` (line 162). Add `{printMode}` to the `PropAwareThumbnail` usage.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts src/lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte src/lib/features/choreo-card/components/ChoreoCard.svelte
git commit -m "feat: wire print layout into card designer via printMode flag"
```

---

## Task 8: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: User visual verification**

Tell the user:
1. Open card designer, load a 16-step sequence with start position ON — verify start position renders as a top row with QR code at the right end
2. Toggle start position OFF — verify the grid is a clean 4x4 with no start row
3. Flip to card back — verify the bottom-right corner shows the mini-grid with colored dots instead of a Greek letter
4. Check browse gallery and sequence viewer — verify thumbnails render correctly with the new aspect ratios

- [ ] **Step 5: Commit any fixes from visual review**
