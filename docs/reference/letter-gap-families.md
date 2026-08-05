# Letter Gap Families — the one-hand rotation structure

**Established 2026-08-05** (Austen + Fable session, sequence-combinator redesign).
Derived by exhaustive computation over `DiamondPictographDataframe.csv` +
`BoxPictographDataframe.csv`: 100% coverage, zero unmapped letters.

## The operation

Hold one hand's motions fixed. Rotate the **other** hand's locations by a
multiple of 90°. Every resulting motion tuple is a legal pictograph, and it
carries a different letter.

Nothing about the dance changes — each hand keeps its own path, motion type
(pro/anti), and rotation direction. The only thing that changes is the **gap**
between the hands, and therefore the position family that describes it:

| Gap between hands | Position family | VTG timing |
|---|---|---|
| 0° (same point) | beta | Together |
| 90° (right angle) | gamma | Quarter |
| 180° (opposite) | alpha | Split |
| 45° / 135° | zeta, eta | (skewed) |

**A letter is not an atom. A letter is (motion character, gap).**

## The 13 families

Members of a family are the same motion character seen at different gaps.
Verified 2026-08-05 as undirected connected components under 90/180/270
one-hand rotation.

| # | Family | Character |
|---|---|---|
| 1 | A, G, S | Type 1, same direction, both pro |
| 2 | B, H, T | Type 1, same direction, both anti |
| 3 | C, I, U, V | Type 1, same direction, hybrid |
| 4 | D, J, M, P | Type 1, opposite direction, both pro |
| 5 | E, K, N, Q | Type 1, opposite direction, both anti |
| 6 | F, L, O, R | Type 1, opposite direction, hybrid |
| 7 | W, Y, Σ, Θ | Type 2, shifting hand pro |
| 8 | X, Z, Δ, Ω | Type 2, shifting hand anti |
| 9 | Φ, Ψ, Λ | dash pair + its gamma form |
| 10 | W-, Y-, Σ-, Θ- | Type 3, shifting hand pro |
| 11 | X-, Z-, Δ-, Ω- | Type 3, shifting hand anti |
| 12 | Φ-, Ψ-, Λ- | dashed dash family |
| 13 | α, β, γ | static holds |

**TKA already named this.** The family is the VTG *direction* class plus spin
character; the member within it is the VTG *timing* class. Split-Same (A),
Together-Same (G) and Quarter-Same (S) were never three unrelated letters —
they are one motion at three separations, and the existing names say so.

## The 180° map (a total involution)

A↔G · B↔H · C↔I · D↔J · E↔K · F↔L · M↔P · N↔Q · O↔R · U↔V · W↔Y · X↔Z ·
Σ↔Θ · Δ↔Ω · Φ↔Ψ · α↔β

Self-paired: **S, T, Λ, γ, Λ-**.

This is NOT the pro/anti twin involution (A↔B, G↔H, S↔T — see
`reference_twin_letter_involution`). Two different involutions act on the
letter set; do not conflate them.

## Why S is its own partner

Gamma has 16 variations where alpha and beta have 8. In the same-direction
families, one letter covers *both* right-angle arrangements — S has 32 dataframe
rows where A and G have 16 each — so rotating one hand 180° maps S onto itself.
In the opposite-direction families the two right angles are split across two
letters (M/P, N/Q, O/R), 16 rows each, so they map onto each other instead.

That is exactly why Quarter-Same has 4 letters (S, T, U, V) and Quarter-Opposite
has 6 (M–R).

## Sequence orbits

A sequence's orbit is every letter walking its own family in lockstep. Verified
on EK+GG (a combination requiring a prop reversal):

| Red rotated | Word | World | Path | Closes |
|---|---|---|---|---|
| 0° | EKGG | diamond α/β | beta3 → alpha5 → beta7 → beta1 → beta3 | yes |
| 90° | NQSS | gamma | gamma5 → gamma15 → gamma1 → gamma3 → gamma5 | yes |
| 180° | KEAA | diamond α/β | alpha7 → beta1 → alpha3 → alpha5 → alpha7 | yes |
| 270° | QNSS | gamma | gamma9 → gamma3 → gamma13 → gamma15 → gamma9 | yes |

E and K sit in family 5, G in family 1; every face is those families re-gapped
together. Reversal structure is invariant across the orbit — rotating locations
never touches spin direction — so all four faces carry the same 3 prop
reversals. Same loop, same flaw, four labels.

**Independent confirmation:** running the same rule on ALGF reproduced two
sequences Austen had hand-built in the constructor before this rule existed —
90° gives SRSO, 180° gives GFAL, both letter-for-letter.

## The 45° case (skew) — real but undescribed

Rotating one hand 45° puts it on the diagonals while the other stays cardinal.
Austen built a working closed 4-step skewed loop this way (`G F A L` in eta/zeta
positions), and skew **keeps the original letter names** — the skew generator
applies skew to existing diamond/box pictographs and preserves the letter.

But `SkewedPictographDataframe.csv` (byte-identical in `static/data/pictographs/`
and `mcp-server-pkg/assets/data/pictographs/`, 5120 rows) contains **no rows that
start from a skewed position**. Its start positions are only alpha/beta/gamma.
`scripts/generate-skewed-dataframe.ts` builds it by applying skew to existing
diamond and box pictographs, so it can describe stepping *into* skew and never
describes continuing *within* it.

Consequence: a closed loop that stays in skew cannot be expressed from the
shipped data, even though it is performable. Extending the generator to cover
skew→skew transitions is the unlock for skewed LOOPs.

## What this changes

1. **Search orbit representatives, not letters.** 13 families instead of 47
   letters; roughly a 4× reduction in combination search, with gamma and box
   material arriving free rather than as a deferred cross-mode feature.
2. **Dedup at the family level.** Four faces of one loop are one discovery with
   four presentations, not four results.
3. **Do not widen the combinatorial space — factor it.** The generator should
   work on (motion character, gap) rather than on opaque letters. The space gets
   smaller while covering more.

## Reproduce

`scripts/` has no tool for this yet. The session used a throwaway script that
loads both dataframes, keys pictographs by the full 8-field motion tuple
(`blueMotionType, blueRotationDirection, blueStartLocation, blueEndLocation`,
same for red), rotates one hand's two locations on the 8-point compass ring, and
looks the result back up. Any reimplementation should reproduce the 13 families
exactly; if it does not, the lookup key is wrong.
