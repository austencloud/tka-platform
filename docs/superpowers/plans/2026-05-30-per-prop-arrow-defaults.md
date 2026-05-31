# Per-Prop Arrow Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Default arrow-placement tier prop-aware — each prop owns an isolated dataset seeded from staff, tuned in-panel via Firestore, with staff as last-resort for unseeded props.

**Architecture:** Add a `propType` dimension to the Default tier only (key, static loader, Firestore doc-id, resolver, call chain, dock UX). Per-prop static seed JSON lives in `<prop>/` subfolders generated once from staff. Runtime resolution: `P Firestore override → P static JSON → (last-resort) staff static JSON`. Full isolation: no runtime staff cascade for seeded props. Other tiers (Global, Special JSON, Prop Geometry) unchanged.

**Tech Stack:** TypeScript, Svelte 5 runes, Firestore, Vitest. Node ESM script for seeding.

**Spec:** `docs/superpowers/specs/2026-05-30-per-prop-arrow-defaults-design.md`

**Commit discipline:** Each commit uses an explicit pathspec (`git commit -- <paths>`). The shared index may hold other agents' work — never a bare `git commit`.

**Test command (single file):**
`npx vitest run --config tests/config/vitest.config.ts <test-path>`
**Full suite:** `npm run test:ci`
**Typecheck (commit gate only):** `npm run check`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `scripts/seed-prop-default-placements.mjs` | Copy staff JSON → `<prop>/` seed files | Create |
| `static/data/arrow_placement/<grid>/default/<prop>/*.json` | Per-prop seed datasets | Generated |
| `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts` | Per-prop static load + prop-aware default lookup + resolver type | Modify |
| `src/lib/shared/pictograph/arrow/positioning/placement/services/default-placer.ts` | Forward `propType` to ArrowPlacer | Modify |
| `src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts` | Prop-aware doc-id + legacy decode | Modify |
| `.../default-override/state/DefaultArrowPlacementState.svelte.ts` | Prop-keyed state map | Modify |
| `.../default-override/services/default-arrow-placement-repository.ts` | Prop-aware get/has/save/delete | Modify |
| `.../default-override/services/default-arrow-placement-persister.ts` | Prop-aware doc id + legacy subscribe decode | Modify |
| `.../default-override/services/default-override-singleton.ts` | Resolver passes `propType` | Modify |
| `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts` | Derive + thread `propType`; diagnostics carry it | Modify |
| `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts` | `DefaultTierInfo.propType` | Modify |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte` | Prop-scoped Default tier + dock-head prop segment | Modify |
| `tests/unit/arrow-adjustment/*.test.ts` | Per-prop coverage | Create/extend |

---

## Task 1: Seed script + per-prop static datasets

**Files:**
- Create: `scripts/seed-prop-default-placements.mjs`
- Generated: `static/data/arrow_placement/{diamond,box}/default/<prop>/default_<grid>_<motion>_placements.json`

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-prop-default-placements.mjs`:

```js
// Seeds per-prop default arrow-placement datasets by copying the staff (root)
// JSON into <prop>/ subfolders. Idempotent: never clobbers a file that has
// already diverged from the staff source (i.e. been hand-tuned).
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRIDS = ["diamond", "box"];
const MOTIONS = ["pro", "anti", "float", "dash", "static"];

// Geometrically-distinct props that warrant their own dataset. Staff stays at
// root (it IS the seed source). Unlisted props fall back to staff at runtime.
// To add a prop: append its lowercased PropType value here and re-run.
const SEED_PROPS = [
  "fan", "bigfan", "club", "bigclub", "triad", "bigtriad",
  "minihoop", "bighoop", "buugeng", "bigbuugeng",
  "doublestar", "bigdoublestar", "eightrings", "bigeightrings",
];

const baseDir = (grid) => join(ROOT, "static/data/arrow_placement", grid, "default");
const staffPath = (grid, motion) => join(baseDir(grid), `default_${grid}_${motion}_placements.json`);
const propPath = (grid, prop, motion) => join(baseDir(grid), prop, `default_${grid}_${motion}_placements.json`);

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

let written = 0, skipped = 0;
for (const grid of GRIDS) {
  for (const motion of MOTIONS) {
    const staff = await readFile(staffPath(grid, motion), "utf8");
    for (const prop of SEED_PROPS) {
      const target = propPath(grid, prop, motion);
      if (await exists(target)) {
        const current = await readFile(target, "utf8");
        if (current !== staff) { skipped++; continue; } // diverged = hand-tuned, leave it
      }
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, staff);
      written++;
    }
  }
}
console.log(`seed-prop-defaults: wrote ${written}, skipped (tuned) ${skipped}`);
```

- [ ] **Step 2: Run the seed script**

Run: `node scripts/seed-prop-default-placements.mjs`
Expected: `seed-prop-defaults: wrote 140, skipped (tuned) 0` (14 props × 2 grids × 5 motions).

- [ ] **Step 3: Verify a seed file is byte-identical to its staff source**

Run: `node -e "const a=require('fs').readFileSync('static/data/arrow_placement/diamond/default/default_diamond_pro_placements.json','utf8');const b=require('fs').readFileSync('static/data/arrow_placement/diamond/default/fan/default_diamond_pro_placements.json','utf8');console.log(a===b?'IDENTICAL':'DIFFER')"`
Expected: `IDENTICAL`

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-prop-default-placements.mjs "static/data/arrow_placement/diamond/default" "static/data/arrow_placement/box/default"
git commit -m "feat(arrow-defaults): seed per-prop default placement datasets from staff" -- scripts/seed-prop-default-placements.mjs static/data/arrow_placement/diamond/default static/data/arrow_placement/box/default
```

---

## Task 2: Prop-aware static loader in ArrowPlacer

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts`
- Test: `tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { ArrowPlacer, setDefaultOverrideResolver } from "$lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Cache returns a different value for the fan/ subfolder than for the staff root.
const fakeCache = {
  async get(path: string) {
    if (path.includes("/fan/") && path.includes("pro")) {
      return { pro_to_layer1_alpha: { "0": [10, 20] } };
    }
    if (path.includes("default_diamond_pro")) {
      return { pro_to_layer1_alpha: { "0": [1, 2] } };
    }
    return {};
  },
} as unknown as import("$lib/shared/pictograph/shared/services/simple-json-cache").SimpleJsonCache;

afterEach(() => setDefaultOverrideResolver(null));

describe("per-prop static default load", () => {
  it("reads the prop's own subfolder dataset when seeded", async () => {
    const placer = new ArrowPlacer(fakeCache);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType, "pro_to_layer1_alpha", "0", GridMode.DIAMOND, "fan",
    );
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it("falls back to staff root for an unseeded prop", async () => {
    const placer = new ArrowPlacer(fakeCache);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType, "pro_to_layer1_alpha", "0", GridMode.DIAMOND, "sword",
    );
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it("staff prop reads the root dataset (back-compat)", async () => {
    const placer = new ArrowPlacer(fakeCache);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType, "pro_to_layer1_alpha", "0", GridMode.DIAMOND, "staff",
    );
    expect(result).toEqual({ x: 1, y: 2 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts`
Expected: FAIL — `getDefaultAdjustment` ignores the 5th arg; fan returns `{x:1,y:2}` not `{x:10,y:20}`.

- [ ] **Step 3: Restructure storage + file resolution in `arrow-placer.ts`**

Replace the `allPlacements`/`loadedGridModes`/`placementFiles` declarations (lines ~40-70) with a prop-aware structure. The seeded props list mirrors the seed script.

```ts
  // [gridMode][propType][motionType][placementKey][turns] = [x, y]
  private allPlacements: Record<string, Record<string, GridPlacementData>> = {};

  // Lazily-loaded (gridMode, propType) buckets, e.g. "diamond:fan".
  private loadedKeys = new Set<string>();

  // Props with their own seeded subfolder. Anything else resolves to staff root.
  private static readonly SEEDED_PROPS = new Set([
    "fan", "bigfan", "club", "bigclub", "triad", "bigtriad",
    "minihoop", "bighoop", "buugeng", "bigbuugeng",
    "doublestar", "bigdoublestar", "eightrings", "bigeightrings",
  ]);

  private readonly motionTypes = ["pro", "anti", "float", "dash", "static"] as const;

  /** Resolve the 5 motion-type file paths for a (gridMode, propType). Seeded
   *  props read their <prop>/ subfolder; staff and unseeded props read root. */
  private filesFor(gridMode: string, propType: string): Record<string, string> {
    const seeded = ArrowPlacer.SEEDED_PROPS.has(propType);
    const sub = seeded ? `${propType}/` : "";
    const files: Record<string, string> = {};
    for (const mt of this.motionTypes) {
      files[mt] = `/data/arrow_placement/${gridMode}/default/${sub}default_${gridMode}_${mt}_placements.json`;
    }
    return files;
  }
```

Replace `ensureGridModeLoaded`/`loadGridPlacements`/`ensureDataLoaded` with prop-aware variants. SKEWED still loads both diamond + box for the same prop.

```ts
  async ensureLoaded(gridMode: GridMode, propType: string): Promise<void> {
    if (gridMode === GridMode.SKEWED) {
      await this.ensureLoaded(GridMode.DIAMOND, propType);
      await this.ensureLoaded(GridMode.BOX, propType);
      return;
    }
    const key = `${gridMode}:${propType}`;
    if (this.loadedKeys.has(key)) return;
    await this.loadPlacements(gridMode, propType);
    this.loadedKeys.add(key);
  }

  private async loadPlacements(gridMode: GridMode, propType: string): Promise<void> {
    const files = this.filesFor(gridMode, propType);
    this.allPlacements[gridMode] ??= {};
    const byMotion: GridPlacementData = {};
    for (const [motionType, filePath] of Object.entries(files)) {
      try {
        const raw = await this.loadJsonFile(filePath);
        const filtered: GridPlacementData[string] = {};
        for (const [placementKey, turnsData] of Object.entries(raw ?? {})) {
          filtered[placementKey] = {};
          for (const [turns, coords] of Object.entries(turnsData ?? {})) {
            if (Array.isArray(coords) && coords.length === 2 &&
                typeof coords[0] === "number" && typeof coords[1] === "number") {
              filtered[placementKey][turns] = coords as [number, number];
            }
          }
        }
        byMotion[motionType] = filtered;
      } catch (error) {
        console.warn(`Could not load ${motionType} placements for ${gridMode}/${propType}: ${error}`);
        byMotion[motionType] = {};
      }
    }
    this.allPlacements[gridMode][propType] = byMotion;
  }
```

Update `getDefaultAdjustment` (add `propType`, default `"staff"`; route resolver + lookup through prop):

```ts
  async getDefaultAdjustment(
    motionType: MotionType,
    placementKey: string,
    turns: number | string,
    gridMode: GridMode = GridMode.DIAMOND,
    propType: string = "staff",
  ): Promise<{ x: number; y: number }> {
    await this.ensureLoaded(gridMode, propType);
    const turnsStr = this.formatTurnsForLookup(turns);

    const override = defaultOverrideResolver
      ? defaultOverrideResolver(
          gridMode as unknown as string,
          motionType as unknown as string,
          placementKey,
          turnsStr,
          propType,
        )
      : null;
    if (override) return { x: override[0], y: override[1] };

    const adjustment =
      this.allPlacements[gridMode]?.[propType]?.[motionType]?.[placementKey]?.[turnsStr];
    if (!adjustment) return { x: 0, y: 0 };
    return { x: adjustment[0], y: adjustment[1] };
  }
```

Update the remaining callers of `ensureGridModeLoaded`/`ensureDataLoaded` inside this file (`getAvailablePlacementKeys`, `getPlacementData`, `isLoaded`) to read `this.allPlacements[gridMode]?.["staff"]?.[motionType]` — these debug/keys helpers operate on the staff dataset.

Keep a back-compat alias so the four `ensureGridModeLoaded(gridMode)` callers in `default-placer.ts` (lines 102/137/157 + the one updated in Task 6) keep compiling without churn:

```ts
  /** Back-compat: staff-scoped load. Prefer ensureLoaded(gridMode, propType). */
  async ensureGridModeLoaded(gridMode: GridMode): Promise<void> {
    await this.ensureLoaded(gridMode, "staff");
  }
```

Confirmed scope (grep): the ONLY external caller of `ensureGridModeLoaded` is `default-placer.ts`; the `ensureDataLoaded` functions in `src/routes/api/tika/*/+server.ts` are unrelated local functions, not ArrowPlacer methods — leave them alone.

Update the `DefaultOverrideResolver` type (lines ~25-30) to carry propType:

```ts
export type DefaultOverrideResolver = (
  gridMode: string,
  motionType: string,
  placementKey: string,
  turns: string,
  propType: string,
) => [number, number] | null;
```

Remove the obsolete `__DBG_DEFAULT` temp diagnostic block while here (it referenced the old single-map shape).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Update the existing precedence test for the new resolver arity**

In `tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts`, the resolver callback gains a 5th param. Update the "prefers the resolver value" case:

```ts
    setDefaultOverrideResolver((grid, motion, key, turns, prop) =>
      grid === "box" && motion === "pro" && key === "pro_to_layer1_alpha" && turns === "1.5" && prop === "staff"
        ? [7, 9]
        : null,
    );
```

The three existing `placer.getDefaultAdjustment("pro", "pro_to_layer1_alpha", "1.5", GridMode.BOX)` calls stay valid (propType defaults to `"staff"`, and the fakeCache path `box`+`pro` has no `/<prop>/`, so it loads as the staff root). Confirm by running:

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts`
Expected: PASS (3/3) — staff path unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts
git commit -m "feat(arrow-defaults): prop-aware static loader + resolver arity in ArrowPlacer" -- src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts
```

---

## Task 3: Prop-aware Firestore doc-id (domain)

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts`
- Test: `tests/unit/arrow-adjustment/DefaultDocId.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/arrow-adjustment/DefaultDocId.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateDefaultDocId, parseDefaultDocId } from "$lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement";

describe("default doc id (prop-aware)", () => {
  it("encodes gridMode_propType_motionType", () => {
    expect(generateDefaultDocId("diamond", "fan", "pro")).toBe("diamond_fan_pro");
  });

  it("round-trips a 3-part id", () => {
    expect(parseDefaultDocId("diamond_fan_pro")).toEqual({
      gridMode: "diamond", propType: "fan", motionType: "pro",
    });
  });

  it("decodes a legacy 2-part id as staff", () => {
    expect(parseDefaultDocId("diamond_pro")).toEqual({
      gridMode: "diamond", propType: "staff", motionType: "pro",
    });
  });

  it("rejects malformed ids", () => {
    expect(parseDefaultDocId("diamond")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultDocId.test.ts`
Expected: FAIL — `generateDefaultDocId` takes 2 args; `diamond_fan_pro` ≠ current output.

- [ ] **Step 3: Update doc-id functions**

Replace `generateDefaultDocId` and `parseDefaultDocId` in `DefaultArrowPlacement.ts`:

```ts
/** Doc id mirrors the static file with a prop segment: "{gridMode}_{propType}_{motionType}". */
export function generateDefaultDocId(gridMode: string, propType: string, motionType: string): string {
  return `${gridMode}_${propType}_${motionType}`;
}

export function parseDefaultDocId(
  docId: string,
): { gridMode: string; propType: string; motionType: string } | null {
  const parts = docId.split("_");
  // Legacy 2-part ids ("{gridMode}_{motionType}") predate the prop dimension → staff.
  if (parts.length === 2) {
    const [gridMode, motionType] = parts;
    if (!gridMode || !motionType) return null;
    return { gridMode, propType: "staff", motionType };
  }
  if (parts.length === 3) {
    const [gridMode, propType, motionType] = parts;
    if (!gridMode || !propType || !motionType) return null;
    return { gridMode, propType, motionType };
  }
  return null;
}
```

Also update the `DefaultArrowPlacementDoc` interface: add `readonly propType: string;` after `gridMode`, and update the `id` comment to `"{gridMode}_{propType}_{motionType}"`. Add `propType: z.string().default("staff")` to `DefaultArrowPlacementDocSchema` (legacy docs lack the field → default staff). Update `flattenPlacements` to accept and pass `propType`.

```ts
export interface DefaultArrowPlacementDoc {
  readonly id: string; // "{gridMode}_{propType}_{motionType}"
  readonly gridMode: string;
  readonly propType: string;
  readonly motionType: string;
  readonly placements: PlacementsMap;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}
```

```ts
export const DefaultArrowPlacementDocSchema = z
  .object({
    id: z.string(),
    gridMode: z.string(),
    propType: z.string().default("staff"),
    motionType: z.string(),
    placements: z.record(z.string(), z.record(z.string(), PlacementValueSchema)),
    updatedAt: firestoreDate.optional(),
    updatedBy: z.string(),
  })
  .passthrough();
```

```ts
export function flattenPlacements(
  gridMode: string,
  propType: string,
  motionType: string,
  placements: PlacementsMap,
  updatedBy: string,
): { gridMode: string; propType: string; motionType: string; placements: PlacementsMap; updatedBy: string } {
  return { gridMode, propType, motionType, placements, updatedBy };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultDocId.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts tests/unit/arrow-adjustment/DefaultDocId.test.ts
git commit -m "feat(arrow-defaults): prop-aware default doc-id with legacy staff decode" -- src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts tests/unit/arrow-adjustment/DefaultDocId.test.ts
```

---

## Task 4: Prop-aware state map

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts`
- Test: `tests/unit/arrow-adjustment/DefaultStatePerProp.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/arrow-adjustment/DefaultStatePerProp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createDefaultArrowPlacementState } from "$lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte";

describe("default state per-prop isolation", () => {
  it("stores and reads a value under its propType", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    expect(s.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toEqual([3, 4]);
  });

  it("does not bleed a fan value into staff", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    expect(s.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
  });

  it("removeValue clears only the targeted prop", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    s.setValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0", [9, 9], "me");
    s.removeValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0");
    expect(s.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
    expect(s.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toEqual([9, 9]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultStatePerProp.test.ts`
Expected: FAIL — `setValue`/`getValue` take no `propType`.

- [ ] **Step 3: Thread `propType` through the state**

In `DefaultArrowPlacementState.svelte.ts`, add `propType` as the 2nd argument to `getMap`, `getValue`, `setValue`, `removeValue`, passing it into `generateDefaultDocId(gridMode, propType, motionType)` and storing it on the doc. Full updated methods:

```ts
    getMap(gridMode: string, propType: string, motionType: string): PlacementsMap | null {
      return docsMap.get(generateDefaultDocId(gridMode, propType, motionType))?.placements ?? null;
    },

    getValue(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string): PlacementValue | null {
      const map = this.getMap(gridMode, propType, motionType);
      if (!map) return null;
      return unflattenValue(map, placementKey, turns);
    },

    setValue(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string, value: PlacementValue, updatedBy: string): void {
      const id = generateDefaultDocId(gridMode, propType, motionType);
      const existing = docsMap.get(id);
      const placements: PlacementsMap = existing ? structuredCloneMap(existing.placements) : {};
      placements[placementKey] = { ...(placements[placementKey] ?? {}), [turns]: value };
      const fakeTimestamp = {
        seconds: Math.floor(Date.now() / 1000), nanoseconds: 0,
        toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => false,
      } as unknown as DefaultArrowPlacementDoc["updatedAt"];
      const newMap = new Map(docsMap);
      newMap.set(id, { id, gridMode, propType, motionType, placements, updatedAt: existing?.updatedAt ?? fakeTimestamp, updatedBy });
      docsMap = newMap;
    },

    removeValue(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string): void {
      const id = generateDefaultDocId(gridMode, propType, motionType);
      const existing = docsMap.get(id);
      if (!existing) return;
      const placements = structuredCloneMap(existing.placements);
      if (placements[placementKey]) {
        delete placements[placementKey][turns];
        if (Object.keys(placements[placementKey]).length === 0) delete placements[placementKey];
      }
      const newMap = new Map(docsMap);
      newMap.set(id, { ...existing, placements });
      docsMap = newMap;
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultStatePerProp.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts tests/unit/arrow-adjustment/DefaultStatePerProp.test.ts
git commit -m "feat(arrow-defaults): prop-keyed default placement state" -- src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts tests/unit/arrow-adjustment/DefaultStatePerProp.test.ts
```

---

## Task 5: Prop-aware repository + persister + singleton resolver

**Files:**
- Modify: `.../default-override/services/default-arrow-placement-repository.ts`
- Modify: `.../default-override/services/default-arrow-placement-persister.ts`
- Modify: `.../default-override/services/default-override-singleton.ts`
- Test: `tests/unit/arrow-adjustment/DefaultRepoPerProp.test.ts` (create)

- [ ] **Step 1: Write the failing test** (repo read/local-write path, no Firestore)

Create `tests/unit/arrow-adjustment/DefaultRepoPerProp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DefaultArrowPlacementRepository } from "$lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository";

// Persister is unused on the read/local path; a no-op double satisfies the ctor.
const noopPersister = {
  loadAll: async () => [],
  saveValue: async () => {},
  deleteValue: async () => {},
  subscribe: () => () => {},
} as unknown as import("$lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister").DefaultArrowPlacementPersister;

describe("default repo per-prop", () => {
  it("local save + getValue round-trip under a prop", () => {
    const repo = new DefaultArrowPlacementRepository(noopPersister);
    repo.saveDefaultLocal("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [5, 6]);
    expect(repo.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toEqual([5, 6]);
    expect(repo.hasValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toBe(true);
    expect(repo.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultRepoPerProp.test.ts`
Expected: FAIL — repo methods take no `propType`.

- [ ] **Step 3: Thread `propType` through the repository**

In `default-arrow-placement-repository.ts`, add `propType` as the 2nd arg to `getValue`, `hasValue`, `saveDefaultLocal`, `deleteDefaultLocal`, `saveDefault`, `deleteDefault`, forwarding to the state and persister. Example signatures (apply to all six):

```ts
  getValue(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string): PlacementValue | null {
    return this.state.getValue(gridMode, propType, motionType, placementKey, turns);
  }

  hasValue(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string): boolean {
    return this.state.getValue(gridMode, propType, motionType, placementKey, turns) !== null;
  }

  saveDefaultLocal(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string, value: PlacementValue): void {
    this.state.setValue(gridMode, propType, motionType, placementKey, turns, value, authState.user?.email ?? "unknown");
  }

  deleteDefaultLocal(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string): void {
    this.state.removeValue(gridMode, propType, motionType, placementKey, turns);
  }

  async saveDefault(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string, value: PlacementValue): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) throw new Error("Only admin can save default placement overrides");
    await this.persister.saveValue(gridMode, propType, motionType, placementKey, turns, value, email);
  }

  async deleteDefault(gridMode: string, propType: string, motionType: string, placementKey: string, turns: string): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) throw new Error("Only admin can delete default placement overrides");
    await this.persister.deleteValue(gridMode, propType, motionType, placementKey, turns);
    this.state.removeValue(gridMode, propType, motionType, placementKey, turns);
  }
```

- [ ] **Step 4: Thread `propType` through the persister**

In `default-arrow-placement-persister.ts`:
- `saveValue(gridMode, propType, motionType, placementKey, turns, value, userEmail)`: `const id = generateDefaultDocId(gridMode, propType, motionType);` and include `propType` in the merged doc body (`{ gridMode, propType, motionType, placements: {...}, updatedBy }`).
- `deleteValue(gridMode, propType, motionType, placementKey, turns)`: `const id = generateDefaultDocId(gridMode, propType, motionType);`.
- `subscribe`: decode the prop from the doc id so legacy docs map to staff. Replace the onChange body:

```ts
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") return;
              const data = change.doc.data();
              const decoded = parseDefaultDocId(change.doc.id);
              if (decoded && data.placements) {
                onChange({
                  id: change.doc.id,
                  gridMode: data.gridMode ?? decoded.gridMode,
                  propType: data.propType ?? decoded.propType,
                  motionType: data.motionType ?? decoded.motionType,
                  placements: data.placements,
                  updatedAt: data.updatedAt,
                  updatedBy: data.updatedBy ?? "unknown",
                });
              }
            });
```

Add `parseDefaultDocId` to the existing import from `../domain/DefaultArrowPlacement`.

- [ ] **Step 5: Thread `propType` through the singleton resolver**

In `default-override-singleton.ts`, the resolver now receives `propType` last and forwards it to the repo (note the repo's prop-after-gridMode arg order):

```ts
    setDefaultOverrideResolver((gridMode, motionType, placementKey, turns, propType) =>
      repository.getValue(gridMode, propType, motionType, placementKey, turns),
    );
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultRepoPerProp.test.ts`
Expected: PASS (1/1).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts tests/unit/arrow-adjustment/DefaultRepoPerProp.test.ts
git commit -m "feat(arrow-defaults): prop-aware default-override repo, persister, resolver" -- src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts tests/unit/arrow-adjustment/DefaultRepoPerProp.test.ts
```

---

## Task 6: Calculator threading + diagnostics propType

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/placement/services/default-placer.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts`
- Test: `tests/unit/arrow-adjustment/DefaultIdentityPropType.test.ts` (create)

- [ ] **Step 1: Add `propType` to `DefaultPlacer` + interface**

In `default-placer.ts`, add `propType: string` (default `"staff"`) as the 5th param of `getDefaultAdjustment` on both `IDefaultPlacerJson` and `DefaultPlacer`, forwarding to `this.placementDataService.getDefaultAdjustment(motionType, placementKey, turns, gridMode, propType)`:

```ts
  async getDefaultAdjustment(
    placementKey: string,
    turns: number | string,
    motionType: MotionType,
    gridMode: GridMode,
    propType: string = "staff",
  ): Promise<{ x: number; y: number }> {
    try {
      await this.placementDataService.ensureLoaded(gridMode, propType);
      return await this.placementDataService.getDefaultAdjustment(motionType, placementKey, turns, gridMode, propType);
    } catch (error) {
      console.warn(`Failed to get default adjustment for ${placementKey} at ${turns} turns:`, error);
      return { x: 0, y: 0 };
    }
  }
```

(Also update the `IDefaultPlacerJson.getDefaultAdjustment` signature to include `propType: string`. The old `ensureGridModeLoaded` call is replaced by `ensureLoaded(gridMode, propType)`.)

- [ ] **Step 2: Add `propType` to `DefaultTierInfo`**

In `PipelineDiagnostics.ts`, add to `DefaultTierInfo`:

```ts
export interface DefaultTierInfo {
  value: TierValue;
  /** Lookup identity so the editor can address the Firestore default field. */
  gridMode: string;
  propType: string;
  motionType: string;
  placementKey: string;
  turns: string;
}
```

- [ ] **Step 3: Write the failing test** (identity carries propType)

Create `tests/unit/arrow-adjustment/DefaultIdentityPropType.test.ts`. The identity resolver is private; assert through the public diagnostics. Mirror the fixture style used by sibling calculator tests in `tests/unit/arrow-adjustment/` (use an existing pictograph/motion fixture from a neighboring test file as the template for `motionData`/`pictographData`). The assertion:

```ts
// Build a staff motion (propType "staff") and a fan motion (propType "fan")
// from the shared fixture, run getDiagnostics, assert diagnostics.default.propType.
expect(staffDiag.default?.propType).toBe("staff");
expect(fanDiag.default?.propType).toBe("fan");
```

(If the calculator's diagnostics entry point requires more wiring than a unit fixture supports, assert at the `resolveDefaultLookupIdentity` seam by temporarily exporting a thin `__test` helper — but prefer the public `getDiagnostics` path using the neighboring fixture.)

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultIdentityPropType.test.ts`
Expected: FAIL — `diagnostics.default.propType` is `undefined`.

- [ ] **Step 5: Thread propType in the calculator**

In `arrow-adjustment-calculator.ts`:

`resolveDefaultLookupIdentity` (returns at ~701-706) — add `propType`:

```ts
    return {
      gridMode,
      motionType: motionData.motionType as MotionType,
      placementKey,
      turns,
      propType: motionData.propType?.toLowerCase() || "staff",
    };
```

(Update its return-type annotation at ~665 to include `propType: string`.)

`calculateDefaultAdjustment` (~709-732) — derive identity once and pass propType down:

```ts
  private async calculateDefaultAdjustment(
    motionData: MotionData,
    pictographData: PictographData,
  ): Promise<Point> {
    try {
      const { gridMode, motionType, placementKey, turns, propType } =
        await this.resolveDefaultLookupIdentity(motionData, pictographData);
      const adjustmentPoint = await this.DefaultPlacer.getDefaultAdjustment(
        placementKey, turns, motionType, gridMode, propType,
      );
      return new Point(adjustmentPoint.x, adjustmentPoint.y);
    } catch (error) {
      console.error("Error calculating default adjustment:", error);
      throw new Error(`Default adjustment calculation failed: ${error}`);
    }
  }
```

Diagnostics default block (~393-399) — set propType from identity:

```ts
      diagnostics.default = {
        value: { x: defaultResult.x, y: defaultResult.y },
        gridMode: identity.gridMode as unknown as string,
        propType: identity.propType,
        motionType: identity.motionType as unknown as string,
        placementKey: identity.placementKey,
        turns: identity.turns,
      };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/DefaultIdentityPropType.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/placement/services/default-placer.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts tests/unit/arrow-adjustment/DefaultIdentityPropType.test.ts
git commit -m "feat(arrow-defaults): thread propType through calculator + diagnostics" -- src/lib/shared/pictograph/arrow/positioning/placement/services/default-placer.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts tests/unit/arrow-adjustment/DefaultIdentityPropType.test.ts
```

---

## Task 7: Inspect dock — prop-scoped Default tier + dock-head segment

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte`

- [ ] **Step 1: Carry `propType` in the Default lookup**

`defaultLookup` (~209-224) is built from `diagnostics.default`, which now has `propType`. Extend the returned object and its type:

```ts
  const defaultLookup = $derived.by((): {
    gridMode: string;
    propType: string;
    motionType: string;
    placementKey: string;
    turns: string;
  } | null => {
    if (!diagnostics?.default) return null;
    const d = diagnostics.default;
    if (!d.gridMode || !d.motionType || !d.placementKey) return null;
    return { gridMode: d.gridMode, propType: d.propType, motionType: d.motionType, placementKey: d.placementKey, turns: d.turns };
  });
```

- [ ] **Step 2: Pass `propType` to every default repo call**

Update `defaultHasValue` and the three handlers to pass `lk.propType` as the 2nd arg, matching the repo signature `(gridMode, propType, motionType, placementKey, turns[, value])`:

```ts
  const defaultHasValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    const lk = defaultLookup;
    if (!lk) return false;
    return getDefaultOverrideRepository()?.hasValue(lk.gridMode, lk.propType, lk.motionType, lk.placementKey, lk.turns) ?? false;
  });
```

```ts
  function handleDefaultNumericUpdate() {
    const repo = getDefaultOverrideRepository();
    const lk = defaultLookup;
    if (!repo || !lk) return;
    repo.saveDefaultLocal(lk.gridMode, lk.propType, lk.motionType, lk.placementKey, lk.turns, [editX, editY]);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  async function handleDefaultSave() {
    const repo = getDefaultOverrideRepository();
    const lk = defaultLookup;
    if (!repo || !lk) return;
    try {
      saveState = "saving";
      await repo.saveDefault(lk.gridMode, lk.propType, lk.motionType, lk.placementKey, lk.turns, [editX, editY]);
      saveState = "saved";
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Default save failed:", error);
      saveState = "idle";
    }
  }

  async function handleDefaultDelete() {
    const repo = getDefaultOverrideRepository();
    const lk = defaultLookup;
    if (!repo || !lk) return;
    try {
      repo.deleteDefaultLocal(lk.gridMode, lk.propType, lk.motionType, lk.placementKey, lk.turns);
      await repo.deleteDefault(lk.gridMode, lk.propType, lk.motionType, lk.placementKey, lk.turns);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Default delete failed:", error);
    }
  }
```

- [ ] **Step 3: Show the prop in the dock head (Default tier only), layout-shift-safe**

The dock head currently renders `{colorName} · {tierLabel(editTarget)}` via the ghost-sizer (from the no-layout-shift work). When `editTarget === "default"`, append the prop being tuned so the admin knows which dataset. Derive it from the existing `thisPropType`:

```ts
  const dockTitleText = $derived(
    editTarget === "default"
      ? `${colorName} · ${thisPropType} · Default`
      : `${colorName} · ${tierLabel(editTarget)}`,
  );
```

Update the live span to `{dockTitleText}`. Update the ghost sizer to the new longest variant — `thisPropType` can be up to `bigdoublecontactball` (20 chars), so the sizer must cover the worst case:

```svelte
      <span class="dock-title">
        <span class="dock-title-sizer" aria-hidden="true">Blue · bigdoublecontactball · Default</span>
        <span class="dock-title-live">{dockTitleText}</span>
      </span>
```

Per `.claude/rules/no-layout-shift.md`, the sizer string must be ≥ the widest real value; `Blue · bigdoublecontactball · Default` covers both the longest prop and `Blue · Global Override`.

- [ ] **Step 4: Verify typecheck on the dock file**

Run: `npm run check:fast 2>&1 | grep -iE "PipelineEditorDock" ; echo "---done---"`
Expected: only `---done---` (no errors for the dock).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte
git commit -m "feat(arrow-defaults): prop-scoped Default tier + prop in dock head" -- src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte
```

---

## Task 8: Full regression + verification

**Files:** none (verification only)

- [ ] **Step 1: Run the arrow-adjustment test suite**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment`
Expected: all green, including the unchanged `DefaultOverrideReadPrecedence` (staff path) and the four new per-prop tests.

- [ ] **Step 2: Full typecheck (commit gate)**

Run: `npm run check > /tmp/check-perprop.log 2>&1; grep -niE "error" /tmp/check-perprop.log | head -40; echo "---done---"`
Expected: no NEW errors referencing any file in the File Structure table. (Pre-existing unrelated errors in the repo are out of scope — confirm by grepping the changed paths only.)

- [ ] **Step 3: Runtime smoke (admin, manual — requires user)**

In the running dev server, open a pictograph in Inspect, select an arrow, switch the prop (settings) to `fan`, edit the Default tier X/Y, Save. Confirm: (a) dock head reads `<color> · fan · Default`; (b) the fan edit does NOT move the same letter rendered with `staff`; (c) reload → fan value persists, staff value unchanged. This step is user-verified per the verification protocol.

- [ ] **Step 4: Confirm seed parity end-to-end**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/arrow-adjustment/PerPropStaticLoad.test.ts`
Expected: PASS — a seeded prop with no Firestore override resolves to the seed (== staff) value.

---

## Self-Review

**Spec coverage:**
- §1 cascade (P Firestore → P static → last-resort staff) → Tasks 2 (static + fallback) + 5 (resolver) + 6 (threading).
- §2 data & seeding → Task 1.
- §3 static loader → Task 2.
- §4 Firestore per-prop → Tasks 3, 4, 5.
- §5 call-chain plumbing + DefaultTierInfo → Task 6.
- §6 dock UX → Task 7.
- §7 testing → embedded TDD per task + Task 8.
All spec sections mapped.

**Type consistency:** Repo arg order is `(gridMode, propType, motionType, placementKey, turns[, value])` in Tasks 4/5/7. The resolver type appends `propType` LAST `(gridMode, motionType, placementKey, turns, propType)` (Task 2) and the singleton adapts the order (Task 5). `ArrowPlacer.getDefaultAdjustment(motionType, placementKey, turns, gridMode, propType)` and `DefaultPlacer.getDefaultAdjustment(placementKey, turns, motionType, gridMode, propType)` keep their distinct existing orders with `propType` appended (Tasks 2, 6) — verified against current callers. `generateDefaultDocId(gridMode, propType, motionType)` consistent across domain/state/persister (Tasks 3, 4, 5).

**Placeholder scan:** Task 6 Step 3 references a "neighboring fixture" rather than inlining a full pictograph fixture — the implementer must copy the actual `motionData`/`pictographData` shape from an existing `tests/unit/arrow-adjustment/*.test.ts`; this is the one spot requiring the implementer to read a sibling test for the fixture template (unavoidable without duplicating a large fixture here).
