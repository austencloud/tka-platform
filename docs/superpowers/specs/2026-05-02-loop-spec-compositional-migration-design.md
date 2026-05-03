# LOOPSpec: Compositional LOOP Type Migration

**Date:** 2026-05-02
**Status:** Draft

---

## Motivation

`LOOPType` is a flat enum of 16 string combinations (`"mirrored_inverted_rotated"`, etc.). Every new combination requires a new enum value. Adding a new primitive multiplies the enum. Per-prop independence is unrepresentable.

The breaking evidence: a real sequence exists where blue repeats a 4-beat motif identically and red performs a quartered rotation. The current detector labels it `loop: none`. The current type system has no slot for it. The impossibility isn't theoretical — it's live data.

The modern model: a LOOP is a **per-prop map of transform primitives to their own integer periods**. The flat enum becomes a serialization artifact only.

---

## Discovery: per-prop independence

Sequence `c3f8a1b0` (16 beats):

- **Blue** — identical 4-beat motif × 4. Pure repeated. No transformation.
- **Red** — same start position each pass after 90° CW rotation. ROTATED at period 4.

`LOOPSpec` for this sequence:
```ts
{
  blue: undefined,                                     // repeated — absent = no transform
  red: { components: new Map([[ROTATED, 4]]) }
}
```

Overall period = LCM(1, 4) = 4.

---

## New Canonical Types

### Home

`packages/sequence-engine/src/loop/loop-spec.ts` — single source of truth, imported by app.

### Types

```ts
/**
 * Per-prop transformation specification.
 * Maps each active LOOPComponent to its own integer period.
 *
 * period semantics: how many passes before this component returns to identity.
 *   Any component (ROTATED, MIRRORED, FLIPPED, SWAPPED, INVERTED, REWOUND)
 *   can operate at any period: 2, 4, 8, or beyond.
 *   2 = returns to identity in 2 passes
 *   4 = returns to identity in 4 passes
 *   8 = returns to identity in 8 passes (L5, reserved)
 *
 * Absent or empty map = pure repeated (no transformation).
 */
export interface PropLOOPSpec {
  readonly components: ReadonlyMap<LOOPComponent, number>;
}

/**
 * Full LOOP specification for a sequence.
 * Each prop has an independent transformation spec.
 *
 * SWAPPED is a cross-prop operation — validation requires it appear in both
 * blue and red with the same period, or in neither.
 */
export interface LOOPSpec {
  readonly blue?: PropLOOPSpec;
  readonly red?: PropLOOPSpec;
}

/** Overall period: LCM of all active component periods across both props. */
export function loopSpecPeriod(spec: LOOPSpec): number {
  const periods: number[] = [];
  for (const prop of [spec.blue, spec.red]) {
    if (prop) {
      for (const p of prop.components.values()) {
        periods.push(p);
      }
    }
  }
  return periods.length === 0 ? 1 : periods.reduce(lcm, 1);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}
```

### Named period constants (replace `Period` enum)

```ts
// Replaces Period.HALVED, Period.QUARTERED
export const PERIOD_HALVED   = 2;
export const PERIOD_QUARTERED = 4;
export const PERIOD_OCTAVED  = 8;  // L5 — reserved
```

`Period` enum is deprecated and kept only as a compatibility alias during transition:
```ts
/** @deprecated Use numeric literals 2, 4, 8 */
export const Period = { HALVED: 2, QUARTERED: 4 } as const;
```

---

## LOOPType Enum: Scope Reduction

`LOOPType` becomes a **serialization token only**. It:

- Stays as a TypeScript string enum for Firestore field values and MCP API strings
- Is **removed from all internal logic** (no more switch/case on LOOPType in validator, position selector, executor selector, generation, detection)
- Lives in a `serialization/` subpath to signal its boundary-only role

The two duplicate definitions (`loop-types.ts` in sequence-engine, `circular-models.ts` in app) are consolidated into one in `loop-spec.ts`, with the app importing from the package.

---

## Component Enum: Consolidation

`LOOPComponent` is currently defined in two places:

- `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` (simple 6-value version)
- `src/lib/features/create/generate/shared/domain/models/generate-models.ts` (richer, with reserved orientation primitives)

The richer version (including `ZONE_HOLD_INVERT`, `ZONE_HOLD_FLIP`, `ZONE_CROSS`) becomes the canonical one in `loop-spec.ts`. The engine imports it from there. The app's `generate-models.ts` re-exports from the package.

---

## SequenceData Migration

```ts
// Add:
readonly loopSpec?: LOOPSpec;

// Keep deprecated during migration:
/** @deprecated Use loopSpec */
readonly loopType?: LOOPType | null;
```

Hydration reads `loopSpec` if present. If absent but `loopType` exists, converts via `loopSpecFromLegacy`. After a backfill migration, `loopType` is removed from `SequenceData`.

---

## GenerationOptions Migration

```ts
// Add:
loopSpec?: LOOPSpec;

// Keep deprecated:
/** @deprecated Use loopSpec */
loopType?: LOOPType;
/** @deprecated Period is now per-component in loopSpec */
period?: number;
```

Generation entry point normalizes: if `loopType` present but not `loopSpec`, calls `loopSpecFromLegacy(loopType, period ?? 2)`.

---

## Execution Pipeline Changes

### LOOPExecutorSelector

Before: `getExecutor(loopType: LOOPType): ILOOPExecutor`

After: `getExecutors(spec: PropLOOPSpec): ILOOPExecutor[]` — returns ordered executors for a single prop, one per active component. Executors are composed in order: ROTATED → MIRRORED → FLIPPED → INVERTED → SWAPPED.

Each executor transforms **one prop's motions** for one component. SWAPPED is the only cross-prop executor — it receives both props' motions and swaps them.

### LOOPValidator

Before: `switch(loopType)` dispatch to different validation sets.

After: Compositional check — decompose the validation set requirements:

```ts
function isLOOPValidForPositionPair(spec: LOOPSpec, pair: string, period: number): boolean {
  const blueComponents = spec.blue?.components ?? new Map();
  const redComponents = spec.red?.components ?? new Map();
  const allComponents = new Set([...blueComponents.keys(), ...redComponents.keys()]);

  const hasRotated  = allComponents.has(LOOPComponent.ROTATED);
  const hasMirrored = allComponents.has(LOOPComponent.MIRRORED);
  const hasSwapped  = allComponents.has(LOOPComponent.SWAPPED);
  // ...

  let valid = true;
  if (hasRotated)  valid &&= rotationSet(period).has(pair);
  if (hasMirrored) valid &&= MIRRORED_LOOP_VALIDATION_SET.has(pair);
  if (hasSwapped && !hasRotated && !hasMirrored) valid &&= SWAPPED_LOOP_VALIDATION_SET.has(pair);
  // SWAPPED + ROTATED and SWAPPED + MIRRORED handled via composed sets
  return valid;
}
```

Any new primitive never requires a new case — only a new validation set if its valid positions differ from existing ones.

### LOOPEndPositionSelector

Same pattern: replace switch cases with component presence checks. `hasRotated`, `hasMirrored`, `hasFlipped` etc. drive the selection logic. Compound behavior falls out naturally from composition.

---

## Detection Changes

The app-side `LOOPDetector` (in `features/create/generate/circular`) and the engine-side `LOOPDetector` are updated to emit `LOOPSpec` directly — no more `resolveComponentsToLOOPType` bridge.

### Per-prop detection algorithm

```
1. Split steps into blue motions and red motions.
2. For each prop independently:
   a. Detect circular (ends where it starts, prop-level).
   b. Run halved comparer: detect which components activate at period 2.
   c. Run quartered comparer: detect which components activate at period 4.
   d. Build PropLOOPSpec with per-component periods.
3. Assemble LOOPSpec { blue, red }.
4. Compute overall period = loopSpecPeriod(spec).
```

`RichLOOPDetectionResult` drops `loopType: LOOPType | null`. Adds `spec: LOOPSpec | null`.

`LOOPComponentId[]` in the functional API (`LOOPDetectionResult`) becomes `LOOPComponent[]` (no string alias needed).

The bridge function `resolveComponentsToLOOPType` is deleted.

---

## Serialization / Backward Compatibility

### Legacy read (Firestore → SequenceData)

```ts
export function loopSpecFromLegacy(loopType: string, period: number): LOOPSpec {
  const components = new Map<LOOPComponent, number>();
  // All components get the stored period — any component can operate at any period.
  // Legacy LOOPType used one shared period for all components; this is the best
  // lossless reconstruction available from the old format.
  if (loopType.includes("rotated"))  components.set(LOOPComponent.ROTATED, period);
  if (loopType.includes("mirrored")) components.set(LOOPComponent.MIRRORED, period);
  if (loopType.includes("flipped"))  components.set(LOOPComponent.FLIPPED, period);
  if (loopType.includes("swapped"))  components.set(LOOPComponent.SWAPPED, period);
  if (loopType.includes("inverted")) components.set(LOOPComponent.INVERTED, period);
  if (loopType.includes("rewound"))  components.set(LOOPComponent.REWOUND, period);
  const prop: PropLOOPSpec = { components };
  return { blue: prop, red: prop };  // legacy = symmetric, both props identical
}
```

### Modern write (LOOPSpec → Firestore)

Firestore stores `loopSpec` as a plain object (JSON-serializable). The `components` map serializes as `{ "rotated": 4, "mirrored": 4 }` per prop (each component stores its own integer period).

Old `loopType` field is written as a derived string for legacy clients during transition, then removed after backfill.

### MCP API boundary

MCP tools accept `loopType` as a string param (e.g. `"mirrored_rotated"`). The `engine-generation-adapter` parses this string into a `LOOPSpec` via `loopSpecFromLegacy`. The internal pipeline never sees the string.

---

## What Does NOT Change

- Internal comparer labels (`rotated_90_cw`, `mirrored`, etc.) — geometric, not domain
- Beat pair generation (`generateHalvedBeatPairs`, `generateQuarteredBeatPairs`)
- Individual executor class implementations (they transform their single component correctly already)
- MCP API string interface — users/LLMs keep sending `"mirrored_rotated"` etc.
- Firestore `loopType` field — retained until backfill migration runs

---

## File Impact Summary

| File | Change |
|---|---|
| `packages/sequence-engine/src/loop/loop-spec.ts` | **New** — `LOOPSpec`, `PropLOOPSpec`, `loopSpecPeriod`, period constants |
| `packages/sequence-engine/src/loop/loop-types.ts` | Deprecated — keep `LOOPType` enum only, add `@deprecated` JSDoc |
| `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` | Emit `LOOPSpec`, delete `resolveComponentsToLOOPType`, per-prop detection |
| `packages/sequence-engine/src/loop/validation/LOOPValidator.ts` | Replace switch → compositional component checks |
| `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts` | Replace switch → component checks |
| `packages/sequence-engine/src/loop/targeting/LOOPEndOrientationSelector.ts` | Replace `=== LOOPType.X` checks → component checks |
| `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts` | Replace `Map<LOOPType, ILOOPExecutor>` → `getExecutors(PropLOOPSpec)` |
| `packages/sequence-engine/src/loop/execution/LOOPExecutor.ts` | Update to use `LOOPSpec` |
| `packages/sequence-engine/src/generation/capacity/minimum-length-calculator.ts` | Replace `LOOPType` param → `LOOPSpec` |
| `src/lib/shared/foundation/domain/models/SequenceData.ts` | Add `loopSpec?: LOOPSpec`, deprecate `loopType` |
| `src/lib/features/create/generate/shared/domain/models/generate-models.ts` | Re-export `LOOPComponent` from package, remove duplicate |
| `src/lib/features/create/generate/shared/domain/models/generate-models.ts` | Add `loopSpec?` to `GenerationOptions`, deprecate `loopType` / `period` |
| `src/lib/features/create/generate/circular/domain/models/circular-models.ts` | Remove duplicate `LOOPType`, import from package |
| `src/lib/features/create/generate/shared/services/implementations/LOOPTypeResolver.ts` | Delete (replaced by `loopSpecFromLegacy` + direct spec construction) |
| `src/lib/features/loop-labeler/services/loop-display-resolver.ts` | Update to read `LOOPSpec` from sequence |
| `src/lib/shared/navigation/services/implementations/SequenceHydrator.ts` | Hydrate `loopSpec` from detector |
| `mcp-server/src/core/engine-generation-adapter.ts` | Parse `loopType` string → `LOOPSpec` at boundary |
| `deployment/functions/src/broadcast/loop-executor.ts` | Replace switch dispatch → `LOOPSpec` |

---

## Validation Rules

1. **SWAPPED symmetry**: if `spec.blue.components.has(SWAPPED)`, then `spec.red.components.has(SWAPPED)` must also be true with the same period (and vice versa).
2. **Minimum period**: each component's period ≥ 2.
3. **Valid combination**: any combination of components is valid by definition — no enum gate needed.
4. **Empty spec**: `LOOPSpec` with no components in either prop = non-circular (not a LOOP).

---

## Testing Strategy

1. **Golden snapshots**: all currently-detected sequences emit equivalent `LOOPSpec` after migration (no regression).
2. **Per-prop detection**: `c3f8a1b0` detects as `{ blue: undefined, red: { ROTATED: 4 } }`.
3. **Symmetric legacy sequences**: `loopSpecFromLegacy("mirrored_rotated", 4)` → `{ blue: { MIRRORED:4, ROTATED:4 }, red: same }`.
4. **Validator compositional**: `isLOOPValidForPositionPair` returns same results as old switch for all 16 legacy types.
5. **Period arithmetic**: `loopSpecPeriod({ blue: { MIRRORED:4 }, red: { ROTATED:4 } })` = 4.
6. **SWAPPED symmetry validation**: spec with SWAPPED in blue only throws.
7. **Executor composition**: per-prop executor chain applies components in correct order.

---

## Open Questions

1. Per-prop INVERTED without SWAPPED: one prop going PRO while the other goes ANTI — is this mechanically realizable? Needs a test sequence.
2. The `repeated` and `modular` components in `loop-components.ts` — are these `LOOPComponent` values, or a separate taxonomy? They're not in the current `LOOPComponent` enum and may belong in a different spec.
3. Validator position sets: the existing validation sets (e.g. `MIRRORED_LOOP_VALIDATION_SET`) were derived assuming period 2 for MIRRORED. Do they need separate sets for period 4 MIRRORED, or does the same set hold?
