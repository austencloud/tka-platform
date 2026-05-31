# Mirror-Swap Twin Deck — Enumerator Mode

**Date:** 2026-05-31
**Status:** Design — approved for planning
**Scope:** `scripts/enumerate-deck.cjs` only. No app/UI/sequence-action changes.

## Concept

A new orthogonal flag `--twin` on the deck enumerator. The deck is built in two
halves from one enumeration:

- **Generated half** — the normal enumeration for the given
  `loopType`/`slice`/`seedLength`/`level` → N cards.
- **Derived half** — each generated card transformed by **color-swap ∘
  vertical-mirror** → N cards.
- **Deck = 2N.**

The theme: you make half a deck, then derive the other half by one fixed
transformation (mirror + color swap). `--twin` stacks on any existing
configuration; it does not replace `loopType`, `slice`, `reversalPattern`, etc.

## The Transform

Applied to the **full loop-executed sequence** of each card (the start position
+ all beats), NOT to the pre-execution seed. This guarantees a card's twin is
exactly the mirror-swap of the rendered card — matching the two reference
sequences this design was derived from (full 8-beat X-LΘΛX-LΘΛ pairs).

Per step (start position step included):

1. **Color swap** — `newBlue = {...oldRed, color:"blue"}`,
   `newRed = {...oldBlue, color:"red"}` (the motion data travels with the swap).
2. **Vertical mirror** — for each motion:
   - `startLocation`, `endLocation` → `VERTICAL_MIRROR_LOCATION_MAP`
     (`packages/sequence-engine/src/loop/position-maps/strict-loop-position-maps.ts:66`;
     e↔w, n/s/c fixed).
   - `rotationDirection` → `mirrorHandRotationDirection`
     (`circular-position-maps.ts:364`; cw↔ccw, dash/static unchanged).
3. **Derive positions from transformed locations** — a step's `startPosition` is
   derived from its transformed `(blueStartLoc, redStartLoc)` pair and its
   `endPosition` from `(blueEndLoc, redEndLoc)`, via a `(blueLoc|redLoc) →
   position` lookup built once from the CSV `edges` array (the same data the
   enumeration walks). A position IS the encoding of a hand-location pair, so the
   pair determines the position uniquely. **`VERTICAL_MIRROR_POSITION_MAP` is NOT
   used** — mapping the position directly is wrong (it yields `gamma13→gamma5`
   where derivation from locations yields the correct `gamma11`). Verified
   beat-by-beat against the two reference sequences.
4. **Re-derive letter** — `lookupLetterFromMotions(step)` (already in-script,
   `enumerate-deck.cjs:820`) against the CSV after the swap+mirror.
5. **Re-propagate orientations** — set the twin start step's orientations to
   `in`/`in` (it's static), then `propagateOrientations(twinSteps)` (already
   in-script, `:727`) recomputes the rest, because swapped/mirrored motions
   change orientation flow.

Color-swap and vertical-mirror act on independent axes (color vs geometry), so
they commute; each is an involution, so the pair map is an involution (A's twin
is B, B's twin is A). **No "original/derived" relationship is stored** — twin is
a pure function of the card, recomputed anywhere it's needed. This follows the
QR-derived-field principle: don't bake derivable state.

## Reuse, not new code

| Need | Source | Status |
|------|--------|--------|
| e↔w location mirror | `VERTICAL_MIRROR_LOCATION_MAP` | engine, `require`d |
| rot-dir flip | `mirrorHandRotationDirection` | engine, `require`d |
| position from locations | `(blueLoc\|redLoc)→pos` map built from `edges` | in-script (CSV) |
| color swap | swap `motions.blue`/`red` (with `color` field) | trivial inline |
| letter re-derive | `lookupLetterFromMotions` | in-script `:820` |
| orientation propagation | `propagateOrientations` | in-script `:727` |

`VERTICAL_MIRROR_POSITION_MAP` is deliberately NOT used (see Transform step 3).
Both engine maps load via `require()` (Node 22.20 `require(esm)`, runtime-verified:
`VERTICAL_MIRROR_LOCATION_MAP.e === "w"`, `mirrorHandRotationDirection("cw") ===
"ccw"`) — the same mechanism the script already uses for the LOOP executor at
`:680`.

The enumerator already `require`s the ESM engine dist (`:680`), so the three
maps import the same way. No transform logic is ported or hand-rolled.

## Injection Point

Inside the existing write loop `for (const item of deduped)`
(`enumerate-deck.cjs:841`), after `seqData` is assembled from `fullSteps` +
`startPosition` (`:991`):

- Write the base `seqData` (unchanged).
- If `--twin`: build `twinSteps`/`twinStartPosition` by applying the transform
  above to the same `fullSteps`/`sp`, assemble `twinSeqData` exactly like
  `seqData` (same shape, `loopType`, `reversalPattern`, `metadata`), and write
  it as a second doc.
- `twinSeqId = ${twinStartPos}_${twinWord}` (parallel to base
  `${item.startPos}_${item.seedWord}` at `:842`).
- The twin's `metadata.handPathFamily` is recomputed from its own transformed
  letters (it falls into its natural family; existing family grouping/seeding
  machinery at `:1016-1018` consumes it unchanged).

## Self-Twins — excluded

A self-twin is a card equal to its own mirror-swap. Per decision, drop them so
the deck reads as "every card is half of a pair."

- Equality test: twin step locations/positions/motion-types/letters identical to
  base across all steps.
- With the canonical default starts (`alpha1, beta5, gamma11`,
  `enumerate-deck.cjs:299`), a twin's start maps to a position the base
  enumeration never visits (e.g. `gamma11→gamma7`), so generated- and
  derived-half start sets are disjoint and self-twins effectively cannot occur.
  The exclusion is a guard that logs a count if it ever fires (signals a
  non-canonical start set or a mapping bug).

## Cross-Duplicate Guard

Because generated starts and derived starts are disjoint, no twin collides with
a generated card. A `Set` of written `seqId`s is still checked before each twin
write; a collision is logged and skipped (defensive, expected count 0).

## Catalog Output

- `deckId` gains a `-twin` segment:
  `l{level}-{slice}-{loopType}-twin-{totalBeats}beat`
  (e.g. `l1-halved-rotated-twin-4beat`). Built where `deckId` is composed
  (`enumerate-deck.cjs:659`).
- Deck name/description note the twin construction:
  "… Twin edition (mirror + color swap)."
- Card docs are plain — **no `twinPairId`, no `twinRole`, no new fields.** Pair
  recovery, if ever needed by UI, is computed on the fly.
- Existing hand-path family grouping is kept (recommended over a pair-first
  regroup): the Decks UI is already built around families, and twins land in
  their natural families. Pairs are derivable without a storage change.

## Dry-Run Reporting

`--twin --dry-run` reports, without executing loops:

- generated count N,
- derived count N (= N minus any self-twins),
- self-twins excluded,
- deck total 2N,
- start-position spread for both halves (generated starts + their mirror-swap
  start mapping), so the disjoint-start claim is visible before seeding.

## Verification

Per `.claude/rules/verification-protocol.md` + the `deck` skill exit criteria:

1. `--twin --dry-run` first; confirm 2N and disjoint start spread.
2. After `--seed-firestore`: pick one generated card and confirm a sibling doc
   exists whose steps equal its mirror-swap (locations e↔w, colors swapped,
   rot-dir flipped, letters re-derived).
3. Confirm a derived **anti** card shows correct orientation flipping
   (in→out→in) — proves re-propagation ran.
4. Confirm the reference pair reproduces: base start `gamma13 {blue w, red s}`
   twins to `gamma11 {blue s, red e}` (color-swap then e↔w mirror), matching the
   two supplied X-LΘΛX-LΘΛ sequences.
5. Deck loads in the Decks tab with correct name + beat count, no console
   errors.

## Out of Scope

- Sequence-action "Twin" button (explicitly deferred by user).
- Releaser Twin axis / `CardVariation` flag (the render-seam alternative was
  considered; enumerator-baked chosen for a self-contained catalog deck).
- Any new card-model field.

## Files

**Modify:**
- `scripts/enumerate-deck.cjs` — `--twin` flag parse + validation; import the
  three engine mirror maps; twin builder applied to `fullSteps` in the write
  loop; `-twin` in `deckId`/name/description; self-twin + cross-dup guards;
  dry-run twin reporting.

**Create:** none (no new modules; transform is composed from existing engine +
in-script helpers).
