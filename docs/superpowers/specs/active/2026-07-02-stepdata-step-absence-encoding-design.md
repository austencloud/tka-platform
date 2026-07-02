# StepData→Step Unification: Absence Encoding + Subtype Redefinition — Design

**Date:** 2026-07-02 · **Status:** ACTIVE (governs the migration bulk)
**Prereqs shipped:** data net armed (`826a1d5fb7`), presence register + tripwire guards (`b0176cae61`), Letter const-union (`d533fd5a9d`), adoption slice 1 (`ca76df65ed`)

## Problem

Canonical `Step.motions` is `{blue, red}` both-required. App `StepData.motions` is
partial, and absence currently encodes four different meanings:

1. **Blank beat** — no motion authored (`isBlank` exists but absence does the work).
2. **One-hand assembly in progress** — REAL and live: Create > Assemble converts
   unequal blue/red hand tracks into steps with one motion
   (`builder-step-converter.ts:102-173`), and these reach hashing + persistence.
3. **Deliberately stripped solo view** — `prepare-mandala-club-sequence.ts:26`
   strips a hand so the animation engine's `if (motion)` guards skip it.
4. **Not-yet-loaded (thin gallery record)** — loader gates
   (`sequence-motion-loader.ts:15` family) sniff "any step has both motions" to
   decide whether to hydrate.

110 sites key on presence (see `2026-07-01-presence-as-signal-register.md`).

## Evidence that fixed the design

- **Persisted corpus is 100% both-handed** (933 seqs / 12,746 steps, 0 one-hand
  steps — constructability check). No existing doc re-hashes under this design;
  the frozen data-parity net proves it.
- **The compositional persist path ALREADY erases absence**: the decomposer
  substitutes a static placeholder for a missing hand
  (`sequence-decomposer.ts:130-134`), and hydrate derives both hands back. The
  design below extends existing semantics; it does not invent new ones.
- **`MotionData.isVisible: false` is produced by NO live flow** (grep: every
  producer writes `isVisible: true`). The flag is a free slot.
- **The V2 identity hash excludes `isVisible`** by design
  (`sequence-content-hasher.ts:162`), so visibility can never shift identity.
- **App enums are now structurally identical to `@tka/tka-types`** (Letter
  converted `d533fd5a9d`; MotionColor/GridLocation/GridMode/RotationDirection/
  Orientation/GridPosition already const-union; MotionType is a canonical
  superset, widening-only).

## Approaches considered

**A. Layer split (draft type keeps partial motions at the edit layer).**
Honest, but the Assemble workspace syncs into the SHARED sequence state that
feeds save/hash/viewer — a draft type forces parallel plumbing through all of
it, and StepData survives under a new name. Rejected: fails the unification
goal and costs the most.

**B. Subtype redefinition + invisible-placeholder absence (CHOSEN).** Redefine
the app types as subtypes of the canonical package types; re-encode absence as
data (below). Type system enforces the unification; runtime deltas confined to
enumerated producer/consumer sites.

**C. Lean `Step` + view side-channel plumbed everywhere.** Purest split, but
carries two parallel structures through ~246 render refs and every component
seam for zero behavioral gain over B. Rejected.

## The design (B)

### 1. Subtype redefinition — the unification itself

```ts
// motion-data.ts — same fields as today, canonical base
export interface MotionData extends Motion {          // @tka/tka-types
  readonly motionType: MotionType;                    // app narrowing (no "shift")
  readonly color: MotionColor;
  readonly isVisible: boolean;                        // view fields stay REQUIRED
  readonly propType: PropType;
  readonly arrowLocation: GridLocation;
  readonly gridMode: GridMode;
  readonly arrowPlacementData: ArrowPlacementData;
  readonly propPlacementData: PropPlacementData;
  readonly handPath?: HandPath | null;                // + skewSteps/skewDir/pathShape
}

// step-data.ts — canonical base, both hands required
export interface StepData extends Step {              // @tka/tka-types
  readonly motions: { readonly blue: MotionData; readonly red: MotionData };
  readonly blueReversal: boolean;                     // app extras (derived on read)
  readonly redReversal: boolean;
  readonly isBlank: boolean;                          // narrows Step's optional
  readonly betaSwapped?: boolean;                     // kept from PictographData
  readonly category?: number | null;
  readonly isStep?: true;                             // deleted in final slice
  readonly isSelected?: boolean;                      // deleted in final slice
}
```

Consequences, all by declaration instead of by bridge:
- `StepData` IS a canonical `Step`; `MotionData` IS a canonical `Motion` and a
  `MotionWithView`. `stepDataToStep` becomes the identity and dies.
- `StepData` remains structurally assignable to `PictographData` (required
  motions ⊆ partial motions), so every render component keeps accepting steps.
- `StepData` no longer `extends PictographData` (it extends `Step`); the three
  pictograph extras it used (`betaSwapped`, `category`, and optional letter
  defaults) are re-declared.
- Render pipeline keeps REQUIRED view fields (that is what rendering needs);
  "migration B" reduces to opportunistic param-widening (slice-1 style), not a
  246-ref forced rewrite.

`PictographData` and `StartPositionData` KEEP partial motions. Genuine one-hand
pictograph cells (option previews, guide pages, start-position cells) are a
render-layer reality. The step layer is where both-required holds.

### 2. Absence encoding — one rule

**A hand that is not really there is a static placeholder `MotionData` with
`isVisible: false`.** Same recipe as `sequence-decomposer.makePlaceholderStep`:
STATIC / NO_ROTATION at the hand's last known location+orientation (hard
default NORTH/IN when nothing is known).

| Old meaning | New encoding |
|---|---|
| Blank beat | `isBlank: true` + both hands invisible placeholders |
| Assembly in progress | missing hand = invisible placeholder at last known location |
| Solo strip (mandala club) | real motion kept, `isVisible: false` on the hidden hand |
| Not-yet-loaded | `steps.length === 0` (thin records carry no steps) |

Producers to re-encode (the compile-forced worklist):
- `create-step-data.ts` factory: `motions ?? {}` → fill missing hands with
  invisible placeholders (both-required output).
- `workbench.ts:74,92` blank insert/clear — flows through the factory.
- `builder-step-converter.ts` (Assemble): placeholder for the shorter track's
  missing hand.
- `sequence-encoder.ts decodeChained` + `compositional-utils`/`compositional-decoder`:
  chain last location per hand (like orientation) and synthesize invisible
  placeholders for empty segments. Encoder emits an EMPTY segment for an
  invisible placeholder, so share-URLs round-trip byte-identical.
- `prepare-mandala-club-sequence.ts`: strip → `isVisible: false`.

Consumers to re-encode (behavior-preserving; register families):
- **Family A (render/engine):** presence guard → `m.isVisible !== false`.
  Enumerated: prop-interpolator (3), frame-parameter-builder hand-presence
  cache, PathLinesOverlay, sequence-converter 3D (2), GlyphRenderer +
  frame-builder + animation-render-loop turns-tuple guards, PictographRenderer
  (render list, hasValidData, tip z-promotion), pictograph-preparer, mandala
  geometry/path preparers (3), arrow lifecycle/positioning, prop-placer beta
  offset, layer-compositor, web-gl-direct-renderer, thumbnail-renderer start
  repair. Invisible placeholders AND solo-stripped hands take the same skip.
- **Family B (identity/derivation):** presence guard → skip when either hand
  `isVisible === false`. Safe because no real-motion visibility toggle exists;
  the solo feed never reaches derivation (render-only). Letter derivation,
  TnD, loopability, turn/rotation pattern managers, equivalence, difficulty.
- **Family C (loaders):** gate → `steps.length === 0` (+ existing re-check on
  fetched result).
- **Family D (editing/UX):** same visibility predicate where the old absence
  branch was load-bearing (per-site disposition in the register).

Identity math: placeholders hash as static motions where absence hashed as the
`"-"` sentinel — a change ONLY for future saves of partial sequences, of which
ZERO exist in the corpus (proof above). No phantom-fork surface.

### 3. What stays, what dies

- `step-bridge.ts` lossy `stepToStepData`/`stepDataToStep`: DELETED (identity /
  replaced by placeholder-aware enrichment where lean engine output needs view
  fields).
- `step-view-bridge.ts` stays for the parity scripts (StepWithView pairing).
- `isStep` discriminator (10 literals) + `isSelected`: deleted in the final
  slice (selection already has an id-keyed store).
- Tripwire guards in `presence-as-signal-guards.test.ts`: updated per family
  re-encode above — each flip is the conscious re-encode the register demands.

### Gates (unchanged discipline)

Every slice lands only with: data-parity net 0-drift, roundtrip parity 0-drift,
lossy-mutation negative control still failing loudly, guards green (updated
semantics documented per test), full `svelte-check` 0 errors, unit suite green
on touched domains. Pixel net (`/test/step-migration-parity`) before/after the
producer re-encodes.
