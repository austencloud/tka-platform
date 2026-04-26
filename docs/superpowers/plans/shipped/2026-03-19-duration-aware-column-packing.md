# Duration-Aware Column Packing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make swing/duration sequences display with the correct number of beats per row (e.g., 4 columns for 16 beats) instead of collapsing to fewer columns because duration units exceed the row capacity.

**Architecture:** Replace duration-capacity-based row packing with beat-count-based row packing. The layout tables already define how many beats per row each sequence length should use (e.g., 16 beats = 4 columns). Currently, `calculateTimelineRows` packs by duration capacity (4 or 8 units), so swing durations (1.67 + 1.0 alternating) only fit 2 beats per row in capacity 4. The fix: pack exactly N beats per row (from the layout table), then let the CSS flexbox proportionally size cells by duration within each row.

**Tech Stack:** Svelte 5, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations.ts` | Modify | Add `calculateTimelineRowsByBeatCount()` function |
| `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` | Modify | Use beat-count packing instead of capacity packing for mixed-duration sequences |
| `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte` | Modify | Derive timeline row capacity from beat-count logic instead of hardcoded 4/8 |

---

### Task 1: Add beat-count-based row packing function

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations.ts`

The existing `calculateTimelineRows()` packs beats greedily by duration capacity. We need a new function that packs a fixed number of beats per row regardless of their durations.

- [ ] **Step 1: Add `calculateTimelineRowsByBeatCount` function**

Add this function after the existing `calculateTimelineRows` function (after line 275):

```typescript
/**
 * Calculate timeline row assignments based on a fixed beat count per row.
 * Unlike calculateTimelineRows (which packs by duration capacity), this
 * always places exactly `beatsPerRow` steps in each row. The last row
 * may have fewer if steps don't divide evenly.
 *
 * Use this when the layout table prescribes a column count and the
 * sequence has mixed durations (e.g., swing). The CSS flexbox handles
 * proportional sizing within each row.
 *
 * @param steps - Array of step data with optional duration
 * @param beatsPerRow - Exact number of beats to place in each row
 * @returns Array of row assignments with actual duration totals
 */
export function calculateTimelineRowsByBeatCount(
  steps: readonly { duration?: number }[],
  beatsPerRow: number
): TimelineRow[] {
  if (beatsPerRow <= 0) beatsPerRow = 1;
  const rows: TimelineRow[] = [];

  for (let i = 0; i < steps.length; i += beatsPerRow) {
    const rowSteps: Array<{ stepIndex: number; duration: number }> = [];
    let totalDuration = 0;

    for (let j = i; j < Math.min(i + beatsPerRow, steps.length); j++) {
      const duration = steps[j]?.duration ?? 1;
      rowSteps.push({ stepIndex: j, duration });
      totalDuration += duration;
    }

    rows.push({
      rowIndex: rows.length,
      steps: rowSteps,
      totalDuration,
    });
  }

  return rows;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations.ts
git commit -m "feat: add calculateTimelineRowsByBeatCount for fixed-column duration layouts"
```

---

### Task 2: Update ChoreoCard to use beat-count packing

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

ChoreoCard currently uses capacity-based packing (line 756-757):
```typescript
const rowCapacity = includeStartPosition ? cols - 1 : cols;
computedDurationRows = calculateTimelineRows(sequence.steps, rowCapacity, false);
```

This needs to use `calculateTimelineRowsByBeatCount` with the beat-column count from the layout table instead.

- [ ] **Step 1: Add import for the new function**

At line 42, where `calculateTimelineRows` is imported, add the new function:

```typescript
import {
  calculateTimelineRows,
  calculateTimelineRowsByBeatCount,
} from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
```

- [ ] **Step 2: Replace capacity-based packing with beat-count packing in renderAllCells**

In the `renderAllCells` function, find the mixed-duration block (around lines 754-769). Replace the row calculation logic:

**Before (lines 755-765):**
```typescript
if (mixed) {
  const rowCapacity = includeStartPosition ? cols - 1 : cols;
  computedDurationRows = calculateTimelineRows(sequence.steps, rowCapacity, false);
  rws = computedDurationRows.length;
  durationRows = computedDurationRows;
  let maxStepUnits = 0;
  for (const row of computedDurationRows) {
    maxStepUnits = Math.max(maxStepUnits, row.totalDuration);
  }
  durationColCount = maxStepUnits + (includeStartPosition ? 1 : 0);
}
```

**After:**
```typescript
if (mixed) {
  // Use the layout table's column count as beats-per-row.
  // cols already includes start position (+1), so subtract it to get beat columns.
  const beatsPerRow = includeStartPosition ? cols - 1 : cols;
  computedDurationRows = calculateTimelineRowsByBeatCount(sequence.steps, beatsPerRow);
  rws = computedDurationRows.length;
  durationRows = computedDurationRows;
  // durationColCount = widest row's duration total + 1 for start position column
  let maxStepUnits = 0;
  for (const row of computedDurationRows) {
    maxStepUnits = Math.max(maxStepUnits, row.totalDuration);
  }
  durationColCount = maxStepUnits + (includeStartPosition ? 1 : 0);
}
```

The key change: `calculateTimelineRowsByBeatCount` packs exactly `beatsPerRow` beats per row instead of fitting as many beats as possible within a duration capacity. The `durationColCount` calculation stays the same — it finds the widest row and uses that for CSS sizing.

For a 16-beat swing sequence with `cols=5` (including start) and `includeStartPosition=true`:
- `beatsPerRow = 4`
- Each row: 4 beats of alternating 1.67/1.0 = 5.34 total duration units
- `durationColCount = 5.34 + 1 = 6.34`
- CSS will proportion cells correctly within each row

- [ ] **Step 3: Verify build passes**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat: use beat-count packing for duration-aware ChoreoCard layouts"
```

---

### Task 3: Update StepGrid workspace to use beat-count packing

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte`

StepGrid currently uses a hardcoded capacity of 4 or 8 (line 126-128):
```typescript
const timelineRowCapacity = $derived(
  manualColumnCount ??
    (!isSideBySideLayout && containerWidth >= WIDE_THRESHOLD ? 8 : 4)
);
```

This capacity is passed to `calculateTimelineRows`. The problem is the same: with swing durations, 4 capacity units only fits 2 beats.

However, the workspace StepGrid is different from ChoreoCard — it uses `timelineRowCapacity` as both the beats-per-row AND the unit sizing denominator. We need to:
1. Keep the existing capacity-based `timelineRowCapacity` for unit sizing (it determines how wide the timeline is)
2. Add a separate `timelineBeatsPerRow` that determines how many beats go in each row
3. Use `calculateTimelineRowsByBeatCount` with the beats-per-row count

- [ ] **Step 1: Add import for new function**

At line 22, where `calculateTimelineRows` is imported, add `calculateTimelineRowsByBeatCount`:

```typescript
import {
  calculateGridLayout,
  calculateTimelineRows,
  calculateTimelineRowsByBeatCount,
  calculateTimelineUnitSize,
  calculateTimelinePadding,
} from "../utils/grid-calculations";
```

- [ ] **Step 2: Add beats-per-row derivation and update timeline rows**

After the `timelineRowCapacity` derivation (line 128), add a beats-per-row derivation. The beats-per-row should come from the grid layout's column count (what the layout table says), not the hardcoded 4/8 capacity:

```typescript
// Beats per row for timeline mode — matches the grid layout's column count
// so swing/duration sequences show the same number of beats per row as
// uniform sequences. Falls back to timelineRowCapacity for manual overrides.
const timelineBeatsPerRow = $derived(
  manualColumnCount ?? gridLayout.columns
);
```

Then update the `timelineRows` derivation (lines 130-133) to use beat-count packing:

**Before:**
```typescript
const timelineRows = $derived.by(() => {
  if (!isTimelineMode) return [];
  return calculateTimelineRows(steps, timelineRowCapacity, false);
});
```

**After:**
```typescript
const timelineRows = $derived.by(() => {
  if (!isTimelineMode) return [];
  return calculateTimelineRowsByBeatCount(steps, timelineBeatsPerRow);
});
```

- [ ] **Step 3: Update timelineUnitSize to use actual row duration**

The `timelineUnitSize` calculation (lines 135-162) currently uses `timelineRowCapacity` to determine how many units fit in a row. With beat-count packing, the actual units per row vary (e.g., 5.34 for swing). The unit size should be based on the widest row's total duration so that all rows align properly.

**Replace the timelineUnitSize derivation (lines 135-162) with:**

```typescript
const timelineUnitSize = $derived.by(() => {
  if (!isTimelineMode) return 0;
  const hasStart = startPosition && !startPosition.isBlank;
  const actualCellCount = steps.length + (hasStart ? 1 : 0);

  // Find the widest row's duration to use as the sizing denominator.
  // Add 1 for start position if present.
  let maxRowDuration = 0;
  for (const row of timelineRows) {
    maxRowDuration = Math.max(maxRowDuration, row.totalDuration);
  }
  const fullRowUnits = maxRowDuration + (hasStart ? 1 : 0);

  // Mobile-adaptive: on narrow screens, size based on actual cell count
  const isNarrow = containerWidth > 0 && containerWidth < 650;
  const totalUnits = isNarrow
    ? Math.max(Math.min(actualCellCount, fullRowUnits), 2)
    : Math.max(fullRowUnits, 2);

  const widthBased = calculateTimelineUnitSize(containerWidth, totalUnits);

  // Constrain by available height so all rows fit without scrolling
  if (containerHeight > 0 && timelineRows.length > 0) {
    const gaps = (timelineRows.length - 1) * 1;
    const padding = 8;
    const availableHeight = containerHeight - gaps - padding;
    const heightBased = Math.floor(availableHeight / timelineRows.length);
    return Math.max(48, Math.min(widthBased, heightBased));
  }

  return widthBased;
});
```

- [ ] **Step 4: Verify build passes**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte
git commit -m "feat: use beat-count packing for duration-aware workspace timeline"
```

---

### Task 4: Visual verification

- [ ] **Step 1: Generate a 16-beat swing sequence and verify workspace display**

In the app:
1. Go to Generate
2. Set length to 16, customize to Swing
3. Generate a sequence
4. Verify the workspace shows 4 beats per row with alternating wide/narrow cells

Expected: 4 rows of 4 beats each. Odd beats (1, 3, 5, 7...) visually wider than even beats (2, 4, 6, 8...).

- [ ] **Step 2: Verify ChoreoCard display**

Navigate to the sequence viewer or card designer and confirm the choreo card also shows 4 beats per row with proportional widths.

- [ ] **Step 3: Verify other beat counts still work**

Test with:
- 8-beat swing → should show 4 beats per row (2 rows)
- 4-beat swing → should show 4 beats in 1 row
- 16-beat uniform (no swing) → should show standard 4-column grid (no change)

- [ ] **Step 4: Verify narrow/mobile layout**

On a narrow viewport, confirm the layout still looks reasonable and cells aren't too small.

---

## Edge Cases to Watch

1. **Non-swing duration patterns** (waltz = [2,1,1], shuffle = [1.5,1.0]): Should also benefit from beat-count packing. Waltz with 12 beats should show 4 beats per row (2+1+1+2+1+1... pattern).

2. **Manual column override** (`manualColumnCount`): When set (e.g., LOOP alignment), both workspace and ChoreoCard already use this as the column count. The new code respects this path — `manualColumnCount` flows through as `beatsPerRow`.

3. **Long sequences** (`isLongSequence` in ChoreoCard): Uses fixed 5 columns. With beat-count packing, this means 4 beats per row (5 - 1 for start position), which is correct.

4. **Export/print preview** (PageDisplay.svelte): Uses ChoreoCard internally with the same rendering. No separate change needed — ChoreoCard's fix propagates automatically.
