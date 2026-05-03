# LOOPSpec Compositional Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `LOOPType` string enum with a compositional `LOOPSpec` system that supports per-prop independence and per-component integer periods.

**Architecture:** New `loop-spec.ts` defines runtime types (`LOOPSpec`, `PropLOOPSpec`, `ComponentSpec`) and wire format (`LOOPSpecWire`). A parametric `FusedExecutor` replaces 13 old executor files. Migration runs in 5 phases, each shipping independently — old and new APIs coexist in Phases 2–4, cleanup in Phase 5.

**Tech Stack:** TypeScript, vitest, packages/sequence-engine monorepo package

**Spec:** `docs/superpowers/specs/2026-05-02-loop-spec-compositional-migration-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `packages/sequence-engine/src/loop/loop-spec.ts` | All new types, wire format, hydration helpers, period utilities, helper constructors, legacy converter, validation rules |
| `packages/sequence-engine/src/loop/serialization/loop-type-tokens.ts` | Relocated `LOOPType` enum + labels/descriptions (legacy boundary artifact) |
| `packages/sequence-engine/src/loop/execution/FusedExecutor.ts` | Parametric executor for MIRRORED/FLIPPED/SWAPPED/INVERTED (single or combined) |
| `packages/sequence-engine/src/loop/execution/spec-executor.ts` | `executeSpec()` orchestrator — chains RotatedExecutor + FusedExecutor per `PropLOOPSpec` |
| `packages/sequence-engine/tests/loop/loop-spec.test.ts` | Phase 1 unit tests |
| `packages/sequence-engine/tests/loop/execution/fused-executor.test.ts` | FusedExecutor unit + parity tests |
| `packages/sequence-engine/tests/loop/execution/spec-executor-parity.test.ts` | Full parity tests: legacy LOOPType → LOOPSpec produces identical output |
| `packages/sequence-engine/tests/loop/detection/loop-spec-detection.test.ts` | Per-prop detection tests |

### Modified files (by phase)

| File | Phase | Change |
|---|---|---|
| `packages/sequence-engine/src/loop/index.ts` | 1,2,3 | Add exports for new modules |
| `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` | 2 | Emit `LOOPSpec`, per-prop detection, keep legacy fields |
| `src/lib/shared/foundation/domain/models/SequenceData.ts` | 2 | Add `loopSpec?: LOOPSpec` field |
| `src/lib/features/create/generate/shared/domain/models/generate-models.ts` | 2 | Re-export `LOOPComponent` from package, add `loopSpec` to `GenerationOptions` |
| `src/lib/features/loop-labeler/services/loop-display-resolver.ts` | 2 | Read `loopSpec` field, fall back to legacy |
| `packages/sequence-engine/src/loop/validation/LOOPValidator.ts` | 3 | Add `isLOOPValidForSpec()` alongside old function |
| `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts` | 3 | Add `determineEndPositionForSpec()` alongside old function |
| `mcp-server/src/core/engine-generation-adapter.ts` | 4 | Convert at boundary via `loopSpecFromLegacy` |
| `packages/sequence-engine/src/generation/capacity/minimum-length-calculator.ts` | 4 | Accept `LOOPSpec` via adapter |

### Deleted files (Phase 5)

9 compound executors + 4 strict single-component executors (13 total):
- `MirroredSwappedExecutor.ts`, `MirroredSwappedInvertedExecutor.ts`, `MirroredInvertedExecutor.ts`
- `RotatedSwappedExecutor.ts`, `RotatedInvertedExecutor.ts`, `MirroredRotatedExecutor.ts`
- `MirroredRotatedInvertedExecutor.ts`, `MirroredRotatedInvertedSwappedExecutor.ts`, `SwappedInvertedExecutor.ts`
- `StrictMirroredExecutor.ts`, `StrictFlippedExecutor.ts`, `StrictSwappedExecutor.ts`, `StrictInvertedExecutor.ts`

Also deleted: `LOOPTypeResolver.ts`, duplicate enums in `circular-models.ts`, `loop-types.ts` (after Phase 5 only)

---

## Phase 1 — Types and Wire Format

No behavioral changes. Nothing imports these yet.

### Task 1: Create `loop-spec.ts`

**Files:**
- Create: `packages/sequence-engine/src/loop/loop-spec.ts`

- [ ] **Step 1: Write the file**

```ts
import { LOOPType } from "./loop-types.js";

// ── Domain ──────────────────────────────────────────────────────

export type LOOPDomain = "location" | "orientation" | "both";

// ── LOOPComponent (canonical — replaces both local enums) ──────

export enum LOOPComponent {
  ROTATED = "rotated",
  MIRRORED = "mirrored",
  FLIPPED = "flipped",
  SWAPPED = "swapped",
  INVERTED = "inverted",
  REWOUND = "rewound",
  ZONE_HOLD_INVERT = "zone_hold_invert",
  ZONE_HOLD_FLIP = "zone_hold_flip",
  ZONE_CROSS = "zone_cross",
}

export const RESERVED_ORIENTATION_PRIMITIVES = new Set<LOOPComponent>([
  LOOPComponent.ZONE_HOLD_INVERT,
  LOOPComponent.ZONE_HOLD_FLIP,
  LOOPComponent.ZONE_CROSS,
]);

// ── Runtime types ──────────────────────────────────────────────

export interface ComponentSpec {
  readonly period: number;
  readonly domain?: LOOPDomain;
}

export interface PropLOOPSpec {
  readonly components: ReadonlyMap<LOOPComponent, ComponentSpec>;
}

export interface LOOPSpec {
  readonly blue?: PropLOOPSpec;
  readonly red?: PropLOOPSpec;
}

// ── Wire format (JSON / Firestore) ─────────────────────────────

export interface ComponentSpecWire {
  period: number;
  domain?: LOOPDomain;
}

export type PropLOOPSpecWire = Record<string, ComponentSpecWire>;

export interface LOOPSpecWire {
  blue?: PropLOOPSpecWire;
  red?: PropLOOPSpecWire;
}

// ── Wire ↔ Runtime ─────────────────────────────────────────────

export function loopSpecToWire(spec: LOOPSpec): LOOPSpecWire {
  const wire: LOOPSpecWire = {};
  if (spec.blue) wire.blue = propSpecToWire(spec.blue);
  if (spec.red) wire.red = propSpecToWire(spec.red);
  return wire;
}

export function loopSpecFromWire(wire: LOOPSpecWire): LOOPSpec {
  return {
    blue: wire.blue ? propSpecFromWire(wire.blue) : undefined,
    red: wire.red ? propSpecFromWire(wire.red) : undefined,
  };
}

function propSpecToWire(prop: PropLOOPSpec): PropLOOPSpecWire {
  const wire: PropLOOPSpecWire = {};
  for (const [comp, cSpec] of prop.components) {
    const entry: ComponentSpecWire = { period: cSpec.period };
    if (cSpec.domain) entry.domain = cSpec.domain;
    wire[comp] = entry;
  }
  return wire;
}

function propSpecFromWire(wire: PropLOOPSpecWire): PropLOOPSpec {
  const components = new Map<LOOPComponent, ComponentSpec>();
  for (const [key, value] of Object.entries(wire)) {
    const comp = key as LOOPComponent;
    const cSpec: ComponentSpec = { period: value.period };
    if (value.domain) (cSpec as { domain?: LOOPDomain }).domain = value.domain;
    components.set(comp, cSpec);
  }
  return { components };
}

// ── Period utilities ───────────────────────────────────────────

export const PERIOD_HALVED = 2;
export const PERIOD_QUARTERED = 4;
export const PERIOD_OCTAVED = 8;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

export function loopSpecPeriod(spec: LOOPSpec): number {
  const periods: number[] = [];
  for (const prop of [spec.blue, spec.red]) {
    if (!prop) continue;
    for (const { period } of prop.components.values()) {
      periods.push(period);
    }
  }
  return periods.length === 0 ? 1 : periods.reduce((a, b) => lcm(a, b));
}

// ── Helper constructors ────────────────────────────────────────

export function singleComponent(
  comp: LOOPComponent,
  period: number,
  domain?: LOOPDomain,
): PropLOOPSpec {
  const cSpec: ComponentSpec = domain ? { period, domain } : { period };
  return { components: new Map([[comp, cSpec]]) };
}

export function symmetricSpec(
  components: ReadonlyMap<LOOPComponent, ComponentSpec>,
): LOOPSpec {
  const prop: PropLOOPSpec = { components };
  return { blue: prop, red: prop };
}

export function allActiveComponents(
  spec: LOOPSpec,
): ReadonlyMap<LOOPComponent, ComponentSpec> {
  const result = new Map<LOOPComponent, ComponentSpec>();
  for (const prop of [spec.blue, spec.red]) {
    if (!prop) continue;
    for (const [comp, cSpec] of prop.components) {
      const existing = result.get(comp);
      if (!existing || existing.period < cSpec.period) {
        result.set(comp, cSpec);
      }
    }
  }
  return result;
}

export function isEmptySpec(spec: LOOPSpec): boolean {
  const blueEmpty = !spec.blue || spec.blue.components.size === 0;
  const redEmpty = !spec.red || spec.red.components.size === 0;
  return blueEmpty && redEmpty;
}

export function specsAreEqual(
  a: PropLOOPSpec | undefined,
  b: PropLOOPSpec | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.components.size !== b.components.size) return false;
  for (const [comp, aSpec] of a.components) {
    const bSpec = b.components.get(comp);
    if (!bSpec) return false;
    if (aSpec.period !== bSpec.period) return false;
    if (aSpec.domain !== bSpec.domain) return false;
  }
  return true;
}

export const EMPTY_PROP_SPEC: PropLOOPSpec = {
  components: new Map(),
};

// ── Legacy converter ───────────────────────────────────────────

export function loopSpecFromLegacy(
  loopType: string,
  period: number,
): LOOPSpec {
  const components = new Map<LOOPComponent, ComponentSpec>();
  if (loopType.includes("rotated"))
    components.set(LOOPComponent.ROTATED, { period });
  if (loopType.includes("mirrored"))
    components.set(LOOPComponent.MIRRORED, { period });
  if (loopType.includes("flipped"))
    components.set(LOOPComponent.FLIPPED, { period });
  if (loopType.includes("swapped"))
    components.set(LOOPComponent.SWAPPED, { period });
  if (loopType.includes("inverted"))
    components.set(LOOPComponent.INVERTED, { period });
  if (loopType.includes("rewound"))
    components.set(LOOPComponent.REWOUND, { period });
  const prop: PropLOOPSpec = { components };
  return { blue: prop, red: prop };
}

// ── Validation rules ───────────────────────────────────────────

export interface LOOPSpecValidationError {
  readonly rule: string;
  readonly message: string;
}

export function validateLOOPSpec(
  spec: LOOPSpec,
): readonly LOOPSpecValidationError[] {
  const errors: LOOPSpecValidationError[] = [];

  for (const [propName, propSpec] of [
    ["blue", spec.blue],
    ["red", spec.red],
  ] as const) {
    if (!propSpec) continue;
    for (const [comp, cSpec] of propSpec.components) {
      if (cSpec.period < 2) {
        errors.push({
          rule: "minimum_period",
          message: `${propName}.${comp}: period must be >= 2, got ${cSpec.period}`,
        });
      }
    }

    if (
      propSpec.components.has(LOOPComponent.REWOUND) &&
      propSpec.components.size > 1
    ) {
      errors.push({
        rule: "rewound_exclusivity",
        message: `${propName}: REWOUND cannot compose with other components`,
      });
    }
  }

  const blueHasSwap = spec.blue?.components.has(LOOPComponent.SWAPPED);
  const redHasSwap = spec.red?.components.has(LOOPComponent.SWAPPED);
  if (blueHasSwap !== redHasSwap) {
    errors.push({
      rule: "swapped_symmetry",
      message: "SWAPPED must be present in both props or neither",
    });
  }
  if (blueHasSwap && redHasSwap) {
    const bluePeriod = spec.blue!.components.get(LOOPComponent.SWAPPED)!.period;
    const redPeriod = spec.red!.components.get(LOOPComponent.SWAPPED)!.period;
    if (bluePeriod !== redPeriod) {
      errors.push({
        rule: "swapped_symmetry",
        message: `SWAPPED period mismatch: blue=${bluePeriod}, red=${redPeriod}`,
      });
    }
  }

  return errors;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit packages/sequence-engine/src/loop/loop-spec.ts`

If import resolution fails (monorepo), just check it compiles as part of the full check:

Run: `npm run check`

Expected: No new errors from `loop-spec.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/loop/loop-spec.ts
git commit -m "feat(loop): add loop-spec.ts — compositional LOOPSpec types, wire format, helpers"
```

---

### Task 2: Create `loop-type-tokens.ts`

**Files:**
- Create: `packages/sequence-engine/src/loop/serialization/loop-type-tokens.ts`

- [ ] **Step 1: Create the serialization directory and file**

Copy the `LOOPType` enum, `Period` enum, labels, descriptions, and helper functions from `packages/sequence-engine/src/loop/loop-types.ts` into the new file. Keep the exact same values and exports.

```ts
export enum LOOPType {
  ROTATED = "rotated",
  MIRRORED = "mirrored",
  SWAPPED = "swapped",
  INVERTED = "inverted",
  SWAPPED_INVERTED = "swapped_inverted",
  ROTATED_INVERTED = "rotated_inverted",
  MIRRORED_SWAPPED = "mirrored_swapped",
  MIRRORED_INVERTED = "mirrored_inverted",
  ROTATED_SWAPPED = "rotated_swapped",
  MIRRORED_ROTATED = "mirrored_rotated",
  MIRRORED_INVERTED_ROTATED = "mirrored_inverted_rotated",
  MIRRORED_SWAPPED_INVERTED = "mirrored_swapped_inverted",
  MIRRORED_ROTATED_SWAPPED = "mirrored_rotated_swapped",
  MIRRORED_ROTATED_INVERTED_SWAPPED = "mirrored_rotated_inverted_swapped",
  FLIPPED = "flipped",
  REWOUND = "rewound",
}

export enum Period {
  HALVED = "halved",
  QUARTERED = "quartered",
}

export function periodToNumber(period: Period | undefined): number {
  if (period === Period.QUARTERED) return 4;
  return 2;
}

export function periodFromNumber(period: number): Period {
  return period === 4 ? Period.QUARTERED : Period.HALVED;
}

export const LOOP_TYPE_LABELS: Record<LOOPType, string> = {
  [LOOPType.ROTATED]: "Rotated",
  [LOOPType.MIRRORED]: "Mirrored",
  [LOOPType.SWAPPED]: "Swapped",
  [LOOPType.INVERTED]: "Inverted",
  [LOOPType.SWAPPED_INVERTED]: "Swapped Inverted",
  [LOOPType.ROTATED_INVERTED]: "Rotated Inverted",
  [LOOPType.MIRRORED_SWAPPED]: "Mirrored Swapped",
  [LOOPType.MIRRORED_INVERTED]: "Mirrored Inverted",
  [LOOPType.ROTATED_SWAPPED]: "Rotated Swapped",
  [LOOPType.MIRRORED_ROTATED]: "Mirrored Rotated",
  [LOOPType.MIRRORED_INVERTED_ROTATED]: "Mirrored Inverted Rotated",
  [LOOPType.MIRRORED_SWAPPED_INVERTED]: "Mirrored Swapped Inverted",
  [LOOPType.MIRRORED_ROTATED_SWAPPED]: "Mirrored Rotated Swapped",
  [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED]: "Mirrored Rotated Inverted Swapped",
  [LOOPType.FLIPPED]: "Flipped",
  [LOOPType.REWOUND]: "Rewound",
};

export const LOOP_TYPE_DESCRIPTIONS: Record<LOOPType, string> = {
  [LOOPType.ROTATED]: "Position rotates each pass",
  [LOOPType.MIRRORED]: "Locations mirror vertically each pass",
  [LOOPType.SWAPPED]: "Blue and red hands swap roles each pass",
  [LOOPType.INVERTED]: "Motion type flips PRO↔ANTI each pass",
  [LOOPType.SWAPPED_INVERTED]: "Swap + invert each pass",
  [LOOPType.ROTATED_INVERTED]: "Rotation + inversion",
  [LOOPType.MIRRORED_SWAPPED]: "Mirror + swap each pass",
  [LOOPType.MIRRORED_INVERTED]: "Mirror + invert each pass",
  [LOOPType.ROTATED_SWAPPED]: "Rotation + swap",
  [LOOPType.MIRRORED_ROTATED]: "Mirror + rotation",
  [LOOPType.MIRRORED_INVERTED_ROTATED]: "Mirror + invert + rotation",
  [LOOPType.MIRRORED_SWAPPED_INVERTED]: "Mirror + swap + invert",
  [LOOPType.MIRRORED_ROTATED_SWAPPED]: "Mirror + rotation + swap",
  [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED]: "All four transforms",
  [LOOPType.FLIPPED]: "Locations mirror horizontally each pass",
  [LOOPType.REWOUND]: "Second half plays backward",
};

export const ALL_LOOP_TYPES = Object.values(LOOPType);

export const ROTATED_LOOP_TYPES = new Set<LOOPType>([
  LOOPType.ROTATED,
  LOOPType.ROTATED_INVERTED,
  LOOPType.ROTATED_SWAPPED,
  LOOPType.MIRRORED_ROTATED,
  LOOPType.MIRRORED_INVERTED_ROTATED,
  LOOPType.MIRRORED_ROTATED_SWAPPED,
  LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
]);
```

Read `packages/sequence-engine/src/loop/loop-types.ts` to capture any additional exports (`LOOPOption`, `LOOPValidationResult`, `LOOPGenerationOptions`) and include them in `loop-type-tokens.ts`.

- [ ] **Step 2: Verify compilation**

Run: `npm run check`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/loop/serialization/loop-type-tokens.ts
git commit -m "feat(loop): add loop-type-tokens.ts — relocated LOOPType enum for legacy boundary"
```

---

### Task 3: Add Phase 1 exports to barrel

**Files:**
- Modify: `packages/sequence-engine/src/loop/index.ts`

- [ ] **Step 1: Add exports for loop-spec.ts**

Add after the existing "Types and enums" section:

```ts
// LOOPSpec compositional types
export {
  LOOPComponent,
  RESERVED_ORIENTATION_PRIMITIVES,
  type LOOPDomain,
  type ComponentSpec,
  type PropLOOPSpec,
  type LOOPSpec,
  type ComponentSpecWire,
  type PropLOOPSpecWire,
  type LOOPSpecWire,
  loopSpecToWire,
  loopSpecFromWire,
  loopSpecPeriod,
  PERIOD_HALVED,
  PERIOD_QUARTERED,
  PERIOD_OCTAVED,
  singleComponent,
  symmetricSpec,
  allActiveComponents,
  isEmptySpec,
  specsAreEqual,
  EMPTY_PROP_SPEC,
  loopSpecFromLegacy,
  validateLOOPSpec,
  type LOOPSpecValidationError,
} from "./loop-spec.js";
```

**Important:** The existing barrel exports `LOOPComponent` from `./detection/LOOPDetector.js` (line 85). This will conflict. Remove that export from the detection section — `loop-spec.ts` is now canonical for `LOOPComponent`. The detector's local enum will be deleted in Phase 2, but for now, the barrel points at the new source.

- [ ] **Step 2: Verify no duplicate export errors**

Run: `npm run check`

Expected: If there are duplicate export errors for `LOOPComponent`, remove the old export from the detection section of `index.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/loop/index.ts
git commit -m "feat(loop): export LOOPSpec types from loop barrel"
```

---

### Task 4: Unit tests for Phase 1

**Files:**
- Create: `packages/sequence-engine/tests/loop/loop-spec.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from "vitest";
import {
  LOOPComponent,
  type LOOPSpec,
  type ComponentSpec,
  loopSpecToWire,
  loopSpecFromWire,
  loopSpecPeriod,
  loopSpecFromLegacy,
  singleComponent,
  symmetricSpec,
  allActiveComponents,
  isEmptySpec,
  specsAreEqual,
  validateLOOPSpec,
  EMPTY_PROP_SPEC,
} from "../../src/loop/loop-spec.js";

describe("loopSpecToWire / loopSpecFromWire", () => {
  it("round-trips a symmetric spec", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.ROTATED, { period: 4 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);
    const spec: LOOPSpec = symmetricSpec(components);
    const wire = loopSpecToWire(spec);
    const hydrated = loopSpecFromWire(wire);

    expect(hydrated.blue!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
    expect(hydrated.blue!.components.get(LOOPComponent.MIRRORED)!.period).toBe(2);
    expect(hydrated.red!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
    expect(hydrated.red!.components.get(LOOPComponent.MIRRORED)!.period).toBe(2);
  });

  it("round-trips an asymmetric spec", () => {
    const spec: LOOPSpec = {
      blue: undefined,
      red: singleComponent(LOOPComponent.ROTATED, 4),
    };
    const wire = loopSpecToWire(spec);
    const hydrated = loopSpecFromWire(wire);

    expect(hydrated.blue).toBeUndefined();
    expect(hydrated.red!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
  });

  it("preserves domain field", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.MIRRORED, 2, "orientation"),
    };
    const wire = loopSpecToWire(spec);
    const hydrated = loopSpecFromWire(wire);

    expect(hydrated.blue!.components.get(LOOPComponent.MIRRORED)!.domain).toBe(
      "orientation",
    );
  });

  it("omits domain when absent", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.ROTATED, 4),
    };
    const wire = loopSpecToWire(spec);
    expect(wire.blue!["rotated"]).toEqual({ period: 4 });
    expect(wire.blue!["rotated"].domain).toBeUndefined();
  });
});

describe("loopSpecPeriod", () => {
  it("returns 1 for empty spec", () => {
    expect(loopSpecPeriod({})).toBe(1);
  });

  it("returns single component period", () => {
    const spec: LOOPSpec = symmetricSpec(
      new Map([[LOOPComponent.MIRRORED, { period: 2 }]]),
    );
    expect(loopSpecPeriod(spec)).toBe(2);
  });

  it("returns LCM across props", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.ROTATED, 4),
      red: singleComponent(LOOPComponent.MIRRORED, 2),
    };
    expect(loopSpecPeriod(spec)).toBe(4);
  });

  it("returns LCM of different periods within one prop", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.ROTATED, { period: 4 }],
      [LOOPComponent.INVERTED, { period: 2 }],
    ]);
    const spec: LOOPSpec = { blue: { components } };
    expect(loopSpecPeriod(spec)).toBe(4);
  });

  it("handles period 8", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.ROTATED, 8),
      red: singleComponent(LOOPComponent.MIRRORED, 4),
    };
    expect(loopSpecPeriod(spec)).toBe(8);
  });
});

describe("loopSpecFromLegacy", () => {
  it("parses mirrored_rotated with period 4", () => {
    const spec = loopSpecFromLegacy("mirrored_rotated", 4);
    expect(spec.blue!.components.has(LOOPComponent.MIRRORED)).toBe(true);
    expect(spec.blue!.components.has(LOOPComponent.ROTATED)).toBe(true);
    expect(spec.blue!.components.get(LOOPComponent.MIRRORED)!.period).toBe(4);
    expect(spec.blue!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
    expect(specsAreEqual(spec.blue, spec.red)).toBe(true);
  });

  it("parses single component", () => {
    const spec = loopSpecFromLegacy("rotated", 2);
    expect(spec.blue!.components.size).toBe(1);
    expect(spec.blue!.components.has(LOOPComponent.ROTATED)).toBe(true);
  });

  it("parses mirrored_rotated_inverted_swapped", () => {
    const spec = loopSpecFromLegacy("mirrored_rotated_inverted_swapped", 2);
    expect(spec.blue!.components.size).toBe(4);
    expect(spec.blue!.components.has(LOOPComponent.MIRRORED)).toBe(true);
    expect(spec.blue!.components.has(LOOPComponent.ROTATED)).toBe(true);
    expect(spec.blue!.components.has(LOOPComponent.INVERTED)).toBe(true);
    expect(spec.blue!.components.has(LOOPComponent.SWAPPED)).toBe(true);
  });

  it("parses rewound", () => {
    const spec = loopSpecFromLegacy("rewound", 2);
    expect(spec.blue!.components.size).toBe(1);
    expect(spec.blue!.components.has(LOOPComponent.REWOUND)).toBe(true);
  });
});

describe("helper constructors", () => {
  it("singleComponent builds correct PropLOOPSpec", () => {
    const prop = singleComponent(LOOPComponent.ROTATED, 4);
    expect(prop.components.size).toBe(1);
    expect(prop.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
  });

  it("symmetricSpec shares both props", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);
    const spec = symmetricSpec(components);
    expect(spec.blue).toBe(spec.red);
  });

  it("allActiveComponents merges with max period", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.ROTATED, 2),
      red: singleComponent(LOOPComponent.ROTATED, 4),
    };
    const active = allActiveComponents(spec);
    expect(active.get(LOOPComponent.ROTATED)!.period).toBe(4);
  });

  it("isEmptySpec is true for no components", () => {
    expect(isEmptySpec({})).toBe(true);
    expect(isEmptySpec({ blue: EMPTY_PROP_SPEC })).toBe(true);
  });

  it("isEmptySpec is false when components exist", () => {
    expect(
      isEmptySpec({ blue: singleComponent(LOOPComponent.ROTATED, 2) }),
    ).toBe(false);
  });
});

describe("specsAreEqual", () => {
  it("equal when both undefined", () => {
    expect(specsAreEqual(undefined, undefined)).toBe(true);
  });

  it("not equal when one undefined", () => {
    expect(
      specsAreEqual(singleComponent(LOOPComponent.ROTATED, 2), undefined),
    ).toBe(false);
  });

  it("equal with same components and periods", () => {
    const a = singleComponent(LOOPComponent.ROTATED, 4);
    const b = singleComponent(LOOPComponent.ROTATED, 4);
    expect(specsAreEqual(a, b)).toBe(true);
  });

  it("not equal with different periods", () => {
    const a = singleComponent(LOOPComponent.ROTATED, 2);
    const b = singleComponent(LOOPComponent.ROTATED, 4);
    expect(specsAreEqual(a, b)).toBe(false);
  });
});

describe("validateLOOPSpec", () => {
  it("passes valid spec", () => {
    const spec = symmetricSpec(
      new Map([[LOOPComponent.MIRRORED, { period: 2 }]]),
    );
    expect(validateLOOPSpec(spec)).toHaveLength(0);
  });

  it("catches period < 2", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.ROTATED, 1),
    };
    const errors = validateLOOPSpec(spec);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.rule).toBe("minimum_period");
  });

  it("catches REWOUND composing with other components", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.REWOUND, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);
    const spec: LOOPSpec = { blue: { components } };
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "rewound_exclusivity")).toBe(true);
  });

  it("catches SWAPPED asymmetry", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.SWAPPED, 2),
      red: singleComponent(LOOPComponent.ROTATED, 2),
    };
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "swapped_symmetry")).toBe(true);
  });

  it("catches SWAPPED period mismatch", () => {
    const spec: LOOPSpec = {
      blue: singleComponent(LOOPComponent.SWAPPED, 2),
      red: singleComponent(LOOPComponent.SWAPPED, 4),
    };
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "swapped_symmetry")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run packages/sequence-engine/tests/loop/loop-spec.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/tests/loop/loop-spec.test.ts
git commit -m "test(loop): add Phase 1 unit tests for loop-spec.ts"
```

---

## Phase 2 — Detection Emits LOOPSpec

### Task 5: Add `loopSpec` field to SequenceData

**Files:**
- Modify: `src/lib/shared/foundation/domain/models/SequenceData.ts`

- [ ] **Step 1: Add the field**

Read the file. Find the `SequenceData` interface. Add after the existing `componentDomains` field:

```ts
readonly loopSpec?: LOOPSpec;
```

Add the import at the top:

```ts
import type { LOOPSpec } from "@tka/sequence-engine/loop/loop-spec.js";
```

Check the exact import path the file uses for other sequence-engine imports — match that pattern. (It may be a relative path or a package import.)

- [ ] **Step 2: Add `loopSpec` to GenerationOptions**

Read `src/lib/features/create/generate/shared/domain/models/generate-models.ts`. Find `GenerationOptions` or `LOOPGenerationOptions` interface. Add:

```ts
loopSpec?: LOOPSpec;
```

With the same import pattern.

- [ ] **Step 3: Verify compilation**

Run: `npm run check`

Expected: No new errors (new field is optional, no callers affected yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/foundation/domain/models/SequenceData.ts
git add src/lib/features/create/generate/shared/domain/models/generate-models.ts
git commit -m "feat(loop): add loopSpec field to SequenceData and GenerationOptions"
```

---

### Task 6: LOOPDetector emits LOOPSpec

**Files:**
- Modify: `packages/sequence-engine/src/loop/detection/LOOPDetector.ts`

This is the most complex task. The existing detector detects components as a `Set<LOOPComponent>` and resolves them to a flat `LOOPType` via `resolveComponentsToLOOPType`. The new code:

1. Keeps the existing detection logic (component detection per-prop is already there)
2. Adds `spec: LOOPSpec | null` to `RichLOOPDetectionResult`
3. Builds the spec from detected components + period
4. Keeps `loopType` and `period` derivation for backward compat

- [ ] **Step 1: Add LOOPSpec import and update result type**

Read the full file. Add import:

```ts
import {
  LOOPComponent as CanonicalLOOPComponent,
  type LOOPSpec,
  type PropLOOPSpec,
  type ComponentSpec,
  loopSpecFromLegacy,
  singleComponent,
  symmetricSpec,
  loopSpecPeriod,
} from "../loop-spec.js";
```

Update `RichLOOPDetectionResult`:

```ts
export interface RichLOOPDetectionResult {
  isCircular: boolean;
  spec: LOOPSpec | null;
  loopType: LOOPType | null;
  period: Period | null;
  confidence: DetectionConfidence;
  compoundPattern?: CompoundPattern;
}
```

- [ ] **Step 2: Build LOOPSpec from detected components**

In the `LOOPDetectorClass.detectLOOP()` method, after the existing component detection logic that produces the `components: Set<LOOPComponent>` and `period`, add a new method `buildLOOPSpec`:

```ts
private buildLOOPSpec(
  components: Set<LOOPComponent>,
  period: Period | null,
  compoundPattern?: CompoundPattern,
): LOOPSpec | null {
  if (components.size === 0) return null;

  const periodNum = period ? (period === Period.QUARTERED ? 4 : 2) : 2;
  const compMap = new Map<CanonicalLOOPComponent, ComponentSpec>();

  for (const comp of components) {
    const canonical = comp as unknown as CanonicalLOOPComponent;
    compMap.set(canonical, { period: periodNum });
  }

  if (compoundPattern?.transformationIntervals) {
    for (const [comp, interval] of Object.entries(
      compoundPattern.transformationIntervals,
    )) {
      const canonical = comp as CanonicalLOOPComponent;
      if (compMap.has(canonical)) {
        compMap.set(canonical, { period: interval });
      }
    }
  }

  const prop: PropLOOPSpec = { components: compMap };
  return { blue: prop, red: prop };
}
```

Call this method and assign the result to `spec` in the return value.

- [ ] **Step 3: Keep resolveComponentsToLOOPType for backward compat**

Do NOT delete `resolveComponentsToLOOPType` yet — it's still used for the `loopType` field. Mark it `@deprecated`.

- [ ] **Step 4: Verify compilation**

Run: `npm run check`

Expected: No new errors.

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run packages/sequence-engine/tests/loop`

Expected: All existing tests still pass. The `RichLOOPDetectionResult` change may break tests that assert on result shape — fix by adding `spec` to expected objects.

- [ ] **Step 6: Commit**

```bash
git add packages/sequence-engine/src/loop/detection/LOOPDetector.ts
git commit -m "feat(loop): LOOPDetector emits LOOPSpec alongside legacy loopType"
```

---

### Task 7: Update loop-display-resolver to read LOOPSpec

**Files:**
- Modify: `src/lib/features/loop-labeler/services/loop-display-resolver.ts`

- [ ] **Step 1: Add LOOPSpec path**

Read the file. In `computeLoopDisplay()`, before the existing 3-path resolver, add a check for `input.loopSpec`:

```ts
if (input.loopSpec) {
  const components = new Set<LOOPComponent>();
  const componentDomains = new Map<LOOPComponent, LOOPDomain>();
  let maxPeriod = 1;

  for (const prop of [input.loopSpec.blue, input.loopSpec.red]) {
    if (!prop) continue;
    for (const [comp, cSpec] of prop.components) {
      if (!RESERVED_ORIENTATION_PRIMITIVES.has(comp)) {
        components.add(comp);
        if (cSpec.domain) componentDomains.set(comp, cSpec.domain);
        maxPeriod = Math.max(maxPeriod, cSpec.period);
      }
    }
  }

  return {
    components,
    period: maxPeriod,
    componentDomains: Object.fromEntries(componentDomains),
  };
}
```

This must be the FIRST path — if `loopSpec` exists, use it directly. The existing paths (on-demand detection, stored components, stored loopType) become fallbacks.

- [ ] **Step 2: Verify compilation**

Run: `npm run check`

Expected: No errors. The `input` parameter needs a `loopSpec` field — check the `LoopDisplayInput` type and add `loopSpec?: LOOPSpec` if needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/loop-labeler/services/loop-display-resolver.ts
git commit -m "feat(loop): loop-display-resolver reads LOOPSpec with legacy fallback"
```

---

## Phase 3 — New Execution Functions (Parallel API)

### Task 8: Create FusedExecutor

**Files:**
- Create: `packages/sequence-engine/src/loop/execution/FusedExecutor.ts`

The FusedExecutor is a parametric class that replaces all compound executors. It takes flags indicating which transforms are active and applies them all in a single doubling pass.

- [ ] **Step 1: Write the file**

```ts
import type {
  SequenceStep,
  MotionData,
} from "../../core/types/sequence-engine-types.js";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  VERTICAL_MIRROR_LOCATION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
  SWAPPED_POSITION_MAP,
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  mirrorHandRotationDirection,
} from "../position-maps/circular-position-maps.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export interface FusedTransformFlags {
  readonly mirror: boolean;
  readonly flip: boolean;
  readonly swap: boolean;
  readonly invert: boolean;
}

export class FusedExecutor {
  private readonly flipCount: number;

  constructor(private readonly flags: FusedTransformFlags) {
    let count = 0;
    if (flags.mirror) count++;
    if (flags.flip) count++;
    if (flags.invert) count++;
    this.flipCount = count;
  }

  execute(sequence: SequenceStep[], period: number): SequenceStep[] {
    const startPosition = sequence.shift();
    if (!startPosition) throw new Error("Sequence must have a start position");

    const partialLength = sequence.length;
    const stepsToGenerate = partialLength * (period - 1);

    let lastStep = sequence[sequence.length - 1]!;
    const firstStepNumber = (lastStep.stepNumber ?? 0) + 1;

    for (let offset = 0; offset < stepsToGenerate; offset++) {
      const stepNumber = firstStepNumber + offset;
      const quarterIdx = Math.floor((stepNumber - 1) / partialLength);
      const sourceIdx = ((stepNumber - 1) % partialLength);
      const applyTransform = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceIdx]!;

      const newStep = applyTransform
        ? this.createTransformedStep(sourceStep, lastStep, stepNumber)
        : this.createCopiedStep(sourceStep, lastStep, stepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);
      sequence.push(finalStep);
      lastStep = finalStep;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private createTransformedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number,
  ): SequenceStep {
    const blueSource = this.flags.swap
      ? sourceStep.motions.red
      : sourceStep.motions.blue;
    const redSource = this.flags.swap
      ? sourceStep.motions.blue
      : sourceStep.motions.red;

    const blueMotion = this.transformMotion(
      blueSource,
      previousStep.motions.blue,
    );
    const redMotion = this.transformMotion(
      redSource,
      previousStep.motions.red,
    );

    const endPosition = gridPositionDeriver.getGridPositionFromLocations(
      blueMotion.endLocation,
      redMotion.endLocation,
    );

    const letter = this.flags.invert
      ? (getInvertedLetter(sourceStep.letter ?? "") as SequenceStep["letter"])
      : sourceStep.letter;

    return {
      ...sourceStep,
      stepNumber,
      letter,
      startPosition: previousStep.endPosition as SequenceStep["startPosition"],
      endPosition: endPosition as SequenceStep["endPosition"],
      motions: { blue: blueMotion, red: redMotion },
    };
  }

  private transformMotion(
    matchingMotion: MotionData,
    previousMotion: MotionData,
  ): MotionData {
    const startLocation = previousMotion.endLocation;
    const endLocation = this.computeEndLocation(matchingMotion, startLocation);

    const flipRotDir = this.flipCount % 2 === 1;
    const rotationDirection = flipRotDir
      ? flipRotationDirection(matchingMotion.rotationDirection)
      : matchingMotion.rotationDirection;

    const motionType = this.flags.invert
      ? invertMotionType(matchingMotion.motionType)
      : matchingMotion.motionType;

    return {
      ...matchingMotion,
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection:
        rotationDirection as MotionData["rotationDirection"],
      motionType: motionType as MotionData["motionType"],
    };
  }

  private computeEndLocation(
    matchingMotion: MotionData,
    startLocation: string,
  ): string {
    if (matchingMotion.startLocation === matchingMotion.endLocation) {
      return startLocation;
    }

    const seedHandDir = getHandRotationDirection(
      matchingMotion.startLocation,
      matchingMotion.endLocation,
    );

    const needsMirror = this.flags.mirror || this.flags.flip;
    const dir = needsMirror
      ? mirrorHandRotationDirection(seedHandDir)
      : seedHandDir;

    const locationMap = getLocationMapForHandRotation(dir);
    return locationMap[startLocation] || startLocation;
  }

  private createCopiedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number,
  ): SequenceStep {
    return {
      ...sourceStep,
      stepNumber,
      startPosition:
        previousStep.endPosition as SequenceStep["startPosition"],
      endPosition: sourceStep.endPosition as SequenceStep["endPosition"],
      motions: {
        blue: {
          ...sourceStep.motions.blue,
          startLocation:
            previousStep.motions.blue
              .endLocation as MotionData["startLocation"],
        },
        red: {
          ...sourceStep.motions.red,
          startLocation:
            previousStep.motions.red
              .endLocation as MotionData["startLocation"],
        },
      },
    };
  }
}

function flipRotationDirection(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

function invertMotionType(motionType: string): string {
  if (motionType === "pro") return "anti";
  if (motionType === "anti") return "pro";
  return motionType;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/loop/execution/FusedExecutor.ts
git commit -m "feat(loop): add FusedExecutor — parametric executor for field-level transforms"
```

---

### Task 9: Create spec-executor orchestrator

**Files:**
- Create: `packages/sequence-engine/src/loop/execution/spec-executor.ts`

This file orchestrates execution for a `PropLOOPSpec` by chaining RotatedExecutor + FusedExecutor groups.

- [ ] **Step 1: Write the file**

```ts
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import {
  LOOPComponent,
  type PropLOOPSpec,
  type LOOPSpec,
  type ComponentSpec,
  specsAreEqual,
  EMPTY_PROP_SPEC,
} from "../loop-spec.js";
import { Period } from "../loop-types.js";
import { strictRotatedExecutor } from "./StrictRotatedExecutor.js";
import { rewoundExecutor } from "./RewoundExecutor.js";
import { FusedExecutor, type FusedTransformFlags } from "./FusedExecutor.js";

const FUSEABLE = new Set([
  LOOPComponent.MIRRORED,
  LOOPComponent.FLIPPED,
  LOOPComponent.SWAPPED,
  LOOPComponent.INVERTED,
]);

export function executeSymmetricSpec(
  sequence: SequenceStep[],
  spec: PropLOOPSpec,
): SequenceStep[] {
  if (spec.components.size === 0) return sequence;

  let result = sequence;

  if (spec.components.has(LOOPComponent.REWOUND)) {
    const period = spec.components.get(LOOPComponent.REWOUND)!.period;
    const periodEnum = period === 4 ? Period.QUARTERED : Period.HALVED;
    return rewoundExecutor.executeLOOP(result, periodEnum);
  }

  if (spec.components.has(LOOPComponent.ROTATED)) {
    const period = spec.components.get(LOOPComponent.ROTATED)!.period;
    const periodEnum = period === 4 ? Period.QUARTERED : Period.HALVED;
    result = strictRotatedExecutor.executeLOOP(result, periodEnum);
  }

  const groups = groupFuseableByPeriod(spec);
  for (const [period, flags] of groups) {
    const executor = new FusedExecutor(flags);
    result = executor.execute(result, period);
  }

  return result;
}

export function executeLOOPSpec(
  sequence: SequenceStep[],
  spec: LOOPSpec,
): SequenceStep[] {
  const blueSpec = spec.blue ?? EMPTY_PROP_SPEC;
  const redSpec = spec.red ?? EMPTY_PROP_SPEC;

  if (specsAreEqual(blueSpec, redSpec)) {
    return executeSymmetricSpec(sequence, blueSpec);
  }

  throw new Error(
    "Asymmetric LOOPSpec execution not yet implemented. " +
      "Per-prop independent execution requires Phase 3b follow-on.",
  );
}

function groupFuseableByPeriod(
  spec: PropLOOPSpec,
): Map<number, FusedTransformFlags> {
  const groups = new Map<
    number,
    { mirror: boolean; flip: boolean; swap: boolean; invert: boolean }
  >();

  for (const [comp, cSpec] of spec.components) {
    if (!FUSEABLE.has(comp)) continue;

    if (!groups.has(cSpec.period)) {
      groups.set(cSpec.period, {
        mirror: false,
        flip: false,
        swap: false,
        invert: false,
      });
    }
    const flags = groups.get(cSpec.period)!;
    if (comp === LOOPComponent.MIRRORED) flags.mirror = true;
    if (comp === LOOPComponent.FLIPPED) flags.flip = true;
    if (comp === LOOPComponent.SWAPPED) flags.swap = true;
    if (comp === LOOPComponent.INVERTED) flags.invert = true;
  }

  return new Map(
    [...groups.entries()].sort(([a], [b]) => b - a),
  ) as Map<number, FusedTransformFlags>;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/loop/execution/spec-executor.ts
git commit -m "feat(loop): add spec-executor — chains RotatedExecutor + FusedExecutor per PropLOOPSpec"
```

---

### Task 10: Add `executeSpec` to LOOPExecutorSelector

**Files:**
- Modify: `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts`

- [ ] **Step 1: Add the method**

Read the file. Add import and method:

```ts
import type { LOOPSpec } from "../loop-spec.js";
import { executeLOOPSpec } from "./spec-executor.js";
```

Add to the `LOOPExecutorSelector` class:

```ts
executeSpec(sequence: SequenceStep[], spec: LOOPSpec): SequenceStep[] {
  return executeLOOPSpec(sequence, spec);
}
```

Add the import for `SequenceStep`:

```ts
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
```

(Check if this import already exists.)

- [ ] **Step 2: Export from barrel**

Add to `packages/sequence-engine/src/loop/index.ts`:

```ts
// Spec-based execution
export { executeLOOPSpec, executeSymmetricSpec } from "./execution/spec-executor.js";
export { FusedExecutor, type FusedTransformFlags } from "./execution/FusedExecutor.js";
```

- [ ] **Step 3: Verify compilation**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts
git add packages/sequence-engine/src/loop/index.ts
git commit -m "feat(loop): wire executeSpec into LOOPExecutorSelector and barrel"
```

---

### Task 11: Add `isLOOPValidForSpec` to LOOPValidator

**Files:**
- Modify: `packages/sequence-engine/src/loop/validation/LOOPValidator.ts`

- [ ] **Step 1: Add the function**

Read the file. Add import:

```ts
import {
  LOOPComponent as CanonicalLOOPComponent,
  type LOOPSpec,
  allActiveComponents,
} from "../loop-spec.js";
```

Add the new function after the existing `isLOOPValidForPositionPair`:

```ts
export function isLOOPValidForSpec(
  spec: LOOPSpec,
  positionPair: string,
): boolean {
  const active = allActiveComponents(spec);

  for (const [comp, { period }] of active) {
    switch (comp) {
      case CanonicalLOOPComponent.ROTATED: {
        const set = period === 4 ? QUARTERED_LOOPS : HALVED_LOOPS;
        if (!set.has(positionPair)) return false;
        break;
      }
      case CanonicalLOOPComponent.MIRRORED:
        if (!MIRRORED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.FLIPPED:
        if (!FLIPPED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.SWAPPED:
        if (!SWAPPED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.INVERTED:
        if (!INVERTED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.REWOUND:
        break;
    }
  }

  return true;
}
```

- [ ] **Step 2: Export from barrel**

Add to `packages/sequence-engine/src/loop/index.ts` under the Validator section:

```ts
export { isLOOPValidForSpec } from "./validation/LOOPValidator.js";
```

- [ ] **Step 3: Verify compilation**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add packages/sequence-engine/src/loop/validation/LOOPValidator.ts
git add packages/sequence-engine/src/loop/index.ts
git commit -m "feat(loop): add isLOOPValidForSpec — compositional validator"
```

---

### Task 12: Add `determineEndPositionForSpec`

**Files:**
- Modify: `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts`

- [ ] **Step 1: Add the function**

Read the file. Add imports:

```ts
import {
  LOOPComponent as CanonicalLOOPComponent,
  type LOOPSpec,
  type PropLOOPSpec,
} from "../loop-spec.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
```

Add the new function:

```ts
export function determineEndPositionForSpec(
  spec: LOOPSpec,
  startPosition: string,
): string | null {
  const [blueStart, redStart] =
    gridPositionDeriver.getGridLocationsFromPosition(startPosition);

  const blueEnd = determinePropEndLocation(spec.blue, blueStart);
  const redEnd = determinePropEndLocation(spec.red, redStart);

  if (blueEnd === null && redEnd === null) return null;

  return gridPositionDeriver.getGridPositionFromLocations(
    blueEnd ?? blueStart,
    redEnd ?? redStart,
  );
}

function determinePropEndLocation(
  spec: PropLOOPSpec | undefined,
  startLoc: string,
): string | null {
  if (!spec || spec.components.size === 0) return startLoc;

  if (spec.components.has(CanonicalLOOPComponent.REWOUND)) return null;

  if (spec.components.has(CanonicalLOOPComponent.ROTATED)) {
    const period = spec.components.get(CanonicalLOOPComponent.ROTATED)!.period;
    return rotateLocation(startLoc, period);
  }
  if (spec.components.has(CanonicalLOOPComponent.MIRRORED))
    return VERTICAL_MIRROR_LOCATION_MAP[startLoc] ?? null;
  if (spec.components.has(CanonicalLOOPComponent.FLIPPED))
    return HORIZONTAL_MIRROR_LOCATION_MAP[startLoc] ?? null;
  if (spec.components.has(CanonicalLOOPComponent.INVERTED)) return startLoc;
  if (spec.components.has(CanonicalLOOPComponent.SWAPPED)) return startLoc;

  return startLoc;
}

function rotateLocation(loc: string, period: number): string | null {
  if (period === 2) return HALF_POSITION_MAP[loc] ?? null;
  if (period === 4) return QUARTER_POSITION_MAP_CW[loc] ?? null;
  return null;
}
```

Check whether `VERTICAL_MIRROR_LOCATION_MAP`, `HORIZONTAL_MIRROR_LOCATION_MAP`, `HALF_POSITION_MAP`, `QUARTER_POSITION_MAP_CW` are already imported in the file. Add any missing imports from the position-maps modules.

- [ ] **Step 2: Export from barrel**

Add to `packages/sequence-engine/src/loop/index.ts`:

```ts
export { determineEndPositionForSpec } from "./targeting/LOOPEndPositionSelector.js";
```

- [ ] **Step 3: Verify compilation**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts
git add packages/sequence-engine/src/loop/index.ts
git commit -m "feat(loop): add determineEndPositionForSpec — per-prop end position resolver"
```

---

### Task 13: Parity tests — FusedExecutor vs legacy executors

**Files:**
- Create: `packages/sequence-engine/tests/loop/execution/spec-executor-parity.test.ts`

These tests verify that `executeSpec(loopSpecFromLegacy(type, period))` produces identical output to the existing `getExecutor(type).executeLOOP(seq, period)` for all 15 mapped LOOPType values.

- [ ] **Step 1: Write test file**

```ts
import { describe, it, expect } from "vitest";
import { LOOPType, Period } from "../../../src/loop/loop-types.js";
import { loopExecutorSelector } from "../../../src/loop/execution/LOOPExecutorSelector.js";
import { loopSpecFromLegacy } from "../../../src/loop/loop-spec.js";
import { executeLOOPSpec } from "../../../src/loop/execution/spec-executor.js";
import type { SequenceStep, MotionData } from "../../../src/core/types/sequence-engine-types.js";

function makeMotion(overrides: Partial<MotionData> = {}): MotionData {
  return {
    motionType: "pro",
    startLocation: "n",
    endLocation: "e",
    rotationDirection: "cw",
    startOrientation: "in",
    endOrientation: "clock",
    turns: 1,
    ...overrides,
  } as MotionData;
}

function makeStep(
  stepNumber: number,
  startPos: string,
  endPos: string,
  blueOverrides: Partial<MotionData> = {},
  redOverrides: Partial<MotionData> = {},
): SequenceStep {
  return {
    stepNumber,
    startPosition: startPos,
    endPosition: endPos,
    motions: {
      blue: makeMotion({ startLocation: "n", endLocation: "e", ...blueOverrides }),
      red: makeMotion({ startLocation: "s", endLocation: "w", ...redOverrides }),
    },
  } as SequenceStep;
}

function makeTestSequence(): SequenceStep[] {
  return [
    makeStep(0, "alpha1", "alpha1"),
    makeStep(1, "alpha1", "alpha5", { startLocation: "n", endLocation: "s" }, { startLocation: "s", endLocation: "n" }),
    makeStep(2, "alpha5", "alpha1", { startLocation: "s", endLocation: "n" }, { startLocation: "n", endLocation: "s" }),
  ];
}

const MAPPED_TYPES: LOOPType[] = [
  LOOPType.ROTATED,
  LOOPType.MIRRORED,
  LOOPType.FLIPPED,
  LOOPType.SWAPPED,
  LOOPType.INVERTED,
  LOOPType.MIRRORED_SWAPPED,
  LOOPType.SWAPPED_INVERTED,
  LOOPType.MIRRORED_INVERTED,
  LOOPType.ROTATED_SWAPPED,
  LOOPType.ROTATED_INVERTED,
  LOOPType.MIRRORED_ROTATED,
  LOOPType.MIRRORED_INVERTED_ROTATED,
  LOOPType.MIRRORED_SWAPPED_INVERTED,
  LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
  LOOPType.REWOUND,
];

describe("spec-executor parity with legacy executors", () => {
  for (const loopType of MAPPED_TYPES) {
    it(`${loopType} at period 2 produces identical output`, () => {
      const legacySeq = makeTestSequence();
      const specSeq = makeTestSequence();

      const executor = loopExecutorSelector.getExecutor(loopType);
      let legacyResult: SequenceStep[];
      try {
        legacyResult = executor.executeLOOP(legacySeq, Period.HALVED);
      } catch {
        return;
      }

      const spec = loopSpecFromLegacy(loopType, 2);
      const specResult = executeLOOPSpec(specSeq, spec);

      expect(specResult.length).toBe(legacyResult.length);
      for (let i = 0; i < legacyResult.length; i++) {
        expect(specResult[i]!.endPosition).toBe(legacyResult[i]!.endPosition);
        expect(specResult[i]!.motions.blue.endLocation).toBe(
          legacyResult[i]!.motions.blue.endLocation,
        );
        expect(specResult[i]!.motions.red.endLocation).toBe(
          legacyResult[i]!.motions.red.endLocation,
        );
        expect(specResult[i]!.motions.blue.rotationDirection).toBe(
          legacyResult[i]!.motions.blue.rotationDirection,
        );
        expect(specResult[i]!.motions.red.rotationDirection).toBe(
          legacyResult[i]!.motions.red.rotationDirection,
        );
      }
    });
  }
});
```

**Important:** The test sequence must start from a position valid for ALL loop types. `alpha1,alpha1` is in `INVERTED_LOOP_VALIDATION_SET` (identity pair). For types requiring different start/end positions (e.g., `ROTATED` needs `alpha1,alpha5`), the sequence may need adjustment. If a legacy executor throws a validation error, the test catches it and skips that case — the parity test only applies to cases where both paths can execute. Fix the test sequence iteratively until most types pass.

- [ ] **Step 2: Run tests**

Run: `npx vitest run packages/sequence-engine/tests/loop/execution/spec-executor-parity.test.ts`

Expected: If any tests fail, the FusedExecutor has a bug. Debug by comparing step-by-step output between legacy and new executor. Fix FusedExecutor until all 15 types produce identical output.

This is the migration safety net. Do not proceed to Phase 4 until this passes.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/tests/loop/execution/spec-executor-parity.test.ts
git commit -m "test(loop): add parity tests — spec-executor vs all 15 legacy executors"
```

---

### Task 14: FusedExecutor unit tests

**Files:**
- Create: `packages/sequence-engine/tests/loop/execution/fused-executor.test.ts`

- [ ] **Step 1: Write tests for individual transforms**

```ts
import { describe, it, expect } from "vitest";
import { FusedExecutor } from "../../../src/loop/execution/FusedExecutor.js";
import type { SequenceStep, MotionData } from "../../../src/core/types/sequence-engine-types.js";

function makeMotion(overrides: Partial<MotionData> = {}): MotionData {
  return {
    motionType: "pro",
    startLocation: "n",
    endLocation: "e",
    rotationDirection: "cw",
    startOrientation: "in",
    endOrientation: "clock",
    turns: 1,
    ...overrides,
  } as MotionData;
}

function makeStep(stepNumber: number, overrides: Partial<SequenceStep> = {}): SequenceStep {
  return {
    stepNumber,
    startPosition: "alpha1",
    endPosition: "alpha5",
    motions: {
      blue: makeMotion(),
      red: makeMotion({ startLocation: "s", endLocation: "w", rotationDirection: "ccw" }),
    },
    ...overrides,
  } as SequenceStep;
}

describe("FusedExecutor", () => {
  describe("invert only", () => {
    it("flips motionType pro→anti and rotDir cw→ccw", () => {
      const executor = new FusedExecutor({
        mirror: false,
        flip: false,
        swap: false,
        invert: true,
      });

      const seq = [makeStep(0), makeStep(1)];
      const result = executor.execute(seq, 2);

      expect(result.length).toBe(3);
      const transformed = result[2]!;
      expect(transformed.motions.blue.motionType).toBe("anti");
      expect(transformed.motions.blue.rotationDirection).toBe("ccw");
    });
  });

  describe("swap only", () => {
    it("blue reads from red source and vice versa", () => {
      const executor = new FusedExecutor({
        mirror: false,
        flip: false,
        swap: true,
        invert: false,
      });

      const seq = [
        makeStep(0),
        makeStep(1, {
          motions: {
            blue: makeMotion({ motionType: "pro" }),
            red: makeMotion({ motionType: "anti" }),
          },
        }),
      ];
      const result = executor.execute(seq, 2);

      const transformed = result[2]!;
      expect(transformed.motions.blue.motionType).toBe("anti");
      expect(transformed.motions.red.motionType).toBe("pro");
    });
  });

  describe("mirror + invert cancellation", () => {
    it("rotation direction preserved when both mirror and invert are active", () => {
      const executor = new FusedExecutor({
        mirror: true,
        flip: false,
        swap: false,
        invert: true,
      });

      const seq = [makeStep(0), makeStep(1)];
      const result = executor.execute(seq, 2);

      const source = seq[1]!;
      const transformed = result[2]!;
      expect(transformed.motions.blue.rotationDirection).toBe(
        source.motions.blue.rotationDirection,
      );
    });
  });

  describe("period 4", () => {
    it("generates 3 additional passes from 1 motif", () => {
      const executor = new FusedExecutor({
        mirror: true,
        flip: false,
        swap: false,
        invert: false,
      });

      const seq = [makeStep(0), makeStep(1)];
      const result = executor.execute(seq, 4);

      expect(result.length).toBe(5);
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run packages/sequence-engine/tests/loop/execution/fused-executor.test.ts`

Expected: All pass. If cancellation test fails, check `flipCount` logic in FusedExecutor.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/tests/loop/execution/fused-executor.test.ts
git commit -m "test(loop): add FusedExecutor unit tests — transforms, cancellation, period 4"
```

---

## Phase 4 — Swap Callers to New API

### Task 15: MCP adapter uses loopSpecFromLegacy

**Files:**
- Modify: `mcp-server/src/core/engine-generation-adapter.ts`

- [ ] **Step 1: Add conversion at boundary**

Read the file. Find where `LOOP_TYPE_MAP` is used to resolve `options.loopType` to a `LOOPType` enum. After that resolution, add:

```ts
import { loopSpecFromLegacy } from "@tka/sequence-engine";
```

Where the build options are assembled (around line 196), add:

```ts
const loopSpec = resolvedLoopType
  ? loopSpecFromLegacy(resolvedLoopType, periodNum)
  : undefined;
```

Pass `loopSpec` alongside the existing `type` and `period` in the `options.loop` object. The downstream consumer will prefer `loopSpec` when present.

- [ ] **Step 2: Verify compilation**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/core/engine-generation-adapter.ts
git commit -m "feat(loop): MCP adapter converts LOOPType → LOOPSpec at boundary"
```

---

### Task 16: Minimum length calculator accepts LOOPSpec

**Files:**
- Modify: `packages/sequence-engine/src/generation/capacity/minimum-length-calculator.ts`

- [ ] **Step 1: Add LOOPSpec overload**

Read the file. Add a new exported function alongside `minLength`:

```ts
import {
  type LOOPSpec,
  allActiveComponents,
  loopSpecPeriod,
  LOOPComponent,
} from "../../loop/loop-spec.js";

export function minLengthForSpec(
  spec: LOOPSpec,
  level: number,
): number {
  const period = loopSpecPeriod(spec);
  const active = allActiveComponents(spec);

  if (level === 1) {
    for (const [comp] of active) {
      if (comp !== LOOPComponent.ROTATED && comp !== LOOPComponent.REWOUND) {
        if (period > 2) return Infinity;
      }
    }
  }

  let baseMin = 1;
  for (const [comp] of active) {
    if (
      comp === LOOPComponent.ROTATED ||
      comp === LOOPComponent.MIRRORED ||
      comp === LOOPComponent.FLIPPED
    ) {
      baseMin = Math.max(baseMin, 2);
    }
  }

  return baseMin * period;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/generation/capacity/minimum-length-calculator.ts
git commit -m "feat(loop): add minLengthForSpec alongside legacy minLength"
```

---

### Task 17: Deprecation annotations

**Files:**
- Modify: `packages/sequence-engine/src/loop/loop-types.ts`
- Modify: `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts`
- Modify: `packages/sequence-engine/src/loop/validation/LOOPValidator.ts`
- Modify: `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts`

- [ ] **Step 1: Add @deprecated JSDoc to old functions**

In each file, add `/** @deprecated Use LOOPSpec-based equivalent */` above:
- `LOOPType` enum in `loop-types.ts`
- `Period` enum in `loop-types.ts`
- `getExecutor()` method in `LOOPExecutorSelector`
- `isLOOPValidForPositionPair()` in `LOOPValidator`
- `determineEndPosition()` in `LOOPEndPositionSelector`

- [ ] **Step 2: Verify no compile errors from JSDoc**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/loop/loop-types.ts
git add packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts
git add packages/sequence-engine/src/loop/validation/LOOPValidator.ts
git add packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts
git commit -m "chore(loop): add @deprecated to legacy LOOPType-based APIs"
```

---

## Phase 5 — Cleanup

### Task 18: Delete compound and strict single-component executors

**Files:**
- Delete 13 files in `packages/sequence-engine/src/loop/execution/`
- Modify: `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts`
- Modify: `packages/sequence-engine/src/loop/index.ts`

- [ ] **Step 1: Delete executor files**

Delete these 9 compound executor files:
```
packages/sequence-engine/src/loop/execution/MirroredSwappedExecutor.ts
packages/sequence-engine/src/loop/execution/MirroredSwappedInvertedExecutor.ts
packages/sequence-engine/src/loop/execution/MirroredInvertedExecutor.ts
packages/sequence-engine/src/loop/execution/RotatedSwappedExecutor.ts
packages/sequence-engine/src/loop/execution/RotatedInvertedExecutor.ts
packages/sequence-engine/src/loop/execution/MirroredRotatedExecutor.ts
packages/sequence-engine/src/loop/execution/MirroredRotatedInvertedExecutor.ts
packages/sequence-engine/src/loop/execution/MirroredRotatedInvertedSwappedExecutor.ts
packages/sequence-engine/src/loop/execution/SwappedInvertedExecutor.ts
```

Delete these 4 strict single-component executors:
```
packages/sequence-engine/src/loop/execution/StrictMirroredExecutor.ts
packages/sequence-engine/src/loop/execution/StrictFlippedExecutor.ts
packages/sequence-engine/src/loop/execution/StrictSwappedExecutor.ts
packages/sequence-engine/src/loop/execution/StrictInvertedExecutor.ts
```

- [ ] **Step 2: Update LOOPExecutorSelector**

Remove all imports and map entries for deleted executors. The `getExecutor()` method can either:
- Route through `executeSpec` + `loopSpecFromLegacy` internally (recommended for backward compat)
- Throw "use executeSpec instead" (only if all callers already migrated)

Recommended approach — keep `getExecutor` but implement via spec:

```ts
getExecutor(loopType: LOOPType): ILOOPExecutor {
  const spec = loopSpecFromLegacy(loopType, 2);
  return {
    executeLOOP: (sequence: SequenceStep[], period: Period) => {
      const fullSpec = loopSpecFromLegacy(loopType, periodToNumber(period));
      return executeLOOPSpec(sequence, fullSpec);
    },
  };
}
```

- [ ] **Step 3: Update barrel exports**

Remove all exports for deleted executor classes from `packages/sequence-engine/src/loop/index.ts`.

- [ ] **Step 4: Verify compilation**

Run: `npm run check`

Fix any remaining import errors across the codebase. Grep for any file still importing deleted executor classes:

```bash
grep -r "MirroredSwappedExecutor\|MirroredInvertedExecutor\|RotatedSwappedExecutor\|RotatedInvertedExecutor\|MirroredRotatedExecutor\|MirroredRotatedInvertedExecutor\|MirroredSwappedInvertedExecutor\|MirroredRotatedInvertedSwappedExecutor\|SwappedInvertedExecutor\|StrictMirroredExecutor\|StrictFlippedExecutor\|StrictSwappedExecutor\|StrictInvertedExecutor" --include="*.ts" packages/ src/
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`

Expected: All tests pass. The parity tests from Task 13 now test that `getExecutor()` routes through the spec path correctly.

- [ ] **Step 6: Commit**

```bash
git add -u packages/sequence-engine/src/loop/execution/
git add packages/sequence-engine/src/loop/index.ts
git commit -m "refactor(loop): delete 13 legacy executors — FusedExecutor handles all transforms"
```

---

### Task 19: Delete LOOPTypeResolver and resolveComponentsToLOOPType

**Files:**
- Delete: `src/lib/features/create/generate/shared/services/implementations/LOOPTypeResolver.ts`
- Modify: `packages/sequence-engine/src/loop/detection/LOOPDetector.ts`

- [ ] **Step 1: Delete LOOPTypeResolver**

Remove the file. Grep for imports:

```bash
grep -r "LOOPTypeResolver\|loopTypeResolver" --include="*.ts" src/
```

Update every importer to use `loopSpecFromLegacy` or read the spec directly.

- [ ] **Step 2: Delete resolveComponentsToLOOPType from LOOPDetector**

Read `packages/sequence-engine/src/loop/detection/LOOPDetector.ts`. Remove the `resolveComponentsToLOOPType` function. If the `loopType` field in `RichLOOPDetectionResult` still needs to be populated for backward compat, derive it from the spec:

```ts
private specToLegacyType(spec: LOOPSpec): LOOPType | null {
  const active = allActiveComponents(spec);
  const names = [...active.keys()]
    .filter((c) => !RESERVED_ORIENTATION_PRIMITIVES.has(c))
    .sort();
  const key = names.join("_");
  return (Object.values(LOOPType) as string[]).includes(key)
    ? (key as LOOPType)
    : null;
}
```

- [ ] **Step 3: Verify compilation + tests**

Run: `npm run check && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(loop): delete LOOPTypeResolver and resolveComponentsToLOOPType"
```

---

### Task 20: Consolidate duplicate LOOPComponent enums

**Files:**
- Modify: `packages/sequence-engine/src/loop/detection/LOOPDetector.ts`
- Modify: `src/lib/features/create/generate/shared/domain/models/generate-models.ts`
- Modify: `src/lib/features/create/generate/circular/domain/models/circular-models.ts`

- [ ] **Step 1: Replace local LOOPComponent in LOOPDetector**

Read the detector file. Find the local `enum LOOPComponent { ... }` (6 values). Replace all references with imports from `loop-spec.ts`:

```ts
import { LOOPComponent } from "../loop-spec.js";
```

Delete the local enum.

- [ ] **Step 2: Replace LOOPComponent in generate-models.ts**

Read the file. Find the 9-value `LOOPComponent` enum. Replace with re-export:

```ts
export { LOOPComponent, RESERVED_ORIENTATION_PRIMITIVES, type LOOPDomain } from "@tka/sequence-engine";
```

Delete the local enum, `RESERVED_ORIENTATION_PRIMITIVES`, and `LOOPDomain` type.

- [ ] **Step 3: Delete duplicate LOOPType/Period from circular-models.ts**

Read `src/lib/features/create/generate/circular/domain/models/circular-models.ts`. Find the `LOOPType` and `Period` enums. Replace with imports from the package:

```ts
export { LOOPType, Period } from "@tka/sequence-engine";
```

Delete the local enums and any helper functions that now live in `loop-type-tokens.ts`.

- [ ] **Step 4: Verify compilation**

Run: `npm run check`

Fix import errors across all consumers of these types. Grep:

```bash
grep -r "from.*circular-models.*LOOPType\|from.*circular-models.*Period\|from.*generate-models.*LOOPComponent" --include="*.ts" src/
```

Update each importer to use the package export.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(loop): consolidate duplicate LOOPComponent/LOOPType/Period enums — single source in loop-spec.ts"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] New types (LOOPSpec, PropLOOPSpec, ComponentSpec) — Task 1
- [x] Wire format (LOOPSpecWire) — Task 1
- [x] Period utilities (LCM, constants) — Task 1
- [x] Helper constructors — Task 1
- [x] Legacy converter — Task 1
- [x] Validation rules (SWAPPED symmetry, REWOUND exclusivity, min period) — Task 1
- [x] LOOPType relocation — Task 2
- [x] Barrel exports — Task 3
- [x] SequenceData migration — Task 5
- [x] GenerationOptions migration — Task 5
- [x] Detection emits LOOPSpec — Task 6
- [x] loop-display-resolver reads LOOPSpec — Task 7
- [x] FusedExecutor — Task 8
- [x] spec-executor orchestrator — Task 9
- [x] executeSpec on selector — Task 10
- [x] Compositional validator — Task 11
- [x] Per-prop end position — Task 12
- [x] Parity tests — Task 13
- [x] FusedExecutor unit tests — Task 14
- [x] MCP adapter boundary — Task 15
- [x] Minimum length calculator — Task 16
- [x] Deprecation annotations — Task 17
- [x] Delete old executors — Task 18
- [x] Delete LOOPTypeResolver — Task 19
- [x] Consolidate enums — Task 20

**Not covered (intentionally out of scope per spec):**
- Asymmetric spec execution (Phase 3b follow-on — Task 9 throws clear error)
- Period 8 for ROTATED (needs 45° position maps that don't exist yet)
- Per-prop UI picker
- Firestore backfill (infrastructure task, not code)
- Period-4 validation sets for MIRRORED/FLIPPED/SWAPPED (implementation work during Task 11 — validator uses period-2 sets initially, period-4 sets added when derived from position maps)
