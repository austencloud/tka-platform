# LOOPSpec: Compositional LOOP Type Migration

**Date:** 2026-05-02
**Status:** Draft

---

## Motivation

Three hard limits of the current `LOOPType` flat enum:

1. **Combinatorial wall**: 16 string values for 16 compound types. Adding a 7th primitive to 6 existing ones would require 64+ new enum values and 64+ new executor classes.
2. **Per-prop independence impossible**: sequence `c3f8a1b0` has blue repeating a motif while red performs quartered rotation. No `LOOPType` string can express this. The detector labels it `loop: none`.
3. **Per-component periods impossible**: all compound executors hardcode non-ROTATED components to `Period.HALVED`. MIRRORED, FLIPPED, SWAPPED, and INVERTED can each operate at any period (2, 4, 8), but the architecture can't express it.

The modern model: a LOOP is a **per-prop map of transform primitives to their own integer periods**. The flat enum becomes a serialization artifact at the API boundary.

---

## Discovery: per-prop independence

Sequence `c3f8a1b0` (16 beats, diamond grid):

- **Blue** — identical 4-beat motif × 4 (`s>n, n>w, w>e, e>s` repeating). No transformation.
- **Red** — start locations per pass: `[s,e,n,e]` → `[w,s,e,s]` → `[n,w,s,w]` → `[e,n,w,n]`. Each pass rotated 90° CW. ROTATED at period 4.

LOOPSpec:
```ts
{
  blue: undefined,                                        // repeated — no transform
  red: { components: new Map([[ROTATED, { period: 4 }]]) }
}
```

Overall period = LCM(1, 4) = 4.

---

## New Canonical Types

### Home

`packages/sequence-engine/src/loop/loop-spec.ts` — single source of truth. App imports from package.

### Runtime types

```ts
export interface ComponentSpec {
  readonly period: number;
  readonly domain?: LOOPDomain; // "location" | "orientation" | "both"; absent = location
}

export interface PropLOOPSpec {
  readonly components: ReadonlyMap<LOOPComponent, ComponentSpec>;
}

export interface LOOPSpec {
  readonly blue?: PropLOOPSpec;
  readonly red?: PropLOOPSpec;
}
```

### Wire format (JSON / Firestore)

```ts
export interface ComponentSpecWire {
  period: number;
  domain?: LOOPDomain;
}
export type PropLOOPSpecWire = Record<string, ComponentSpecWire>;
export interface LOOPSpecWire {
  blue?: PropLOOPSpecWire;
  red?: PropLOOPSpecWire;
}

// Hydration (live in loop-spec.ts)
export function loopSpecFromWire(wire: LOOPSpecWire): LOOPSpec;
export function loopSpecToWire(spec: LOOPSpec): LOOPSpecWire;
```

Firestore stores `loopSpec` as `LOOPSpecWire`. Example document:
```json
{
  "loopSpec": {
    "blue": { "rotated": { "period": 4 }, "mirrored": { "period": 2 } },
    "red": { "rotated": { "period": 4 }, "mirrored": { "period": 2 } }
  }
}
```

### Period utilities

```ts
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

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function lcm(a: number, b: number): number { return (a / gcd(a, b)) * b; }

export const PERIOD_HALVED    = 2;
export const PERIOD_QUARTERED = 4;
export const PERIOD_OCTAVED   = 8;
```

### Helper constructors

```ts
/** Build a PropLOOPSpec from a single component (common case). */
export function singleComponent(comp: LOOPComponent, period: number): PropLOOPSpec {
  return { components: new Map([[comp, { period }]]) };
}

/** Build a symmetric LOOPSpec where both props have identical transforms. */
export function symmetricSpec(components: ReadonlyMap<LOOPComponent, ComponentSpec>): LOOPSpec {
  const prop: PropLOOPSpec = { components };
  return { blue: prop, red: prop };
}

/** Collect all active components across both props, taking the max period where both have the same component. */
export function allActiveComponents(spec: LOOPSpec): ReadonlyMap<LOOPComponent, ComponentSpec> {
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
```

---

## LOOPType Enum: Scope Reduction

`LOOPType` kept as a TypeScript string enum for Firestore values and MCP API strings. Removed from all internal logic. Relocated to `packages/sequence-engine/src/loop/serialization/loop-type-tokens.ts`.

The two definitions diverge: `loop-types.ts` has 16 values (including `REWOUND`), while `circular-models.ts` has 15 values (uses `STRICT_REWOUND`, missing `MIRRORED_SWAPPED_INVERTED`). Both consolidate into `loop-spec.ts` (new types) and `loop-type-tokens.ts` (legacy enum, canonical 16-value version).

**Dead enum value:** `MIRRORED_ROTATED_SWAPPED` exists in the LOOPType enum but has no executor mapping in `LOOPExecutorSelector` (only 15 of 16 values are mapped). Phase 5 deletes it.

---

## LOOPComponent Enum: Consolidation

Currently in two places:
- `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` (simple 6-value)
- `src/lib/features/create/generate/shared/domain/models/generate-models.ts` (richer: +ZONE_HOLD_INVERT, ZONE_HOLD_FLIP, ZONE_CROSS)

The richer version becomes canonical in `loop-spec.ts`. Both consumers import from the package.

---

## SequenceData Migration

```ts
readonly loopSpec?: LOOPSpec;                    // new canonical field
/** @deprecated Use loopSpec */ readonly loopType?: LOOPType | null;
/** @deprecated Use loopSpec */ readonly period?: number;
```

Hydration priority: `loopSpec` (wire) → `loopSpecFromWire`. If absent but `loopType` exists → `loopSpecFromLegacy(loopType, period ?? 2)`.

## GenerationOptions Migration

```ts
loopSpec?: LOOPSpec;                             // new
/** @deprecated */ loopType?: LOOPType;
/** @deprecated */ period?: number;
```

Entry point normalizes: `loopType` + `period` → `loopSpec` via `loopSpecFromLegacy`.

---

## Execution Architecture

### The problem with naive chaining

The spec's first draft proposed chaining single-component executors: MIRRORED(N→2N) then SWAPPED(2N→4N). This is **wrong**. Sequentially doubling produces `N × period₁ × period₂` total steps — a period of `period₁ × period₂`. But the existing `MirroredSwappedExecutor` fuses both transforms into ONE doubling pass (N→2N, period 2). Sequential chaining would produce 4N (period 4). Different sequence, different period.

### Why it works as a single pass

MIRRORED, FLIPPED, SWAPPED, and INVERTED are independent field-level operations on `MotionData`:

| Operation | Position | Location | MotionType | RotDir | Prop assignment |
|---|---|---|---|---|---|
| MIRRORED | vertical mirror map | vertical mirror map | unchanged | flip CW↔CCW | same |
| FLIPPED | horizontal mirror map | horizontal mirror map | unchanged | flip CW↔CCW | same |
| SWAPPED | swap map | unchanged | unchanged | unchanged | blue↔red |
| INVERTED | unchanged | unchanged | PRO↔ANTI | flip CW↔CCW | same |

When multiple operate at the **same period**, they compose by combining field-level effects:
- **Rotation direction**: each MIRRORED/FLIPPED/INVERTED toggles CW↔CCW. Even count of flips = no change, odd = flip. (MirroredSwappedInvertedExecutor: all three of SWAP+MIRRORED+INVERTED together preserve rotation direction — confirmed by codebase comment "Mirror + Invert both flip hand direction → they cancel → preserve original".)
- **Position/location**: compose mirror maps (vertical ∘ horizontal, etc.)
- **Prop assignment**: SWAPPED swaps; all others preserve.
- **Motion type**: only INVERTED flips.

### New executor architecture: 3 executor classes replace 15 selector entries

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOOPExecutorSelector                         │
│                                                                 │
│  Input: PropLOOPSpec                                           │
│                                                                 │
│  1. Extract ROTATED (if present) → RotatedExecutor(period)     │
│  2. Group remaining {MIRRORED,FLIPPED,SWAPPED,INVERTED}        │
│     by period                                                   │
│  3. For each period group → FusedExecutor(flags, period)       │
│  4. Chain: ROTATED first (largest period), then fused groups   │
│     in descending period order                                  │
│                                                                 │
│  REWOUND: separate — applies independently (sequence reversal) │
│                                                                 │
│  SWAPPED: cross-prop — applied to both props' motions jointly  │
└─────────────────────────────────────────────────────────────────┘
```

**RotatedExecutor** — unchanged from `StrictRotatedExecutor`. Applies position rotation maps. Accepts period as integer.

**FusedExecutor** — new parametric class. Replaces all 14 compound executors:

```ts
interface FusedTransformFlags {
  mirror: boolean;
  flip: boolean;
  swap: boolean;
  invert: boolean;
}

class FusedExecutor implements ILOOPExecutor {
  constructor(private readonly flags: FusedTransformFlags) {}

  executeLOOP(sequence: SequenceStep[], period: number): SequenceStep[] {
    // Single doubling pass. For each new step:
    //   position  = compose(mirrorMap?, flipMap?, swapMap?)(matchingStep.endPosition)
    //   motions   = { blue: transform(flags, prevBlue, matchBlue, matchRed),
    //                 red:  transform(flags, prevRed,  matchRed,  matchBlue) }
    // Rotation direction: count flips from (mirror + flip + invert), even=keep, odd=flip
    // Motion type: invert flag ? PRO↔ANTI : keep
    // Prop source: swap flag ? read from other hand's matching step : same hand
  }
}
```

**RewoundExecutor** — unchanged. Sequence-level reversal.

**Chaining for mixed periods:**

For `{ ROTATED: { period: 4 }, MIRRORED: { period: 2 } }`:
1. RotatedExecutor(4): motif → 4× motif
2. FusedExecutor({ mirror:true })(2): 4× motif → 8× motif

For `{ MIRRORED: { period: 2 }, SWAPPED: { period: 2 } }`:
1. FusedExecutor({ mirror:true, swap:true })(2): motif → 2× motif

For `{ ROTATED: { period: 4 }, MIRRORED: { period: 4 }, INVERTED: { period: 2 } }`:
1. RotatedExecutor(4): motif → 4× motif
2. FusedExecutor({ mirror:true })(4): 4× motif → 16× motif
3. FusedExecutor({ invert:true })(2): 16× motif → 32× motif

Total period = product of all chained periods = 4 × 4 × 2 = 32.

**Why ROTATED is always first:** ROTATED uses position maps that transform composite positions. All other transforms operate on motion-level fields. ROTATED sets the positional structure; the others refine it. This matches existing compound executors (MirroredRotatedExecutor applies ROTATED first, then MIRRORED).

**Chain order for non-ROTATED groups:** Descending period. Largest-period group is the outer structure; smaller-period groups refine within it. This matches existing behavior (ROTATED(4) → MIRRORED(2) in MirroredRotatedExecutor).

### Per-prop execution

For asymmetric specs (blue and red have different components):

```ts
function executeLOOPSpec(motif: SequenceStep[], spec: LOOPSpec): SequenceStep[] {
  // 1. If spec is symmetric (blue === red), execute as before (both props together)
  if (specsAreEqual(spec.blue, spec.red)) {
    return executeSymmetric(motif, spec.blue ?? EMPTY_SPEC);
  }

  // 2. Asymmetric: split motif into per-prop motion sequences
  const blueMotions = motif.map(s => s.motions.blue);
  const redMotions  = motif.map(s => s.motions.red);

  // 3. Execute each prop's transforms independently
  const blueResult = executePropChain(blueMotions, spec.blue ?? EMPTY_SPEC);
  const redResult  = executePropChain(redMotions,  spec.red  ?? EMPTY_SPEC);

  // 4. Reconcile: zip per-prop results back into SequenceSteps
  //    Compute composite positions from per-hand end locations
  return reconcileProps(blueResult, redResult, motif);
}
```

The `reconcileProps` step maps per-hand locations back to composite positions (alpha/beta/gamma). This uses the existing grid position deriver that already handles `(blueLocation, redLocation) → compositePosition`.

### SWAPPED in per-prop execution

SWAPPED is cross-prop: it exchanges blue and red patterns. In a symmetric spec, SWAPPED is handled inside the FusedExecutor (blue reads from red's matching step, red reads from blue's). In an asymmetric spec, SWAPPED must appear in BOTH props at the same period (enforced by validation). The per-prop executor handles it by passing both props' motions to the FusedExecutor simultaneously when SWAPPED is active.

---

## Validator

Before: `switch(loopType)` with 9 case blocks (fallthrough covers ~14 of 16 types).

After: compositional. Each component independently constrains the valid position pairs:

```ts
function isLOOPValidForSpec(spec: LOOPSpec, positionPair: string): boolean {
  const active = allActiveComponents(spec);

  let valid = true;
  for (const [comp, { period }] of active) {
    switch (comp) {
      case LOOPComponent.ROTATED:
        valid &&= rotationValidationSet(period).has(positionPair);
        break;
      case LOOPComponent.MIRRORED:
        valid &&= mirrorValidationSet(period).has(positionPair);
        break;
      case LOOPComponent.FLIPPED:
        valid &&= flipValidationSet(period).has(positionPair);
        break;
      case LOOPComponent.SWAPPED:
        valid &&= swapValidationSet(period).has(positionPair);
        break;
      case LOOPComponent.INVERTED:
        valid &&= invertValidationSet(period).has(positionPair);
        break;
      case LOOPComponent.REWOUND:
        break; // always valid
    }
  }
  return valid;
}
```

Each component contributes an independent constraint. Valid position pair = intersection of all constraints. No compound cases needed. New components = new validation set, nothing else.

**Period-parameterized validation sets:** The existing `MIRRORED_LOOP_VALIDATION_SET` was derived for period 2. Period 4 may require a different set (if the valid start/end pairs differ when the sequence must cycle through 4 passes). Each validator function returns the appropriate set for the requested period:

```ts
function mirrorValidationSet(period: number): Set<string> {
  if (period === 2) return MIRRORED_LOOP_VALIDATION_SET;        // existing
  if (period === 4) return MIRRORED_PERIOD_4_VALIDATION_SET;    // new — derive from position map
  throw new Error(`Unsupported mirror period: ${period}`);
}
```

The period-4 sets need to be derived from the position maps. For MIRRORED period 4: the set of (start, end) pairs where applying the mirror transform 4 times returns to identity in both position and orientation. This is a concrete computation over the existing position maps.

**Asymmetric spec validation:** When blue and red have different components, the composite position pair may not be the right unit of validation. The validator decomposes:
1. Extract blue/red hand locations from the composite start and end positions.
2. Validate each prop's location pair against that prop's component constraints.
3. Both must pass.

---

## End Position Selector

Before: `switch(loopType)` → single composite end position.

After: per-prop computation, then reconciliation:

```ts
function determineEndPosition(spec: LOOPSpec, startPosition: string): string | null {
  const [blueStart, redStart] = decomposePosition(startPosition);

  const blueEnd = determinePropEndLocation(spec.blue, blueStart);
  const redEnd  = determinePropEndLocation(spec.red,  redStart);

  if (blueEnd === null && redEnd === null) return null; // REWOUND — no constraint

  // Reconstruct composite position from per-hand locations
  return findCompositePosition(blueEnd ?? blueStart, redEnd ?? redStart);
}

function determinePropEndLocation(spec: PropLOOPSpec | undefined, startLoc: string): string | null {
  if (!spec || spec.components.size === 0) return startLoc; // repeated — return to start

  // Precedence: ROTATED > MIRRORED > FLIPPED > INVERTED > SWAPPED
  if (spec.components.has(LOOPComponent.ROTATED)) {
    const period = spec.components.get(LOOPComponent.ROTATED)!.period;
    return rotateLocation(startLoc, period);
  }
  if (spec.components.has(LOOPComponent.MIRRORED))
    return VERTICAL_MIRROR_LOCATION_MAP[startLoc] ?? null;
  if (spec.components.has(LOOPComponent.FLIPPED))
    return HORIZONTAL_MIRROR_LOCATION_MAP[startLoc] ?? null;
  if (spec.components.has(LOOPComponent.INVERTED))
    return startLoc; // inverted returns to start
  if (spec.components.has(LOOPComponent.SWAPPED))
    return startLoc; // swap happens across props, location unchanged
  return null;
}
```

`decomposePosition` and `findCompositePosition` use the grid position deriver (already in codebase: `gridPositionDeriver`).

---

## Detection Changes

### Per-prop algorithm

```
1. Check overall circularity (composite positions).
2. Split steps into blue and red motion sequences.
3. For each prop independently:
   a. For each candidate period P in [2, 4, 8]:
      - Split into P passes of (totalBeats / P) each
      - Test ROTATED:  pass[i+1] locations = rotate(pass[i] locations, 360/P)?
      - Test MIRRORED: pass[i+1] locations = verticalMirror(pass[i] locations)?
      - Test FLIPPED:  pass[i+1] locations = horizontalMirror(pass[i] locations)?
      - Test INVERTED: pass[i+1] motionTypes = flip(pass[i] motionTypes)?
   b. Record each passing test as component → { period: P }.
      Use minimum passing P (a component at period 2 is not re-recorded at 4).
4. Cross-prop detection (not per-prop):
   a. Test SWAPPED: does blue's pass[i+1] match red's pass[i] (and vice versa)?
   b. Test REWOUND: does pass 2 = reverse(pass 1)?
5. Assemble LOOPSpec { blue, red }.
```

`RichLOOPDetectionResult`:
```ts
// Before:
loopType: LOOPType | null;
period: Period | null;

// After:
spec: LOOPSpec | null;
```

`resolveComponentsToLOOPType` deleted.

---

## Serialization / Backward Compatibility

### Legacy read

```ts
/**
 * Convert legacy LOOPType string + single period → LOOPSpec.
 * Assigns all components the stored period (best lossless reconstruction).
 * For exact per-component periods, re-run detector against stored steps.
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
  return { blue: prop, red: prop }; // legacy = always symmetric
}
```

String parsing is safe for the 16 known `LOOPType` values: no substring collisions exist (`"inverted"` never appears in a string that isn't inverted, etc.). The converter is only invoked for known legacy values.

### MCP API boundary

MCP tools accept `loopType` string + `period` integer. `engine-generation-adapter.ts` calls `loopSpecFromLegacy` at the boundary. Internal pipeline sees `LOOPSpec` only.

### Legacy write (migration window)

Firestore adapter writes both `loopSpec` (new) and `loopType` + `period` (derived, for old clients) during migration. Removed after backfill confirms no old clients remain.

---

## UI (Follow-on Spec)

Out of scope for this migration. `LOOPPicker` continues using `LOOPType` strings at the surface; adapter converts to `LOOPSpec` internally. The follow-on UI spec covers:
- Per-prop component selection (blue/red independent)
- Per-component period control
- Generation strategy for asymmetric specs

---

## Validation Rules

1. **SWAPPED symmetry**: if present in one prop, must be in both at same period.
2. **Minimum period**: each component's period ≥ 2.
3. **Any combination representable**: no enum gate. Validity is a position-pair constraint, not a type constraint.
4. **Empty spec = non-LOOP**: no components in either prop = not circular.
5. **REWOUND exclusivity**: REWOUND does not compose with other components in the same prop (reversal makes per-pass transforms ill-defined).

---

## Migration Phases

Each phase ships independently and leaves the system working at every step.

### Phase 1 — Types and wire format

**Deliverables:**
- `loop-spec.ts`: all types, wire format, hydration helpers, period constants, `loopSpecFromLegacy`, `loopSpecPeriod`, helper constructors
- `serialization/loop-type-tokens.ts`: `LOOPType` enum (relocated)
- Unit tests: wire round-trip, legacy converter, LCM, helper constructors

**No behavioral changes.** Nothing imports these yet.

### Phase 2 — Detection emits LOOPSpec

**Deliverables:**
- `LOOPDetector` emits `LOOPSpec` (new field) + derives `loopType`/`period` for backward compat
- Per-prop detection algorithm
- Cross-prop SWAPPED/REWOUND detection
- `SequenceHydrator` reads `loopSpec` when available
- Golden snapshot regression tests (existing sequences still produce equivalent results)

### Phase 3 — New execution functions (parallel API)

**Deliverables:**
- `FusedExecutor` parametric class
- `LOOPExecutorSelector.executeSpec(spec: PropLOOPSpec)` — new method alongside existing `getExecutor(loopType)`
- `isLOOPValidForSpec(spec, pair)` — new alongside existing
- `determineEndPositionForSpec(spec, start)` — new alongside existing
- Period-parameterized validation sets for MIRRORED/FLIPPED/SWAPPED at period 4
- **Parity tests**: for all 16 legacy LOOPType values, `executeSpec(loopSpecFromLegacy(type, period))` produces identical output to `getExecutor(type).executeLOOP(seq, period)`.

### Phase 4 — Swap callers to new API

**Deliverables:**
- Generation pipeline uses `loopSpec`
- `LOOPExecutor` MCP entry point uses `loopSpec`
- Broadcast functions use `loopSpec`
- Old API functions get `@deprecated` warnings

### Phase 5 — Cleanup

**Deliverables:**
- Delete 9 compound executor files + 4 strict single-component executors (13 total; RotatedExecutor and RewoundExecutor kept)
- Delete `resolveComponentsToLOOPType`, `LOOPTypeResolver`
- Remove `loopType`/`period` from SequenceData (after Firestore backfill)
- Remove `loopType`/`period` from GenerationOptions
- Consolidate duplicate `LOOPComponent` enums

---

## File Impact Summary

| File | Phase | Change |
|---|---|---|
| `loop-spec.ts` | 1 | **New** — all types, helpers, converter |
| `serialization/loop-type-tokens.ts` | 1 | **New** — LOOPType enum relocated |
| `loop-types.ts` | 5 | Delete (after relocation) |
| `LOOPDetector.ts` (engine) | 2 | Emit LOOPSpec, per-prop detection, delete `resolveComponentsToLOOPType` |
| `LOOPDetector.ts` (app) | 2 | Same + consolidate LOOPComponent import |
| `FusedExecutor.ts` | 3 | **New** — parametric fused executor |
| `LOOPExecutorSelector.ts` | 3 | Add `executeSpec()`, keep `getExecutor()` |
| `LOOPValidator.ts` | 3 | Add `isLOOPValidForSpec()`, keep old function |
| `LOOPEndPositionSelector.ts` | 3 | Add `determineEndPositionForSpec()` |
| `LOOPEndOrientationSelector.ts` | 3 | Add spec-based overload |
| `SequenceData.ts` | 2 | Add `loopSpec?: LOOPSpec` |
| `generate-models.ts` | 2 | Re-export from package; add `loopSpec` to GenerationOptions |
| `circular-models.ts` | 5 | Delete duplicate LOOPType/Period |
| `LOOPTypeResolver.ts` | 5 | Delete |
| `loop-display-resolver.ts` | 2 | Read LOOPSpec; fall back to `loopSpecFromLegacy` |
| `SequenceHydrator.ts` | 2 | Hydrate `loopSpec` from detector |
| `mcp-server/src/core/engine-generation-adapter.ts` | 4 | Parse string → `loopSpecFromLegacy` at boundary |
| `broadcast/loop-executor.ts` | 4 | Use `LOOPSpec` routing |
| `minimum-length-calculator.ts` | 4 | Accept `LOOPSpec` |
| 9 compound executor files | 5 | Delete (replaced by FusedExecutor) |
| 4 strict single-component executors (Mirrored, Flipped, Swapped, Inverted) | 5 | Delete (absorbed into FusedExecutor with single flags) |

---

## Testing Strategy

1. **Wire round-trip**: `loopSpecFromWire(loopSpecToWire(spec))` deep-equals original.
2. **Legacy converter**: `loopSpecFromLegacy("mirrored_rotated", 4)` → symmetric `{ MIRRORED:{period:4}, ROTATED:{period:4} }`.
3. **Period LCM**: `loopSpecPeriod({ blue: { ROTATED:{period:4} }, red: { MIRRORED:{period:2} } })` = 4.
4. **Golden snapshots**: all currently-detected sequences produce equivalent LOOPSpec.
5. **Per-prop detection**: `c3f8a1b0` detects as `{ blue: undefined, red: { ROTATED:{period:4} } }`.
6. **FusedExecutor parity (critical)**: for each of the 15 mapped LOOPType values (excludes dead `MIRRORED_ROTATED_SWAPPED`), `FusedExecutor` + `RotatedExecutor` chain produces byte-identical output to the existing compound executor. This is the migration safety net.
7. **FusedExecutor math**: MIRRORED+INVERTED rotation direction cancellation verified. SWAPPED+MIRRORED location composition verified.
8. **Validator parity**: `isLOOPValidForSpec` matches old `isLOOPValidForPositionPair` for all 16 types.
9. **End position parity**: new per-prop selector matches old selector for symmetric specs.
10. **SWAPPED symmetry**: spec with SWAPPED in one prop only fails validation.
11. **REWOUND exclusivity**: spec with REWOUND + MIRRORED in same prop fails validation.
12. **Asymmetric end position**: blue ROTATED(4) + red REPEATED produces correct per-hand end locations that map to a valid composite position.

---

## Open Questions

1. **Period-4 validation sets for MIRRORED/FLIPPED/SWAPPED**: need to be derived from position maps. Can be computed mechanically — not a design question, just implementation work.

2. **`repeated` and `modular` in `loop-components.ts`**: these appear in the UI component palette but not in `LOOPComponent` enum. Are they LOOPComponent values, or a separate higher-order taxonomy?

3. **Asymmetric spec generation**: the generator currently picks one `LOOPType` for both props. Generating asymmetric specs (blue ROTATED, red MIRRORED) is a follow-on design problem — the generation heuristics for this don't exist yet.
