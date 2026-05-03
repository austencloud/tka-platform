# LOOPSpec: Compositional LOOP Type Migration

**Date:** 2026-05-02
**Status:** Draft

---

## Motivation

`LOOPType` is a flat enum of 16 string combinations (`"mirrored_inverted_rotated"`, etc.). Every new combination requires a new enum value. Adding a new primitive multiplies the enum. Per-prop independence is unrepresentable. Component-level periods are impossible.

The breaking evidence: a real sequence exists (`c3f8a1b0`) where blue repeats a 4-beat motif identically while red performs a quartered rotation. The current detector labels it `loop: none`. No `LOOPType` string can express it. This isn't theoretical — it's live data.

A second problem: all existing compound executors hardcode the non-ROTATED components to `Period.HALVED` (period 2). `MirroredRotatedExecutor` calls `mirroredExecutor.executeLOOP(rotatedSequence, Period.HALVED)` — the MIRRORED period is not configurable. MIRRORED, FLIPPED, SWAPPED, and INVERTED can each operate at period 4 (or 8), but the current architecture has no way to express or execute this.

The modern model: a LOOP is a **per-prop map of transform primitives to their own integer periods**. The flat enum becomes a serialization artifact at the API boundary only.

---

## Discovery: per-prop independence

Sequence `c3f8a1b0` (16 beats, diamond grid):

- **Blue** — identical 4-beat motif × 4 (`s>n, n>w, w>e, e>s` repeating). Pure repeated.
- **Red** — start locations per pass: `[s,e,n,e]` → `[w,s,e,s]` → `[n,w,s,w]` → `[e,n,w,n]`. Each pass is the previous rotated 90° CW. ROTATED at period 4.

Current label: `loop: none`. Correct label under new model:
```ts
{
  blue: undefined,                                        // repeated — absent = no transform
  red: { components: new Map([[ROTATED, { period: 4 }]]) }
}
```

Overall sequence period = LCM(1, 4) = 4.

---

## New Canonical Types

### Home

`packages/sequence-engine/src/loop/loop-spec.ts` — single source of truth for both runtime types and serialization helpers. App imports from the package; the duplicate in `circular-models.ts` is deleted.

### Runtime types

```ts
import type { LOOPComponent, LOOPDomain } from "./loop-spec.js";

/**
 * Specification for a single component within a PropLOOPSpec.
 * period: how many passes before this component returns to identity.
 *   Any component (ROTATED, MIRRORED, FLIPPED, SWAPPED, INVERTED, REWOUND)
 *   can operate at period 2, 4, 8, or any integer ≥ 2.
 * domain: which space the transform acts in. Absent = location (default).
 */
export interface ComponentSpec {
  readonly period: number;
  readonly domain?: LOOPDomain; // "location" | "orientation" | "both"
}

/**
 * Per-prop LOOP specification.
 * Maps each active LOOPComponent to its ComponentSpec.
 * Absent or empty map = pure repeated (no transformation).
 */
export interface PropLOOPSpec {
  readonly components: ReadonlyMap<LOOPComponent, ComponentSpec>;
}

/**
 * Full LOOP specification for a sequence.
 * Each prop has an independent transformation spec.
 *
 * SWAPPED is cross-prop: validation requires it in both blue and red
 * with matching periods, or in neither.
 */
export interface LOOPSpec {
  readonly blue?: PropLOOPSpec;
  readonly red?: PropLOOPSpec;
}
```

### Wire format (JSON / Firestore)

`ReadonlyMap` is not JSON-serializable. The wire format uses plain objects:

```ts
// Firestore / JSON on-disk format
export interface ComponentSpecWire {
  period: number;
  domain?: LOOPDomain;
}
export interface PropLOOPSpecWire {
  [component: string]: ComponentSpecWire;
}
export interface LOOPSpecWire {
  blue?: PropLOOPSpecWire;
  red?: PropLOOPSpecWire;
}

// Hydration helpers (live in loop-spec.ts)
export function propLOOPSpecFromWire(wire: PropLOOPSpecWire): PropLOOPSpec
export function propLOOPSpecToWire(spec: PropLOOPSpec): PropLOOPSpecWire
export function loopSpecFromWire(wire: LOOPSpecWire): LOOPSpec
export function loopSpecToWire(spec: LOOPSpec): LOOPSpecWire
```

The Firestore adapter calls these; the rest of the app never touches the wire format.

### Period utilities

```ts
/** Overall sequence period: LCM of all component periods across both props. */
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

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b; // avoid overflow vs (a*b)/gcd
}

// Named period constants — preferred over magic numbers in call sites
export const PERIOD_HALVED    = 2;
export const PERIOD_QUARTERED = 4;
export const PERIOD_OCTAVED   = 8; // L5 — reserved
```

### Period enum deprecation

```ts
/** @deprecated Use numeric literals 2, 4, 8 or PERIOD_* constants. */
export const Period = { HALVED: 2, QUARTERED: 4 } as const;
```

---

## LOOPType Enum: Scope Reduction

`LOOPType` becomes a **serialization token only**:

- Kept as a TypeScript string enum for Firestore field values and MCP API strings
- **Removed from all internal logic** — no switch/case on LOOPType in validator, position selector, executor selector, generation pipeline, or detection
- Moved to `packages/sequence-engine/src/loop/serialization/loop-type-tokens.ts` — the path signals boundary-only role

The two duplicate definitions (`loop-types.ts` and `circular-models.ts`) consolidate into `loop-spec.ts` (new types) and `serialization/loop-type-tokens.ts` (legacy enum).

---

## LOOPComponent Enum: Consolidation

Currently defined in two places with divergent content:

- `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` — simple 6-value version
- `src/lib/features/create/generate/shared/domain/models/generate-models.ts` — richer, includes reserved orientation primitives (`ZONE_HOLD_INVERT`, `ZONE_HOLD_FLIP`, `ZONE_CROSS`)

The richer version becomes canonical in `loop-spec.ts`. The engine imports from the package. `generate-models.ts` re-exports from the package rather than defining its own.

---

## SequenceData Migration

```ts
// Add (new canonical field):
readonly loopSpec?: LOOPSpec;

// Deprecate (kept for Firestore backward compat during migration):
/** @deprecated Use loopSpec */
readonly loopType?: LOOPType | null;
/** @deprecated Period is now per-component in loopSpec */
readonly period?: number;
```

Hydration priority: `loopSpec` (wire) → convert via `loopSpecFromWire`. If absent but `loopType` present → convert via `loopSpecFromLegacy(loopType, period ?? 2)`. After a full backfill migration, `loopType` and `period` are dropped from SequenceData.

---

## GenerationOptions Migration

```ts
// Add:
loopSpec?: LOOPSpec;

// Deprecate:
/** @deprecated Use loopSpec */
loopType?: LOOPType;
/** @deprecated Period is now per-component in loopSpec */
period?: number;
```

Generation entry point normalizes on intake: `loopType` + `period` → `loopSpec` via `loopSpecFromLegacy`. All downstream generation logic receives `loopSpec` only.

---

## Execution Pipeline Changes

### Composition order

The existing compound executors establish a canonical order, confirmed by `LOOPEndPositionSelector`'s documented precedence:

```
1. ROTATED   — outer periodic structure; determines how many passes
2. MIRRORED  — vertical reflection; applied after rotation
3. FLIPPED   — horizontal reflection
4. INVERTED  — PRO↔ANTI motion type flip; position-independent
5. SWAPPED   — blue↔red exchange; cross-prop, always last
```

This order is not arbitrary — it matches the existing compound executors (e.g. `MirroredRotatedExecutor` applies ROTATED first, then MIRRORED). **Changing this order produces different sequences and breaks all existing data.** New code must preserve it.

### What changes in compound executors

All current compound executors that contain MIRRORED, FLIPPED, INVERTED, or SWAPPED **hardcode those components to `Period.HALVED`**. For example:

```ts
// Current MirroredRotatedExecutor — MIRRORED period hardcoded:
const rotatedSequence = this.rotatedExecutor.executeLOOP(sequence, period);
const finalSequence = this.mirroredExecutor.executeLOOP(rotatedSequence, Period.HALVED); // ← hardcoded
```

In the new model, each component's period comes from the `PropLOOPSpec`. Compound executors receive the full `PropLOOPSpec` and read each component's period:

```ts
// New signature for all executors:
executeLOOP(sequence: SequenceStep[], spec: PropLOOPSpec): SequenceStep[]

// MirroredRotatedExecutor refactored:
executeLOOP(sequence: SequenceStep[], spec: PropLOOPSpec): SequenceStep[] {
  const rotatedPeriod  = spec.components.get(LOOPComponent.ROTATED)?.period  ?? 2;
  const mirroredPeriod = spec.components.get(LOOPComponent.MIRRORED)?.period ?? 2;
  const rotated  = this.rotatedExecutor.executeLOOP(sequence, singleComponentSpec(ROTATED, rotatedPeriod));
  const mirrored = this.mirroredExecutor.executeLOOP(rotated,  singleComponentSpec(MIRRORED, mirroredPeriod));
  return mirrored;
}
```

### LOOPExecutorSelector

Before: `getExecutor(loopType: LOOPType): ILOOPExecutor` — map lookup by flat enum.

After: `getExecutors(spec: PropLOOPSpec): ILOOPExecutor[]` — returns the ordered executor chain for a single prop. Executors fire in composition order. Each executor receives the full `PropLOOPSpec` and reads only its own component's period.

SWAPPED is the only cross-prop executor. It receives both props' specs and sequences simultaneously.

### LOOPValidator

Before: `switch(loopType)` dispatches to hard-coded validation sets with a shared `period` parameter.

After: each component reads its own period from the spec. The validator composes validation sets per component:

```ts
function isLOOPValidForPositionPair(spec: LOOPSpec, positionPair: string): boolean {
  // Collect all active components across both props
  const active = new Map<LOOPComponent, number>(); // component → its period
  for (const prop of [spec.blue, spec.red]) {
    if (!prop) continue;
    for (const [comp, { period }] of prop.components) {
      // Symmetric case: same component in both props → use that period
      // Asymmetric case: component in one prop only → still validate
      if (!active.has(comp) || active.get(comp)! < period) {
        active.set(comp, period);
      }
    }
  }

  const hasRotated  = active.has(LOOPComponent.ROTATED);
  const hasMirrored = active.has(LOOPComponent.MIRRORED);
  const hasFlipped  = active.has(LOOPComponent.FLIPPED);
  const hasSwapped  = active.has(LOOPComponent.SWAPPED);
  const hasInverted = active.has(LOOPComponent.INVERTED);

  let valid = true;
  if (hasRotated)                      valid &&= rotationValidationSet(active.get(LOOPComponent.ROTATED)!).has(positionPair);
  if (hasMirrored && !hasRotated)      valid &&= MIRRORED_LOOP_VALIDATION_SET.has(positionPair);
  if (hasMirrored && hasRotated)       valid &&= MIRRORED_LOOP_VALIDATION_SET.has(positionPair) && rotationValidationSet(active.get(LOOPComponent.ROTATED)!).has(positionPair);
  if (hasFlipped && !hasRotated)       valid &&= FLIPPED_LOOP_VALIDATION_SET.has(positionPair);
  if (hasSwapped && !hasRotated && !hasMirrored) valid &&= SWAPPED_LOOP_VALIDATION_SET.has(positionPair);
  if (hasInverted && !hasMirrored && !hasSwapped && !hasRotated) valid &&= INVERTED_LOOP_VALIDATION_SET.has(positionPair);
  return valid;
}
```

**Note:** The existing validation sets (`MIRRORED_LOOP_VALIDATION_SET`, etc.) were derived assuming period 2 for non-ROTATED components. Whether these sets remain valid when those components operate at period 4 is an open question that requires empirical verification with period-4 sequences (see Open Questions).

### LOOPEndPositionSelector

Replaces switch/case with the same compositional precedence already documented in the current code (ROTATED > MIRRORED > INVERTED > SWAPPED):

```ts
determineEndPosition(spec: LOOPSpec, startPosition: string): string | null {
  const components = mergeActiveComponents(spec); // union across both props

  if (components.has(LOOPComponent.ROTATED)) {
    return this.rotatedSelector.determineRotatedEndPosition(
      components.get(LOOPComponent.ROTATED)!.period,
      startPosition
    );
  }
  if (components.has(LOOPComponent.MIRRORED)) {
    const mirrored = VERTICAL_MIRROR_POSITION_MAP[startPosition] ?? null;
    if (mirrored && components.has(LOOPComponent.SWAPPED))
      return SWAPPED_POSITION_MAP[mirrored] ?? null;
    return mirrored;
  }
  if (components.has(LOOPComponent.FLIPPED))
    return HORIZONTAL_MIRROR_POSITION_MAP[startPosition] ?? null;
  if (components.has(LOOPComponent.INVERTED))
    return startPosition; // inverted returns to start
  if (components.has(LOOPComponent.SWAPPED))
    return SWAPPED_POSITION_MAP[startPosition] ?? null;
  return null; // REWOUND, REPEATED — no constraint
}
```

### LOOPEndOrientationSelector

Replaces `=== LOOPType.ROTATED` and `=== LOOPType.SWAPPED` checks with `components.has(LOOPComponent.ROTATED)` etc. The logic is otherwise identical.

---

## Detection Changes

### Per-prop algorithm

The detector splits the sequence by prop and analyzes each independently:

```
For each prop (blue, red):
  1. Isolate this prop's locations and motion types across all beats.
  2. For each candidate period P in [2, 4, 8, ...]:
     a. Split the motif into P equal passes.
     b. For each LOOPComponent:
        - ROTATED:  does each pass's start-locations equal the previous pass's start-locations rotated by (360/P)°?
        - MIRRORED: does pass 2 equal pass 1 vertically mirrored? (for P=2: pass2=mirror(pass1), for P=4: pass3=mirror(pass1), pass4=mirror(pass2))
        - FLIPPED:  same, horizontal mirror
        - SWAPPED:  does this prop's pattern in pass 2 equal the OTHER prop's pattern in pass 1?
        - INVERTED: does each pass's motion types equal the previous pass's motion types PRO↔ANTI flipped?
        - REWOUND:  does pass 2 equal pass 1 reversed?
     c. If the test passes for component C at period P, record C → { period: P }.
  3. Build PropLOOPSpec from recorded components.
Assemble LOOPSpec { blue, red }.
```

Detection tries periods from lowest to highest and records the **minimum period** that satisfies each component — a component at period 2 is not re-recorded at period 4.

`RichLOOPDetectionResult` changes:
```ts
// Before:
loopType: LOOPType | null;
period: Period | null;

// After:
spec: LOOPSpec | null;
// loopType and period removed — no bridge function needed
```

`resolveComponentsToLOOPType` is deleted.

`LOOPComponentId` string union in `LOOPDetectionResult` (functional API) becomes `LOOPComponent` enum values directly.

---

## Serialization / Backward Compatibility

### Legacy read (Firestore → SequenceData)

```ts
/**
 * Convert a legacy LOOPType string + single period to a LOOPSpec.
 * Legacy sequences stored ONE period for all components; we assign it
 * uniformly to all detected components — best lossless reconstruction
 * from the old format. For exact per-component periods, re-run the
 * detector against the stored steps.
 */
export function loopSpecFromLegacy(loopType: string, period: number): LOOPSpec {
  const components = new Map<LOOPComponent, ComponentSpec>();
  if (loopType.includes("rotated"))  components.set(LOOPComponent.ROTATED,  { period });
  if (loopType.includes("mirrored")) components.set(LOOPComponent.MIRRORED, { period });
  if (loopType.includes("flipped"))  components.set(LOOPComponent.FLIPPED,  { period });
  if (loopType.includes("swapped"))  components.set(LOOPComponent.SWAPPED,  { period });
  if (loopType.includes("inverted")) components.set(LOOPComponent.INVERTED, { period });
  if (loopType.includes("rewound"))  components.set(LOOPComponent.REWOUND,  { period });
  const prop: PropLOOPSpec = { components };
  return { blue: prop, red: prop }; // legacy = symmetric, both props identical
}
```

The uniform period assignment is a known approximation. For sequences where per-component periods differ (e.g. MIRRORED at 2, ROTATED at 4), legacy data is under-specified. The correct fix is to re-detect from steps using the new per-prop detector — this is the preferred migration path for any sequence where steps are available.

### Modern write (LOOPSpec → Firestore)

```ts
// Stored under the "loopSpec" field on the sequence document:
const wire: LOOPSpecWire = loopSpecToWire(spec);
// wire.blue = { "rotated": { period: 4 }, "mirrored": { period: 4 } }
// wire.red  = undefined (absent = repeated)
```

During the migration window, the Firestore adapter also derives and writes the legacy `loopType` string for backward-compatible reads by old clients. Once backfill is confirmed complete, the legacy write is removed.

### MCP API boundary

MCP tools accept `loopType` as a string (e.g. `"mirrored_rotated"`) and `period` as an integer. `engine-generation-adapter.ts` calls `loopSpecFromLegacy(loopType, period)` at the boundary. The internal pipeline receives `LOOPSpec` only — never the raw string.

---

## UI (Separate Phase)

`LOOPPicker` currently presents a flat list of `LOOPType` options. Under the new model, a fully compositional UI would let the user select:

- Per-prop components independently (blue vs red)
- Per-component period

This is a significant UX redesign and is **out of scope for this migration**. In Phase 1, `LOOPPicker` continues to work with `LOOPType` strings at the surface layer; the adapter converts to `LOOPSpec` internally. The UI redesign is a follow-on spec.

Similarly, the generation strategy for choosing which props get which components at which periods (the generative UI in `LOOPCard` / `ConsolidatedLOOPCard`) is a follow-on.

---

## What Does NOT Change

- Internal comparer labels (`rotated_90_cw`, `mirrored`, etc.) — geometric names in the detector internals
- Beat pair generation (`generateHalvedBeatPairs`, `generateQuarteredBeatPairs`)
- MCP API string interface — callers keep sending `"mirrored_rotated"` etc.
- Firestore `loopType` field — retained until backfill migration confirms all reads succeed

---

## File Impact Summary

| File | Change |
|---|---|
| `packages/sequence-engine/src/loop/loop-spec.ts` | **New** — `LOOPSpec`, `PropLOOPSpec`, `ComponentSpec`, wire types, hydration helpers, period constants, `loopSpecFromLegacy`, `loopSpecPeriod` |
| `packages/sequence-engine/src/loop/serialization/loop-type-tokens.ts` | **New** — `LOOPType` enum relocated here (boundary only) |
| `packages/sequence-engine/src/loop/loop-types.ts` | Delete after relocating; callers updated to import from `loop-spec.ts` / `loop-type-tokens.ts` |
| `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` | Emit `LOOPSpec` directly; per-prop detection; delete `resolveComponentsToLOOPType`; consolidate local `LOOPComponent` enum into package import |
| `packages/sequence-engine/src/loop/validation/LOOPValidator.ts` | Replace `switch(loopType)` → compositional component checks; remove global `period` param |
| `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts` | Replace `switch(loopType)` → component precedence checks; accept `LOOPSpec` not `LOOPType` |
| `packages/sequence-engine/src/loop/targeting/LOOPEndOrientationSelector.ts` | Replace `=== LOOPType.X` checks → `components.has(...)` |
| `packages/sequence-engine/src/loop/execution/ILOOPExecutor.ts` | Update signature: `executeLOOP(seq, spec: PropLOOPSpec)` |
| `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts` | Replace `Map<LOOPType, ILOOPExecutor>` → `getExecutors(PropLOOPSpec): ILOOPExecutor[]` |
| `packages/sequence-engine/src/loop/execution/MirroredRotatedExecutor.ts` | Read per-component periods from `PropLOOPSpec` instead of hardcoded `Period.HALVED` |
| `packages/sequence-engine/src/loop/execution/MirroredRotatedInvertedExecutor.ts` | Same |
| `packages/sequence-engine/src/loop/execution/MirroredRotatedInvertedSwappedExecutor.ts` | Same |
| `packages/sequence-engine/src/loop/execution/MirroredSwappedInvertedExecutor.ts` | Accept `PropLOOPSpec`; use stored period instead of ignoring param |
| `packages/sequence-engine/src/loop/execution/LOOPExecutor.ts` | Accept `LOOPSpec`; route per-prop |
| `packages/sequence-engine/src/generation/capacity/minimum-length-calculator.ts` | Replace `LOOPType` param → `LOOPSpec` |
| `src/lib/shared/foundation/domain/models/SequenceData.ts` | Add `loopSpec?: LOOPSpec`; deprecate `loopType`, `period` |
| `src/lib/features/create/generate/shared/domain/models/generate-models.ts` | Re-export `LOOPComponent`, `ComponentSpec`, `PropLOOPSpec`, `LOOPSpec` from package; remove duplicates |
| `src/lib/features/create/generate/circular/domain/models/circular-models.ts` | Remove duplicate `LOOPType` and `Period`; import from package |
| `src/lib/features/create/generate/shared/domain/models/generate-models.ts` | Add `loopSpec?` to `GenerationOptions`; deprecate `loopType` / `period` |
| `src/lib/features/create/generate/shared/services/implementations/LOOPTypeResolver.ts` | Delete — replaced by `loopSpecFromLegacy` + direct spec construction |
| `src/lib/features/loop-labeler/services/loop-display-resolver.ts` | Read `LOOPSpec` from sequence; fall back to `loopSpecFromLegacy` |
| `src/lib/shared/navigation/services/implementations/SequenceHydrator.ts` | Hydrate `loopSpec` from detector output |
| `mcp-server/src/core/engine-generation-adapter.ts` | `loopType` string + `period` → `loopSpecFromLegacy` at boundary |
| `deployment/functions/src/broadcast/loop-executor.ts` | Replace switch dispatch → `LOOPSpec` routing |

---

## Validation Rules

1. **SWAPPED symmetry**: `spec.blue.components.has(SWAPPED)` iff `spec.red.components.has(SWAPPED)` with equal period.
2. **Minimum period**: each component's period ≥ 2.
3. **Any combination valid**: no enum gate — any set of components at any periods is representable. Whether a given combination can be physically generated is a validator concern, not a type concern.
4. **Empty spec = non-LOOP**: `LOOPSpec` with no components in either prop = sequence is not circular under any LOOP transform.
5. **REWOUND is sequence-level**: REWOUND does not compose with other components within the same prop (it reverses the whole motif, making other per-pass transforms ill-defined). Validator rejects specs where REWOUND coexists with other components in the same `PropLOOPSpec`.

---

## Testing Strategy

1. **Golden snapshots** — all currently-detected sequences produce an equivalent `LOOPSpec` (verified by re-deriving `loopType` string from spec and comparing).
2. **Per-prop detection** — `c3f8a1b0` detects as `{ blue: undefined, red: { ROTATED: { period: 4 } } }`.
3. **Legacy converter round-trip** — `loopSpecFromLegacy("mirrored_rotated", 4)` → `{ blue: { MIRRORED: { period:4 }, ROTATED: { period:4 } }, red: same }`.
4. **Validator parity** — `isLOOPValidForPositionPair` returns identical results to old switch for all 16 legacy `LOOPType` values.
5. **Period LCM** — `loopSpecPeriod({ blue: { MIRRORED:{period:2} }, red: { ROTATED:{period:4} } })` = 4; `loopSpecPeriod({ blue: { ROTATED:{period:4} }, red: { MIRRORED:{period:2}, INVERTED:{period:3} } })` = LCM(4,2,3) = 12.
6. **SWAPPED symmetry** — spec with SWAPPED in blue only fails validation.
7. **Wire round-trip** — `loopSpecFromWire(loopSpecToWire(spec))` deep-equals the original spec.
8. **Compound executor period passthrough** — `MirroredRotatedExecutor` with `MIRRORED: { period:4 }` passes period 4 to the mirrored executor instead of hardcoded 2.
9. **REWOUND exclusivity** — spec with REWOUND + MIRRORED in same prop fails validation.

---

## Open Questions

1. **Validation sets at period 4 for non-ROTATED components**: `MIRRORED_LOOP_VALIDATION_SET` was derived for period-2 MIRRORED. Does it remain the correct valid-position constraint when MIRRORED operates at period 4? Needs a real period-4 MIRRORED sequence to verify — or a geometric proof.

2. **Per-prop position pair validation for asymmetric specs**: when blue is ROTATED and red is REPEATED, the composite position (both props) transforms on blue's side only. Do the existing composite-position validation sets still apply, or does asymmetric per-prop spec require a separate validator path?

3. **INVERTED without SWAPPED across props**: one prop PRO→ANTI while the other is unchanged — is this mechanically realizable? Currently all INVERTED sequences are symmetric. Needs a test sequence.

4. **`repeated` and `modular` in `loop-components.ts`**: these appear in the UI component palette but are absent from `LOOPComponent` enum. Are they `LOOPComponent` values to be added, or a separate higher-order taxonomy?
