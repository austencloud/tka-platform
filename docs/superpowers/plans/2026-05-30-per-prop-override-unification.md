# Per-Prop Override Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 4-tier arrow override pipeline (Global → Special → Prop Geometry → Default) into 2 prop-scoped tiers (Special → Default), migrating 120 live Global records into prop-keyed Special overrides with a blocking pixel-parity gate, and wiring WASD to move arrows in the pressed screen direction.

**Architecture:** Special overrides become prop-scoped (key gains a mandatory `propType`), mirroring the already-shipped per-prop Default tier. A live in-app migration replays every pictograph variation through the existing render code paths to write Global values into Special under the exact keys the renderer looks up (parity by construction), then the Global render-read is removed. WASD deltas are routed through the existing `ScreenSpaceAdjustmentTransformer` before being stored.

**Tech Stack:** Svelte 5 runes, Firestore (`special_arrow_placements`, `global_arrow_adjustments`), Vitest, fabric `Point`.

**Spec:** `docs/superpowers/specs/2026-05-30-per-prop-override-unification-design.md`

**Critical invariant (every task respects this):** Until Task 9 explicitly removes the Global render-read, the render pipeline keeps reading Global FIRST. No task before Task 9 may change rendered output. The migration (Tasks 6-8) only ADDS Special data; it never deletes Global and never changes the read order. This guarantees zero regression at every commit.

---

## File Structure

**New files:**
- `src/lib/features/admin/override-migration/services/override-migration.ts` — the parity-by-construction migration engine (enumerate variations → replay → write Special → verify).
- `src/lib/features/admin/override-migration/services/variation-enumerator.ts` — yields every (PictographData, arrowColor) the dataset can render, for the migration to replay.
- `src/routes/test/override-migration/+page.svelte` — admin dev route with Dry-Run / Migrate / Verify buttons and the parity report table.
- `tests/unit/arrow-adjustment/special-override-proptype.test.ts` — key/schema/state propType tests.
- `tests/unit/arrow-adjustment/wasd-screen-direction.test.ts` — WASD→reference round-trip tests.
- `tests/unit/arrow-adjustment/override-migration-parity.test.ts` — migration engine parity-gate test against fixtures.

**Modified files (with responsibility):**
- `special-override/domain/SpecialArrowPlacement.ts` — add mandatory `propType` to key/interfaces/schema/parse.
- `special-override/state/SpecialArrowPlacementState.svelte.ts` — key by 7-part id; zero-override treated as absent.
- `special-override/services/special-arrow-placement-repository.ts` + `…-persister.ts` — thread `propType`; never persist `[0,0]`.
- `placement/services/special-placer.ts` — Task 9: remove Global read; special-override lookup keyed prop-aware.
- `calculation/services/arrow-adjustment-calculator.ts` — prop-aware special-override key in `lookupSpecialPlacement`; Task 9: drop Global + Prop-Geometry tiers from `getBaseAdjustment`/`getDiagnostics`; strip temp `[ARROW-ADJ]` diagnostic.
- `calculation/services/directional-tuple-processor.ts` — strip temp `[TUPLE]` diagnostic.
- `pictograph-inspect/PipelineEditorDock.svelte` — Special-only edit target; WASD screen transform; prop in header; remove tier selector + Base/Prop/Combo toggle.
- `pictograph-inspect/PipelineTraceSection.svelte` — show only Special + Default rows.
- `global/state/global-adjustment-version.svelte.ts` → rename export to `arrowAdjustmentVersion` (Task 11); update all importers.

---

## Task 1: Add mandatory `propType` to the Special override key + schema

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement.ts`
- Test: `tests/unit/arrow-adjustment/special-override-proptype.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  generateSpecialOverrideKey,
  parseSpecialOverrideKey,
  SpecialArrowPlacementSchema,
} from "$lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement";

describe("special override key — propType dimension", () => {
  it("includes propType as the 7th segment", () => {
    const key = generateSpecialOverrideKey({
      gridMode: "box", oriFolder: "from_layer2", letter: "P",
      turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red", propType: "fan",
    });
    expect(key).toBe("box|from_layer2|P|(0, 0)|pro|red|fan");
  });

  it("parses a 7-part key back to fields", () => {
    expect(parseSpecialOverrideKey("box|from_layer2|P|(0, 0)|pro|red|fan")).toEqual({
      gridMode: "box", oriFolder: "from_layer2", letter: "P",
      turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red", propType: "fan",
    });
  });

  it("parses a legacy 6-part key with propType defaulted to staff", () => {
    expect(parseSpecialOverrideKey("box|from_layer2|P|(0, 0)|pro|red")).toEqual({
      gridMode: "box", oriFolder: "from_layer2", letter: "P",
      turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red", propType: "staff",
    });
  });

  it("schema defaults a missing propType to staff", () => {
    const parsed = SpecialArrowPlacementSchema.parse({
      key: "box|from_layer2|P|(0, 0)|pro|red", gridMode: "box", oriFolder: "from_layer2",
      letter: "P", turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red",
      adjustmentX: 1, adjustmentY: 2, originalX: 0, originalY: 0,
      updatedAt: new Date().toISOString(), updatedBy: "x",
    });
    expect(parsed.propType).toBe("staff");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/arrow-adjustment/special-override-proptype.test.ts`
Expected: FAIL (key has 6 segments, no `propType`).

- [ ] **Step 3: Implement**

In `SpecialArrowPlacement.ts`:
- Add `readonly propType: string;` to both `SpecialArrowPlacement` and `SpecialArrowPlacementInput`.
- Add `propType: z.string().default("staff"),` to `SpecialArrowPlacementSchema`.
- Update `generateSpecialOverrideKey` input type to include `propType: string` and append it:

```ts
export function generateSpecialOverrideKey(input: {
  gridMode: string; oriFolder: string; letter: string;
  turnsTuple: string; motionType: string; attributeKey: string; propType: string;
}): string {
  return `${input.gridMode}|${input.oriFolder}|${input.letter}|${input.turnsTuple}|${input.motionType}|${input.attributeKey}|${input.propType}`;
}
```

- Update `parseSpecialOverrideKey` to accept 6 OR 7 parts (6 → propType "staff"):

```ts
export function parseSpecialOverrideKey(key: string): {
  gridMode: string; oriFolder: string; letter: string; turnsTuple: string;
  motionType: string; attributeKey: string; propType: string;
} | null {
  const parts = key.split("|");
  if (parts.length !== 6 && parts.length !== 7) return null;
  const [gridMode, oriFolder, letter, turnsTuple, motionType, attributeKey] = parts;
  const propType = parts.length === 7 ? parts[6] : "staff";
  if (!gridMode || !oriFolder || !letter || !turnsTuple || !motionType || !attributeKey || !propType) return null;
  return { gridMode, oriFolder, letter, turnsTuple, motionType, attributeKey, propType };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/arrow-adjustment/special-override-proptype.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(arrows): add mandatory propType to special override key" -- src/lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement.ts tests/unit/arrow-adjustment/special-override-proptype.test.ts
```

---

## Task 2: Thread `propType` through state, repository, persister, and zero-handling

**Files:**
- Modify: `special-override/state/SpecialArrowPlacementState.svelte.ts`, `…/services/special-arrow-placement-repository.ts`, `…/services/special-arrow-placement-persister.ts`
- Test: append to `tests/unit/arrow-adjustment/special-override-proptype.test.ts`

- [ ] **Step 1: Write failing tests** (append)

```ts
import { createSpecialArrowPlacementState } from "$lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte";

describe("special override state — prop isolation + zero handling", () => {
  const base = {
    gridMode: "box", oriFolder: "from_layer2", letter: "P", turnsTuple: "(0, 0)",
    motionType: "pro", attributeKey: "red", originalX: 0, originalY: 0,
    updatedAt: undefined as never, updatedBy: "me",
  };
  it("isolates fan from staff under distinct keys", () => {
    const s = createSpecialArrowPlacementState();
    s.setOverride({ ...base, key: "box|from_layer2|P|(0, 0)|pro|red|fan", propType: "fan", adjustmentX: 3, adjustmentY: 4 });
    expect(s.getOverride("box|from_layer2|P|(0, 0)|pro|red|fan")?.x).toBe(3);
    expect(s.getOverride("box|from_layer2|P|(0, 0)|pro|red|staff")).toBeNull();
  });
  it("treats a [0,0] override as absent", () => {
    const s = createSpecialArrowPlacementState();
    s.setOverride({ ...base, key: "box|from_layer2|P|(0, 0)|pro|red|staff", propType: "staff", adjustmentX: 0, adjustmentY: 0 });
    expect(s.getOverride("box|from_layer2|P|(0, 0)|pro|red|staff")).toBeNull();
    expect(s.hasOverride("box|from_layer2|P|(0, 0)|pro|red|staff")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/unit/arrow-adjustment/special-override-proptype.test.ts`
Expected: FAIL (zero override returns a Point; `propType` not on type).

- [ ] **Step 3: Implement**

- `SpecialArrowPlacementState.svelte.ts`: in `getOverride`, return null when both coords are 0; in `hasOverride`, return false when the stored entry is `[0,0]`:

```ts
getOverride(key: string): Point | null {
  const entry = overridesMap.get(key);
  if (!entry) return null;
  if (entry.adjustmentX === 0 && entry.adjustmentY === 0) return null; // zero = absent
  return new Point(entry.adjustmentX, entry.adjustmentY);
},
hasOverride(key: string): boolean {
  const entry = overridesMap.get(key);
  return !!entry && !(entry.adjustmentX === 0 && entry.adjustmentY === 0);
},
```

- `special-arrow-placement-repository.ts`: in `saveOverrideLocal`, include `propType: input.propType` in the `setOverride` object. In `saveOverride`, before calling `persister.save`, skip persistence when `input.adjustmentX === 0 && input.adjustmentY === 0` (delete instead so a nudge-back removes the doc):

```ts
async saveOverride(input: SpecialArrowPlacementInput): Promise<void> {
  const email = authState.user?.email;
  if (email !== ADMIN_EMAIL) throw new Error("Only admin can save special placement overrides");
  if (input.adjustmentX === 0 && input.adjustmentY === 0) {
    await this.deleteOverride(generateSpecialOverrideKey(input)); // zero = remove, never persist [0,0]
    return;
  }
  await this.persister.save(input, email);
}
```

- `special-arrow-placement-persister.ts`: add `propType: input.propType,` to the `firestoreSet` payload; in the `subscribe` mapper add `propType: data.propType ?? "staff",`.

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/unit/arrow-adjustment/special-override-proptype.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(arrows): prop-isolate special override state + drop zero overrides" -- src/lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte.ts src/lib/shared/pictograph/arrow/positioning/special-override/services/special-arrow-placement-repository.ts src/lib/shared/pictograph/arrow/positioning/special-override/services/special-arrow-placement-persister.ts tests/unit/arrow-adjustment/special-override-proptype.test.ts
```

---

## Task 3: Prop-aware special-override key at the render read (Global still wins)

**Files:**
- Modify: `calculation/services/arrow-adjustment-calculator.ts` (`lookupSpecialPlacement` ~line 578, `getDiagnostics` special block ~line 284)

The render's special-override lookup (`lookupSpecialPlacement`) and the diagnostics special probe both build `generateSpecialOverrideKey({...})` WITHOUT propType today. Add `propType: motionData.propType?.toLowerCase() || "staff"` to every `generateSpecialOverrideKey(...)` call site in this file. The `PipelineEditorDock` `specialOverrideKey` builder must get the same propType added (see Task 7).

**Invariant:** Global is still read first (`special-placer.ts` step-0 unchanged), so this changes nothing rendered yet — it only makes the special-override lookup prop-specific for when its data exists.

- [ ] **Step 1:** Grep every `generateSpecialOverrideKey(` call in `arrow-adjustment-calculator.ts` (lines ~315, ~353, ~602). Add `propType: motionData.propType?.toLowerCase() || "staff",` to each input object.
- [ ] **Step 2:** Run `npm run check:fast`; expect no new type errors (the key-gen signature now requires propType — these call sites satisfy it).
- [ ] **Step 3:** Manual smoke: existing special overrides (legacy 6-part docs) now look up under `…|staff`; legacy docs decode to staff via the schema default, so a staff pictograph still resolves them. Confirm in a `npx vitest run` of the existing special-override suite (no breakage).
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(arrows): thread propType into special-override render lookup" -- src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts
```

---

## Task 4: Variation enumerator — yield every (PictographData, arrowColor) the dataset renders

**Files:**
- Create: `src/lib/features/admin/override-migration/services/variation-enumerator.ts`
- Test: `tests/unit/arrow-adjustment/override-migration-parity.test.ts` (enumerator portion)

The migration replays real variations. The enumerator loads the same pictograph dataset the app renders from and yields each variation paired with each arrow color.

- [ ] **Step 1: Identify the dataset source.** Grep for where the app loads its full pictograph variation set (search terms: `DiamondPictographDataframe`, `loadPictographData`, `pictograph-dataframe`, `getAllPictographs`, the CSV walk used by the deck seeder `dd8ee2a5e`). Read the chosen loader. The enumerator wraps it.

- [ ] **Step 2: Write the enumerator**

```ts
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface VariationArrow {
  pictographData: PictographData;
  arrowColor: "blue" | "red";
}

/** Yields every (pictograph variation, arrow) pair the renderer can draw.
 *  Source: the same dataset the app's pictograph rendering loads. */
export async function enumerateVariationArrows(): Promise<VariationArrow[]> {
  const variations = await loadAllPictographVariations(); // from the loader found in Step 1
  const out: VariationArrow[] = [];
  for (const pictographData of variations) {
    if (pictographData.motions?.blue) out.push({ pictographData, arrowColor: "blue" });
    if (pictographData.motions?.red) out.push({ pictographData, arrowColor: "red" });
  }
  return out;
}
```

- [ ] **Step 3: Test** that the enumerator yields a non-trivial count and that a known letter (e.g. "P") appears with both colors. Assert `out.length > 1000` and that some entry has `letter === "P"`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(migration): pictograph variation enumerator for override replay" -- src/lib/features/admin/override-migration/services/variation-enumerator.ts tests/unit/arrow-adjustment/override-migration-parity.test.ts
```

---

## Task 5: Migration engine — replay, write Special, verify parity by construction

**Files:**
- Create: `src/lib/features/admin/override-migration/services/override-migration.ts`
- Test: `tests/unit/arrow-adjustment/override-migration-parity.test.ts`

The engine drives the EXISTING render code paths, so the keys it writes are exactly the keys the renderer reads — parity by construction. For each variation-arrow:

1. Compute `globalValue` = what `arrowAdjustmentCalculator.getBaseAdjustment(...)` returns NOW (Global enabled). Capture the **active tier** via `getDiagnostics`; only act when the active source is `global` (those are the records being migrated). (Special-JSON-static and Default sources need no migration — they already render from non-Global data.)
2. Compute the special-override key the renderer would use for this arrow: `generateSpecialOverrideKey({ gridMode, oriFolder, letter, turnsTuple, motionType, attributeKey, propType })`, deriving each field with the SAME generators the calculator uses (reuse `getDiagnostics`' resolved `specialJson.filePath` → `extractOriFolderFromPath`, `motionData.motionType`, `getKeyFromArrow`, `motionData.propType`).
3. Stage a write: special-override `key → globalValue` with `originalX/Y` from the static JSON baseline (so the trace shows the struck-through original).
4. **Parity check (per arrow):** temporarily compute the base with Global disabled + the staged Special applied; assert it equals `globalValue`. Collect pass/fail.

```ts
export interface MigrationRow {
  key: string; propType: string; letter: string; arrowColor: "blue" | "red";
  value: { x: number; y: number }; parity: "pass" | "fail"; note?: string;
}
export interface MigrationReport {
  total: number; staged: number; pass: number; fail: number; rows: MigrationRow[];
}

/** dryRun=true stages + verifies but writes nothing to Firestore. */
export async function runOverrideMigration(opts: { dryRun: boolean }): Promise<MigrationReport> { /* ... */ }
```

Implementation notes for the executor:
- Toggle Global on/off for the parity check WITHOUT mutating Firestore: add a module-level boolean `__globalReadDisabled` in `global-adjustment-singleton.ts` that `special-placer.ts` checks before its step-0 block (`if (!isGlobalReadDisabled() && globalAdjustmentRepo?.isInitialized)`). The migration flips it for the verify pass. This same flag becomes the permanent OFF in Task 9 (then deleted with the module).
- Apply staged Special via `getSpecialOverrideRepository().saveOverrideLocal(input)` (local cache, no Firestore) during dry-run verification.
- The Firestore write (non-dry-run) uses `saveOverride(input)` per staged row.
- Dedup: the same (letter, oriFolder, turnsTuple, motionType, attributeKey, propType) can be produced by multiple start-position variations; collapse to one write (assert all collapsed values are equal; if not, record a `fail` with note — that would mean Global itself was ambiguous, which it cannot be by key, so this is a guard).

- [ ] **Step 1: Write the parity test** against a small hand-built fixture set (3 records: one L1→staff, one L2-fan, one L2-bighoop). Seed a fake Global repo with those, run `runOverrideMigration({dryRun:true})`, assert `report.fail === 0` and that each row's `value` matches the seeded Global value and the key carries the right `propType`.
- [ ] **Step 2: Run, verify fail** (engine not implemented).
- [ ] **Step 3: Implement the engine.**
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(migration): parity-by-construction global→special override engine" -- src/lib/features/admin/override-migration/services/override-migration.ts src/lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton.ts tests/unit/arrow-adjustment/override-migration-parity.test.ts
```

---

## Task 6: Admin migration route (Dry-Run / Migrate / Verify UI)

**Files:**
- Create: `src/routes/test/override-migration/+page.svelte`

A dev route, admin-gated (reuse the existing admin check `authState.user?.email === "austencloud@gmail.com"`), with three buttons and a report table. No checkbox inputs (button + state per `no-checkboxes.md`). Uses the shared design tokens.

- [ ] **Step 1:** Build the page: "Dry Run" → `runOverrideMigration({dryRun:true})` → render the `MigrationReport` table (key, prop, letter, color, value, parity badge). Show `pass/fail/staged/total` counts. A red banner if any `fail > 0`.
- [ ] **Step 2:** "Migrate" button — **disabled unless the last dry-run had `fail === 0`** — calls `runOverrideMigration({dryRun:false})`.
- [ ] **Step 3:** "Verify Render" button — flips the Global-read-disabled flag on, forces `pictographPreparer.clearCache()` + `arrowAdjustmentVersion.increment()`, so the admin can eyeball live pictographs with Global OFF before committing to deletion; a second press flips it back.
- [ ] **Step 4:** Manual: load `http://localhost:5173/test/override-migration`, run Dry Run, confirm `total` reflects the dataset and the report lists ~120 staged rows with `fail: 0`.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(migration): admin override-migration dev route" -- src/routes/test/override-migration/+page.svelte
```

**CHECKPOINT (human):** Austen runs Dry Run, reviews the parity report (must be 0 failures), runs Migrate, then Verify Render and eyeballs tuned letters. Do not proceed to Task 9 until he confirms parity.

---

## Task 7: WASD screen-direction transform + Special-only edit target in the dock

**Files:**
- Modify: `pictograph-inspect/PipelineEditorDock.svelte`
- Test: `tests/unit/arrow-adjustment/wasd-screen-direction.test.ts`

- [ ] **Step 1: Write the failing test** for the transform wiring helper. Extract the delta transform into a tiny pure helper so it is unit-testable:

```ts
// tests assert: for a pro/CW box arrow at a quadrant whose forward tuple is Y-flip,
// a screen-down press (0,+5) becomes a reference delta that, after the forward tuple,
// renders as screen-down. Use the real screenSpaceAdjustmentTransformer + directional
// tuple processor (no mocks) to round-trip: forward(transformToReference((0,5))) == (0,5).
import { Point } from "fabric";
import { screenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/screen-space-adjustment-transformer";
import { directionalTupleProcessor } from "$lib/shared/pictograph/arrow/positioning/calculation/services/directional-tuple-processor";
// build a representative MotionData + location, assert round-trip identity for W/A/S/D.
```

Assert for all four keys and a CW + a CCW pro motion that `forward(toReference(delta)) === delta`.

- [ ] **Step 2: Run, verify fail** (no test exists yet / helper not wired).
- [ ] **Step 3: Implement in `PipelineEditorDock.svelte`:**

```ts
import { Point } from "fabric";
import { screenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/screen-space-adjustment-transformer";
import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-location-calculator";

const arrowLocation = $derived.by(() => {
  const c = activeColor; if (!c) return null;
  const motion = stepData.motions?.[c]; const pd = selectedArrowContext?.pictographData;
  if (!motion || !pd) return null;
  return arrowLocationCalculator.calculateLocation(motion, pd);
});
```

Replace the raw add in `handleWASDMovement` (lines 419-421):

```ts
const dir = directionMap[key]!;
const motion = stepData.motions?.[activeColor!];
if (motion && arrowLocation) {
  const refDelta = screenSpaceAdjustmentTransformer.transformToReference(new Point(dir.dx, dir.dy), motion, arrowLocation);
  editX += refDelta.x; editY += refDelta.y;
} else {
  editX += dir.dx; editY += dir.dy;
}
```

- Make Special the only edit target: set `let editTarget = $state(...)("special-json")`; change `defaultEditTargetForActiveTier()` to `return "special-json";`. Add `propType: thisPropType` to the `generateSpecialOverrideKey({...})` call in `specialOverrideKey` (line ~155 and ~177) and to `buildSpecialJsonInput`'s return (so writes are prop-keyed).
- The dock's `thisPropType` derived already exists — reuse it.

- [ ] **Step 4: Run, verify pass** + `npm run check:fast`.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(arrows): WASD screen-direction transform + special-json default in inspect dock" -- src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte tests/unit/arrow-adjustment/wasd-screen-direction.test.ts
```

---

## Task 8: Strip Global + Prop Geometry from the dock UI and trace

**Files:**
- Modify: `pictograph-inspect/PipelineEditorDock.svelte`, `pictograph-inspect/PipelineTraceSection.svelte`

- [ ] **Step 1:** In `PipelineEditorDock.svelte`: remove the tier `SegmentedControl` and `tierOptions` entries for `global`, `prop-geometry` (keep only special-json + default? — per spec, edit target is always Special, so remove the SegmentedControl entirely). Remove the Base/Prop/Combo `LayerTabBar` block (global-only). Remove the global + prop-geometry handlers/deriveds/imports (`handleGlobalNumericUpdate`, `handlePropGeometry*`, `propGeometryKey`, `propGeometryHasValue`, related imports). Header `dockTitleText` already reads `{colorName} · {thisPropType} · Special`.
- [ ] **Step 2:** In `PipelineTraceSection.svelte`: reduce the `tiers` array (lines 63-68) to `special-json` + `default` only. Remove `global`/`prop-geometry` cases from `tierLabel`/`tierColor` (or leave exhaustive but unused — keep the `PipelineTier` type intact since the diagnostics object still carries those fields until Task 9).
- [ ] **Step 3:** Run `npm run check:fast`; fix dangling references. Manual: open Inspect, confirm only Special + Default show and the bottom bar has no tier selector.
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(arrows): inspect dock shows only Special + Default tiers" -- src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte
```

---

## Task 9: Flip the render — remove Global read, drop Global + Prop-Geometry tiers from the cascade

**Files:**
- Modify: `placement/services/special-placer.ts`, `calculation/services/arrow-adjustment-calculator.ts`

**GATE:** Only run after the Task 6 checkpoint confirms parity. This is the step that changes rendered output (from Global-sourced to Special-sourced — which the migration made identical).

- [ ] **Step 1:** In `special-placer.ts`, delete the step-0 Global block (lines ~94-120) and the `getGlobalAdjustmentRepository` import (line 30). `getSpecialAdjustment` now goes straight to static JSON; the Firestore special-override (now prop-keyed) is consulted upstream in `lookupSpecialPlacement`.
- [ ] **Step 2:** In `arrow-adjustment-calculator.ts`: in `getBaseAdjustment`, remove the `lookupPropGeometryAdjustment` tier (lines ~517-524) so the cascade is special → default. In `getDiagnostics`, delete the Global probe (lines ~198-282) and Prop-Geometry probe (lines ~383-397); set `activeTier` selection to special-json → default only. Remove now-unused imports (`getGlobalAdjustmentRepository`, prop-geometry imports, `GlobalTierInfo`).
- [ ] **Step 3:** Run `npm run check` (full — cross-file). Fix all errors. Run `npx vitest run tests/unit/arrow-adjustment/`.
- [ ] **Step 4:** Manual parity: with the migration applied, open the same tuned letters (I, P, M, H, a fan, a bighoop) — arrows must be unchanged vs the pre-flip screenshots. WASD now moves the selected arrow in the pressed direction and edits only the current prop.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(arrows): special is authoritative — remove global + prop-geometry render tiers" -- src/lib/shared/pictograph/arrow/positioning/placement/services/special-placer.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts
```

---

## Task 10: Prop Geometry data audit + retire

**Files:**
- Modify: migration route (reuse) or a one-off audit in `override-migration.ts`

- [ ] **Step 1:** Query the prop-geometry Firestore collection (find its name in `prop-geometry/services/*-persister.ts`). Count records.
- [ ] **Step 2:** If empty → nothing to migrate. If non-empty → extend the migration engine to replay prop-geometry-sourced arrows the same way (active tier `prop-geometry`) into prop-keyed Special, with the same parity gate. (The Task 9 cascade already dropped the prop-geometry render tier, so any non-migrated prop-geometry data is already inert — migrate BEFORE Task 9 ships if records exist, else those tunings are lost. If records exist, this task moves earlier in execution order.)
- [ ] **Step 3:** Commit the audit result + any migration extension.

```bash
git commit -m "chore(arrows): audit + migrate prop-geometry overrides into special" -- <touched files>
```

---

## Task 11: Remove the Global module, rename the version counter, retire the old WASD path

**Files:**
- Delete: `src/lib/shared/pictograph/arrow/positioning/global/**` (after confirming no remaining importers)
- Rename: `global/state/global-adjustment-version.svelte.ts` export `globalAdjustmentVersion` → a new `src/lib/shared/pictograph/arrow/positioning/shared/arrow-adjustment-version.svelte.ts` exporting `arrowAdjustmentVersion`
- Modify: all importers (`PictographContainer.svelte`, special-override repo, etc.), `auth-boot-orchestrator.ts`, `ArrowAdjustmentPanel.svelte`/`ArrowAdjustmentHistory.svelte`/`arrow-adjustment/ArrowLayerModal.svelte`, `arrow-adjustment-orchestrator.ts`, `firestore.rules`

- [ ] **Step 1:** Move the version counter out of `global/` into a neutral location and rename to `arrowAdjustmentVersion`. Update every importer (grep `globalAdjustmentVersion`).
- [ ] **Step 2:** Determine if `ArrowAdjustmentPanel`/`StepEditorPanel`/`SkewLabEditorPanel` WASD path is still mounted (grep route usage). If dead → delete `arrow-adjustment-orchestrator.ts` global branch + those panels' global wiring. If live → repoint `applyWASDMovement` to the special-override repo with the screen-space transform (same as Task 7).
- [ ] **Step 3:** Delete `global/**`, remove its init from `auth-boot-orchestrator.ts`, delete `tests/unit/arrow-adjustment/GlobalArrowAdjustment.test.ts`, remove the `global_arrow_adjustments` block from `firestore.rules`.
- [ ] **Step 4:** Run full `npm run check` + `npx vitest run`. Fix all.
- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(arrows): delete global override tier; rename version counter to arrowAdjustmentVersion" -- <touched files>
```

---

## Task 12: Strip temp diagnostics + final verification

**Files:**
- Modify: `calculation/services/arrow-adjustment-calculator.ts` (remove `[ARROW-ADJ]` block ~line 145-159), `calculation/services/directional-tuple-processor.ts` (remove `[TUPLE]` block)

- [ ] **Step 1:** Delete both `__DBG_ARROW`-gated console blocks.
- [ ] **Step 2:** Full `npm run check` + `npm run build` + `npx vitest run`. All green.
- [ ] **Step 3:** Final manual: Inspect dock shows Special + Default only; WASD moves arrows in pressed direction; editing a prop's arrow leaves other props untouched; the 6 verification letters render identically to pre-migration.
- [ ] **Step 4:** After Austen confirms in-app, optionally delete the `global_arrow_adjustments` Firestore collection (separate explicit action — not automated).
- [ ] **Step 5: Commit**

```bash
git commit -m "chore(arrows): remove temporary positioning diagnostics" -- src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/directional-tuple-processor.ts
```

---

## Self-Review Notes

- **Spec coverage:** propType key (T1), prop-isolated state + zero-drop (T2), prop-aware read (T3), migration enumerate+replay+parity (T4-6), WASD transform + Special-default (T7), UI declutter (T8), render flip removing Global+PropGeo (T9), prop-geometry audit (T10), module deletion + version rename (T11), diagnostics cleanup + verify (T12). All spec sections mapped.
- **Ordering caveat:** Task 10 (prop-geometry audit) must execute BEFORE Task 9 if the prop-geometry collection is non-empty, since Task 9 drops the prop-geometry render tier. The executor checks T10 Step 1's count first; if >0, reorder T10 before T9.
- **Parity is the gate:** no Firestore deletion anywhere in T1-T11; Global data persists until Austen's explicit final action in T12 Step 4.
- **Type consistency:** `generateSpecialOverrideKey` requires `propType` everywhere after T1; all call sites updated in T3 and T7. `arrowAdjustmentVersion` replaces `globalAdjustmentVersion` only in T11 (single rename pass).
