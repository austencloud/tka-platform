# LOOP Detection Foundation Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LOOP detection system aware that period is per-component (not per-sequence), fix the quartered detector's rotation-only filter, expand the modular system to track all component types, and migrate TransformationIntervals from string-based to numeric periods.

**Architecture:** Five incremental changes, each behind tests. The type migration (string→number) touches detection internals, UI display panels, candidate formatting, and scripts. The quartered filter widen and modular expansion are scoped to LOOPDetector.ts and TransformationAnalyzer.ts. All changes are within the loop-labeler feature boundary.

**Tech Stack:** TypeScript, Vitest, Svelte 5

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/features/loop-labeler/domain/models/label-models.ts` | Modify | `TransformationInterval` type: `"none" \| "halved" \| "quartered" \| string` → `2 \| 4` |
| `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts` | Modify | `periodFromIntervals`, `detectQuarteredPattern` filter widen, `buildQuarteredIntervals`, `buildCompoundCandidates`, `detectHalvedPattern`, `detectModularQuarteredPattern`, `enrichWithHalvedPrimitives` — all interval string→number |
| `src/lib/features/loop-labeler/services/implementations/CandidateFormatter.ts` | Modify | `buildCandidateDesignations` parameter `"halved" \| "quartered"` → `2 \| 4`; display logic |
| `src/lib/features/loop-labeler/services/contracts/ICandidateFormatter.ts` | Modify | Interface signature update |
| `src/lib/features/loop-labeler/services/contracts/ITransformationAnalyzer.ts` | Modify | `ColumnBehavior` — add `isInverted`, `isMirrored`, `isFlipped` |
| `src/lib/features/loop-labeler/services/implementations/TransformationAnalyzer.ts` | Modify | `detectModularPattern` — populate new boolean fields |
| `src/lib/features/loop-labeler/services/loop-display-resolver.ts` | Modify | `mapRotationInterval` — number comparison instead of string |
| `src/lib/features/loop-labeler/services/implementations/LabelFormatter.ts` | Modify | `formatInterval` — number→display string |
| `src/lib/features/loop-labeler/components/panels/WholeModePanel.svelte` | Modify | Button onclick values and display logic: `"halved"` → `2`, `"quartered"` → `4` |
| `src/lib/features/loop-labeler/components/panels/StepPairModePanel.svelte` | Modify | Same as WholeModePanel |
| `src/lib/features/loop-labeler/components/panels/designations/CandidatesSection.svelte` | Modify | Display formatting: number→symbol |
| `src/lib/features/loop-labeler/components/panels/SequencePreviewPanel.svelte` | Modify | Interval string checks → number checks |
| `src/lib/features/loop-labeler/state/whole-mode-state.svelte.ts` | Modify | Interval validation |
| `src/lib/features/loop-labeler/state/steppair-mode-state.svelte.ts` | Modify | Display formatting |
| `tests/unit/loop-labeler/LOOPDetector.test.ts` | Modify | Assertions: `"halved"` → `2`, `"quartered"` → `4`; add new test cases |
| `scripts/auto-label-loops.cjs` | Modify | All interval string assignments → numbers |

---

### Task 1: Golden Snapshot Tests

Lock current behavior before changing anything.

**Files:**
- Modify: `tests/unit/loop-labeler/LOOPDetector.test.ts`

- [ ] **Step 1: Add snapshot test for halved detection**

```ts
it("halved detection snapshot — full result shape", () => {
  const result = loopDetector.detectLOOP(halvedFixture());
  expect(result.components).toEqual(expect.arrayContaining(["rotated"]));
  expect(result.transformationIntervals.rotation).toBe("halved");
  expect(result.period).toBe(2);
  expect(result.isCircular).toBe(true);
  expect(result.isFreeform).toBe(false);
});
```

- [ ] **Step 2: Add snapshot test for quartered detection**

```ts
it("quartered detection snapshot — full result shape", () => {
  const result = loopDetector.detectLOOP(quarteredFixture());
  expect(result.components).toEqual(expect.arrayContaining(["rotated"]));
  expect(result.transformationIntervals.rotation).toBe("quartered");
  expect(result.period).toBe(4);
  expect(result.isCircular).toBe(true);
  expect(result.isFreeform).toBe(false);
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/unit/loop-labeler/LOOPDetector.test.ts`
Expected: all pass (these lock existing behavior)

- [ ] **Step 4: Commit**

```bash
git add tests/unit/loop-labeler/LOOPDetector.test.ts
git commit -m "test(loop): add golden snapshot tests before foundation refactor"
```

---

### Task 2: TransformationInterval Type Migration

Change from strings to numbers, update all producers and consumers.

**Files:**
- Modify: `src/lib/features/loop-labeler/domain/models/label-models.ts:19`
- Modify: `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts:69-78,552-571,700-758,835-838,950-954`
- Modify: `src/lib/features/loop-labeler/services/implementations/CandidateFormatter.ts:271,288-313`
- Modify: `src/lib/features/loop-labeler/services/contracts/ICandidateFormatter.ts:57`
- Modify: `src/lib/features/loop-labeler/services/loop-display-resolver.ts:93-98`
- Modify: `src/lib/features/loop-labeler/services/implementations/LabelFormatter.ts:72-73`
- Modify: `src/lib/features/loop-labeler/components/panels/WholeModePanel.svelte:62-63,104-119`
- Modify: `src/lib/features/loop-labeler/components/panels/StepPairModePanel.svelte:68-69,139-153`
- Modify: `src/lib/features/loop-labeler/components/panels/designations/CandidatesSection.svelte:45`
- Modify: `src/lib/features/loop-labeler/components/panels/SequencePreviewPanel.svelte:110,121,133,137`
- Modify: `src/lib/features/loop-labeler/state/whole-mode-state.svelte.ts:135`
- Modify: `src/lib/features/loop-labeler/state/steppair-mode-state.svelte.ts:146-147`
- Modify: `tests/unit/loop-labeler/LOOPDetector.test.ts`

- [ ] **Step 1: Change the type definition**

In `label-models.ts`, replace:

```ts
export type TransformationInterval = "none" | "halved" | "quartered" | string;
```

With:

```ts
export type TransformationInterval = 2 | 4;
```

And update `TransformationIntervals`:

```ts
export interface TransformationIntervals {
  rotation?: TransformationInterval;
  swap?: TransformationInterval;
  mirror?: TransformationInterval;
  flip?: TransformationInterval;
  invert?: TransformationInterval;
}
```

- [ ] **Step 2: Update `periodFromIntervals`**

In `LOOPDetector.ts` lines 69-79, replace:

```ts
function periodFromIntervals(
  intervals: TransformationIntervals,
  isCircular: boolean
): number {
  if (!isCircular) return 1;
  const values = Object.values(intervals);
  if (values.length === 0) return 1;
  if (values.some((v) => v === "quartered")) return 4;
  if (values.some((v) => v === "halved")) return 2;
  return 1;
}
```

With:

```ts
function periodFromIntervals(
  intervals: TransformationIntervals,
  isCircular: boolean
): number {
  if (!isCircular) return 1;
  const values = Object.values(intervals).filter(
    (v): v is number => typeof v === "number"
  );
  if (values.length === 0) return 1;
  return Math.max(...values);
}
```

- [ ] **Step 3: Update `detectHalvedPattern` interval assignments**

In `LOOPDetector.ts` lines 563-571, replace all `"halved"` with `2`:

```ts
const derivedIntervals: TransformationIntervals = {};
if (derivedComponents.includes("inverted")) derivedIntervals.invert = 2;
if (derivedComponents.includes("rotated")) derivedIntervals.rotation = 2;
if (derivedComponents.includes("swapped")) derivedIntervals.swap = 2;
if (derivedComponents.includes("mirrored")) derivedIntervals.mirror = 2;
if (derivedComponents.includes("flipped")) derivedIntervals.flip = 2;
```

- [ ] **Step 4: Update `buildCompoundCandidates` intervals**

In `LOOPDetector.ts` lines 703-709, replace:

```ts
const compoundIntervals: TransformationIntervals = {
  rotation: "quartered",
};
if (halvedOnlyTransformations.includes("swapped"))
  compoundIntervals.swap = "halved";
if (halvedOnlyTransformations.includes("inverted"))
  compoundIntervals.invert = "halved";
```

With:

```ts
const compoundIntervals: TransformationIntervals = {
  rotation: 4,
};
if (halvedOnlyTransformations.includes("swapped"))
  compoundIntervals.swap = 2;
if (halvedOnlyTransformations.includes("inverted"))
  compoundIntervals.invert = 2;
```

- [ ] **Step 5: Update `buildQuarteredIntervals`**

In `LOOPDetector.ts` lines 741-757, replace all `"quartered"` with `4` and `"halved"` with `2`:

```ts
private buildQuarteredIntervals(
  components: ComponentId[],
  halvedTransformations?: string[]
): TransformationIntervals {
  const intervals: TransformationIntervals = {};
  if (components.includes("rotated")) intervals.rotation = 4;

  if (halvedTransformations?.includes("swapped")) {
    intervals.swap = 2;
  } else if (components.includes("swapped")) {
    intervals.swap = 4;
  }

  if (halvedTransformations?.includes("inverted")) {
    intervals.invert = 2;
  } else if (components.includes("inverted")) {
    intervals.invert = 4;
  }

  if (components.includes("mirrored")) intervals.mirror = 4;
  return intervals;
}
```

- [ ] **Step 6: Update `detectModularQuarteredPattern` intervals**

In `LOOPDetector.ts` lines 834-838, replace:

```ts
if (components.includes("rotated")) intervals.rotation = "quartered";
if (components.includes("swapped")) {
  intervals.swap = `positional:${modularAnalysis.swapRhythm}`;
}
```

With:

```ts
if (components.includes("rotated")) intervals.rotation = 4;
if (components.includes("swapped")) intervals.swap = 4;
```

- [ ] **Step 7: Update `enrichWithHalvedPrimitives`**

In `LOOPDetector.ts` lines 949-954, replace `"halved"` with `2`:

```ts
if (primitive === "inverted")
  result.transformationIntervals.invert = 2;
if (primitive === "mirrored")
  result.transformationIntervals.mirror = 2;
if (primitive === "flipped")
  result.transformationIntervals.flip = 2;
```

- [ ] **Step 8: Update `CandidateFormatter.buildCandidateDesignations`**

In `CandidateFormatter.ts` line 271 and throughout the method, change the parameter type and all string comparisons:

```ts
buildCandidateDesignations(
  allCommon: string[],
  interval: 2 | 4,
  rotationDirection: "cw" | "ccw" | null
): CandidateInfo[] {
```

Update line 288-291 (interval assignments already correct — they assign `interval` which is now a number).

Update line 300:
```ts
label: `repeated @${interval === 2 ? "1/2" : "1/4"}`,
```

Update lines 308-313:
```ts
if (direction && interval === 4)
  label += ` (${direction.toUpperCase()})`;
if (interval === 4) label += " @1/4";
else if (interval === 2) label += " @1/2";

const effectiveDirection = interval === 4 ? direction : null;
```

- [ ] **Step 9: Update the interface contract**

In `ICandidateFormatter.ts` line 57:
```ts
interval: 2 | 4,
```

- [ ] **Step 10: Update call sites passing `"halved"` / `"quartered"` to `buildCandidateDesignations`**

In `LOOPDetector.ts` line 343:
```ts
// was: "quartered"
4,
```

In `LOOPDetector.ts` line 552:
```ts
// was: "halved"
2,
```

- [ ] **Step 11: Update `loop-display-resolver.ts`**

In `loop-display-resolver.ts` lines 93-98:

```ts
function mapRotationInterval(
  interval: number | undefined
): Period | undefined {
  if (interval === 2) return Period.HALVED;
  if (interval === 4) return Period.QUARTERED;
  return undefined;
}
```

- [ ] **Step 12: Update `LabelFormatter.ts`**

In `LabelFormatter.ts` lines 72-73:

```ts
if (interval === 2) return "½";
if (interval === 4) return "¼";
```

- [ ] **Step 13: Update UI panels — WholeModePanel.svelte**

Replace display function (lines 62-63):
```ts
if (val === 2) return "½";
if (val === 4) return "¼";
```

Replace button onclick handlers (lines 107, 117):
```svelte
onclick={() => onSetInterval(intervalConfig.key, 2)}
```
and:
```svelte
onclick={() => onSetInterval(intervalConfig.key, 4)}
```

Replace aria-pressed checks (lines 109, 119):
```svelte
aria-pressed={transformationIntervals[intervalConfig.key] === 2}
```
and:
```svelte
aria-pressed={transformationIntervals[intervalConfig.key] === 4}
```

Replace class:active checks (lines 104-105, 114-115):
```svelte
class:active={transformationIntervals[intervalConfig.key] === 2}
```
and:
```svelte
class:active={transformationIntervals[intervalConfig.key] === 4}
```

- [ ] **Step 14: Update UI panels — StepPairModePanel.svelte**

Same pattern as WholeModePanel. Replace `"halved"` → `2`, `"quartered"` → `4` in display function (lines 68-69), button onclick handlers (lines 141, 151), aria-pressed (lines 143, 153).

- [ ] **Step 15: Update CandidatesSection.svelte**

Line 45:
```ts
`${k}: ${v === 2 ? "½" : v === 4 ? "¼" : v}`
```

- [ ] **Step 16: Update SequencePreviewPanel.svelte**

Lines 110, 121 — these check if intervals array includes string values. They need to check for numbers:

```ts
// Line 110: was intervals.includes("quartered")
return intervals.includes(4);

// Line 121: was intervals.includes("halved")  
return intervals.includes(2);
```

Lines 133, 137 — these check `loopTypeLower.includes("quartered"/"halved")` which is about the loopType string, NOT intervals. These stay as-is since loopType is still a string.

- [ ] **Step 17: Update state files**

`whole-mode-state.svelte.ts` line 135 — replace string check:
```ts
interval === 2 || interval === 4
```

`steppair-mode-state.svelte.ts` lines 146-147:
```ts
if (interval === 2) return `½ ${label}`;
if (interval === 4) return `¼ ${label}`;
```

- [ ] **Step 18: Update test assertions**

In `LOOPDetector.test.ts`, change all `"halved"` assertions to `2` and `"quartered"` to `4`:

Line 179: `expect(result.transformationIntervals.rotation).toBe(2);`
Line 188: `expect(result.transformationIntervals.rotation).toBe(4);`

And the golden snapshots from Task 1:
```ts
expect(result.transformationIntervals.rotation).toBe(2);
// and
expect(result.transformationIntervals.rotation).toBe(4);
```

- [ ] **Step 19: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to TransformationInterval type mismatches

- [ ] **Step 20: Run tests**

Run: `npx vitest run tests/unit/loop-labeler/LOOPDetector.test.ts`
Expected: all pass

- [ ] **Step 21: Commit**

```bash
git add src/lib/features/loop-labeler/ tests/unit/loop-labeler/
git commit -m "refactor(loop): migrate TransformationInterval from string to numeric period (2|4)"
```

---

### Task 3: Update Scripts

Migrate the standalone scripts that write string interval values.

**Files:**
- Modify: `scripts/auto-label-loops.cjs`

- [ ] **Step 1: Replace all interval string assignments in auto-label-loops.cjs**

Find every occurrence of `= "halved"` and `= "quartered"` in interval assignment context. Replace:

- `"quartered"` → `4` in lines ~1400, 1434, 1478, 1508, 1512
- `"halved"` → `2` in lines ~1401, 1434, 1443, 1452, 1563, 1574-1582, 1615-1623

Also update display formatting:
- Line 943: `if (interval === 4) label += " (1/4)";`
- Line 944: `else if (interval === 2) label += " (1/2)";`

And the `buildCandidateDesignations` call:
- Line 1478: pass `4` instead of `"quartered"`
- Line 1492: pass `2` instead of `"halved"`

- [ ] **Step 2: Check that deck scripts don't write TransformationIntervals**

The `backfill-deck-slicetype.cjs` and `backfill-deck-metadata.cjs` scripts use `"halved"/"quartered"` for `sliceType` — this is a DIFFERENT field (deck metadata), NOT TransformationIntervals. Leave them alone.

`enumerate-deck.cjs` uses the strings for slice type too. Leave alone.

`validate-loop-detection.cjs` line 798 has `period: "halved"` — check if this is TransformationIntervals or a different field:

```bash
grep -n -B5 -A5 'period: "halved"' scripts/validate-loop-detection.cjs
```

If it writes to TransformationIntervals, update to `2`. If it's a different schema, leave it.

- [ ] **Step 3: Commit**

```bash
git add scripts/auto-label-loops.cjs
git commit -m "refactor(scripts): update auto-label-loops interval values to numeric periods"
```

---

### Task 4: Widen Quartered Detector Filter

Remove the rotation-only filter. Extract all components from quartered-common set.

**Files:**
- Modify: `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts:277-293`
- Modify: `tests/unit/loop-labeler/LOOPDetector.test.ts`

- [ ] **Step 1: Write the failing test — quartered non-rotation component**

Add a test fixture for a sequence that has period-4 swapped (every quarter, colors swap) but no rotation. Currently the detector misses this because the filter at line 278 only looks for `rotated_90`.

```ts
function quarteredSwappedFixture(): SequenceEntry {
  // 4 beats. Beat 1→2 is a color swap (blue↔red positions swap).
  // Beat 2→3 is another swap. Beat 3→4 is another swap. Beat 4→1 closes.
  // No rotation — same positions, just swapped color assignment each quarter.
  const makeMotion = (
    s: string,
    e: string,
    motionType: string,
    propRotDir: string
  ): MotionAttrs => ({
    startLoc: s,
    endLoc: e,
    motionType,
    propRotDir,
  });

  return makeEntry([
    {
      beat: 0,
      sequenceStartPosition: "alpha1",
      endPos: "alpha1",
    },
    // Beat 1: blue n→e, red s→w (pro/cw)
    makeBeat(
      1,
      makeMotion("n", "e", "pro", "cw"),
      makeMotion("s", "w", "pro", "cw"),
      "alpha1",
      "alpha2"
    ),
    // Beat 2: swapped — blue s→w, red n→e (same motion, colors swapped)
    makeBeat(
      2,
      makeMotion("s", "w", "pro", "cw"),
      makeMotion("n", "e", "pro", "cw"),
      "alpha2",
      "alpha1"
    ),
    // Beat 3: swap again — blue n→e, red s→w
    makeBeat(
      3,
      makeMotion("n", "e", "pro", "cw"),
      makeMotion("s", "w", "pro", "cw"),
      "alpha1",
      "alpha2"
    ),
    // Beat 4: swap again — blue s→w, red n→e
    makeBeat(
      4,
      makeMotion("s", "w", "pro", "cw"),
      makeMotion("n", "e", "pro", "cw"),
      "alpha2",
      "alpha1"
    ),
  ]);
}
```

```ts
it("detects quartered-level swap without rotation", () => {
  const result = loopDetector.detectLOOP(quarteredSwappedFixture());
  expect(result.isCircular).toBe(true);
  expect(result.components).toContain("swapped");
  // Swap repeats every quarter — period 4
  // (This test will fail before the filter widen)
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/loop-labeler/LOOPDetector.test.ts -t "quartered-level swap"`
Expected: FAIL — the quartered detector filters to rotation-only and returns null, so the detector falls back to halved or freeform.

- [ ] **Step 3: Widen the quartered filter**

In `LOOPDetector.ts`, replace the rotation-only filter block (lines 277-293) with component extraction that handles ALL transformation types:

```ts
// Extract all components found at quartered level
const quarteredComponents: ComponentId[] = [];
let hasRotation90 = false;

for (const t of allQuarteredCommon) {
  if (t.includes("rotated_90") || t.includes("90_ccw") || t.includes("90_cw")) {
    hasRotation90 = true;
  }
  const derived = this.formattingService.deriveComponentsFromPattern(t);
  for (const c of derived) {
    if (!quarteredComponents.includes(c)) quarteredComponents.push(c);
  }
}

// Guard: rotation-specific motion consistency check
// If 90° rotation is detected but motions differ between quartered pairs,
// drop rotation from the quartered components (it's a false positive).
// Other components found at quartered level survive this check.
if (hasRotation90) {
  const quarterLength = Math.floor(steps.length / 4);
  if (quarterLength > 0 && !this.quarteredMotionsConsistent(steps, quarterLength)) {
    const rotIdx = quarteredComponents.indexOf("rotated");
    if (rotIdx >= 0) quarteredComponents.splice(rotIdx, 1);
    hasRotation90 = false;
  }
}
```

Then update the rest of `detectQuarteredPattern` to use `quarteredComponents` instead of `rotation90Patterns`. Where `rotation90Patterns.length === 0` was the gate for compound/modular fallback, use `quarteredComponents.length === 0`.

The candidate building and interval derivation sections already work with `derivedComponents` — just populate them from `quarteredComponents` instead of extracting from `rotation90Patterns[0]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/loop-labeler/LOOPDetector.test.ts`
Expected: all pass including new quartered swap test

- [ ] **Step 5: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts tests/unit/loop-labeler/LOOPDetector.test.ts
git commit -m "feat(loop): widen quartered detector to extract all components, not just rotation"
```

---

### Task 5: Add `swapped` to Enrichment Primitives

**Files:**
- Modify: `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts:936`
- Modify: `tests/unit/loop-labeler/LOOPDetector.test.ts`

- [ ] **Step 1: Write the failing test — period-2 swap via enrichment**

Create a fixture where swap is present at halved level but NOT at quartered level (i.e., beat 1↔3 are swapped, beat 2↔4 are swapped, but consecutive quarters are NOT swapped). Currently this is missed because `enrichWithHalvedPrimitives` doesn't check for `swapped`.

```ts
it("enriches quartered result with period-2 swap from halved pairs", () => {
  // A quartered-rotation loop where the halved pairs also show swap
  const result = loopDetector.detectLOOP(quarteredWithHalvedSwapFixture());
  expect(result.components).toContain("rotated");
  expect(result.components).toContain("swapped");
  expect(result.transformationIntervals.rotation).toBe(4);
  expect(result.transformationIntervals.swap).toBe(2);
});
```

(The fixture `quarteredWithHalvedSwapFixture` needs a sequence where rotation is 90° per quarter AND the 180° pairs show color swap. This is a compound pattern — beats separated by half the sequence have swapped colors.)

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — swap not in components because enrichment skips it.

- [ ] **Step 3: Add `swapped` to enrichment primitives list**

In `LOOPDetector.ts` line 936, change:

```ts
const halvedPrimitives = ["inverted", "mirrored", "flipped"] as const;
```

To:

```ts
const halvedPrimitives = ["inverted", "mirrored", "flipped", "swapped"] as const;
```

And add the swap interval assignment in the loop body (after line 954):

```ts
if (primitive === "swapped")
  result.transformationIntervals.swap = 2;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/loop-labeler/LOOPDetector.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts tests/unit/loop-labeler/LOOPDetector.test.ts
git commit -m "feat(loop): add swapped to enrichment primitives for period-2 swap detection"
```

---

### Task 6: Expand ColumnBehavior and Modular Detection

**Files:**
- Modify: `src/lib/features/loop-labeler/services/contracts/ITransformationAnalyzer.ts:34-45`
- Modify: `src/lib/features/loop-labeler/services/implementations/TransformationAnalyzer.ts:405-432`
- Modify: `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts:819-838`
- Modify: `tests/unit/loop-labeler/LOOPDetector.test.ts`

- [ ] **Step 1: Write the failing test — modular with invert variation**

```ts
it("detects modular quartered pattern with per-column invert variation", () => {
  // A 4-beat modular sequence where columns 1,3 are normal and columns 2,4
  // are inverted. The modular analysis should report isInverted per column.
  const result = loopDetector.detectLOOP(modularWithInvertFixture());
  expect(result.isModular).toBe(true);
  expect(result.components).toContain("inverted");
});
```

(The fixture needs a modular quartered sequence where rotation is present but invert varies by column position. This proves the modular detector sees invert, not just swap.)

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — modular detector only emits swap, not invert.

- [ ] **Step 3: Expand ColumnBehavior interface**

In `ITransformationAnalyzer.ts`, replace:

```ts
export interface ColumnBehavior {
  position: number;
  baseTransformation: string;
  isSwapped: boolean;
  steps: number[];
  transformations: string[];
}
```

With:

```ts
export interface ColumnBehavior {
  position: number;
  baseTransformation: string;
  isSwapped: boolean;
  isInverted: boolean;
  isMirrored: boolean;
  isFlipped: boolean;
  steps: number[];
  transformations: string[];
}
```

- [ ] **Step 4: Populate new fields in `detectModularPattern`**

In `TransformationAnalyzer.ts`, in the column behavior construction block (lines 417-432), add detection for invert/mirror/flip using the same pattern as swap:

```ts
const isSwapped = this.isColumnSwapped(columnPairs);
const isInverted = this.isColumnInverted(columnPairs);
const isMirrored = this.isColumnMirrored(columnPairs);
const isFlipped = this.isColumnFlipped(columnPairs);

columnBehaviors.push({
  position: pos,
  baseTransformation,
  isSwapped,
  isInverted,
  isMirrored,
  isFlipped,
  steps: columnPairs.map((p) => p.keyStep),
  transformations: uniqueTransformations.map((t) =>
    this.formattingService.formatSingleTransformation(t)
  ),
});
```

Add the helper methods (following the pattern of `isColumnSwapped`):

```ts
private isColumnInverted(pairs: InternalStepPair[]): boolean {
  return pairs.every((p) =>
    p.rawTransformations.some((t) => t.includes("inverted"))
  );
}

private isColumnMirrored(pairs: InternalStepPair[]): boolean {
  return pairs.every((p) =>
    p.rawTransformations.some((t) => t.includes("mirrored"))
  );
}

private isColumnFlipped(pairs: InternalStepPair[]): boolean {
  return pairs.every((p) =>
    p.rawTransformations.some((t) => t.includes("flipped"))
  );
}
```

- [ ] **Step 5: Update `detectModularQuarteredPattern` to emit new components**

In `LOOPDetector.ts`, after the existing swap check (lines 826-831), add:

```ts
const invertedPositions = modularAnalysis.columnBehaviors
  .filter((c) => c.isInverted)
  .map((c) => c.position);
if (invertedPositions.length > 0 && !components.includes("inverted")) {
  components.push("inverted");
}

const mirroredPositions = modularAnalysis.columnBehaviors
  .filter((c) => c.isMirrored)
  .map((c) => c.position);
if (mirroredPositions.length > 0 && !components.includes("mirrored")) {
  components.push("mirrored");
}

const flippedPositions = modularAnalysis.columnBehaviors
  .filter((c) => c.isFlipped)
  .map((c) => c.position);
if (flippedPositions.length > 0 && !components.includes("flipped")) {
  components.push("flipped");
}
```

And add their intervals (after the existing swap interval at line 838):

```ts
if (components.includes("inverted")) intervals.invert = 4;
if (components.includes("mirrored")) intervals.mirror = 4;
if (components.includes("flipped")) intervals.flip = 4;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/loop-labeler/LOOPDetector.test.ts`
Expected: all pass

- [ ] **Step 7: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/loop-labeler/ tests/unit/loop-labeler/
git commit -m "feat(loop): expand modular detection to track invert/mirror/flip per column"
```

---

### Task 7: Final Verification

**Files:** None created — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: clean

- [ ] **Step 4: Verify no remaining string intervals in detection code**

Run: `grep -rn '"halved"\|"quartered"' src/lib/features/loop-labeler/services/implementations/`
Expected: zero matches (UI panels may still use strings for display labels/CSS classes — that's fine, those are display text not interval values)

- [ ] **Step 5: Commit any straggler fixes**

If steps 1-4 surfaced issues, fix and commit individually.
