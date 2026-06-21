# Multi-Avatar Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `PerformerManager` into the standalone 3D viewer with per-performer selection, fan-out editing, six new formation presets, and snapshot-based undo — without breaking realm/museum/duet features that already consume `PerformerManager`.

**Architecture:** Additive wiring. `createViewer3DState` adopts `createPerformerManager` as its source of truth and exposes a viewer-specific `selectedPerformerIndex: number | null` scope layer on top. Existing `AvatarInstanceState` per-instance API is untouched. The existing `FormationPreset` union and `formation-presets.ts` library are extended with six new presets. A new `Viewer3DUndoManager` follows the snapshot pattern from `features/create/shared/services/implementations/UndoManager.ts`. UI surfaces are a `PerformerChipStrip` in the gear popover and a `PerformerTab` replacing the placeholder Avatar tab.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`), TypeScript strict, ITI DI container, Threlte/Three.js for the 3D scene, vitest for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-04-11-multi-avatar-foundation-design.md`

---

## File Structure

```
src/lib/shared/3d/
├── scale/scale-constants.ts                        [MODIFY — add MAX_VIEWER_PERFORMERS]
├── domain/formation.ts                             [MODIFY — extend FormationPreset union]
├── config/formation-presets.ts                     [MODIFY — 6 generators + PRESET_VALID_COUNTS + FORMATION_PRESET_INFO]
├── state/
│   ├── viewer-3d-state.svelte.ts                   [REFACTOR — wire PerformerManager, scope, undo, persistence]
│   └── performer-manager.svelte.ts                 [MODIFY — optional maxPerformers dep]
├── services/
│   ├── contracts/IViewer3DUndoManager.ts           [NEW]
│   └── implementations/Viewer3DUndoManager.ts      [NEW]
├── keyboard/Viewer3DKeyboardHandler.ts             [NEW]
├── components/
│   ├── Viewer3DScene.svelte                        [MODIFY — raycaster + ground-disc indicator]
│   ├── Viewer3DGearPopover.svelte                  [MODIFY — mount chip strip, swap Avatar tab]
│   └── controls/
│       ├── PerformerChipStrip.svelte               [NEW]
│       └── PerformerTab.svelte                     [NEW]

src/lib/shared/di/containers/3d-container.ts        [MODIFY — register viewer3DUndoManager]

tests/unit/3d-viewer/
├── formation-presets.test.ts                       [NEW]
├── viewer3d-scope.test.ts                          [NEW]
├── viewer3d-undo-manager.test.ts                   [NEW]
└── viewer3d-integration.test.ts                    [NEW]
```

---

## Test Runner Primer

This project uses vitest. Run a specific test file with:
```bash
npm test -- tests/unit/3d-viewer/formation-presets.test.ts
```
Run a specific test by name:
```bash
npm test -- tests/unit/3d-viewer/formation-presets.test.ts -t "solo preset"
```
Run all tests in a directory:
```bash
npm test -- tests/unit/3d-viewer/
```
Type-check after edits:
```bash
npm run check
```
Do **not** run `npm run dev` — port 5173 belongs to the user. The dev server is already running there.

---

## Task 1: Add `MAX_VIEWER_PERFORMERS` constant

**Files:**
- Modify: `src/lib/shared/3d/scale/scale-constants.ts` (within the `STAGE` object, near line 117)

- [ ] **Step 1: Add the new field to `STAGE`**

Edit `src/lib/shared/3d/scale/scale-constants.ts`. Locate the line:
```ts
	/** Maximum performers supported */
	MAX_PERFORMERS: 4,
```
Add directly after it:
```ts
	/**
	 * Viewer-specific max performers. The standalone 3D viewer allows up to 8,
	 * while realm/museum/duet continue to use the shared MAX_PERFORMERS = 4.
	 * Wired into createPerformerManager via its optional maxPerformers dep.
	 */
	MAX_VIEWER_PERFORMERS: 8,
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: No errors. No behavior change yet.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scale/scale-constants.ts
git commit -m "feat(3d): add MAX_VIEWER_PERFORMERS = 8 for viewer-specific cap"
```

---

## Task 2: Parameterize `PerformerManager`'s cap

**Files:**
- Modify: `src/lib/shared/3d/state/performer-manager.svelte.ts:32-36` (the `PerformerManagerDeps` interface and `addPerformer`/`ensurePerformerCount` methods)

- [ ] **Step 1: Add optional `maxPerformers` to the deps interface**

Edit `src/lib/shared/3d/state/performer-manager.svelte.ts`. Replace the `PerformerManagerDeps` interface with:
```ts
/**
 * Dependencies for performer manager
 */
export interface PerformerManagerDeps {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
  initialAvatarId: AvatarId;
  /**
   * Optional cap override. Defaults to the shared STAGE.MAX_PERFORMERS (4).
   * The standalone 3D viewer passes STAGE.MAX_VIEWER_PERFORMERS (8).
   */
  maxPerformers?: number;
}
```

- [ ] **Step 2: Destructure with default in the factory**

At the top of `createPerformerManager`, change:
```ts
  const { propInterpolator, sequenceConverter, initialAvatarId } = deps;
```
to:
```ts
  const { propInterpolator, sequenceConverter, initialAvatarId } = deps;
  const maxPerformers = deps.maxPerformers ?? MAX_PERFORMERS;
```

- [ ] **Step 3: Use the local cap in `addPerformer`**

In `addPerformer()`, change:
```ts
    if (performerStates.length >= MAX_PERFORMERS) return;
```
to:
```ts
    if (performerStates.length >= maxPerformers) return;
```

- [ ] **Step 4: Use the local cap in `ensurePerformerCount`**

Change:
```ts
  function ensurePerformerCount(count: number) {
    while (performerStates.length < count && performerStates.length < MAX_PERFORMERS) {
      addPerformer();
    }
  }
```
to:
```ts
  function ensurePerformerCount(count: number) {
    while (performerStates.length < count && performerStates.length < maxPerformers) {
      addPerformer();
    }
  }
```

- [ ] **Step 5: Update the `maxPerformers` getter on the returned object**

Change:
```ts
    get maxPerformers() {
      return MAX_PERFORMERS;
    },
```
to:
```ts
    get maxPerformers() {
      return maxPerformers;
    },
```

- [ ] **Step 6: Type-check and verify backward compatibility**

Run: `npm run check`
Expected: No errors. Existing callers (`WorldScene.svelte`, `Museum3DScene.svelte`, `DuetOrchestrator.svelte`, `components/panels/PerformerManager.svelte`) don't pass `maxPerformers`, so they keep the default 4-cap.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/state/performer-manager.svelte.ts
git commit -m "feat(3d): parameterize PerformerManager cap via optional maxPerformers dep"
```

---

## Task 3: Extend `FormationPreset` union with 6 new values

**Files:**
- Modify: `src/lib/shared/3d/domain/formation.ts:11-17` (the `FormationPreset` union)

- [ ] **Step 1: Extend the union**

Edit `src/lib/shared/3d/domain/formation.ts`. Replace:
```ts
export type FormationPreset =
  | "grid-2x2" // Current default - 2x2 grid
  | "line" // Single row, evenly spaced
  | "circle" // Performers face center
  | "v-shape" // V/chevron formation
  | "diagonal" // Staggered diagonal line
  | "custom"; // User-defined positions
```
with:
```ts
export type FormationPreset =
  // Existing
  | "grid-2x2" // 2x2 grid
  | "line" // Single row, evenly spaced
  | "circle" // Performers face center
  | "v-shape" // V/chevron formation
  | "diagonal" // Staggered diagonal line
  | "custom" // User-defined positions
  // New (2026-04-11 multi-avatar foundation)
  | "solo" // Single performer, centered
  | "tunnel-stack" // Conga line along -Z
  | "back-to-back" // Two performers, opposite facings
  | "facing-each-other" // Two performers, facing inward
  | "stage-lr" // Left and right of stage
  | "side-by-side"; // Evenly spaced in one row
```

- [ ] **Step 2: Type-check — expect new errors**

Run: `npm run check`
Expected: Errors in `formation-presets.ts` where `presetNames: Record<FormationPreset, string>` is missing the six new keys, and in `getSlotsForPreset`'s switch (non-exhaustive). These errors are intentional — they get fixed in Task 4.

- [ ] **Step 3: Commit (failing compile fixed in Task 4)**

Since the codebase fails type-check at this point, fold this commit into Task 4's final commit rather than committing in isolation. Skip commit here; move directly to Task 4.

---

## Task 4: Add 6 formation generators + `PRESET_VALID_COUNTS` + `FORMATION_PRESET_INFO` + `formation-presets.test.ts`

**Files:**
- Create: `tests/unit/3d-viewer/formation-presets.test.ts`
- Modify: `src/lib/shared/3d/config/formation-presets.ts`

- [ ] **Step 1: Write failing tests for the six new generators**

Create `tests/unit/3d-viewer/formation-presets.test.ts` with:
```ts
import { describe, it, expect } from "vitest";
import {
  getSlotsForPreset,
  PRESET_VALID_COUNTS,
  FORMATION_PRESET_INFO,
} from "$lib/shared/3d/config/formation-presets";
import { FORMATION_WALL_OFFSET } from "$lib/shared/3d/domain/formation";
import type { FormationPreset } from "$lib/shared/3d/domain/formation";

describe("formation-presets: new presets", () => {
  describe("solo", () => {
    it("returns a single slot at origin", () => {
      const slots = getSlotsForPreset("solo", 1);
      expect(slots.length).toBe(1);
      expect(slots[0]!.position.x).toBe(0);
      expect(slots[0]!.position.z).toBe(FORMATION_WALL_OFFSET);
    });
  });

  describe("tunnel-stack", () => {
    it("produces N slots for N=2..8", () => {
      for (let n = 2; n <= 8; n++) {
        const slots = getSlotsForPreset("tunnel-stack", n);
        expect(slots.length).toBe(n);
      }
    });

    it("stacks along -Z with at least 1.0m spacing", () => {
      const slots = getSlotsForPreset("tunnel-stack", 4);
      for (let i = 1; i < slots.length; i++) {
        const dz = Math.abs(slots[i]!.position.z - slots[i - 1]!.position.z);
        expect(dz).toBeGreaterThanOrEqual(1.0);
      }
    });

    it("all slots share x=0", () => {
      const slots = getSlotsForPreset("tunnel-stack", 5);
      for (const s of slots) expect(s.position.x).toBe(0);
    });
  });

  describe("back-to-back", () => {
    it("returns two slots at origin with opposite facings", () => {
      const slots = getSlotsForPreset("back-to-back", 2);
      expect(slots.length).toBe(2);
      expect(slots[0]!.facingAngle).toBe(0);
      expect(slots[1]!.facingAngle).toBe(Math.PI);
    });

    it("falls back to solo when count < 2", () => {
      const slots = getSlotsForPreset("back-to-back", 1);
      expect(slots.length).toBe(1);
    });
  });

  describe("facing-each-other", () => {
    it("returns two slots facing inward", () => {
      const slots = getSlotsForPreset("facing-each-other", 2);
      expect(slots.length).toBe(2);
      // Performer 0 on the -x side, facing +x (angle = +PI/2 in our convention)
      expect(slots[0]!.position.x).toBeLessThan(0);
      // Performer 1 on the +x side, facing -x
      expect(slots[1]!.position.x).toBeGreaterThan(0);
      // Facings should be opposite
      expect(slots[0]!.facingAngle).toBe(Math.PI / 2);
      expect(slots[1]!.facingAngle).toBe(-Math.PI / 2);
    });

    it("falls back to solo when count < 2", () => {
      const slots = getSlotsForPreset("facing-each-other", 1);
      expect(slots.length).toBe(1);
    });
  });

  describe("stage-lr", () => {
    it("returns two slots at least 3m apart on the X axis", () => {
      const slots = getSlotsForPreset("stage-lr", 2);
      expect(slots.length).toBe(2);
      const dx = Math.abs(slots[0]!.position.x - slots[1]!.position.x);
      expect(dx).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("side-by-side", () => {
    it("produces N slots for N=2..8", () => {
      for (let n = 2; n <= 8; n++) {
        const slots = getSlotsForPreset("side-by-side", n);
        expect(slots.length).toBe(n);
      }
    });

    it("evenly spaces consecutive slots at least 1.5m apart on X", () => {
      const slots = getSlotsForPreset("side-by-side", 4);
      for (let i = 1; i < slots.length; i++) {
        const dx = Math.abs(slots[i]!.position.x - slots[i - 1]!.position.x);
        expect(dx).toBeGreaterThanOrEqual(1.5);
      }
    });

    it("centers the row around x=0", () => {
      const slots = getSlotsForPreset("side-by-side", 4);
      const avgX = slots.reduce((sum, s) => sum + s.position.x, 0) / slots.length;
      expect(avgX).toBeCloseTo(0, 6);
    });
  });

  describe("bounds and finiteness", () => {
    const newPresets: FormationPreset[] = [
      "solo",
      "tunnel-stack",
      "back-to-back",
      "facing-each-other",
      "stage-lr",
      "side-by-side",
    ];

    for (const preset of newPresets) {
      for (const count of PRESET_VALID_COUNTS[preset]) {
        it(`${preset} @ count=${count}: positions finite and within [-10, 10]`, () => {
          const slots = getSlotsForPreset(preset, count);
          for (const s of slots) {
            expect(Number.isFinite(s.position.x)).toBe(true);
            expect(Number.isFinite(s.position.z)).toBe(true);
            expect(s.position.x).toBeGreaterThanOrEqual(-10);
            expect(s.position.x).toBeLessThanOrEqual(10);
            expect(s.position.z).toBeGreaterThanOrEqual(-10);
            expect(s.position.z).toBeLessThanOrEqual(10);
          }
        });
      }
    }
  });

  describe("PRESET_VALID_COUNTS", () => {
    it("defines an entry for every FormationPreset", () => {
      const allPresets: FormationPreset[] = [
        "grid-2x2",
        "line",
        "circle",
        "v-shape",
        "diagonal",
        "custom",
        "solo",
        "tunnel-stack",
        "back-to-back",
        "facing-each-other",
        "stage-lr",
        "side-by-side",
      ];
      for (const p of allPresets) {
        expect(PRESET_VALID_COUNTS[p]).toBeDefined();
        expect(PRESET_VALID_COUNTS[p].length).toBeGreaterThan(0);
      }
    });
  });

  describe("FORMATION_PRESET_INFO", () => {
    it("includes entries for all six new presets", () => {
      const ids = FORMATION_PRESET_INFO.map((e) => e.id);
      expect(ids).toContain("solo");
      expect(ids).toContain("tunnel-stack");
      expect(ids).toContain("back-to-back");
      expect(ids).toContain("facing-each-other");
      expect(ids).toContain("stage-lr");
      expect(ids).toContain("side-by-side");
    });
  });
});
```

- [ ] **Step 2: Run the tests — expect failures**

Run: `npm test -- tests/unit/3d-viewer/formation-presets.test.ts`
Expected: FAIL — `getSlotsForPreset` returns `generateGrid2x2Slots(count)` for unknown presets, `PRESET_VALID_COUNTS` is undefined, `FORMATION_PRESET_INFO` is missing the new entries.

- [ ] **Step 3: Add the six new generator functions**

Edit `src/lib/shared/3d/config/formation-presets.ts`. Insert these functions directly after `generateDiagonalSlots` (around line 206):

```ts
/**
 * Solo formation — single performer centered behind the wall plane.
 */
function generateSoloSlots(_count: number): FormationSlot[] {
  return [{ index: 0, position: { x: 0, z: FORMATION_WALL_OFFSET } }];
}

/**
 * Tunnel stack formation — conga line along -Z, all facing the audience.
 * 1.2m between stacked performers.
 */
function generateTunnelStackSlots(count: number): FormationSlot[] {
  const depth = DEFAULT_FORMATION_SPACING * 0.6; // 1.2m
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: { x: 0, z: FORMATION_WALL_OFFSET + i * -depth },
  }));
}

/**
 * Back-to-back formation — both performers at origin, facing opposite directions.
 */
function generateBackToBackSlots(count: number): FormationSlot[] {
  if (count < 2) return generateSoloSlots(count);
  return [
    {
      index: 0,
      position: { x: 0, z: FORMATION_WALL_OFFSET },
      facingAngle: 0,
    },
    {
      index: 1,
      position: { x: 0, z: FORMATION_WALL_OFFSET },
      facingAngle: Math.PI,
    },
  ];
}

/**
 * Facing-each-other formation — performers at ±0.5m, facing inward.
 */
function generateFacingEachOtherSlots(count: number): FormationSlot[] {
  if (count < 2) return generateSoloSlots(count);
  return [
    {
      index: 0,
      position: { x: -0.5, z: FORMATION_WALL_OFFSET },
      facingAngle: Math.PI / 2,
    },
    {
      index: 1,
      position: { x: 0.5, z: FORMATION_WALL_OFFSET },
      facingAngle: -Math.PI / 2,
    },
  ];
}

/**
 * Stage left/right formation — performers at ±2.5m, facing the audience.
 */
function generateStageLRSlots(count: number): FormationSlot[] {
  if (count < 2) return generateSoloSlots(count);
  return [
    { index: 0, position: { x: -2.5, z: FORMATION_WALL_OFFSET } },
    { index: 1, position: { x: 2.5, z: FORMATION_WALL_OFFSET } },
  ];
}

/**
 * Side-by-side formation — evenly spaced along X with 1.8m between consecutive slots.
 */
function generateSideBySideSlots(count: number): FormationSlot[] {
  const spacing = 1.8;
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: { x: (i - (count - 1) / 2) * spacing, z: FORMATION_WALL_OFFSET },
  }));
}
```

- [ ] **Step 4: Extend `getSlotsForPreset` dispatcher and raise its count clamp**

Replace the existing `getSlotsForPreset` body. Change:
```ts
export function getSlotsForPreset(
  preset: FormationPreset,
  performerCount: number
): FormationSlot[] {
  const count = Math.max(1, Math.min(4, performerCount));

  switch (preset) {
    case "grid-2x2":
      return generateGrid2x2Slots(count);
    case "line":
      return generateLineSlots(count);
    case "circle":
      return generateCircleSlots(count);
    case "v-shape":
      return generateVShapeSlots(count);
    case "diagonal":
      return generateDiagonalSlots(count);
    case "custom":
      // Custom formations return empty - should be filled by user
      return generateGrid2x2Slots(count);
    default:
      return generateGrid2x2Slots(count);
  }
}
```
to:
```ts
export function getSlotsForPreset(
  preset: FormationPreset,
  performerCount: number
): FormationSlot[] {
  // grid-2x2 stays clamped to 4 because it's specifically a 2x2 shape.
  // All other presets support up to 8 for the standalone 3D viewer.
  const isGrid = preset === "grid-2x2";
  const upperBound = isGrid ? 4 : 8;
  const count = Math.max(1, Math.min(upperBound, performerCount));

  switch (preset) {
    case "grid-2x2":
      return generateGrid2x2Slots(count);
    case "line":
      return generateLineSlots(count);
    case "circle":
      return generateCircleSlots(count);
    case "v-shape":
      return generateVShapeSlots(count);
    case "diagonal":
      return generateDiagonalSlots(count);
    case "custom":
      return generateGrid2x2Slots(count);
    case "solo":
      return generateSoloSlots(count);
    case "tunnel-stack":
      return generateTunnelStackSlots(count);
    case "back-to-back":
      return generateBackToBackSlots(count);
    case "facing-each-other":
      return generateFacingEachOtherSlots(count);
    case "stage-lr":
      return generateStageLRSlots(count);
    case "side-by-side":
      return generateSideBySideSlots(count);
    default:
      return generateGrid2x2Slots(count);
  }
}
```

- [ ] **Step 5: Extend the `presetNames` map inside `createFormationFromPreset`**

Locate:
```ts
  const presetNames: Record<FormationPreset, string> = {
    "grid-2x2": "Grid",
    line: "Line",
    circle: "Circle",
    "v-shape": "V-Shape",
    diagonal: "Diagonal",
    custom: "Custom",
  };
```
Replace with:
```ts
  const presetNames: Record<FormationPreset, string> = {
    "grid-2x2": "Grid",
    line: "Line",
    circle: "Circle",
    "v-shape": "V-Shape",
    diagonal: "Diagonal",
    custom: "Custom",
    solo: "Solo",
    "tunnel-stack": "Tunnel Stack",
    "back-to-back": "Back-to-Back",
    "facing-each-other": "Facing Each Other",
    "stage-lr": "Stage L/R",
    "side-by-side": "Side-by-Side",
  };
```

- [ ] **Step 6: Extend `FORMATION_PRESETS` array**

Change:
```ts
export const FORMATION_PRESETS: FormationPreset[] = [
  "grid-2x2",
  "line",
  "circle",
  "v-shape",
  "diagonal",
];
```
to:
```ts
export const FORMATION_PRESETS: FormationPreset[] = [
  "solo",
  "grid-2x2",
  "line",
  "circle",
  "v-shape",
  "diagonal",
  "tunnel-stack",
  "back-to-back",
  "facing-each-other",
  "stage-lr",
  "side-by-side",
];
```

- [ ] **Step 7: Extend `FORMATION_PRESET_INFO`**

Add these six entries to the end of the `FORMATION_PRESET_INFO` array (before the closing `];`):
```ts
  {
    id: "solo",
    name: "Solo",
    description: "Single performer, centered",
    icon: "user",
  },
  {
    id: "tunnel-stack",
    name: "Tunnel Stack",
    description: "Conga line behind each other",
    icon: "layer-group",
  },
  {
    id: "back-to-back",
    name: "Back-to-Back",
    description: "Two performers, opposite facings",
    icon: "user-friends",
  },
  {
    id: "facing-each-other",
    name: "Facing Each Other",
    description: "Two performers, facing inward",
    icon: "people-arrows",
  },
  {
    id: "stage-lr",
    name: "Stage L/R",
    description: "Left and right of stage",
    icon: "arrows-alt-h",
  },
  {
    id: "side-by-side",
    name: "Side-by-Side",
    description: "Evenly spaced in one row",
    icon: "grip-lines",
  },
```

- [ ] **Step 8: Add `PRESET_VALID_COUNTS` export**

Add this near the bottom of the file, after `FORMATION_PRESET_INFO`:
```ts
/**
 * Valid performer counts per preset. Used by the viewer's formation picker
 * to gray out presets that don't match the current performer count.
 * "custom" accepts any count in the viewer-specific range [1, 8].
 */
export const PRESET_VALID_COUNTS: Record<FormationPreset, number[]> = {
  solo: [1],
  "grid-2x2": [1, 2, 3, 4],
  line: [1, 2, 3, 4, 5, 6, 7, 8],
  circle: [1, 2, 3, 4, 5, 6, 7, 8],
  "v-shape": [1, 2, 3, 4, 5, 7],
  diagonal: [1, 2, 3, 4, 5, 6, 7, 8],
  "tunnel-stack": [2, 3, 4, 5, 6, 7, 8],
  "back-to-back": [2],
  "facing-each-other": [2],
  "stage-lr": [2],
  "side-by-side": [2, 3, 4, 5, 6, 7, 8],
  custom: [1, 2, 3, 4, 5, 6, 7, 8],
};
```

- [ ] **Step 9: Run the tests — expect pass**

Run: `npm test -- tests/unit/3d-viewer/formation-presets.test.ts`
Expected: PASS — all new generator tests, bounds tests, and `PRESET_VALID_COUNTS` / `FORMATION_PRESET_INFO` assertions pass.

- [ ] **Step 10: Type-check the whole project**

Run: `npm run check`
Expected: No errors. The `FormationPreset` union is now exhaustively handled.

- [ ] **Step 11: Commit**

```bash
git add src/lib/shared/3d/domain/formation.ts src/lib/shared/3d/config/formation-presets.ts tests/unit/3d-viewer/formation-presets.test.ts
git commit -m "feat(3d): add 6 new formation presets with PRESET_VALID_COUNTS table"
```

---

## Task 5: Wire `PerformerManager` into `createViewer3DState` (additive phase)

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Add imports**

Edit `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`. At the top of the file, replace:
```ts
import {
  createAvatarInstanceState,
  type AvatarInstanceState,
} from "./avatar-instance-state.svelte";
```
with:
```ts
import type { AvatarInstanceState } from "./avatar-instance-state.svelte";
import { createPerformerManager, type PerformerManager } from "./performer-manager.svelte";
import { DEFAULT_AVATAR_ID } from "../config/avatar-definitions";
import { STAGE } from "$lib/shared/3d/scale/scale-constants";
```

- [ ] **Step 2: Replace the avatar state field with a performer manager**

In `createViewer3DState`, locate:
```ts
  let renderMode = $state<"2d" | "3d">("2d"); // Actual restore happens via enter3D call from orchestrator
  let avatarState = $state<AvatarInstanceState | null>(null);
```
Replace with:
```ts
  let renderMode = $state<"2d" | "3d">("2d"); // Actual restore happens via enter3D call from orchestrator

  // Performer manager — single source of truth for multi-performer state.
  // The viewer passes its viewer-specific cap (8) while realm/museum/duet
  // keep their shared cap (4) by not passing maxPerformers at all.
  const performerManager: PerformerManager = createPerformerManager({
    propInterpolator: deps.propInterpolator,
    sequenceConverter: deps.sequenceConverter,
    initialAvatarId: DEFAULT_AVATAR_ID,
    maxPerformers: STAGE.MAX_VIEWER_PERFORMERS,
  });

  // Transitional shim: existing components read `viewer3DState.avatarState`.
  // Until all call sites are migrated (Task 13), this getter exposes
  // performer[0] so nothing breaks. Do NOT add new call sites that read it.
  function getAvatarStateShim(): AvatarInstanceState | null {
    return performerManager.performers[0] ?? null;
  }
```

- [ ] **Step 3: Rewrite `enter3D` to delegate to `performerManager`**

Replace:
```ts
  function enter3D(sequenceData: SequenceData) {
    if (!_webgl2Available) return;
    if (!avatarState) {
      avatarState = createAvatarInstanceState(
        { id: "viewer", positionX: 0 },
        {
          propInterpolator: deps.propInterpolator,
          sequenceConverter: deps.sequenceConverter,
        }
      );
    }
    avatarState.loadSequence(sequenceData);
    renderMode = "3d";
    persistMode("3d");
  }
```
with:
```ts
  function enter3D(sequenceData: SequenceData) {
    if (!_webgl2Available) return;
    if (performerManager.performers.length === 0) {
      performerManager.initialize();
    }
    const primary = performerManager.performers[0];
    primary?.loadSequence(sequenceData);
    renderMode = "3d";
    persistMode("3d");
  }
```

- [ ] **Step 4: Update `dispose` to clean up the manager**

Replace:
```ts
  function dispose() {
    avatarState?.destroy();
    avatarState = null;
  }
```
with:
```ts
  function dispose() {
    performerManager.destroy();
  }
```

- [ ] **Step 5: Replace the `avatarState` effect-driven auto-add-plane logic**

The existing `$effect` block at lines 160–175 reads `avatarState.customBluePlane` / `customRedPlane` and auto-adds them to `visiblePlanes`. Replace the effect's body so it watches performer 0 through the shim:
```ts
  // When a hand is assigned to a plane, automatically add that plane's grid
  // circle to the visible set so the plane actually renders. Driven by
  // performer 0 for now — full per-performer plane tracking lands in
  // Task 13's scope work.
  $effect(() => {
    const primary = performerManager.performers[0];
    if (!primary) return;
    const blue = primary.customBluePlane;
    const red = primary.customRedPlane;

    const needsBlue = !visiblePlanes.has(blue);
    const needsRed = !visiblePlanes.has(red);

    if (needsBlue || needsRed) {
      const next = new Set(visiblePlanes);
      if (needsBlue) next.add(blue);
      if (needsRed) next.add(red);
      visiblePlanes = next;
      persistPlanes(visiblePlanes);
    }
  });
```

- [ ] **Step 6: Update the `avatarState` getter on the returned object to use the shim**

Replace:
```ts
    get avatarState() {
      return avatarState;
    },
```
with:
```ts
    /** @deprecated transitional — use `performerManager.performers[i]` instead. Removed in Task 14. */
    get avatarState() {
      return getAvatarStateShim();
    },
    get performerManager() {
      return performerManager;
    },
```

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: No errors. `Viewer3DCanvas.svelte` and `Viewer3DGearPopover.svelte` both read `viewer3DState.avatarState` — the shim keeps them working.

- [ ] **Step 8: Smoke-test in the browser**

Open `http://localhost:5173/` in Chrome DevTools MCP, navigate to the sequence viewer, click "Enter 3D", and verify the viewer loads exactly as before with one performer rendered and the current sequence playing. Take a screenshot to confirm.

If DevTools MCP isn't available, explicitly tell the user: "I cannot verify this visually right now. Please reload the sequence viewer, click Enter 3D, and confirm the avatar still appears and plays the current sequence."

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "refactor(3d-viewer): wire PerformerManager into viewer-3d-state via shim"
```

---

## Task 6: Add viewer-specific selection scope

**Files:**
- Create: `tests/unit/3d-viewer/viewer3d-scope.test.ts`
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Write failing scope tests**

Create `tests/unit/3d-viewer/viewer3d-scope.test.ts` with:
```ts
import { describe, it, expect, vi } from "vitest";
import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import type { IPropStateInterpolator } from "$lib/shared/3d/services/contracts/IPropStateInterpolator";
import type { ISequenceConverter } from "$lib/shared/3d/services/contracts/ISequenceConverter";

function stubDeps(): {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
} {
  return {
    propInterpolator: {
      interpolate: vi.fn(),
    } as unknown as IPropStateInterpolator,
    sequenceConverter: {
      convertSequence: vi.fn().mockReturnValue([]),
    } as unknown as ISequenceConverter,
  };
}

describe("viewer-3d-state: selection scope", () => {
  it("defaults selection to null (All)", () => {
    const state = createViewer3DState(stubDeps());
    expect(state.selectedPerformerIndex).toBeNull();
  });

  it("scopedPerformers returns all performers when selection is null", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.performerManager.addPerformer();
    expect(state.scopedPerformers().length).toBe(3);
  });

  it("scopedPerformers returns one performer when selection is a valid index", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.selectPerformerScope(1);
    expect(state.scopedPerformers().length).toBe(1);
    expect(state.scopedPerformers()[0]).toBe(state.performerManager.performers[1]);
  });

  it("scopedPerformers returns empty array when selection is out of bounds", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    state.selectPerformerScope(5);
    expect(state.scopedPerformers().length).toBe(0);
  });

  it("selectPerformerScope(null) toggles back to All", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.selectPerformerScope(0);
    expect(state.selectedPerformerIndex).toBe(0);
    state.selectPerformerScope(null);
    expect(state.selectedPerformerIndex).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests — expect failures**

Run: `npm test -- tests/unit/3d-viewer/viewer3d-scope.test.ts`
Expected: FAIL — `selectedPerformerIndex`, `scopedPerformers`, `selectPerformerScope` don't exist on the returned object yet.

- [ ] **Step 3: Add the scope state and helper functions**

Edit `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`. After the `performerManager` declaration and before `getAvatarStateShim`, add:

```ts
  // Viewer-specific selection scope. Lives on top of PerformerManager so
  // realm/museum/duet keep their simpler index-only model. null = "All".
  let selectedPerformerIndex = $state<number | null>(null);

  /**
   * Return the set of performers that should receive scoped writes.
   * - null selection → every performer
   * - valid index   → single performer
   * - bad index     → empty (caller should no-op)
   */
  function scopedPerformers(): AvatarInstanceState[] {
    if (selectedPerformerIndex === null) return performerManager.performers;
    const p = performerManager.performers[selectedPerformerIndex];
    return p ? [p] : [];
  }

  /**
   * Set the current selection scope. Pass null for "All".
   * Out-of-bounds indices are allowed — scopedPerformers() will return []
   * so individual write helpers no-op cleanly.
   */
  function selectPerformerScope(index: number | null): void {
    selectedPerformerIndex = index;
  }

  /**
   * Fan-out: assign a hand plane on every performer in the current scope.
   * Used by the Planes tab when "All" is selected or a single performer is picked.
   */
  function setHandPlaneScoped(hand: "blue" | "red", plane: Plane): void {
    for (const p of scopedPerformers()) {
      p.setHandPlane(hand, plane);
    }
  }

  /**
   * Fan-out: load a sequence onto every performer in the current scope.
   * The viewer's "change sequence for this performer" control routes here.
   */
  function loadSequenceScoped(sequenceData: SequenceData): void {
    for (const p of scopedPerformers()) {
      p.loadSequence(sequenceData);
    }
  }
```

- [ ] **Step 4: Expose the new fields on the returned object**

Locate the `return { ... }` block of `createViewer3DState` and add these accessors alongside the existing ones (after the `performerManager` getter you added in Task 5):

```ts
    get selectedPerformerIndex() {
      return selectedPerformerIndex;
    },
    scopedPerformers,
    selectPerformerScope,
    setHandPlaneScoped,
    loadSequenceScoped,
```

- [ ] **Step 5: Run the scope tests — expect pass**

Run: `npm test -- tests/unit/3d-viewer/viewer3d-scope.test.ts`
Expected: PASS — all five scope tests green.

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts tests/unit/3d-viewer/viewer3d-scope.test.ts
git commit -m "feat(3d-viewer): add selection scope and fan-out write helpers"
```

---

## Task 7: Build `Viewer3DUndoManager` (contract + implementation + tests)

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IViewer3DUndoManager.ts`
- Create: `src/lib/shared/3d/services/implementations/Viewer3DUndoManager.ts`
- Create: `tests/unit/3d-viewer/viewer3d-undo-manager.test.ts`

- [ ] **Step 1: Write the contract file**

Create `src/lib/shared/3d/services/contracts/IViewer3DUndoManager.ts` with:
```ts
/**
 * Viewer 3D Undo Manager Contract
 *
 * Snapshot-based undo for the standalone 3D viewer. Captures four types
 * of mutations: spawn, remove, formation-apply, and spatial edits.
 *
 * Pattern mirrors features/create/shared/services/implementations/UndoManager.ts:
 * each push captures a full state snapshot; undo restores the snapshot.
 * Simpler than command-pattern for a bounded operation set.
 */

import type { FormationPreset } from "../../domain/formation";
import type { Plane } from "../../domain/enums/Plane";

/**
 * Serializable snapshot of one performer's editable state.
 * Sequences are referenced by (ownerId, sequenceId) rather than inlined.
 */
export interface PerformerSnapshot {
  id: string;
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
  sequenceRef: { ownerId: string; sequenceId: string } | null;
}

/**
 * Full serializable viewer state at a point in time.
 */
export interface ViewerSnapshot {
  performers: PerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: FormationPreset | "manual";
  timestamp: number;
}

/**
 * The four mutation types that push undo entries.
 * - spawn:    a performer was added
 * - remove:   a performer was removed
 * - formation: a formation preset was applied (via smooth transition)
 * - spatial:  a position or facing edit on any performer, coalesced to 300ms
 */
export type ViewerOperationType = "spawn" | "remove" | "formation" | "spatial";

export interface ViewerUndoEntry {
  id: string;
  type: ViewerOperationType;
  beforeState: ViewerSnapshot;
  afterState?: ViewerSnapshot;
  timestamp: number;
}

export interface IViewer3DUndoManager {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly maxHistorySize: number;
  readonly undoHistory: ReadonlyArray<ViewerUndoEntry>;
  readonly redoHistory: ReadonlyArray<ViewerUndoEntry>;

  /**
   * Push a new entry with only beforeState populated. Returns the new entry's id
   * so the caller can complete it with `completeEntry(id, afterState)` once the
   * mutation lands.
   */
  pushSnapshot(type: ViewerOperationType, beforeState: ViewerSnapshot): string;

  /**
   * Fill in the afterState on an in-flight entry. Called immediately after the
   * mutation completes.
   */
  completeEntry(id: string, afterState: ViewerSnapshot): void;

  /** Pop the top undo entry onto the redo stack. Returns the entry or null. */
  undo(): ViewerUndoEntry | null;

  /** Pop the top redo entry back onto the undo stack. Returns the entry or null. */
  redo(): ViewerUndoEntry | null;

  /** Empty both stacks. */
  clearHistory(): void;

  /** Subscribe to any stack change. Returns an unsubscribe function. */
  onChange(callback: () => void): () => void;
}
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/3d-viewer/viewer3d-undo-manager.test.ts` with:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { Viewer3DUndoManager } from "$lib/shared/3d/services/implementations/Viewer3DUndoManager";
import type { ViewerSnapshot } from "$lib/shared/3d/services/contracts/IViewer3DUndoManager";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

function snap(label: string): ViewerSnapshot {
  return {
    performers: [
      {
        id: `performer-0-${label}`,
        position: { x: 0, z: 0 },
        facingAngle: 0,
        customBluePlane: Plane.WALL,
        customRedPlane: Plane.WALL,
        sequenceRef: null,
      },
    ],
    selectedPerformerIndex: null,
    activeFormation: "solo",
    timestamp: Date.now(),
  };
}

describe("Viewer3DUndoManager", () => {
  let mgr: Viewer3DUndoManager;

  beforeEach(() => {
    mgr = new Viewer3DUndoManager();
  });

  it("starts with both stacks empty", () => {
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it("pushSnapshot makes canUndo true", () => {
    mgr.pushSnapshot("spawn", snap("A"));
    expect(mgr.canUndo).toBe(true);
    expect(mgr.canRedo).toBe(false);
  });

  it("completeEntry fills in afterState on the most recent entry", () => {
    const id = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id, snap("B"));
    const entry = mgr.undoHistory[mgr.undoHistory.length - 1];
    expect(entry?.afterState).toBeDefined();
    expect(entry?.afterState?.performers[0]?.id).toBe("performer-0-B");
  });

  it("undo moves entry to redo stack and returns it", () => {
    const before = snap("before");
    const id = mgr.pushSnapshot("formation", before);
    mgr.completeEntry(id, snap("after"));

    const undone = mgr.undo();
    expect(undone).not.toBeNull();
    expect(undone?.beforeState.performers[0]?.id).toBe("performer-0-before");
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(true);
  });

  it("redo moves entry back to undo stack and returns it", () => {
    const id = mgr.pushSnapshot("spatial", snap("before"));
    mgr.completeEntry(id, snap("after"));
    mgr.undo();

    const redone = mgr.redo();
    expect(redone).not.toBeNull();
    expect(redone?.afterState?.performers[0]?.id).toBe("performer-0-after");
    expect(mgr.canUndo).toBe(true);
    expect(mgr.canRedo).toBe(false);
  });

  it("pushing a new entry clears the redo stack", () => {
    const id1 = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id1, snap("A-done"));
    mgr.undo();
    expect(mgr.canRedo).toBe(true);

    const id2 = mgr.pushSnapshot("remove", snap("B"));
    mgr.completeEntry(id2, snap("B-done"));
    expect(mgr.canRedo).toBe(false);
  });

  it("cap enforcement drops oldest at 51st push", () => {
    for (let i = 0; i < 51; i++) {
      const id = mgr.pushSnapshot("spatial", snap(`push-${i}`));
      mgr.completeEntry(id, snap(`push-${i}-done`));
    }
    expect(mgr.undoHistory.length).toBe(50);
    // The oldest entry (push-0) should have been dropped
    expect(mgr.undoHistory[0]?.beforeState.performers[0]?.id).toBe("performer-0-push-1");
  });

  it("clearHistory empties both stacks", () => {
    const id = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id, snap("B"));
    mgr.undo();
    mgr.clearHistory();
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it("onChange subscribers are notified on push, undo, redo, clearHistory", () => {
    let count = 0;
    const unsub = mgr.onChange(() => {
      count += 1;
    });
    const id = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id, snap("B"));
    mgr.undo();
    mgr.redo();
    mgr.clearHistory();
    unsub();
    // Push + undo + redo + clearHistory = 4 notifications.
    // completeEntry does not notify because it's a silent patch.
    expect(count).toBe(4);
  });

  it("push → undo → redo round-trips", () => {
    const before = snap("before");
    const after = snap("after");
    const id = mgr.pushSnapshot("formation", before);
    mgr.completeEntry(id, after);

    const undone = mgr.undo();
    expect(undone?.beforeState.performers[0]?.id).toBe("performer-0-before");

    const redone = mgr.redo();
    expect(redone?.afterState?.performers[0]?.id).toBe("performer-0-after");
  });
});
```

- [ ] **Step 3: Run the tests — expect import failure**

Run: `npm test -- tests/unit/3d-viewer/viewer3d-undo-manager.test.ts`
Expected: FAIL — the `Viewer3DUndoManager` module does not exist.

- [ ] **Step 4: Write the implementation**

Create `src/lib/shared/3d/services/implementations/Viewer3DUndoManager.ts` with:
```ts
/**
 * Viewer 3D Undo Manager Implementation
 *
 * Snapshot-based undo for the 3D viewer. Pattern borrowed from
 * features/create/shared/services/implementations/UndoManager.ts, simplified:
 * no localStorage persistence (viewer undo is ephemeral), no per-section filtering.
 */

import type {
  IViewer3DUndoManager,
  ViewerOperationType,
  ViewerSnapshot,
  ViewerUndoEntry,
} from "../contracts/IViewer3DUndoManager";

const DEFAULT_MAX_HISTORY_SIZE = 50;

export class Viewer3DUndoManager implements IViewer3DUndoManager {
  private _undoHistory: ViewerUndoEntry[] = [];
  private _redoHistory: ViewerUndoEntry[] = [];
  private _maxHistorySize: number = DEFAULT_MAX_HISTORY_SIZE;
  private _changeCallbacks: Set<() => void> = new Set();
  private _nextId: number = 0;

  get maxHistorySize(): number {
    return this._maxHistorySize;
  }

  get canUndo(): boolean {
    return this._undoHistory.length > 0;
  }

  get canRedo(): boolean {
    return this._redoHistory.length > 0;
  }

  get undoHistory(): ReadonlyArray<ViewerUndoEntry> {
    return this._undoHistory;
  }

  get redoHistory(): ReadonlyArray<ViewerUndoEntry> {
    return this._redoHistory;
  }

  onChange(callback: () => void): () => void {
    this._changeCallbacks.add(callback);
    return () => this._changeCallbacks.delete(callback);
  }

  private notifyChange(): void {
    this._changeCallbacks.forEach((cb) => cb());
  }

  private generateId(): string {
    this._nextId += 1;
    return `viewer3d-undo-${Date.now()}-${this._nextId}`;
  }

  pushSnapshot(type: ViewerOperationType, beforeState: ViewerSnapshot): string {
    const entry: ViewerUndoEntry = {
      id: this.generateId(),
      type,
      beforeState,
      afterState: undefined,
      timestamp: Date.now(),
    };

    this._undoHistory.push(entry);

    // Enforce cap: drop the oldest entry when we exceed maxHistorySize.
    if (this._undoHistory.length > this._maxHistorySize) {
      this._undoHistory.shift();
    }

    // New push invalidates the redo stack.
    this._redoHistory = [];

    this.notifyChange();
    return entry.id;
  }

  completeEntry(id: string, afterState: ViewerSnapshot): void {
    // Look up the entry by id. Most commonly it's the top of the undo stack,
    // but completeEntry is safe to call on any in-flight entry.
    for (let i = this._undoHistory.length - 1; i >= 0; i--) {
      const entry = this._undoHistory[i];
      if (entry && entry.id === id) {
        entry.afterState = afterState;
        return;
      }
    }
    // No match — silently ignore. This happens if the entry was trimmed by
    // the cap between push and complete, which is fine for undo semantics.
  }

  undo(): ViewerUndoEntry | null {
    if (!this.canUndo) return null;
    const entry = this._undoHistory.pop();
    if (!entry) return null;
    this._redoHistory.push(entry);
    this.notifyChange();
    return entry;
  }

  redo(): ViewerUndoEntry | null {
    if (!this.canRedo) return null;
    const entry = this._redoHistory.pop();
    if (!entry) return null;
    this._undoHistory.push(entry);
    this.notifyChange();
    return entry;
  }

  clearHistory(): void {
    this._undoHistory = [];
    this._redoHistory = [];
    this.notifyChange();
  }
}
```

- [ ] **Step 5: Run the tests — expect pass**

Run: `npm test -- tests/unit/3d-viewer/viewer3d-undo-manager.test.ts`
Expected: PASS — all ten tests green.

- [ ] **Step 6: Register `viewer3DUndoManager` in the DI container**

Edit `src/lib/shared/di/containers/3d-container.ts`. At the top, add:
```ts
import { Viewer3DUndoManager } from "$lib/shared/3d/services/implementations/Viewer3DUndoManager";
```

Locate the tier 3 block:
```ts
  // Tier 3: Duet and multi-performer systems
  const tier3 = tier2.add({
    duetPersister: () => new DuetPersister(deps.browseLoader),
    // Factory function - creates new instance each time (not singleton)
    // Use container.items.performerSynchronizerFactory() to create instances
    performerSynchronizerFactory: () => createPerformerSynchronizer,
  });
```
Replace with:
```ts
  // Tier 3: Duet and multi-performer systems
  const tier3 = tier2.add({
    duetPersister: () => new DuetPersister(deps.browseLoader),
    // Factory function - creates new instance each time (not singleton)
    // Use container.items.performerSynchronizerFactory() to create instances
    performerSynchronizerFactory: () => createPerformerSynchronizer,
    // Snapshot-based undo for the standalone 3D viewer. Singleton scoped to
    // the container; the viewer state factory consumes it via its deps.
    viewer3DUndoManager: () => new Viewer3DUndoManager(),
  });
```

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IViewer3DUndoManager.ts src/lib/shared/3d/services/implementations/Viewer3DUndoManager.ts tests/unit/3d-viewer/viewer3d-undo-manager.test.ts src/lib/shared/di/containers/3d-container.ts
git commit -m "feat(3d-viewer): add snapshot-based Viewer3DUndoManager"
```

---

## Task 8: Wire undo + keyboard handler into `createViewer3DState`

**Files:**
- Create: `src/lib/shared/3d/keyboard/Viewer3DKeyboardHandler.ts`
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:307-310` (the single call site of `createViewer3DState`)

- [ ] **Step 1: Confirm the single caller**

There is exactly one caller of `createViewer3DState` in the codebase:
`src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:307`. It currently passes `{ propInterpolator, sequenceConverter }` and must also pass `viewer3DUndoManager: container.items.viewer3DUndoManager` after this task.

- [ ] **Step 2: Add `viewer3DUndoManager` to the state factory's deps**

Edit `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`. Locate the `deps` parameter destructure in `createViewer3DState`:
```ts
export function createViewer3DState(deps: {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
}) {
```
Replace with:
```ts
import type { IViewer3DUndoManager } from "../services/contracts/IViewer3DUndoManager";
import type { PerformerSnapshot, ViewerSnapshot } from "../services/contracts/IViewer3DUndoManager";
// ... (keep existing imports)

export function createViewer3DState(deps: {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
  viewer3DUndoManager: IViewer3DUndoManager;
}) {
```
(Add the two new `import type` statements at the top of the file alongside the other imports. They replace no existing import.)

- [ ] **Step 3: Add snapshot capture helper and active-formation tracking**

Inside `createViewer3DState`, after the existing `selectedPerformerIndex` declaration, add:
```ts
  // Track the most recently applied formation preset so undo snapshots can
  // record it. Starts as "manual" until the user picks a preset.
  let activeFormation = $state<FormationPreset | "manual">("manual");

  /**
   * Serialize the current viewer state into a ViewerSnapshot. Used by the
   * undo manager to capture before/after states around mutations.
   */
  function captureViewerSnapshot(): ViewerSnapshot {
    const performerSnapshots: PerformerSnapshot[] = performerManager.performers.map((p) => ({
      id: p.id,
      position: { x: p.position.x, z: p.position.z },
      facingAngle: p.facingAngle,
      customBluePlane: p.customBluePlane,
      customRedPlane: p.customRedPlane,
      // AvatarInstanceState does not currently expose a sequenceRef on its
      // public surface. For v1 we snapshot null — undo of a sequence change
      // is out of scope. The field remains on the snapshot shape for future
      // expansion.
      sequenceRef: null,
    }));

    return {
      performers: performerSnapshots,
      selectedPerformerIndex,
      activeFormation,
      timestamp: Date.now(),
    };
  }

  /**
   * Restore a snapshot onto the live state. Called by undo/redo.
   * Handles: performer count (spawn/remove to match), per-performer
   * position/facing/plane assignments, active formation, selection.
   * Does NOT restore sequenceRef — out of scope for v1.
   */
  function restoreViewerSnapshot(snap: ViewerSnapshot): void {
    // 1. Match performer count by spawning or removing.
    while (performerManager.performers.length < snap.performers.length) {
      performerManager.addPerformer();
    }
    while (performerManager.performers.length > snap.performers.length) {
      performerManager.removePerformer();
    }

    // 2. Restore each performer's editable state.
    snap.performers.forEach((ps, i) => {
      const p = performerManager.performers[i];
      if (!p) return;
      p.position.x = ps.position.x;
      p.position.z = ps.position.z;
      p.setFacingAngle(ps.facingAngle);
      p.setHandPlane("blue", ps.customBluePlane);
      p.setHandPlane("red", ps.customRedPlane);
    });

    // 3. Restore top-level viewer state.
    activeFormation = snap.activeFormation;
    selectedPerformerIndex = snap.selectedPerformerIndex;
  }
```

- [ ] **Step 4: Add the four undo-producing mutation entry points**

After `restoreViewerSnapshot`, add:
```ts
  // Coalescing window for spatial edits (position/facing nudges). A held
  // numeric spinner shouldn't flood the undo stack with 60 entries/sec.
  const SPATIAL_COALESCE_WINDOW_MS = 300;
  let lastSpatialEntryId: string | null = null;
  let lastSpatialTimestamp: number = 0;

  /**
   * Spawn a new performer. Copies the currently-selected performer's state
   * onto the new one (or performer 0 if scope is "All"). Records an undo
   * entry of type "spawn".
   */
  function spawnPerformerFromUI(): void {
    if (performerManager.performers.length >= STAGE.MAX_VIEWER_PERFORMERS) return;

    const before = captureViewerSnapshot();
    const entryId = deps.viewer3DUndoManager.pushSnapshot("spawn", before);

    const sourceIndex = selectedPerformerIndex ?? 0;
    const source = performerManager.performers[sourceIndex];

    performerManager.addPerformer();

    const newIndex = performerManager.performers.length - 1;
    const newPerf = performerManager.performers[newIndex];
    if (newPerf && source && source !== newPerf) {
      // Copy the source's plane assignments onto the fresh performer.
      newPerf.setHandPlane("blue", source.customBluePlane);
      newPerf.setHandPlane("red", source.customRedPlane);
      // Sequence is copied via loadSequence if the source has one loaded.
      // AvatarInstanceState doesn't expose its current SequenceData on the
      // public surface, so we rely on PerformerManager's defaults for the
      // new performer's sequence. Users can swap sequence via the UI.
    }

    selectedPerformerIndex = newIndex;
    deps.viewer3DUndoManager.completeEntry(entryId, captureViewerSnapshot());
  }

  /**
   * Remove the last performer. PerformerManager only supports removing the
   * last one today (spec Open Question #6 tracks index-specific remove).
   * Records an undo entry of type "remove".
   */
  function removePerformerFromUI(): void {
    if (performerManager.performers.length <= 1) return;

    const before = captureViewerSnapshot();
    const entryId = deps.viewer3DUndoManager.pushSnapshot("remove", before);

    const removedIndex = performerManager.performers.length - 1;
    performerManager.removePerformer();

    // Adjust selection if the removed performer was selected.
    if (selectedPerformerIndex !== null && selectedPerformerIndex >= removedIndex) {
      selectedPerformerIndex = Math.max(0, removedIndex - 1);
    }

    deps.viewer3DUndoManager.completeEntry(entryId, captureViewerSnapshot());
  }

  /**
   * Apply a formation preset. No-ops if the preset's valid counts don't
   * include the current performer count. Records an undo entry of type
   * "formation". Uses PerformerManager's existing smooth transition.
   *
   * `transitionToFormation` kicks off an animated transition — the live
   * performer positions only reach their targets after ~500ms of frame
   * updates. To make redo work correctly, we synthesize the afterState
   * from the target formation slots rather than re-reading live positions.
   */
  function applyFormationFromUI(preset: FormationPreset): void {
    const count = performerManager.performers.length;
    if (!PRESET_VALID_COUNTS[preset]?.includes(count)) return;

    const before = captureViewerSnapshot();
    const entryId = deps.viewer3DUndoManager.pushSnapshot("formation", before);

    // Compute target positions synthetically from the preset.
    const targetFormation = createFormationFromPreset(preset, count);
    const afterPerformers: PerformerSnapshot[] = performerManager.performers.map((p, i) => {
      const slot = targetFormation.slots.find((s) => s.index === i);
      const facing = slot ? calculateFacingAngle(slot, targetFormation) : p.facingAngle;
      return {
        id: p.id,
        position: slot
          ? { x: slot.position.x, z: slot.position.z }
          : { x: p.position.x, z: p.position.z },
        facingAngle: facing,
        customBluePlane: p.customBluePlane,
        customRedPlane: p.customRedPlane,
        sequenceRef: null,
      };
    });

    performerManager.transitionToFormation(preset, 500);
    activeFormation = preset;

    deps.viewer3DUndoManager.completeEntry(entryId, {
      performers: afterPerformers,
      selectedPerformerIndex,
      activeFormation: preset,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a spatial edit (position or facing nudge). Coalesces consecutive
   * edits within 300ms onto the same undo entry so a held spinner doesn't
   * flood the stack.
   */
  function recordSpatialEdit(): void {
    const now = Date.now();
    const withinWindow =
      lastSpatialEntryId !== null && now - lastSpatialTimestamp < SPATIAL_COALESCE_WINDOW_MS;

    if (withinWindow && lastSpatialEntryId) {
      // Coalesce: update the existing entry's afterState, do not push a new one.
      deps.viewer3DUndoManager.completeEntry(lastSpatialEntryId, captureViewerSnapshot());
      lastSpatialTimestamp = now;
      return;
    }

    // New window: push a fresh entry.
    const before = captureViewerSnapshot();
    const id = deps.viewer3DUndoManager.pushSnapshot("spatial", before);
    deps.viewer3DUndoManager.completeEntry(id, before);
    lastSpatialEntryId = id;
    lastSpatialTimestamp = now;
  }

  /**
   * Undo the last mutation. Restores the entry's beforeState.
   */
  function undo(): void {
    const entry = deps.viewer3DUndoManager.undo();
    if (!entry) return;
    restoreViewerSnapshot(entry.beforeState);
    // A fresh undo action closes any spatial coalescing window.
    lastSpatialEntryId = null;
  }

  /**
   * Redo the most recently undone mutation. Restores the entry's afterState.
   */
  function redo(): void {
    const entry = deps.viewer3DUndoManager.redo();
    if (!entry || !entry.afterState) return;
    restoreViewerSnapshot(entry.afterState);
    lastSpatialEntryId = null;
  }
```

Also add the needed imports at the top of the file:
```ts
import type { FormationPreset } from "../domain/formation";
import { calculateFacingAngle } from "../domain/formation";
import { PRESET_VALID_COUNTS, createFormationFromPreset } from "../config/formation-presets";
```

- [ ] **Step 5: Expose undo-related methods on the returned object**

Add to the `return { ... }` block:
```ts
    get canUndo() {
      return deps.viewer3DUndoManager.canUndo;
    },
    get canRedo() {
      return deps.viewer3DUndoManager.canRedo;
    },
    get activeFormation() {
      return activeFormation;
    },
    spawnPerformerFromUI,
    removePerformerFromUI,
    applyFormationFromUI,
    recordSpatialEdit,
    undo,
    redo,
```

- [ ] **Step 6: Build the keyboard handler**

Create `src/lib/shared/3d/keyboard/Viewer3DKeyboardHandler.ts` with:
```ts
/**
 * Viewer 3D Keyboard Handler
 *
 * Binds Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) to the viewer's undo/redo
 * when the gear popover is open and the user is not typing in a text input.
 *
 * Returns a disposer that unregisters the listener. Call once per popover
 * mount; dispose on unmount.
 */

interface Viewer3DKeyboardTarget {
  undo(): void;
  redo(): void;
}

/**
 * Test whether the event target is an editable element. Ctrl+Z inside a
 * text input should go to the input's own undo stack, not the viewer's.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function createViewer3DKeyboardHandler(target: Viewer3DKeyboardTarget): () => void {
  function onKeyDown(e: KeyboardEvent): void {
    // Only respond to Ctrl/Cmd + Z (with or without Shift).
    const meta = e.ctrlKey || e.metaKey;
    if (!meta) return;
    if (e.key !== "z" && e.key !== "Z") return;

    // Don't steal focus from text inputs.
    if (isEditableTarget(e.target)) return;

    e.preventDefault();
    if (e.shiftKey) {
      target.redo();
    } else {
      target.undo();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
```

- [ ] **Step 7: Update the one caller to pass the new dep**

Edit `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`. Locate line 307:
```ts
  const viewer3DState = createViewer3DState({
    propInterpolator: container.items.propStateInterpolator,
    sequenceConverter: container.items.sequenceConverter,
  });
```
Replace with:
```ts
  const viewer3DState = createViewer3DState({
    propInterpolator: container.items.propStateInterpolator,
    sequenceConverter: container.items.sequenceConverter,
    viewer3DUndoManager: container.items.viewer3DUndoManager,
  });
```

- [ ] **Step 8: Type-check**

Run: `npm run check`
Expected: No errors. Every caller of `createViewer3DState` now passes `viewer3DUndoManager`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/shared/3d/keyboard/Viewer3DKeyboardHandler.ts
git commit -m "feat(3d-viewer): wire snapshot undo + Ctrl+Z keyboard handler into viewer state"
```

(If a caller file was modified in Step 7, include it in the `git add` line for the same commit.)

---

## Task 9: Build `PerformerChipStrip.svelte`

**Files:**
- Create: `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte`

- [ ] **Step 1: Scaffold the component**

Create `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` with:
```svelte
<script lang="ts">
  /**
   * PerformerChipStrip
   *
   * Compact performer selector pinned above the gear popover's tab bar.
   * Renders:
   *   [All] · [1] [2] [3] ... [+]
   *
   * - "All" chip: pinned leftmost, pill shape, selected when
   *   `selectedPerformerIndex === null`.
   * - Performer chips: one per performer, numbered 1-N, colored by index,
   *   selected when `selectedPerformerIndex === i`.
   * - "+" chip: rightmost, enabled when `count < MAX_VIEWER_PERFORMERS`.
   *
   * Hidden entirely when only one performer exists (scope doesn't matter).
   */

  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "$lib/shared/3d/scale/scale-constants";

  const viewer3DState = getViewer3DContext();
  const performers = $derived(viewer3DState.performerManager.performers);
  const selectedIndex = $derived(viewer3DState.selectedPerformerIndex);
  const visible = $derived(performers.length >= 2);
  const canAdd = $derived(performers.length < STAGE.MAX_VIEWER_PERFORMERS);

  // Chip tint colors, cycled by performer index.
  // Blue, red, purple, orange, emerald, pink, cyan, yellow — matches the
  // tunnel layer colors used in Compose cell layers for visual consistency.
  const CHIP_COLORS = [
    "#3b82f6", "#ef4444", "#8b5cf6", "#f97316",
    "#10b981", "#ec4899", "#06b6d4", "#eab308",
  ];

  function chipColor(i: number): string {
    return CHIP_COLORS[i % CHIP_COLORS.length] ?? "#6b7280";
  }

  function selectAll(): void {
    viewer3DState.selectPerformerScope(null);
  }

  function selectPerformer(i: number): void {
    viewer3DState.selectPerformerScope(i);
  }

  function addPerformer(): void {
    viewer3DState.spawnPerformerFromUI();
  }
</script>

{#if visible}
  <div class="chip-strip" role="toolbar" aria-label="Performer selection">
    <button
      type="button"
      class="chip chip-all"
      class:active={selectedIndex === null}
      aria-pressed={selectedIndex === null}
      aria-label="Select all performers"
      onclick={selectAll}
    >
      All
    </button>

    <span class="separator" aria-hidden="true">·</span>

    {#each performers as _, i (i)}
      <button
        type="button"
        class="chip chip-performer"
        class:active={selectedIndex === i}
        aria-pressed={selectedIndex === i}
        aria-label={`Select performer ${i + 1}`}
        style="--chip-color: {chipColor(i)}"
        onclick={() => selectPerformer(i)}
      >
        {i + 1}
      </button>
    {/each}

    <button
      type="button"
      class="chip chip-add"
      aria-label="Add performer"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      +
    </button>
  </div>
{/if}

<style>
  .chip-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .chip {
    min-width: 28px;
    height: 28px;
    padding: 0 10px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .chip:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .chip-all {
    padding: 0 14px;
    font-weight: 600;
  }

  .chip-performer {
    width: 44px;
    padding: 0;
    border-color: var(--chip-color, rgba(255, 255, 255, 0.18));
  }

  .chip-performer.active {
    background: var(--chip-color, rgba(255, 255, 255, 0.18));
    color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }

  .chip-all.active {
    background: rgba(139, 139, 255, 0.3);
    border-color: rgba(139, 139, 255, 0.6);
    color: #fff;
  }

  .chip-add {
    width: 28px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
  }

  .separator {
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
    padding: 0 2px;
  }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: No errors. (The component is not mounted yet, but it compiles.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerChipStrip.svelte
git commit -m "feat(3d-viewer): add PerformerChipStrip component"
```

---

## Task 10: Extend `FormationSelector` and build `PerformerTab.svelte`

**Files:**
- Modify: `src/lib/shared/3d/components/controls/FormationSelector.svelte`
- Create: `src/lib/shared/3d/components/controls/PerformerTab.svelte`

- [ ] **Step 0: Add `disabledPresets` prop to `FormationSelector.svelte`**

`FormationSelector.svelte` currently has these props: `value`, `isTransitioning`, `performerCount`, `onchange`. Extend it with an optional `disabledPresets` set so the picker can gray out presets that don't match the current count.

Edit the `Props` interface. Replace:
```ts
  interface Props {
    /** Currently active preset */
    value: FormationPreset;
    /** Whether a transition is in progress */
    isTransitioning?: boolean;
    /** Number of performers (affects visual feedback) */
    performerCount?: number;
    /** Callback when preset is selected */
    onchange: (preset: FormationPreset) => void;
  }
```
with:
```ts
  interface Props {
    /** Currently active preset */
    value: FormationPreset;
    /** Whether a transition is in progress */
    isTransitioning?: boolean;
    /** Number of performers (affects visual feedback) */
    performerCount?: number;
    /** Set of preset ids that are disabled (count not in PRESET_VALID_COUNTS) */
    disabledPresets?: Set<FormationPreset>;
    /** Callback when preset is selected */
    onchange: (preset: FormationPreset) => void;
  }
```

Destructure the new prop with a default:
```ts
  let {
    value,
    isTransitioning = false,
    performerCount = 1,
    disabledPresets,
    onchange,
  }: Props = $props();
```

In the template, change the button disabled logic. Replace:
```svelte
    <button
      class="formation-btn"
      class:active={value === preset.id}
      onclick={() => onchange(preset.id)}
      aria-label={preset.description}
      aria-pressed={value === preset.id}
      title={preset.description}
      disabled={isTransitioning}
    >
```
with:
```svelte
    {@const isDisabled = isTransitioning || (disabledPresets?.has(preset.id) ?? false)}
    <button
      class="formation-btn"
      class:active={value === preset.id}
      onclick={() => onchange(preset.id)}
      aria-label={preset.description}
      aria-pressed={value === preset.id}
      title={disabledPresets?.has(preset.id) ? `${preset.name} — not valid for ${performerCount} performers` : preset.description}
      disabled={isDisabled}
    >
```

- [ ] **Step 1: Scaffold `PerformerTab.svelte`**

Create `src/lib/shared/3d/components/controls/PerformerTab.svelte` with:
```svelte
<script lang="ts">
  /**
   * PerformerTab
   *
   * Contents of the gear popover's "Performers" tab (renamed from "Avatar").
   * Shows:
   *   - Formation preset row (existing FormationSelector, with invalid
   *     presets grayed out for the current performer count)
   *   - Per-performer numeric controls (position X/Z, facing dial)
   *   - Remove button
   *
   * When scope is "All" (selectedPerformerIndex === null), per-performer
   * controls hide and only the formation row is active.
   */

  import FormationSelector from "./FormationSelector.svelte";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { PRESET_VALID_COUNTS, FORMATION_PRESET_INFO } from "../../config/formation-presets";
  import type { FormationPreset } from "../../domain/formation";

  const viewer3DState = getViewer3DContext();
  const selectedIndex = $derived(viewer3DState.selectedPerformerIndex);
  const performers = $derived(viewer3DState.performerManager.performers);
  const count = $derived(performers.length);

  // The selected performer (or null if scope is "All" or the index is bad).
  const selectedPerformer = $derived(
    selectedIndex === null ? null : performers[selectedIndex] ?? null
  );

  // FormationSelector requires a concrete FormationPreset for its `value`
  // prop. When the viewer's activeFormation is "manual", display "custom".
  const selectorValue = $derived<FormationPreset>(
    viewer3DState.activeFormation === "manual" ? "custom" : viewer3DState.activeFormation
  );

  // Presets that aren't compatible with the current count get grayed out.
  const disabledPresets = $derived(
    new Set<FormationPreset>(
      FORMATION_PRESET_INFO.filter(
        (info) => !PRESET_VALID_COUNTS[info.id]?.includes(count)
      ).map((info) => info.id)
    )
  );

  function handleFormationChange(preset: FormationPreset): void {
    viewer3DState.applyFormationFromUI(preset);
  }

  function handleRemove(): void {
    viewer3DState.removePerformerFromUI();
  }

  // Numeric nudge helpers. Each edit records a spatial entry (coalesced by
  // the 300ms window inside viewer-3d-state).
  const NUDGE_STEP = 0.25;

  function nudgeX(delta: number): void {
    if (!selectedPerformer) return;
    selectedPerformer.position.x += delta;
    viewer3DState.recordSpatialEdit();
  }

  function nudgeZ(delta: number): void {
    if (!selectedPerformer) return;
    selectedPerformer.position.z += delta;
    viewer3DState.recordSpatialEdit();
  }

  function nudgeFacing(deltaRadians: number): void {
    if (!selectedPerformer) return;
    selectedPerformer.setFacingAngle(selectedPerformer.facingAngle + deltaRadians);
    viewer3DState.recordSpatialEdit();
  }
</script>

<div class="performer-tab">
  <section class="formation-section">
    <h4 class="section-title">Formation</h4>
    <FormationSelector
      value={selectorValue}
      performerCount={count}
      disabledPresets={disabledPresets}
      onchange={handleFormationChange}
    />
  </section>

  {#if selectedPerformer}
    <section class="selected-section">
      <h4 class="section-title">Performer {(selectedIndex ?? 0) + 1}</h4>

      <div class="control-row">
        <label class="control-label">Position X</label>
        <div class="nudge-group">
          <button type="button" class="nudge-btn" onclick={() => nudgeX(-NUDGE_STEP)}>−</button>
          <span class="nudge-value">{selectedPerformer.position.x.toFixed(2)}</span>
          <button type="button" class="nudge-btn" onclick={() => nudgeX(NUDGE_STEP)}>+</button>
        </div>
      </div>

      <div class="control-row">
        <label class="control-label">Position Z</label>
        <div class="nudge-group">
          <button type="button" class="nudge-btn" onclick={() => nudgeZ(-NUDGE_STEP)}>−</button>
          <span class="nudge-value">{selectedPerformer.position.z.toFixed(2)}</span>
          <button type="button" class="nudge-btn" onclick={() => nudgeZ(NUDGE_STEP)}>+</button>
        </div>
      </div>

      <div class="control-row">
        <label class="control-label">Facing</label>
        <div class="nudge-group">
          <button type="button" class="nudge-btn" onclick={() => nudgeFacing(-Math.PI / 8)}>↶</button>
          <span class="nudge-value">{((selectedPerformer.facingAngle * 180) / Math.PI).toFixed(0)}°</span>
          <button type="button" class="nudge-btn" onclick={() => nudgeFacing(Math.PI / 8)}>↷</button>
        </div>
      </div>

      {#if count > 1}
        <button type="button" class="remove-btn" onclick={handleRemove}>
          Remove Performer
        </button>
      {/if}
    </section>
  {:else}
    <section class="all-section">
      <p class="scope-hint">
        All performers selected. Pick a single performer above to edit their position,
        facing, or remove them.
      </p>
    </section>
  {/if}
</div>

<style>
  .performer-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
  }

  .section-title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.6);
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .control-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.82);
  }

  .nudge-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .nudge-btn {
    width: 26px;
    height: 26px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 14px;
  }

  .nudge-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .nudge-value {
    min-width: 56px;
    text-align: center;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.95);
  }

  .remove-btn {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.45);
    background: rgba(239, 68, 68, 0.12);
    color: rgba(255, 180, 180, 0.95);
    cursor: pointer;
    font-size: 13px;
  }

  .remove-btn:hover {
    background: rgba(239, 68, 68, 0.22);
  }

  .scope-hint {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.4;
  }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerTab.svelte src/lib/shared/3d/components/controls/FormationSelector.svelte
git commit -m "feat(3d-viewer): PerformerTab + FormationSelector disabledPresets prop"
```

---

## Task 11: Mount chip strip and swap Avatar tab for Performers tab in `Viewer3DGearPopover.svelte`

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`

- [ ] **Step 1: Import the new components and keyboard handler**

Edit `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`. Add near the existing imports:
```ts
  import PerformerChipStrip from "./controls/PerformerChipStrip.svelte";
  import PerformerTab from "./controls/PerformerTab.svelte";
  import { createViewer3DKeyboardHandler } from "../keyboard/Viewer3DKeyboardHandler";
  import { onMount } from "svelte";
```

- [ ] **Step 2: Wire up the keyboard handler on mount**

Inside the `<script>` block, add after the existing state declarations:
```ts
  onMount(() => {
    return createViewer3DKeyboardHandler({
      undo: () => viewer3DState.undo(),
      redo: () => viewer3DState.redo(),
    });
  });
```

- [ ] **Step 3: Rename the Avatar tab to Performers and enable it**

Locate:
```ts
  type TabId = "camera" | "planes" | "avatar" | "effects";

  const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: "camera", label: "Camera" },
    { id: "planes", label: "Planes" },
    { id: "avatar", label: "Avatar", disabled: true },
    { id: "effects", label: "Effects", disabled: true },
  ];
```
Replace with:
```ts
  type TabId = "camera" | "planes" | "performers" | "effects";

  const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: "camera", label: "Camera" },
    { id: "planes", label: "Planes" },
    { id: "performers", label: "Performers" },
    { id: "effects", label: "Effects", disabled: true },
  ];
```

- [ ] **Step 4: Mount `PerformerChipStrip` above the tab bar**

In the component template, find the element that renders the tab bar. Immediately before it, add:
```svelte
<PerformerChipStrip />
```

- [ ] **Step 5: Render the Performers tab contents**

Find the tab content switch (wherever each tab's body is rendered by `activeTab`). Add a branch:
```svelte
{#if activeTab === "performers"}
  <PerformerTab />
{/if}
```
If the file uses a different pattern (e.g., `{:else if activeTab === "..."}`), match it. Remove the old `"avatar"` branch entirely since the TabId no longer includes `"avatar"`.

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: No errors. The `activeTab` state variable's initial value may still be `"camera"`, which is still in the union — no change required unless the file explicitly used `"avatar"` anywhere else.

- [ ] **Step 7: Smoke test in the browser**

Navigate to the sequence viewer, enter 3D mode, and open the gear popover. Verify:
- The chip strip is hidden (only one performer by default)
- The "Performers" tab is enabled and shows the formation dropdown + an "All" hint
- Clicking the "+" spawn path from the Performers tab (or wherever it lives in your FormationSelector/PerformerTab layout) spawns a second performer
- Once two performers exist, the chip strip appears with `[All] · [1] [2] [+]`
- Clicking "[1]" selects performer 1, clicking "[All]" returns to All
- Picking a formation like `side-by-side` animates the performers into the formation
- Ctrl+Z undoes the formation change; Ctrl+Shift+Z redoes it

Screenshot via Chrome DevTools MCP and confirm. If MCP is unavailable, tell the user explicitly what to click and what to observe.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "feat(3d-viewer): mount PerformerChipStrip + Performers tab + Ctrl+Z binding"
```

---

## Task 12: Click-in-scene raycasting + ground-disc indicator in `Viewer3DScene.svelte`

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

- [ ] **Step 1: Read the current scene file**

Open `src/lib/shared/3d/components/Viewer3DScene.svelte` and note how it iterates (or does not iterate) the performer array, and how pointer events are currently handled. The goal is to add a raycaster that tests only performer body meshes.

- [ ] **Step 2: Add raycasting state**

Inside the `<script>` block, add:
```ts
  import { Raycaster, Vector2 } from "three";
  import type { Object3D, Scene } from "three";
  import { useThrelte } from "@threlte/core";

  const { camera, renderer, scene } = useThrelte();

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  /**
   * Convert a DOM pointer event into normalized device coordinates (-1..1).
   */
  function setPointerFromEvent(e: PointerEvent): void {
    if (!renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Walk up the parent chain of a hit object looking for a node whose
   * userData.performerIndex is set. Returns the index or null.
   */
  function findPerformerIndexFromHit(obj: Object3D | null): number | null {
    let cur: Object3D | null = obj;
    while (cur) {
      const idx = cur.userData?.performerIndex;
      if (typeof idx === "number") return idx;
      cur = cur.parent;
    }
    return null;
  }

  /**
   * Hit-test everything in the scene, then walk up the hit chain looking
   * for a parent Group tagged with userData.performerIndex. Returns the
   * performer index that was hit, or null for empty space / non-performer hits.
   */
  function hitTestPerformers(e: PointerEvent): number | null {
    if (!camera.current) return null;
    const sceneRoot: Scene | null = scene.current ?? null;
    if (!sceneRoot) return null;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera.current);
    const hits = raycaster.intersectObjects(sceneRoot.children, true);

    for (const hit of hits) {
      const idx = findPerformerIndexFromHit(hit.object);
      if (idx !== null) return idx;
    }
    return null;
  }
```

- [ ] **Step 3: Attach a pointerdown listener on the Canvas container**

The `<Canvas>` is in `Viewer3DCanvas.svelte`, not `Viewer3DScene.svelte`. The raycaster needs access to the rendered DOM canvas and the active camera. Inside `Viewer3DScene.svelte` (which runs inside the Threlte Canvas context), use `useThrelte()` to grab `renderer` and `camera`, then attach a DOM listener on the renderer's canvas element in an `$effect`:

```ts
  $effect(() => {
    if (!renderer) return;
    const dom = renderer.domElement;

    function onPointerDown(e: PointerEvent): void {
      // Suppress selection while the user is orbiting the camera.
      if (viewer3DState.isCameraDragging) return;
      const idx = hitTestPerformers(e);
      viewer3DState.selectPerformerScope(idx);
    }

    dom.addEventListener("pointerdown", onPointerDown);
    return () => dom.removeEventListener("pointerdown", onPointerDown);
  });
```

Where `viewer3DState` is the existing context import. If `Viewer3DScene.svelte` doesn't already `getViewer3DContext()`, add:
```ts
  import { getViewer3DContext } from "../context/viewer-3d-context";
  const viewer3DState = getViewer3DContext();
```

- [ ] **Step 4: Track orbit-drag state via a shared flag on `viewer-3d-state.svelte.ts`**

The raycaster should not fire during camera rotation. Add a shared reactive flag.

In `viewer-3d-state.svelte.ts`, add near the other `$state` declarations:
```ts
  let isCameraDragging = $state(false);
```
And expose it plus a setter in the `return { ... }` block:
```ts
    get isCameraDragging() { return isCameraDragging; },
    setCameraDragging(value: boolean) { isCameraDragging = value; },
```

In `Viewer3DCamera.svelte`, find the `OrbitControls` component mount and add its `start` / `end` handlers:
```svelte
<OrbitControls
  onstart={() => viewer3DState.setCameraDragging(true)}
  onend={() => viewer3DState.setCameraDragging(false)}
/>
```
(If `viewer3DState` isn't already imported in `Viewer3DCamera.svelte`, add `import { getViewer3DContext } from "../context/viewer-3d-context"; const viewer3DState = getViewer3DContext();` to the script block.)

- [ ] **Step 5: Iterate performers in the scene render block**

In the template section of `Viewer3DScene.svelte`, find where the single avatar is currently rendered (likely `<Avatar3D avatarState={avatarState} />` or similar). Replace that single render with an iteration over `performerManager.performers`. Each performer gets its own `<T.Group>` tagged with `userData.performerIndex = i` so the raycaster can resolve hits back to an index:

```svelte
{#each performerManager.performers as performer, i (performer.id)}
  <T.Group userData={{ performerIndex: i }}>
    <Avatar3D avatarState={performer} />
    {#if viewer3DState.selectedPerformerIndex === i || viewer3DState.selectedPerformerIndex === null}
      <!-- Temporary placeholder ground disc for selected performer(s).
           Visual indicator design is deferred to a follow-up spec. -->
      <T.Mesh position={[performer.position.x, 0.01, performer.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <T.CircleGeometry args={[0.45, 32]} />
        <T.MeshBasicMaterial
          color={viewer3DState.selectedPerformerIndex === null ? 0x6b7280 : 0x8b8bff}
          transparent
          opacity={0.35}
        />
      </T.Mesh>
    {/if}
  </T.Group>
{/each}
```

Add a derived at the top of the script section for convenience:
```ts
  const performerManager = $derived(viewer3DState.performerManager);
```

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: No errors. If Threlte rejects `userData` as a prop on `<T.Group>`, use a `bind:ref` to the group and assign `group.userData.performerIndex = i` in an `$effect` instead.

- [ ] **Step 7: Smoke test**

In the browser, open the 3D viewer with two performers. Click each performer's body — the selection chip should highlight accordingly. Click empty space — selection should return to "All" (both ground discs visible, colored gray).

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte src/lib/shared/3d/components/Viewer3DCamera.svelte src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "feat(3d-viewer): raycasting performer selection + ground-disc indicator"
```

---

## Task 13: Persistence — save/load performer snapshots

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Add new storage keys and types**

Near the existing `STORAGE_KEY_*` constants at the top of the file, add:
```ts
const STORAGE_KEY_PERFORMERS = "tka-viewer3d-performers";
const STORAGE_KEY_ACTIVE_FORMATION = "tka-viewer3d-activeFormation";
const STORAGE_KEY_SELECTED_INDEX = "tka-viewer3d-selectedIndex";

interface StoredPerformerSnapshot {
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
}
```

- [ ] **Step 2: Write load/save helpers**

Add near the existing persistence helpers:
```ts
function loadPersistedPerformers(): StoredPerformerSnapshot[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERFORMERS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as StoredPerformerSnapshot[];
  } catch {
    return null;
  }
}

function persistPerformers(snapshots: StoredPerformerSnapshot[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PERFORMERS, JSON.stringify(snapshots));
  } catch {
    // Quota exceeded or unavailable
  }
}

function loadPersistedActiveFormation(): FormationPreset | "manual" | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_FORMATION);
    return raw as FormationPreset | "manual" | null;
  } catch {
    return null;
  }
}

function persistActiveFormation(value: FormationPreset | "manual"): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_FORMATION, value);
  } catch {
    // Quota exceeded or unavailable
  }
}

function loadPersistedSelectedIndex(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELECTED_INDEX);
    if (raw === null || raw === "null") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function persistSelectedIndex(value: number | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SELECTED_INDEX, value === null ? "null" : String(value));
  } catch {
    // Quota exceeded or unavailable
  }
}
```

- [ ] **Step 3: Migrate the legacy `tka-viewer3d-visiblePlanes` key at load time**

Still in `viewer-3d-state.svelte.ts`, add a one-time migration helper:
```ts
/**
 * One-time migration: if the old single-avatar visiblePlanes key exists and
 * the new per-performer key does not, construct a single-performer snapshot
 * from the old data and save it to the new key. Delete the old key.
 */
function migrateLegacyPlanesIfNeeded(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const hasNew = localStorage.getItem(STORAGE_KEY_PERFORMERS);
    if (hasNew) return;
    const hasOld = localStorage.getItem(STORAGE_KEY_VISIBLE_PLANES);
    if (!hasOld) return;

    const planes = JSON.parse(hasOld) as Plane[];
    const blue = planes[0] ?? Plane.WALL;
    const red = planes[1] ?? blue;
    const snapshots: StoredPerformerSnapshot[] = [
      {
        position: { x: 0, z: 0 },
        facingAngle: 0,
        customBluePlane: blue,
        customRedPlane: red,
      },
    ];
    localStorage.setItem(STORAGE_KEY_PERFORMERS, JSON.stringify(snapshots));
    localStorage.removeItem(STORAGE_KEY_VISIBLE_PLANES);
  } catch {
    // Migration is best-effort; fall back to fresh state on any failure.
  }
}
```

- [ ] **Step 4: Wire the migration and loading into `enter3D`**

Replace `enter3D` with:
```ts
  function enter3D(sequenceData: SequenceData) {
    if (!_webgl2Available) return;

    // One-time migration of the deprecated visiblePlanes key.
    migrateLegacyPlanesIfNeeded();

    // Initialize if this is the first entry.
    if (performerManager.performers.length === 0) {
      performerManager.initialize();
    }

    // Restore persisted performers, if any. Each additional snapshot beyond
    // the first one spawns a new performer via the manager.
    const persisted = loadPersistedPerformers();
    if (persisted && persisted.length > 0) {
      while (performerManager.performers.length < persisted.length) {
        performerManager.addPerformer();
      }
      persisted.forEach((snap, i) => {
        const p = performerManager.performers[i];
        if (!p) return;
        p.position.x = snap.position.x;
        p.position.z = snap.position.z;
        p.setFacingAngle(snap.facingAngle);
        p.setHandPlane("blue", snap.customBluePlane);
        p.setHandPlane("red", snap.customRedPlane);
      });
    }

    // Load sequence onto every restored performer (they all share the same
    // source sequence in v1).
    for (const p of performerManager.performers) {
      p.loadSequence(sequenceData);
    }

    // Restore viewer-level state.
    const savedFormation = loadPersistedActiveFormation();
    if (savedFormation) activeFormation = savedFormation;
    const savedSelection = loadPersistedSelectedIndex();
    selectedPerformerIndex = savedSelection;

    renderMode = "3d";
    persistMode("3d");
  }
```

- [ ] **Step 5: Add an effect that persists whenever relevant state changes**

After the existing effect that auto-adds planes, add:
```ts
  // Persistence effect — serialize the performer array whenever it changes.
  // Rune-tracked: the effect re-runs on any performer count change, any
  // position.x / position.z write, any facingAngle change, or any hand plane
  // reassignment.
  $effect(() => {
    const snapshots: StoredPerformerSnapshot[] = performerManager.performers.map((p) => ({
      position: { x: p.position.x, z: p.position.z },
      facingAngle: p.facingAngle,
      customBluePlane: p.customBluePlane,
      customRedPlane: p.customRedPlane,
    }));
    persistPerformers(snapshots);
  });

  // Persist active formation and selection.
  $effect(() => {
    persistActiveFormation(activeFormation);
  });
  $effect(() => {
    persistSelectedIndex(selectedPerformerIndex);
  });
```

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "feat(3d-viewer): persist performer array + migrate legacy visiblePlanes key"
```

---

## Task 14: Remove the `avatarState` shim + integration test

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` (any remaining `avatarState` reads)
- Create: `tests/unit/3d-viewer/viewer3d-integration.test.ts`

- [ ] **Step 1: Find every remaining `avatarState` consumer**

Grep for `viewer3DState.avatarState` and `viewer3DState?.avatarState` across `src/`. Expected call sites: `Viewer3DCanvas.svelte`, `Viewer3DGearPopover.svelte`, possibly `Viewer3DCornerIcon.svelte` or `Viewer3DEffectPills.svelte`. List each.

- [ ] **Step 2: Migrate `Viewer3DCanvas.svelte`**

In `Viewer3DCanvas.svelte`, replace:
```ts
  const avatarState = $derived(viewer3DState.avatarState);
```
with:
```ts
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);
```
This preserves the "gate the Canvas on performer 0 existing" semantics without going through the deprecated shim.

- [ ] **Step 3: Migrate `Viewer3DGearPopover.svelte`**

In `Viewer3DGearPopover.svelte`, replace:
```ts
  const avatarState = $derived(viewer3DState.avatarState);
```
with:
```ts
  // Reads performer 0 for now. When the Planes tab supports per-performer
  // scope (follow-up), this switches to reading scopedPerformers()[0].
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);
```

Also replace any `avatarState.setHandPlane(...)` call sites with:
```ts
  viewer3DState.setHandPlaneScoped(hand, plane);
```
so plane edits respect the current selection scope.

- [ ] **Step 4: Migrate any remaining callers**

For every other file the grep found, replace `viewer3DState.avatarState` reads with either:
- `viewer3DState.performerManager.performers[0] ?? null` — if the caller needs the primary performer, or
- iteration over `viewer3DState.performerManager.performers` — if the caller should act on all performers.

Judgment call per file. Err toward `performers[0]` for read-only uses and iteration for mutations.

- [ ] **Step 5: Delete the shim**

In `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`, remove the `getAvatarStateShim` function and the deprecated getter:
```ts
    /** @deprecated transitional — use `performerManager.performers[i]` instead. Removed in Task 14. */
    get avatarState() {
      return getAvatarStateShim();
    },
```
Delete both the function and the getter. Keep the `performerManager` getter.

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: No errors. Any missed call site surfaces here as a "property 'avatarState' does not exist" error — fix it in place and re-run.

- [ ] **Step 7: Write the integration test**

Create `tests/unit/3d-viewer/viewer3d-integration.test.ts` with:
```ts
import { describe, it, expect, vi } from "vitest";
import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { Viewer3DUndoManager } from "$lib/shared/3d/services/implementations/Viewer3DUndoManager";
import type { IPropStateInterpolator } from "$lib/shared/3d/services/contracts/IPropStateInterpolator";
import type { ISequenceConverter } from "$lib/shared/3d/services/contracts/ISequenceConverter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

function stubDeps() {
  return {
    propInterpolator: {
      interpolate: vi.fn(),
    } as unknown as IPropStateInterpolator,
    sequenceConverter: {
      convertSequence: vi.fn().mockReturnValue([]),
    } as unknown as ISequenceConverter,
    viewer3DUndoManager: new Viewer3DUndoManager(),
  };
}

const EMPTY_SEQUENCE: SequenceData = {
  id: "test-seq",
  word: "TEST",
  steps: [],
  ownerId: "test",
} as unknown as SequenceData;

describe("viewer3d integration: spawn → formation → undo", () => {
  it("spawns 3 performers, applies tunnel-stack, then v-shape, undoes both", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    state.performerManager.performers[0]?.loadSequence(EMPTY_SEQUENCE);

    // Spawn two more performers → total 3.
    state.spawnPerformerFromUI();
    state.spawnPerformerFromUI();
    expect(state.performerManager.performers.length).toBe(3);

    // Record the post-spawn positions (these are the default spawn positions).
    const postSpawnPositions = state.performerManager.performers.map((p) => ({
      x: p.position.x,
      z: p.position.z,
    }));

    // Apply tunnel-stack.
    state.applyFormationFromUI("tunnel-stack");
    expect(state.activeFormation).toBe("tunnel-stack");

    // Apply v-shape (valid for count=3).
    state.applyFormationFromUI("v-shape");
    expect(state.activeFormation).toBe("v-shape");

    // Undo twice → back to post-spawn default positions.
    state.undo(); // undo v-shape
    expect(state.activeFormation).toBe("tunnel-stack");
    state.undo(); // undo tunnel-stack
    expect(state.activeFormation).toBe("manual");

    // Positions should match the post-spawn defaults.
    state.performerManager.performers.forEach((p, i) => {
      expect(p.position.x).toBeCloseTo(postSpawnPositions[i]!.x, 5);
      expect(p.position.z).toBeCloseTo(postSpawnPositions[i]!.z, 5);
    });
  });

  it("caps performers at MAX_VIEWER_PERFORMERS (8)", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    for (let i = 0; i < 10; i++) {
      state.spawnPerformerFromUI();
    }
    expect(state.performerManager.performers.length).toBe(8);
  });

  it("silently ignores formation presets that don't match the current count", () => {
    const state = createViewer3DState(stubDeps());
    state.performerManager.initialize();
    // Count is 1. 'stage-lr' requires 2 performers.
    state.applyFormationFromUI("stage-lr");
    expect(state.activeFormation).toBe("manual");
    expect(state.canUndo).toBe(false);
  });
});
```

- [ ] **Step 8: Run the integration test**

Run: `npm test -- tests/unit/3d-viewer/viewer3d-integration.test.ts`
Expected: PASS — all three tests green. If the post-spawn position assertions fail, the most likely cause is that `PerformerManager.addPerformer()` re-centers every performer via `updatePositions()` on each spawn — in which case the test captures positions *after* the last spawn, which is still correct. If positions drift between spawns due to formation manager recomputation, adjust the test to capture `postSpawnPositions` after the last `spawnPerformerFromUI` call but before the formation applications (which is what Step 7's code already does).

- [ ] **Step 9: Run the full 3d-viewer test suite**

Run: `npm test -- tests/unit/3d-viewer/`
Expected: PASS — all four test files (`formation-presets`, `viewer3d-scope`, `viewer3d-undo-manager`, `viewer3d-integration`) green.

- [ ] **Step 10: Full smoke test in the browser**

Load the sequence viewer, enter 3D, open the gear popover. Verify the entire flow end-to-end:
1. Spawn two performers via the "+" chip → chip strip shows `[All] · [1] [2] [+]`
2. Pick `back-to-back` from the Performers tab → performers animate into place
3. Select performer 2 via chip → ground disc highlights it
4. Nudge its X position via the numeric controls → edit records to undo stack
5. Ctrl+Z → formation reverts to default (or previous formation)
6. Ctrl+Z → spatial edit undone
7. Reload the page → performers restore from localStorage

If DevTools MCP is available, screenshot each step. If not, write the instructions verbatim and ask the user to perform them.

- [ ] **Step 11: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/shared/3d/components/Viewer3DCanvas.svelte src/lib/shared/3d/components/Viewer3DGearPopover.svelte tests/unit/3d-viewer/viewer3d-integration.test.ts
git commit -m "feat(3d-viewer): remove avatarState shim + add end-to-end integration test"
```

(Add any additional modified files from Step 4's grep to the `git add` line.)

---

## Final Verification

After Task 14 is committed:

- [ ] Run the complete test suite: `npm test`
- [ ] Run type-check: `npm run check`
- [ ] Confirm realm, museum, and duet features still work by opening each and smoke-testing:
  - Realm: world scene still renders with its default performer count
  - Museum: museum scene still renders
  - Duet: duet orchestrator still loads two performers from its persister

None of these features should be affected because `PerformerManager`'s default behavior (no `maxPerformers` dep) is unchanged and the existing `addPerformer`/`removePerformer`/`transitionToFormation` APIs were not touched.

- [ ] Review the git log: `git log --oneline main..HEAD` should show 10-12 clean commits, one per task (some tasks were folded together).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-11-multi-avatar-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
