---
status: backlog
value: 3
effort: L
remaining: Scoping memo. Needs full spec
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Mandala Canonical Form — Scoping Memo

**Date:** 2026-04-20
**Status:** Scoping memo (pre-brainstorm)
**Parent effort:** Sticker Lab (Phase 2)

---

## 1. Problem Statement

Every TKA LOOP paints a "mandala" — the decomposition of both hands' tip paths into petals of a symmetric figure. In practice, many structurally different LOOPs produce mandalas that are visually identical under rotation, reflection, hand-color swap, cyclic re-entry, and time reversal. There is currently no algorithmic way to detect this equivalence. Without a canonical form for a mandala, any "browse unique mandalas" directory over our 53k enumerated LOOPs would be ~90% duplicates, and sticker-lab deduplication is impossible.

## 2. Why It Matters

- **Mandala directory.** A real gallery of distinct mandala shapes becomes feasible — deduplicated from LOOP count down to orbit count.
- **Sticker deduplication.** The sticker lab can refuse to mint a second sticker for a mandala that already exists, and can offer the user every LOOP that produces their chosen mandala.
- **Mandala-as-search-key.** "Find all sequences that paint this shape" becomes a one-hash lookup, unlocking a new axis of discovery orthogonal to letter-word search.
- **Curriculum and decks.** Decks grouped by mandala orbit surface families of sequences that share a visual identity but differ in execution.

## 3. The Equivalence Group

Two mandalas are equivalent iff one maps to the other under some composition of:

1. **Rotation (C₈).** The TKA grid has 8 positions; rotations by k·45° permute them. Mandalas rotated onto themselves are visually the same figure.
2. **Reflection.** Mirror across a grid axis. Together with rotation this is the full dihedral group **D₈** (|D₈| = 16).
3. **Hand-color swap (Z₂).** Swapping blue↔red produces the same underlying figure, modulo chirality choice.
4. **Cyclic entry point (C_n, n = loop length).** A LOOP is a closed path; rotating the starting beat paints the same petals.
5. **Time reversal (Z₂).** Traversing the loop backwards paints the same petal set.

Full group (candidate): **D₈ × Z₂(color) × C_n(entry) × Z₂(time)**. For n=8, |G| ≤ 16·2·8·2 = **512** ordered variants; the orbit size per mandala is |G|/|stabilizer|. (Earlier estimate of ~256 assumed one of these factors was absorbed; the brainstorm must settle which actions commute vs. fuse.)

## 4. Representation Question

What is a mandala, as data, before we canonicalize?

- **(a) Set of petal endpoint coordinates.** Simple, but loses curve shape — two different arcs between the same endpoints collapse.
- **(b) Set of parameterized curves.** Faithful, but continuous — canonicalization becomes a geometry problem, not a combinatorial one.
- **(c) Graph on grid positions, edges labeled by curve type (shift arc, dash, static, with curvature sign / prop-rotation tag).** Discrete, combinatorial, plays well with graph canonicalization (Nauty). Probably the right answer.
- **(d) Hybrid: (c) as the canonical skeleton + (b) as the renderable payload.** Canonicalize on (c); render from (b).

The representation choice is load-bearing for every downstream algorithm. **This is the first question the brainstorm must resolve.**

## 5. Candidate Algorithmic Approaches

1. **Brute-force orbit enumeration.** Apply every element of G, serialize each variant, take the lexicographically smallest. Simple, provably correct, O(|G|) per mandala — ~500 ops × 53k LOOPs is trivial offline. Good baseline.
2. **Algebraic canonical form (adapted Booth / bracelet).** Treat the cyclic entry and reflection symmetries with Booth's or Duval's algorithm, handle D₈ and color/time as outer group. Linear-time in n for the cyclic part. Fast, but the "bracelet with colored beads under an outer group action" adaptation is where all the bugs live.
3. **Invariant hashing.** Compute rotation-, reflection-, color-, and time-invariant features (e.g., sorted multiset of edge types, grid-anchored degree sequences, petal-angle histograms) and hash. Fastest, but collisions are false positives — two different mandalas get called equal. Usable as a *pre-filter* before (1) or (2), not as ground truth.

Likely answer: (3) as a bucket, (1) or (2) as the tiebreaker within a bucket.

## 6. Open Questions the Brainstorm Must Answer

1. **Does hand-color swap count as equivalence?** A sticker with blue-dominant vs red-dominant petals — same mandala or a chiral pair sold as a set?
2. **Does time reversal count?** A LOOP and its reverse — same mandala, or two members of a chiral family?
3. **Exact or approximate canonical form?** Hash collision = true equivalence, or visual-similarity threshold for "close enough"?
4. **Cross-length equivalence.** If a 6-beat and 8-beat LOOP paint the same shape, are they the same mandala or distinct (one is "denser")?
5. **Representation choice.** Graph, curves, endpoints, or hybrid (see §4).
6. **What does "petal" mean formally?** One beat's arc? One maximal smooth stroke between direction changes? A Jordan-closed sub-region?
7. **Performance target.** Can we afford to canonicalize all 53k enumerated LOOPs in a one-time build step? In CI? Live on sticker-lab submit?
8. **Stabilizer metadata.** Do we store orbit size / symmetry group per mandala (useful for "this mandala has 8-fold symmetry")?
9. **Interaction with grid mode.** Does a diamond-mode mandala equal its box-mode rotation, or are they distinct under an enriched group?
10. **Fidelity vs. aesthetic.** Should nearly-identical-but-not-exact mandalas (e.g., one extra micro-wobble) be allowed to canonicalize together for the gallery even if they're formally distinct?

## 7. Dependency on Sticker-Lab Spec

The sticker-lab MVP ships **without** canonical form. It mints stickers from explicit user-chosen LOOPs, accepts that the catalog may contain visual duplicates, and provides no "browse all unique mandalas" view. Canonical form unlocks the **Phase 2** second source: a curated gallery of one-sticker-per-orbit, plus "other LOOPs that make this mandala" affordances on each sticker page.

## 8. Next Step

Run `superpowers:brainstorming` on this memo to produce a full research spec. The brainstorm must settle §4 (representation) and §6 (open questions) before any implementation plan is written.
