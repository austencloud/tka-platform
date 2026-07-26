---
status: backlog
value: 3
effort: M
remaining: "Body status: Design (awaiting review → writing-plans)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Box-Mode Axis — Design

**Date:** 2026-05-30
**Status:** Design (awaiting review → writing-plans)
**Author:** Claude (Opus 4.8) + Austen
**Related:** 4th `CardVariation` axis. Builds on the derived-field reconciler
(`2026-05-29-step-derived-field-integrity-design.md`) and the start-orientation
register (`2026-05-29-start-orientation-register-design.md`).

---

## 1. What this adds

A **grid-mode axis** on the deck descriptor: every diamond-authored sequence can
be re-rendered in **box** mode (hands on the intercardinal grid, rotated 45° off
the diamond). Selected per deck, alongside the existing register axis, with a
**Diamond | Box | Both** selector. "Both" doubles the deck (full enumeration),
exactly like multi-select registers.

Box mode is geometry only — it rotates the hand path 45°. It does **not** change
the letter (letters are rotation-invariant) and does **not** change the element
(a split-opp family stays fire in box; rotation only picks the box
*representative* of the same family).

---

## 2. The rotation rule (confirmed 2026-05-30)

Diamond → box is a single 45° rotation. The **direction is per-family**, chosen so
the hands land in the most natural ("relaxed") box representative:

| Family | Direction | 45° step | Lands |
|---|---|---|---|
| alpha | CW | +1 | diagonal box rep |
| gamma | CW | +1 | both hands south (relaxed, e.g. SW/SE) |
| beta | CCW | −1 | both hands at SE |

A sequence's family = its **start-position family** (`positionFamilyOf`,
`start-ori-register.ts`). Rotation preserves family (alpha stays alpha, etc.), so
the direction is decided once from the start position and applied uniformly to
every step.

**Invariants:** the rotation is a rigid isometry — it preserves angular hand
separation (so the family/element is unchanged) and preserves per-hand rotation
direction relationship. Therefore:
- **Letter:** unchanged (no dataset lookup needed).
- **Element / VTG timing+direction:** unchanged (split-opp → fire in box too).
- **gridMode:** flips diamond → box, derived from the now-intercardinal locations
  by the reconciler — never hand-set.

---

## 3. Architecture

### 3.1 Descriptor field

`CardVariation` (`domain/models/DeckRelease.ts`) gains:

```ts
/** Grid-mode register. Absent / "diamond" → as-authored. "box" → 45° rotated. */
gridMode?: "diamond" | "box";
```

Frozen onto each card like `startOriMode`. Absent = diamond (no-op), so existing
decks are unaffected.

### 3.2 Sync geometric rotation (new helper)

`applyVariationDescriptor` is **sync**. The existing `rotateSequence`
(`sequence-transforms.ts`) is async (it does a letter lookup we don't need).
Add a pure sync helper — letters are rotation-invariant, so no async:

```ts
// new in sequence-derived-fields.ts (or a sibling geometry module)
// Rotate every motion's locations by `steps` × 45° and reconcile derived fields.
export function rotateSequenceGeometry(seq: SequenceData, steps: number): SequenceData
```

It maps the existing **sync** `rotateMotion` (`motion-transforms.ts`) over both
hands of every step + the start position, then runs `normalizeSequenceDerived`
(just built) to recompute positions + gridMode from the rotated locations. No
letter lookup, no orientation propagation change.

### 3.3 Application seam

In `applyVariationDescriptor` (`deck-variation.ts`), apply box rotation **first**
(establish geometry), then the existing register seed / reversal / turns:

```ts
let working = seq;
if (variation.gridMode === "box") {
  const family = seq.startPosition ? positionFamilyOf(seq.startPosition) : null;
  if (family) {
    const steps = family === "beta" ? -1 : 1; // beta CCW, alpha/gamma CW
    working = rotateSequenceGeometry(working, steps);
  }
}
working = applyStartOriMode(working, variation.startOriMode); // unchanged
// …reversal, turns unchanged…
```

Family is read **before** rotation (rotation preserves family, so it doesn't
matter, but reading the un-rotated start is clearest). Unsupported families
(zeta/eta/skewed) → skip box (leave diamond), same fallback as the register seed.

### 3.4 Deck-releaser UI + state

Mirror the just-shipped multi-select register exactly:

- **State** (`deck-releaser-state.svelte.ts`): `selectedGridModes = $state<Set<"diamond"|"box">>(new Set(["diamond"]))`, never-empty toggle, persisted as an array (legacy sessions default to diamond).
- **Selector** (`ConfigureStep.svelte`): a second `mode-row` under Start Orientation — "Grid" with Diamond / Box toggles. Select both = Both = full enumeration.
- **Compose** (`DeckReleaserTab.svelte` + `buildTnDCards`): the existing register
  multiply loop gains an outer grid-mode loop. Final deck = base × registers ×
  gridModes. Each emitted card stamps `gridMode: "box"` (omitted when diamond).

### 3.5 Element / footer

No change. `tnd-calculator` / `tnd-element` already classify by family, which is
rotation-invariant. The box card carries the same element tint and footer as its
diamond twin. (If a future observation shows a box card mis-tinting, that is a
*data* bug surfaced by the reconciler work, not a box-axis bug — handle
separately.)

---

## 4. Non-goals

- **No element remap.** Earlier framing considered relabelling to a "box element";
  superseded — element is invariant under grid rotation.
- **No async in `applyVariationDescriptor`.** The sync geometric rotation keeps the
  descriptor seam pure.
- **No new rotation math.** Reuse `rotateMotion` + the reconciler; do not
  re-derive 45° location maps.

---

## 5. Testing (TDD)

1. **Rotation direction (red→green):** alpha & gamma seeds rotate CW (+45°), beta
   rotates CCW (−45°); assert resulting start-position locations.
2. **Family/element invariance:** a split-opp diamond sequence → box keeps its
   family classification and element (no letter change, no element change).
3. **gridMode flips:** box output has `gridMode === BOX` on steps + start, derived
   (not hand-set), via the reconciler.
4. **rotateSequenceGeometry idempotent on round-trip:** +1 then −1 returns the
   original locations.
5. **Descriptor application:** `applyVariationDescriptor({ gridMode: "box" })`
   rotates; `{ gridMode: "diamond" }` / absent is a no-op passthrough; box +
   register compose (rotate then seed orientation).
6. **Enumeration:** `buildTnDCards` / LOOP compose with both grid modes selected
   multiplies the deck; each card stamps the right `gridMode`.
7. **Unsupported family fallback:** a zeta/eta start → box requested → left diamond
   (no throw).

---

## 6. Files

**New:** `rotateSequenceGeometry` (in `sequence-derived-fields.ts` or a sibling),
+ tests.

**Edited:** `domain/models/DeckRelease.ts` (descriptor field),
`deck-variation.ts` (application seam), `deck-releaser-state.svelte.ts` (grid-mode
Set + toggle + persist), `ConfigureStep.svelte` (Grid selector),
`DeckReleaserTab.svelte` (compose multiply + wiring), `deck-composer.ts`
(`buildTnDCards` grid-mode loop).

---

## 7. Why now / dependency

The derived-field reconciler (shipped 2026-05-29) is the prerequisite: box
rotation moves hands to intercardinal locations, and the reconciler is what
recomputes the correct box positions + gridMode from those locations. Without it,
rotated cards would carry stale diamond positions — the exact bug just fixed.
