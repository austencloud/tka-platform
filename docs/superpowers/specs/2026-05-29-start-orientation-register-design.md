# Start-Orientation Register — Design Spec

**Date:** 2026-05-29
**Status:** Approved for planning
**Author:** Austen (brainstormed with Claude)

## Summary

Add a new enumeration axis to the deck catalog: the **start-orientation register**. Today every generated sequence starts with both props in a radial orientation (`in`). This axis lets a deck be viewed with its start orientation re-seeded to a different register, multiplying the visible catalog without re-enumerating or re-storing anything.

Three registers ship in this scope:

| Register | Blue start | Red start | Audience sees |
|----------|-----------|-----------|----------------|
| `radial` | `in` | `in` | both props along the radius |
| `nonradial` | `counter` | `counter` | both props tangent |
| `split` | `in` | `counter` | one radial, one nonradial |

Two further registers (`rail`, `cross`) are designed but deferred — they require interradial render support that does not yet exist (see Deferred Work).

## Motivation

The canonical catalog pins start orientation to radial `in`, leaving the rest of the orientation space unexploited. Re-seeding start orientation and re-propagating produces genuinely new, visually distinct sequences that still return home. This is a cheap, high-leverage multiplier on an existing 53k+ sequence catalog: the underlying sequences already exist, the propagation machinery already exists, and the new states are mathematically guaranteed to close.

## The Closure Guarantee

A LOOP returns home when its net orientation transform fixes the start orientation. Per the orientation-algebra rules:

- Every whole-turn parity operation ("reverse orientation" = `in↔out`, `clock↔counter`) is a rotation by 4 in the 8-point radial cycle (`in → clockIn → clock → clockOut → out → counterOut → counter → counterIn`).
- Every fractional turn is a rotation by ±1 per quarter.

So the net orientation transform of any sequence is a **pure rotation** of that 8-cycle. A rotation fixes one element only if it is the identity rotation, and the identity fixes **all** elements. Therefore: **any sequence that returns home from `in` returns home from every other orientation**, per hand, independently.

This holds for every per-hand combination (`in|in`, `in|out`, `counter|counter`, `in|counter`, …). Blue closing from `in` and red closing from `counter` are independent guarantees. The register restriction is purely about catalog size and visual meaningfulness, never about feasibility.

## Conceptual Model: Phase × Relationship

The two-hand orientation state lives on a torus (`Z/8 × Z/8` — each hand on the 8-point cycle). A single numbered "layer" ladder cannot traverse it cleanly, which is why an earlier 1-D layering attempt forked into half-steps. The honest decomposition uses two orthogonal coordinates:

- **Phase (common mode):** how far both hands rotated together from radial `in`, in 45° steps. Even phase = cardinal (radial or nonradial); odd phase = interradial.
- **Relationship (differential mode):** the blue-vs-red offset, `(red − blue) mod 8`, with three meaningful values:
  - **parallel** (offset 0) — hands same orientation
  - **anti** (offset 4) — opposite (`in|out`, `clock|counter`)
  - **perpendicular** (offset 2/6) — one radial, one nonradial

This **same / opposite / perpendicular** trichotomy is the same three-value algebra already established for hand-vs-prop duality. The orientation axis reuses it rather than inventing a parallel structure.

For the deck axis we do not need the full torus. The catalog axis is the coarse, finite, **visually distinct** slice.

## Visual Equivalence — Why Three, Not Sixteen

The catalog keys on what an audience can see, not on the raw orientation enum:

- `in` and `out` render identically (prop along the radius; which end is the thumb is invisible). All four radial pairs (`in|in`, `in|out`, `out|in`, `out|out`) are one visual class.
- `clock` and `counter` render identically (prop tangent).

So the sixteen per-hand combinations collapse to three visible cardinal registers: both-radial, both-nonradial, and one-of-each. The three shipping registers are exactly these three looks. The chosen per-hand pair for each register is a rendering representative, not a user-facing distinction.

## Architecture

### Storage: derive at read

The base catalog (≈53k radial sequences) is **not** re-enumerated or duplicated. The register is a transform applied at read time, matching the existing asymmetric-deck pattern (`Catalog.asymmetric` references another deck's sequences rather than copying them).

This sidesteps the dedup question entirely. The base enumeration dedups on letter-pair only (`scripts/seed-l1-deck.ts:511`, `[letter1, letter2].sort().join("+")`), which ignores orientation. Re-enumerating nonradial into the same set would collapse it into the radial entry and lose it. Deriving at read avoids that: the ×3 multiplier lives in the browse/picker layer, the stored+deduped set stays radial-only.

### Descriptor schema

Extend the variation descriptor (`src/lib/features/choreo-card/services/deck-variation.ts`) and `Catalog` (`.../domain/models/Catalog.ts`):

```ts
// Human-facing axis value
startOriMode?: "radial" | "nonradial" | "split"   // default "radial"

// Resolved per-hand seed (implementation detail; full 8-orientation space reachable)
startOrientation?: { blue: Orientation; red: Orientation }   // default { in, in }
```

`startOriMode` resolves to the pair:

- `radial`    → `{ blue: in, red: in }`
- `nonradial` → `{ blue: counter, red: counter }`
- `split`     → `{ blue: in, red: counter }`

Storing the per-hand pair (not a boolean) makes the full sixteen-combo space and the deferred registers reachable with no schema migration.

### Pipeline ordering

In `applyVariationDescriptor` (`deck-variation.ts:212`):

```
1. clone base sequence
2. re-seed: set startPosition.motions[blue|red].{startOrientation, endOrientation}
            from descriptor.startOrientation
3. applyReversal   (transformSequence → recalculateAllOrientations)
4. applyTurns      (applyPattern → recalculateAllOrientations)
```

Re-seed must be step 2, before reversal and turns, because both downstream operations re-propagate **from** the start position's `endOrientation` (`orientation-propagation.ts:73` `recalculateAllOrientations`). Setting the seed once means every downstream re-propagation honors it. No new orientation algorithm is introduced — pure reuse of the existing propagation machinery.

### Browse / picker UI

A register selector sits alongside the existing axes (family, term-variation, reversal, turn-pattern) in the deck picker. Three values: **radial · nonradial · split**. Uses the button + toggle-indicator pattern (no checkboxes, no dropdowns, per the design system). Selecting a register sets `startOriMode`, which resolves to the pair, which re-seeds and re-propagates at read. The render path already supports all three.

## Render Coverage (verified)

| Register | Animation engine | Pictograph arrows | Ships now |
|----------|------------------|-------------------|-----------|
| radial | supported (`angle-calculator.ts:46`, `in/out`) | `from_radial` exists | yes |
| nonradial | supported (`clock` `+π/2`, `counter` `−π/2`) | `from_nonradial` exists | yes |
| split | supported (per-prop independent) | mix of existing dirs | yes |
| rail (interradial, same-mode) | not wired (falls to default) | no dedicated SVG | deferred |
| cross (interradial, opposite-mode) | not wired (falls to default) | no dedicated SVG | deferred |

The three shipping registers require **zero rendering work**.

## Scope (this spec)

1. Add `startOriMode` + resolved `startOrientation` pair to the variation descriptor and `Catalog`.
2. Re-seed step in `applyVariationDescriptor`, before reversal/turns.
3. Register selector in the deck picker (button + toggle-indicator, three values).
4. Verify a derived nonradial/split deck animates and renders pictographs correctly end-to-end.

## Deferred Work (rail / cross)

The full five-register ladder is **radial · nonradial · split · rail · cross**. The two interradial registers are visually distinct on their own (not only when props overlay) and earn their slots, but require:

1. **Animation:** wire interradial angles into `animation-engine/services/angle-calculator.ts`. The angle data already exists in `PropRotAngleManager` and `render/core/constants/rotation-maps.ts`; this is a wiring job, not research.
2. **Pictograph arrows:** author `from_interradial` arrow SVGs and add a three-way classifier in `arrow-path-resolver.ts` (`from_radial` / `from_nonradial` / `from_interradial`). Interradial arrows do not currently exist — props in interradial orientations fall back to `from_nonradial`.

Once instrumented, rail and cross add with the same descriptor mechanism as the cardinal registers.

## Naming

- The axis is the **start-orientation register**. Do **not** call it "layer" or "level" — that collides with the TKA Level system (L1–L9, turn complexity).
- Register values: `radial`, `nonradial`, `split` (shipping); `rail` (interradial same-mode, parallel/diagonal), `cross` (interradial opposite-mode, the X) (deferred).

## Files Touched (shipping scope)

- `src/lib/features/choreo-card/services/deck-variation.ts` — descriptor field, resolution, re-seed step
- `src/lib/features/choreo-card/domain/models/Catalog.ts` — `startOriMode` metadata
- Deck picker component (register selector) — to be located during planning
- Reuses unchanged: `orientation-propagation.ts`, `turn-pattern-manager.ts`, `reversal-seed-service.ts`, `angle-calculator.ts`, `arrow-path-resolver.ts`
