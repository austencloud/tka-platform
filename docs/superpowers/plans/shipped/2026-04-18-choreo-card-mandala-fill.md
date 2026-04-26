# ChoreoCard Mandala Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill empty column-0 cells on ChoreoCard with per-hand and full mandala visualizations, switch 4-count to a horizontal 4×2 metadata-row layout, and expose the whole thing via a new "Mandala" toggle in export settings.

**Architecture:** Three isolated units — (1) a `showMandala` flag in `ImageCompositionSettings` for state, (2) a pure `getMandalaPlacements` function that translates `{ stepCount, cols, rows, blueVisible, redVisible }` → a set of `{ row, col, variant }` placements plus an optional layout override for the 4-count horizontal special case, and (3) ChoreoCard wiring that consumes placements, overrides start/QR/step positions when the override is present, and renders `<SequenceMandala>` in placement cells.

**Tech Stack:** Svelte 5 runes, existing `SequenceMandala` component, `ImageCompositionStateManager` (Firebase-backed + localStorage fallback), Vitest unit tests.

---

## Design reference

Full spec: `docs/superpowers/specs/2026-04-18-choreo-card-mandala-fill-design.md`

Placement rule by col-0 empty count (under default layout, start in col 0 top, QR in col 0 bottom, steps filling remaining cells):

| Empties | Mandalas |
|---|---|
| 0 (only 4-count) | Switch to 4×2 horizontal metadata layout; Blue + Red in row 0 cols 2–3 |
| 1 | Full mandala centered in col 0 |
| 2 | Blue (upper empty) / Red (lower empty) |
| 3 | Blue / Full / Red (sandwich) |
| 4+ | Capped at 3 sandwich mandalas centered in col 0; outer empties blank |

Hand visibility: If red hidden, keep only the blue slot (others blank). If blue hidden, keep only the red slot. If both hidden, no mandalas.

Special 4-count horizontal layout (`stepCount=4`, mandala on, start in column, QR enabled):

```
Row 0: [Start] [BlueMandala] [RedMandala] [QR]
Row 1: [B1]    [B2]          [B3]         [B4]
```

Layout dims: `cols=4, rows=2`. Start at (1,1). QR at (4,1). Steps fill row 2 cols 1..4 in order.

---

## File Structure

**Create:**
- `src/lib/shared/sequence-viewer/services/getMandalaPlacements.ts` — pure function, no dependencies
- `tests/unit/getMandalaPlacements.test.ts` — vitest unit tests

**Modify:**
- `src/lib/shared/share/state/image-composition-state.svelte.ts` — add `showMandala` setting + getter/setter
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` — consume placements, override layout for 4-count horizontal, render mandala cells
- `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte` — add "Mandala" toggle chip
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` — pass `showMandala` through to ChoreoCard
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` — pass `showMandala` through to ChoreoCard

---

## Task 1: Add `showMandala` setting to ImageCompositionStateManager

**Files:**
- Modify: `src/lib/shared/share/state/image-composition-state.svelte.ts`

- [ ] **Step 1.1: Add field to interface and defaults**

In `ImageCompositionSettings`, after the `showQRCode` field (~line 33), add:

```typescript
  // Mandala fills empty col-0 cells with per-hand path visualizations
  showMandala: boolean;
```

In `DEFAULT_SETTINGS` (~line 69), after `showQRCode: true,`:

```typescript
  // Mandala - shown by default (fills empty cells with path visualizations)
  showMandala: true,
```

- [ ] **Step 1.2: Add getter**

After the `showQRCode` getter (~line 267):

```typescript
  get showMandala(): boolean {
    return this.settings.showMandala;
  }
```

- [ ] **Step 1.3: Add setter**

After `setShowQRCode` (~line 358):

```typescript
  setShowMandala(value: boolean): void {
    this.settings.showMandala = value;
    this.saveToStorage();
    this.notifyObservers();
  }
```

- [ ] **Step 1.4: Run type check**

```bash
npm run check
```

Expected: No new errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/shared/share/state/image-composition-state.svelte.ts
git commit -m "feat(export): add showMandala setting (default on) to image composition state"
```

---

## Task 2: Create `getMandalaPlacements` pure function

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/getMandalaPlacements.ts`

- [ ] **Step 2.1: Write the module**

```typescript
/**
 * getMandalaPlacements — pure function that decides where mandalas go on a ChoreoCard.
 *
 * Takes the current layout dimensions plus visibility flags and returns:
 * - A list of mandala cell placements (row/col 1-indexed, matching CSS grid).
 * - An optional layoutOverride for the 4-count horizontal metadata-row case,
 *   which reshapes start/QR/step positions.
 *
 * The caller (ChoreoCard) is responsible for:
 * - Applying the layoutOverride to start/QR/step grid positions.
 * - Rendering <SequenceMandala> in each placement cell with the given `show` prop.
 */

export type MandalaVariant = "blue" | "red" | "full";

export interface MandalaPlacement {
  row: number;
  col: number;
  variant: MandalaVariant;
}

export interface MandalaLayoutOverride {
  cols: number;
  rows: number;
  startPos: { col: number; row: number };
  qrPos: { col: number; row: number };
  /** Explicit per-step (1-indexed) grid positions. stepIndex 0..stepCount-1. */
  stepPositions: { col: number; row: number }[];
}

export interface GetMandalaPlacementsArgs {
  stepCount: number;
  cols: number;
  rows: number;
  includeStartPosition: boolean;
  showQRCode: boolean;
  blueVisible: boolean;
  redVisible: boolean;
  /** When false, returns { placements: [], layoutOverride: null } regardless of other args. */
  mandalaEnabled: boolean;
}

export interface GetMandalaPlacementsResult {
  placements: MandalaPlacement[];
  layoutOverride: MandalaLayoutOverride | null;
}

const EMPTY: GetMandalaPlacementsResult = { placements: [], layoutOverride: null };

export function getMandalaPlacements(args: GetMandalaPlacementsArgs): GetMandalaPlacementsResult {
  const { stepCount, cols, rows, includeStartPosition, showQRCode, blueVisible, redVisible, mandalaEnabled } = args;

  // Bail out early for cases where mandalas cannot or should not be shown.
  if (!mandalaEnabled) return EMPTY;
  if (!includeStartPosition) return EMPTY; // No col 0 to place into
  if (!blueVisible && !redVisible) return EMPTY; // Nothing to show
  if (rows < 2) return EMPTY; // No QR, no empties, too short

  // Special case: 4-count horizontal metadata-row layout.
  // Only triggers when QR is shown (otherwise the existing 3×2 layout is fine
  // because start+4 steps perfectly fill 6 cells without needing a QR cell).
  if (stepCount === 4 && showQRCode) {
    return buildFourCountHorizontal(blueVisible, redVisible);
  }

  // Default case: fill empty col-0 cells between start (row 1) and QR (row `rows`).
  // QR occupies row `rows` only when showQRCode is true; otherwise the bottom cell is empty too.
  const topRow = 2;                         // row 1 is start
  const bottomRow = showQRCode ? rows - 1 : rows; // last row the mandala may occupy
  const emptyCount = bottomRow - topRow + 1;
  if (emptyCount < 1) return EMPTY;

  const variants = chooseVariantSequence(emptyCount, blueVisible, redVisible);
  if (variants.length === 0) return EMPTY;

  // Center the variants vertically in the empty span.
  const startRow = topRow + Math.floor((emptyCount - variants.length) / 2);
  const placements: MandalaPlacement[] = variants.map((variant, i) => ({
    row: startRow + i,
    col: 1,
    variant,
  }));

  return { placements, layoutOverride: null };
}

/**
 * Given N empty cells and blue/red visibility, decide which mandala variants to show
 * and in what order. Returns [] if neither hand is visible.
 */
function chooseVariantSequence(emptyCount: number, blueVisible: boolean, redVisible: boolean): MandalaVariant[] {
  // Collapse when one hand is hidden — show only the visible hand's slot.
  if (!redVisible && blueVisible) return ["blue"];
  if (!blueVisible && redVisible) return ["red"];

  // Both visible.
  if (emptyCount === 1) return ["full"];
  if (emptyCount === 2) return ["blue", "red"];
  if (emptyCount >= 3) return ["blue", "full", "red"]; // Cap at 3 for 4+ empties
  return [];
}

/**
 * 4-count horizontal: reshape the whole layout to 4×2 with a metadata row on top.
 *   Row 0: [Start] [Blue] [Red] [QR]
 *   Row 1: [B1]    [B2]   [B3]  [B4]
 *
 * Hand-visibility collapse: if one hand is hidden, drop that mandala cell (leave blank).
 */
function buildFourCountHorizontal(blueVisible: boolean, redVisible: boolean): GetMandalaPlacementsResult {
  const placements: MandalaPlacement[] = [];
  if (blueVisible && redVisible) {
    placements.push({ row: 1, col: 2, variant: "blue" });
    placements.push({ row: 1, col: 3, variant: "red" });
  } else if (blueVisible) {
    placements.push({ row: 1, col: 2, variant: "blue" });
  } else if (redVisible) {
    placements.push({ row: 1, col: 3, variant: "red" });
  }

  const layoutOverride: MandalaLayoutOverride = {
    cols: 4,
    rows: 2,
    startPos: { col: 1, row: 1 },
    qrPos: { col: 4, row: 1 },
    stepPositions: [
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 3, row: 2 },
      { col: 4, row: 2 },
    ],
  };

  return { placements, layoutOverride };
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/getMandalaPlacements.ts
git commit -m "feat(sequence-viewer): add getMandalaPlacements pure function"
```

---

## Task 3: Write unit tests for `getMandalaPlacements`

**Files:**
- Create: `tests/unit/getMandalaPlacements.test.ts`

- [ ] **Step 3.1: Write the test file**

```typescript
import { describe, it, expect } from "vitest";
import {
  getMandalaPlacements,
  type GetMandalaPlacementsArgs,
} from "$lib/shared/sequence-viewer/services/getMandalaPlacements";

function args(overrides: Partial<GetMandalaPlacementsArgs> = {}): GetMandalaPlacementsArgs {
  return {
    stepCount: 8,
    cols: 3,
    rows: 4,
    includeStartPosition: true,
    showQRCode: true,
    blueVisible: true,
    redVisible: true,
    mandalaEnabled: true,
    ...overrides,
  };
}

describe("getMandalaPlacements — toggle off", () => {
  it("returns empty when mandalaEnabled=false", () => {
    const res = getMandalaPlacements(args({ mandalaEnabled: false }));
    expect(res.placements).toEqual([]);
    expect(res.layoutOverride).toBeNull();
  });

  it("returns empty when includeStartPosition=false", () => {
    const res = getMandalaPlacements(args({ includeStartPosition: false }));
    expect(res.placements).toEqual([]);
  });

  it("returns empty when both hands hidden", () => {
    const res = getMandalaPlacements(args({ blueVisible: false, redVisible: false }));
    expect(res.placements).toEqual([]);
  });

  it("returns empty for rows < 2", () => {
    const res = getMandalaPlacements(args({ stepCount: 2, cols: 3, rows: 1 }));
    expect(res.placements).toEqual([]);
  });
});

describe("getMandalaPlacements — 4-count horizontal", () => {
  it("produces 4×2 horizontal with blue + red when both visible and QR on", () => {
    const res = getMandalaPlacements(args({ stepCount: 4, cols: 3, rows: 2 }));
    expect(res.layoutOverride).not.toBeNull();
    expect(res.layoutOverride!.cols).toBe(4);
    expect(res.layoutOverride!.rows).toBe(2);
    expect(res.layoutOverride!.startPos).toEqual({ col: 1, row: 1 });
    expect(res.layoutOverride!.qrPos).toEqual({ col: 4, row: 1 });
    expect(res.layoutOverride!.stepPositions).toHaveLength(4);
    expect(res.layoutOverride!.stepPositions[0]).toEqual({ col: 1, row: 2 });
    expect(res.layoutOverride!.stepPositions[3]).toEqual({ col: 4, row: 2 });
    expect(res.placements).toEqual([
      { row: 1, col: 2, variant: "blue" },
      { row: 1, col: 3, variant: "red" },
    ]);
  });

  it("drops red slot when red hidden", () => {
    const res = getMandalaPlacements(
      args({ stepCount: 4, cols: 3, rows: 2, redVisible: false })
    );
    expect(res.layoutOverride).not.toBeNull();
    expect(res.placements).toEqual([{ row: 1, col: 2, variant: "blue" }]);
  });

  it("drops blue slot when blue hidden", () => {
    const res = getMandalaPlacements(
      args({ stepCount: 4, cols: 3, rows: 2, blueVisible: false })
    );
    expect(res.placements).toEqual([{ row: 1, col: 3, variant: "red" }]);
  });

  it("does not trigger horizontal when QR is off (3×2 remains correct)", () => {
    const res = getMandalaPlacements(args({ stepCount: 4, cols: 3, rows: 2, showQRCode: false }));
    // With QR off, rows=2 gives bottomRow=2, topRow=2 → 1 empty → full mandala
    // No layout override.
    expect(res.layoutOverride).toBeNull();
  });
});

describe("getMandalaPlacements — col-0 empties (both hands visible)", () => {
  it("1 empty → full mandala centered", () => {
    // 9-count: 4×3, col 0 has start(row1), empty(row2), QR(row3) → 1 empty at row 2
    const res = getMandalaPlacements(args({ stepCount: 9, cols: 4, rows: 3 }));
    expect(res.layoutOverride).toBeNull();
    expect(res.placements).toEqual([{ row: 2, col: 1, variant: "full" }]);
  });

  it("2 empties → blue on top, red on bottom", () => {
    // 8-count: 3×4, col 0 has start(row1), empty(row2), empty(row3), QR(row4)
    const res = getMandalaPlacements(args({ stepCount: 8, cols: 3, rows: 4 }));
    expect(res.placements).toEqual([
      { row: 2, col: 1, variant: "blue" },
      { row: 3, col: 1, variant: "red" },
    ]);
  });

  it("3 empties → sandwich", () => {
    // 10-count: 3×5, col 0 has start(row1), 3 empties (rows 2-4), QR(row5)
    const res = getMandalaPlacements(args({ stepCount: 10, cols: 3, rows: 5 }));
    expect(res.placements).toEqual([
      { row: 2, col: 1, variant: "blue" },
      { row: 3, col: 1, variant: "full" },
      { row: 4, col: 1, variant: "red" },
    ]);
  });

  it("4+ empties → capped at 3, centered", () => {
    // Hypothetical 6×5 with 4 empties in col 0 between start (row 1) and QR (row 6)
    // topRow=2, bottomRow=5 → 4 empty rows. Cap at 3, center:
    // startRow = 2 + floor((4-3)/2) = 2 → placements at rows 2,3,4; row 5 blank.
    const res = getMandalaPlacements(args({ stepCount: 20, cols: 6, rows: 6 }));
    expect(res.placements).toEqual([
      { row: 2, col: 1, variant: "blue" },
      { row: 3, col: 1, variant: "full" },
      { row: 4, col: 1, variant: "red" },
    ]);
  });
});

describe("getMandalaPlacements — single-hand visibility", () => {
  it("2 empties + red hidden → only blue slot (top)", () => {
    const res = getMandalaPlacements(args({ stepCount: 8, cols: 3, rows: 4, redVisible: false }));
    // chooseVariantSequence returns ["blue"], length 1, centered in 2 empties.
    // startRow = 2 + floor((2-1)/2) = 2 → row 2.
    expect(res.placements).toEqual([{ row: 2, col: 1, variant: "blue" }]);
  });

  it("3 empties + blue hidden → only red slot, centered", () => {
    // chooseVariantSequence returns ["red"], length 1, centered in 3 empties (rows 2,3,4).
    // startRow = 2 + floor((3-1)/2) = 3 → row 3.
    const res = getMandalaPlacements(args({ stepCount: 10, cols: 3, rows: 5, blueVisible: false }));
    expect(res.placements).toEqual([{ row: 3, col: 1, variant: "red" }]);
  });
});

describe("getMandalaPlacements — QR off (bottom cell now empty)", () => {
  it("with QR off, bottom cell joins the empty span", () => {
    // 8-count, 3×4, QR off → col 0 empties are rows 2,3,4 (3 empties) → sandwich
    const res = getMandalaPlacements(args({ stepCount: 8, cols: 3, rows: 4, showQRCode: false }));
    expect(res.placements).toEqual([
      { row: 2, col: 1, variant: "blue" },
      { row: 3, col: 1, variant: "full" },
      { row: 4, col: 1, variant: "red" },
    ]);
  });
});
```

- [ ] **Step 3.2: Run tests**

```bash
npx vitest run tests/unit/getMandalaPlacements.test.ts
```

Expected: All tests pass.

- [ ] **Step 3.3: Commit**

```bash
git add tests/unit/getMandalaPlacements.test.ts
git commit -m "test(sequence-viewer): add getMandalaPlacements unit tests"
```

---

## Task 4: Pass `showMandala` through component props

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

- [ ] **Step 4.1: Add `showMandala` to ChoreoCard Props interface**

In `ChoreoCard.svelte` around line 134 (after `showQRCode?: boolean;`):

```typescript
    showQRCode?: boolean;
    /** When true, fill empty col-0 cells with mandala visualizations */
    showMandala?: boolean;
```

And around line 176 (after `showQRCode = false,`):

```typescript
    showQRCode = false,
    showMandala = false,
```

- [ ] **Step 4.2: Thread through SequenceViewerOrchestrator**

In `SequenceViewerOrchestrator.svelte`, find the `imgShowQRCode` state around line 644:

```typescript
  let imgShowQRCode = $state(imageComposition.showQRCode);
```

Add immediately after:

```typescript
  let imgShowMandala = $state(imageComposition.showMandala);
```

Find the observer update block around line 873:

```typescript
      imgShowQRCode = imageComposition.showQRCode;
```

Add immediately after:

```typescript
      imgShowMandala = imageComposition.showMandala;
```

Find the `showQRCode: imgShowQRCode,` lines (around 1492 and 2159) — add `showMandala: imgShowMandala,` on the next line in each.

- [ ] **Step 4.3: Thread through ViewerSplitPane**

In `ViewerSplitPane.svelte` around line 363:

```svelte
          showQRCode={imageComposition.showQRCode}
```

Add immediately after:

```svelte
          showMandala={imageComposition.showMandala}
```

- [ ] **Step 4.4: Type check**

```bash
npm run check
```

Expected: No new errors.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(choreo-card): add showMandala prop plumbing (not yet rendered)"
```

---

## Task 5: Add mandala toggle chip to ExportImagePanel

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte`

- [ ] **Step 5.1: Add derived and toggle**

Around line 53, after the `showQRCode` derived:

```typescript
  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });
```

Add:

```typescript
  const showMandala = $derived.by(() => { void compositionVersion; return imageComposition.showMandala; });
```

- [ ] **Step 5.2: Add toggle chip next to the QR chip (sidebar layout, ~line 265)**

Find the QR chip button around line 265 and add a Mandala chip right after it. The exact surrounding markup should be:

```svelte
              <button type="button" class="chip" class:active={showQRCode}
                onclick={() => imageComposition.setShowQRCode(!showQRCode)}
                aria-pressed={showQRCode}
              >QR</button>
              <button type="button" class="chip" class:active={showMandala}
                onclick={() => imageComposition.setShowMandala(!showMandala)}
                aria-pressed={showMandala}
              >Mandala</button>
```

- [ ] **Step 5.3: Same pattern for bottom (mobile) layout (~line 451)**

Find the second QR chip (in the mobile/bottom layout) around line 451 and add a matching Mandala chip:

```svelte
          <button type="button" class="chip" class:active={showQRCode}
            onclick={() => imageComposition.setShowQRCode(!showQRCode)}
            aria-pressed={showQRCode}
          >QR</button>
          <button type="button" class="chip" class:active={showMandala}
            onclick={() => imageComposition.setShowMandala(!showMandala)}
            aria-pressed={showMandala}
          >Mandala</button>
```

- [ ] **Step 5.4: Type check**

```bash
npm run check
```

Expected: No new errors.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte
git commit -m "feat(export): add Mandala toggle chip to ExportImagePanel (sidebar + bottom layouts)"
```

---

## Task 6: Wire placements into ChoreoCard cell rendering

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

This is the biggest task. The component is large, so follow the steps carefully.

- [ ] **Step 6.1: Import SequenceMandala + placement helper**

At the top of the `<script>` block (near the other imports, around line 47):

```typescript
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import { getMandalaPlacements, type MandalaLayoutOverride, type MandalaPlacement } from "../services/getMandalaPlacements";
```

- [ ] **Step 6.2: Derive mandala placements + layout override**

Find the `qrGridPosition` derived around line 327. Immediately after it, add:

```typescript
  // Compute mandala placements and the optional 4-count horizontal layout override.
  // blueVisible/redVisible are derived from the motion visibility flags already used
  // by this component (showBlueMotion / showRedMotion).
  const mandalaResult = $derived.by(() => {
    const stepCount = sequence?.steps?.length ?? 0;
    const cols = effectiveColumns;
    const rows = effectiveRows;
    return getMandalaPlacements({
      stepCount,
      cols,
      rows,
      includeStartPosition,
      showQRCode,
      blueVisible: showBlueMotion,
      redVisible: showRedMotion,
      mandalaEnabled: showMandala,
    });
  });

  const mandalaLayoutOverride = $derived(mandalaResult.layoutOverride);
  const mandalaPlacements = $derived(mandalaResult.placements);

  // When the 4-count horizontal override is active, the card's column/row counts
  // come from the override rather than the standard layout calculator output.
  const overrideCols = $derived(mandalaLayoutOverride?.cols ?? null);
  const overrideRows = $derived(mandalaLayoutOverride?.rows ?? null);
```

- [ ] **Step 6.3: Apply layoutOverride to effective cols/rows**

Find `effectiveColumns` in the file (use Grep):

```bash
grep -n "effectiveColumns" src/lib/shared/sequence-viewer/components/ChoreoCard.svelte | head -5
```

It's a `$derived` that returns the final column count. Wrap its final return value so that when `mandalaLayoutOverride` is present, it returns `mandalaLayoutOverride.cols` instead. Same for `effectiveRows`.

**Important:** Because `mandalaResult` itself depends on `effectiveColumns` and `effectiveRows`, you CANNOT put the override inside those same deriveds (circular dependency). Instead, introduce two new deriveds *downstream* of both:

```typescript
  // Final cols/rows, possibly overridden by the 4-count horizontal layout.
  const finalColumns = $derived(overrideCols ?? effectiveColumns);
  const finalRows = $derived(overrideRows ?? effectiveRows);
```

Then, in the template/markup that consumes `effectiveColumns`/`effectiveRows` for the CSS grid (NOT inside the `mandalaResult` computation), use `finalColumns`/`finalRows`. Specifically search for uses in the template:

```bash
grep -n "effectiveColumns\|effectiveRows" src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
```

For each use **in the template / grid-styling context** (not inside `mandalaResult`), replace with `finalColumns`/`finalRows`. Leave the internal layout-calculator-driven derivations alone — those are the inputs to `mandalaResult`.

- [ ] **Step 6.4: Override start, QR, and step grid positions**

Locate `calculateGridPosition` (around line 736). At the top of the function, add:

```typescript
  function calculateGridPosition(stepIndex: number, cols: number): { gridColumn: number; gridRow: number } {
    // 4-count horizontal override: start/QR/step positions come from the override spec.
    const override = mandalaLayoutOverride;
    if (override) {
      if (stepIndex === -1) {
        return { gridColumn: override.startPos.col, gridRow: override.startPos.row };
      }
      const pos = override.stepPositions[stepIndex];
      if (pos) return { gridColumn: pos.col, gridRow: pos.row };
      // Fall through for out-of-range indices — shouldn't happen in practice.
    }

    // Existing logic below unchanged.
    // Start position is always at column 1, row 1
    if (stepIndex === -1) {
      return { gridColumn: 1, gridRow: 1 };
    }
    // ... rest of existing function
```

Next, find `qrGridPosition` (~line 327) and modify it to respect the override:

```typescript
  const qrGridPosition = $derived.by(() => {
    if (!showQRCode || !includeStartPosition) return null;
    if (mandalaLayoutOverride) {
      return {
        gridColumn: mandalaLayoutOverride.qrPos.col,
        gridRow: mandalaLayoutOverride.qrPos.row,
      };
    }
    if (effectiveRows < 2) return null;
    return { gridColumn: 1, gridRow: effectiveRows };
  });
```

- [ ] **Step 6.5: Render mandala cells**

The component has multiple render blocks (grep `{#if showQRCode}` — around lines 1940, 1994, 2090, 2149). Find each QR-rendering block and add a neighboring mandala-rendering block. The mandala render block should be inserted AFTER the QR block to keep diff focused. Example for the block around line 1940:

```svelte
                  {#if showQRCode}
                    <!-- existing QR rendering -->
                  {/if}
                  {#each mandalaPlacements as placement (placement.row + "-" + placement.col + "-" + placement.variant)}
                    <div
                      class="mandala-cell"
                      style="grid-column: {placement.col}; grid-row: {placement.row}; width: {cellWidth}px; height: {cellWidth}px;"
                    >
                      <SequenceMandala
                        sequence={sequence}
                        mode="card-back"
                        style="stroke"
                        show={placement.variant === "full" ? "both" : placement.variant}
                        size={cellWidth}
                      />
                    </div>
                  {/each}
```

Repeat for each of the other QR render blocks (~1994, 2090, 2149). Some of those branches may correspond to layouts or fallbacks where mandalas also belong; add the `{#each}` block after each QR render.

- [ ] **Step 6.6: Add CSS for mandala cell**

In the `<style>` block, near the `.qr-code-image` styles (~line 2690), add:

```css
  .mandala-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
```

- [ ] **Step 6.7: Type check**

```bash
npm run check
```

Expected: No new errors related to these changes.

- [ ] **Step 6.8: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6.9: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat(choreo-card): render mandala fills + apply 4-count horizontal layout override"
```

---

## Task 7: Visual verification

- [ ] **Step 7.1: Start dev server on 5174 (user's 5173 is occupied)**

```bash
npx vite --port 5174 &
```

- [ ] **Step 7.2: Ask user to verify**

Since this is a pure-visual change, the user will verify themselves. Report:

> "Mandala fills wired up. To verify:
>
> 1. Generate a sequence of length 4, 8, 10, and 16.
> 2. Open the download card view.
> 3. Confirm:
>    - 4-count: horizontal 4×2 with Blue/Red in top row between Start and QR.
>    - 8-count: Blue and Red mandalas stacked in col 0 between Start and QR.
>    - 10-count: Blue / Full / Red sandwich in col 0.
>    - 16-count: Blue and Red (2 empties, no sandwich).
> 4. Toggle the new 'Mandala' chip off — 4-count should revert to 3×2 packed, others lose their mandalas.
> 5. Hide the red motion via the visibility tab — red mandala cells should go blank; blue slots stay.
>
> Report back what you see."

---

## Self-Review

**Spec coverage check:**
- 4-count horizontal layout → Tasks 2, 6 (override + grid position rewrite)
- 6-count 4×3 expansion → Not explicitly implemented. The LayoutCalculator still returns [4,2] for 6-count. This is a GAP. See note below.
- General col-0 empty rule (1/2/3/4+) → Task 2
- Hand visibility respect → Task 2, `chooseVariantSequence`
- Export toggle → Tasks 1, 5
- Reuse SequenceMandala → Task 6
- Hidden-hand collapse rule → Task 2

**GAP: 6-count layout expansion.** The spec calls for 6-count to switch from 4×2 to 4×3 when mandala is enabled (to create 1 empty cell for a Full mandala). Current plan does not modify LayoutCalculator. With 6-count stuck at 4×2, mandala has no empty cell to fill and will be silently skipped.

**Fix:** Add Task 8 below to override 6-count layout when mandala is enabled.

---

## Task 8: Expand 6-count to 4×3 when mandala is on

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

The simplest fix lives inside ChoreoCard (rather than perturbing the shared LayoutCalculator): when step count is 6, mandala is enabled, start is in column, and QR is on, add 1 to the row count.

- [ ] **Step 8.1: Adjust effectiveRows derivation for 6-count**

Find the `effectiveRows` derived (~line 520-546). Inside it, after the call to `layoutCalculator.calculateLayout(...)`, if we got `[4, 2]` from the calculator AND stepCount is 6 AND mandala is on AND QR is on AND includeStartPosition, bump rows to 3.

Minimal edit — at the end of the derived, right before `return rws;`:

```typescript
    // Mandala fill needs at least one col-0 empty between start and QR.
    // 6-count naturally lays out as 4×2 (packed). When mandala is on, expand
    // to 4×3 so col 0 has a single empty cell (Full mandala goes there).
    if (
      showMandala
      && showQRCode
      && includeStartPosition
      && stepCount === 6
      && rws === 2
    ) {
      return 3;
    }
    return rws;
```

(Replace the final `return rws;` with the above block.)

- [ ] **Step 8.2: Same for effectiveColumns if relevant**

Verify the column count for 6-count stays at 4. If the layout calculator already returns 4, no change needed. If not, mirror the logic.

- [ ] **Step 8.3: Type check + build**

```bash
npm run check && npm run build
```

Expected: Both pass.

- [ ] **Step 8.4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat(choreo-card): expand 6-count to 4×3 when mandala fill is enabled"
```

---

## Task 9: Final visual check

- [ ] **Step 9.1: Rebuild and have user verify 6-count specifically**

Same verification approach as Task 7, but include a 6-count sequence. Confirm the card now renders with 3 rows and a Full mandala in the middle of col 0.
