# Combinator research scripts

Throwaway-quality but load-bearing: these three scripts are the **reproducible
evidence** for the domain claims in `docs/reference/letter-gap-families.md` and
`docs/superpowers/specs/2026-08-05-sequence-combinator-redesign-design.md`.
Written 2026-08-05. They read the canonical dataframes directly and depend on
nothing else — `node scripts/combinator-research/<file>`.

They are research instruments, not product code. When the real combinator is
built inside `src/lib/shared/combination/`, these stay as the oracle its output
is checked against.

| Script | What it proves | Runtime |
|---|---|---|
| `letter-orbits.mjs` | The **13 letter-gap families**. Rotates one hand by 90/180/270 over every pictograph and maps letter → letter. 100% coverage, no misses. Prints the full map, the 180° involution, and the families as undirected components. | seconds |
| `by-count.mjs` | The **count buckets and the crossing law**. Enumerates every closed unit for a card pair, tests closure against the D4×swap group, and buckets by full circle length (unit × order of the closing transform). | ~30s for A+G |
| `theory-512.mjs` | The **pair fingerprint**. Same enumeration across many base-sequence pairs, reporting distinct-word counts. Source of the 256 / 512 / 7396 table. | minutes to hours |

## Known limits — read before trusting a number

1. **Diamond mode only.** `by-count.mjs` and `theory-512.mjs` load only
   `DiamondPictographDataframe.csv`. Box is loaded in `letter-orbits.mjs` only.
2. **The closure test is a reimplementation.** It checks position-pair membership
   against a locally-built D4×colour-swap group. It was verified 2026-08-05 to
   agree with the app's `isLOOPValidForPositionPair`
   (`packages/sequence-engine/src/loop/validation/LOOPValidator.ts`) — but the
   real engine must call the app's validator, not this.
3. **Counts are sensitive to the equivalence relation**, which is the open
   design question. `by-count.mjs` quotients by cyclic rotation of the unit,
   whole-sequence D4×swap symmetry, and the one-hand-rotation orbit. Change any
   of those and every number changes. An early version omitted the orbit quotient
   and reported 512 for A+G where the correct figure is 256.
4. **45° (skew) is excluded** — the shipped skewed dataframe has no rows starting
   from a skewed position, so skew faces cannot be resolved. See the design spec.
5. Turns are ignored entirely; everything is 0-turn.
