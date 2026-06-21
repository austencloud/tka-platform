# TnD Downbeat Deriver + Gamma Split Seeds — Design

**Date:** 2026-05-30
**Status:** Design (awaiting review → writing-plans)
**Author:** Claude (Opus 4.8) + Austen
**Supersedes (in part):** `2026-05-30-box-mode-axis-design.md` §5 + Non-goal #1
("element is invariant under grid rotation" — **false**, this is the bug).
**Related:** `2026-05-28-tnd-family-seed-rework-design.md` (six-family seed data),
`2026-05-29-deck-variation-and-tnd-parameter-model-design.md` (descriptor model).

---

## 1. The bug

Deck releaser, TnD mode, **Box** grid + **Quarter-Opp** family selected →
draws MP/NQ/OR, footer "Quarter-Opp / Moon". Wrong on both counts:

- In box, MP/NQ/OR start at γ12 (the *together* half of gamma) → they are
  **tog-opp / Air**, not quarter-opp.
- Box **Quarter-Opp** should be DJ/EK/FL + JD/KE/LF (all six DEFJKL compounds —
  D/E/F/J/K/L → QUARTER_OPP in box).

Root cause: `getTnDFamilyOptions` (`deck-composer.ts:235`) groups the six family
cards from the **diamond** `l1-tnd-motions` catalog, and `buildTnDCards`
(`deck-composer.ts:286`) stamps `gridMode:"box"` while keeping the **diamond**
family id for both grouping and footer (`tndFooter(fam.familyId)`). The
box-correct calculator (`calculateTnD`, `tnd-calculator.ts`) is never called on
the transformed sequence. The box-mode-axis spec explicitly declared element
rotation-invariant, so no reclassification was ever wired.

**Element is NOT invariant under grid rotation.** Diamond quarter-opp MP rotates
to box tog-opp. The element must be recomputed from the box-transformed geometry.

---

## 2. The real model — TnD is read at the downbeat

Timing and direction are defined by the **south beat (downbeat)** — the relative
phase at which each hand passes through south, plus whether both hands arc the
same rotational way.

Most pictographs never touch south, so we **extrapolate**: assume each hand keeps
its current rotation and read the angular distance from its current location to
south, measured *along its rotation direction*. Compare the two hands' distances:

- equal (Δ = 0°) → **together**
- opposite (Δ = 180°) → **split**
- quarter (Δ = 90° or 270°) → **quarter**

Direction: both hands same rotation sense → **same**; opposite → **opp**.

This is a **pure geometric function of the two hands' (location, rotation
direction)** — no letter, no grid mode, no lookup table. It classifies any
pictograph, in either grid, including both halves of gamma and any future start
position.

### 2.1 The algorithm

```
ANG = { n:0, ne:45, e:90, se:135, s:180, sw:225, w:270, nw:315 }   // CW from north
SOUTH = 180

// degrees of travel from `loc` to south along rotation `dir`
phaseToSouth(loc, dir) =
  dir === "cw"  ? ((SOUTH - ANG[loc]) % 360 + 360) % 360
                : ((ANG[loc] - SOUTH) % 360 + 360) % 360

deriveTnD(blueLoc, blueDir, redLoc, redDir):
  if either motion is not a rotating shift (pro/anti) → return null
  Δ = ((phaseToSouth(blueLoc, blueDir) - phaseToSouth(redLoc, redDir)) % 360 + 360) % 360
  timing   = Δ === 0 ? "tog" : Δ === 180 ? "split" : "quarter"   // 90|270 → quarter
  direction = blueDir === redDir ? "same" : "opp"
  return { timing, direction }
```

Maps to the six elements via the existing `TND_TO_ELEMENTAL`
(split-same→Water, split-opp→Fire, tog-same→Earth, tog-opp→Air,
quarter-same→Sun, quarter-opp→Moon).

`loc`/`dir` come from the pictograph's blue/red motion — use the **first rotating
beat** (the static start position has no rotation direction). For a whole
sequence, classify off the first moving step.

### 2.2 Verification against ground truth (already passing by hand)

| Case | blue | red | Δ | result |
|---|---|---|---|---|
| Box MP @γ12 | sw cw → 315° | se ccw → 315° | 0 | **tog-opp** ✓ |
| Box MP @γ10 | se cw → 45° | ne ccw → 225° | 180 | **split-opp** ✓ |
| Diamond MP @γ11 | s cw → 0° | e ccw → 270° | 90 | **quarter-opp** ✓ |
| Diamond J (α7→β1) | e ccw → 270° | w cw → 270° | 0 | **tog-opp** ✓ |

---

## 3. Algorithm vs table — decision

**The deriver (algorithm) is the source of truth. The lookup table is retired to
a generated golden snapshot used only as a regression fixture.**

Why not a hand-authored letter→element table:

- A letter-keyed table **cannot** express start-position-dependent timing —
  `DJ@β5 = tog` vs `DJ@β7 = split`, same letter. The current table only survives
  by allowing one canonical start per family; adding gamma's second start (§4)
  breaks that assumption.
- The position conditionals already leaking into the current table
  (`D: BETA_3_7 ? split : tog`, `M: GAMMA_DIAG ? split : tog`) **are** the
  algorithm, half-implemented and hidden.
- The downbeat algorithm is the actual TKA definition. Encoding it makes the
  code self-documenting and handles every position with zero per-entry decisions.

Safety (the "tweak till correct, correct forever" property, earned not
hand-typed): **derive** the table from the algorithm and freeze it as a test
fixture. Any future drift fails the snapshot test. See §6.

---

## 4. Gamma's second start position

### 4.1 The asymmetry

An **opposite-direction compound** letter can be tog-opp *or* split-opp depending
on which start position it begins from. **Same-direction** letters (A/B/C, G/H/I,
S/T/U/V) are timing-invariant — A is split-same regardless of start or rotation
sense. So a *second* canonical start is needed **only for opp-direction
compounds**. This is the self-limit that prevents combinatorial explosion (no
second A, no doubling of same-direction families).

- **α/β compounds (D/E/F, J/K/L):** already represented twice in
  `l1-tnd-motions` — `DJ/EK/FL @β5` (tog-opp) **and** `JD/KE/LF @α1` (split-opp)
  are separate seeds. Both halves present. ✓
- **γ compounds (M/N/O, P/Q/R):** represented **once** — `MP/NQ/OR @γ11`
  (quarter-opp in diamond). Gamma's position set is 2× α/β (16 positions vs 8)
  because gamma is two mirror halves. It needs a **second seed** to express the
  split half.

### 4.2 The new seeds

Add three gamma split-half seeds: **`PMPM`, `QNQN`, `RORO`** started in the split
half of gamma (`γ10/γ8/γ14/γ4` = `GAMMA_DIAG`), hand path reversed so the LOOP
closes. The diamond start positions and beat walks are taken from the canonical
`DiamondPictographDataframe.csv` / `BoxPictographDataframe.csv` rows the same way
the existing 19 seeds are (one CSV row per beat, verified `findRow`), so the new
seeds are canonical data, not hand-authored geometry.

Classification of the new seeds (by the deriver, automatically):
- **Diamond:** quarter-opp / Moon (gamma is one undivided quarter shape in
  diamond — PM and MP are both quarter there).
- **Box:** split-opp / Fire (start lands in `GAMMA_DIAG`).

Result — the honest box partition, every label computed, no false blanket:

| seed | diamond | box |
|---|---|---|
| MP/NQ/OR | quarter-opp (Moon) | **tog-opp (Air)** |
| PM/QN/RO *(new)* | quarter-opp (Moon) | **split-opp (Fire)** |
| DJ/EK/FL | tog-opp (Air) | **quarter-opp (Moon)** |
| JD/KE/LF | split-opp (Fire) | **quarter-opp (Moon)** |

A card never asserts "PM is always split" — `PM@γ12` would be tog; each card
states only what its own start computes.

### 4.3 Open curation question (resolve at review)

In **diamond**, PM/QN/RO classify as quarter-opp — the same element as MP/NQ/OR,
just a mirror sequence. Options:
- **(A, recommended)** Include them as base seeds unconditionally. Diamond
  Quarter-Opp gains three mirror variants (still correctly Moon); box gains the
  Fire half. Honest and uniform — the deriver labels each correctly per grid.
- **(B)** Emit PM/QN/RO **only** when box is among the selected grid modes, so
  diamond decks stay at three gamma seeds. Avoids diamond "duplication" at the
  cost of a grid-mode special-case in the seed/compose path.

Recommend **A** — uniform, no special case; the seeds are genuinely distinct
sequences and the labels are always computed-correct.

---

## 5. Architecture

### 5.1 New: the deriver (`tnd-deriver.ts`, sibling of `tnd-calculator.ts`)

```ts
export function deriveTnD(
  blueLoc: GridLocation, blueDir: RotationDirection,
  redLoc: GridLocation,  redDir: RotationDirection,
): TnDCalculationResult            // { tndMode, elementalType } | nulls

export function deriveTnDFromPictograph(
  p: PictographData | null | undefined,
): TnDCalculationResult            // reads first rotating beat's blue/red loc+dir
```

Pure, grid- and letter-agnostic. `calculateTnD`/`calculateTnDFromPictograph`
become thin wrappers that delegate to the deriver (or are replaced at call sites);
the `DIAMOND_MODE_MAP`/`BOX_MODE_MAP` tables are kept only as the generated golden
fixture (§6), not as runtime truth.

### 5.2 Classify cards by transformed geometry (`deck-composer.ts`)

`buildTnDCards` currently keeps the diamond family id. Change:

1. For each base seed × selected grid mode, take the **box-transformed**
   sequence (the existing `applyBoxMode` / `rotateSequenceGeometry` from the
   box-mode-axis work — unchanged) and classify it with
   `deriveTnDFromPictograph`.
2. The card's **family** (for selection filtering) and **footer**
   (`tndFooter`) both come from that computed element — never the static diamond
   `fam.familyId`.

So selecting "Quarter-Opp" with Box active yields the seeds that are *box*
quarter-opp (DEFJKL), and each card's footer reads its true element.

### 5.3 Family cards regroup per selected grid mode (`deck-composer.ts` + `ConfigureStep.svelte`)

`getTnDFamilyOptions` must group by computed element per the **selected grid
modes**, not the static diamond catalog. This needs the base seeds' geometry, so:

- Load the ~22 base `l1-tnd-motions` sequences once when TnD mode is active
  (cheap; `loadSequencesByIds`). Classify each for diamond and box via the
  deriver.
- Family option `sequenceCount` = number of (seed × selected grid mode) pairs
  whose computed element matches that family. With both grids selected, a seed
  contributes to whichever family it lands in per grid (e.g. MP → Moon under
  diamond, Air under box).
- `ConfigureStep` family-card counts read from this grid-aware projection
  (the existing `familyMultiplier` for turn-patterns × registers still applies on
  top).

### 5.4 Gamma split seeds (`scripts/seed-tnd-deck.ts`)

Add `PMPM`/`QNQN`/`RORO` to `TND_MOTIONS` (3 new defs, beats sourced from the
canonical CSV walk, split-half gamma start, reversed hand path). Re-seed
`decks/l1-tnd-motions` to Firestore (22 seeds). The seeder's existing
orientation-chaining + `findRow` path is reused unchanged.

Per §4.3 decision, either always include them (A) or tag them for box-only
emission (B).

---

## 6. Testing (TDD)

1. **Deriver unit (red→green):** the four §2.2 ground-truth cases assert exact
   `{timing, direction}`. Add one same-direction case per family (A/G/S) from the
   CSV.
2. **Golden snapshot — deriver reproduces every known pictograph:** run
   `deriveTnD` over **all rows of both** `DiamondPictographDataframe.csv` and
   `BoxPictographDataframe.csv`; assert the result matches the current
   `calculateTnD` table for every Type-1 row. Target **100% match**. Any mismatch
   is investigated: algorithm bug *or* a real table/CSV error (e.g. the box-D
   anomaly noted during design) — never silently accepted.
3. **Seed classification table:** assert each of the 22 seeds × {diamond, box}
   classifies to the §4.2 table via the deriver on the transformed sequence.
4. **Box quarter-opp content:** `buildTnDCards` with Box + Quarter-Opp selected
   emits exactly DJ/EK/FL + JD/KE/LF, footers "Quarter-Opp"; emits **no** MP/NQ/OR.
5. **Box tog/split content:** Box + Tog-Opp → MP/NQ/OR (Air); Box + Split-Opp →
   PM/QN/RO (Fire).
6. **Diamond unchanged:** Diamond + each family reproduces today's correct
   diamond grouping (regression guard — diamond was never broken).
7. **Family counts:** `getTnDFamilyOptions` counts match the emitted-card family
   distribution for diamond-only, box-only, and both-selected.

---

## 7. Files

**New:**
- `src/lib/shared/pictograph/shared/domain/utils/tnd-deriver.ts` — the algorithm
- deriver + golden-snapshot tests

**Edited:**
- `tnd-calculator.ts` — delegate to deriver; tables demoted to golden fixture
- `services/deck-composer.ts` — `buildTnDCards` classify by computed element;
  `getTnDFamilyOptions` grid-aware grouping
- `components/deck-releaser/ConfigureStep.svelte` — family counts from grid-aware
  projection
- `components/deck-releaser/DeckReleaserTab.svelte` /
  `deck-releaser-state.svelte.ts` — load base seeds for classification
- `scripts/seed-tnd-deck.ts` — add PMPM/QNQN/RORO seeds; re-seed `l1-tnd-motions`

**Reused unchanged:**
- `applyBoxMode` / `rotateSequenceGeometry` (box-mode-axis work — geometry is
  correct; only its element-invariance claim is superseded)
- `tnd-element.ts` (`TND_BY_FAMILY`, `TND_TO_ELEMENTAL`)

---

## 8. Non-goals

- **No new rotation math.** The 45° box transform is shipped and correct; this
  spec only adds *classification* on top of it.
- **No change to same-direction seeds or families.** They are timing-invariant;
  diamond grouping was never wrong for them.
- **No hand-authored element table.** Truth is the algorithm; the table is a
  generated regression snapshot only.
