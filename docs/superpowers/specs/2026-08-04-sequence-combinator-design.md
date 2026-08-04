# Sequence Combinator + Analyzer Lab — Design

**Date:** 2026-08-04
**Status:** Approved in brainstorm (this doc is the written record)
**North star:** Two choreo cards on the table. Scan both. The app says: "there
are four ways to combine these" — or "these can only run sequentially" — or
"these cannot be combined, provably." This spec covers the engine and the
internal lab that proves the idea; the consumer scan flow is a later spec.

## The Idea

Given two fully-formed sequences, algorithmically enumerate every way they can
merge into a single closed sequence: concatenation, interleaved fusion
(DJDJ + GGGG → DJGGDJGG), fine braiding, and hybrids — or prove no combination
exists. Alongside, revive the orphaned comparison suite so any two sequences
get a weighted similarity report.

Austen's worked examples (2026-08-04 conversation) established the ontology:

- **FALG** = F(β→α) A(α→α) L(α→β) G(β→β): a hybrid of the FL, AA, and GG base
  sequences.
- The same FALG material admits two performable truths at each seam:
  **letter-faithful** (rotation direction reverses, `rev` flags, letters stay
  FALG) and **rotation-faithful** (rotation flows, pro/anti letters mutate to
  partners: GGGG's continuation becomes HHHH; F survives as its own
  mirror-variation because its motions are mixed pro/anti).
- **BBBΨGGGΦ** = a three-way hybrid of B-base + G-base + ΦΨ-base. Ψ (α→β) and
  Φ (β→α) are NOT out-of-framework "glue" — ΦΨΦΨ is a base sequence in its own
  right, and the single Ψ/Φ steps are 1-step blocks borrowed from it, exactly
  as a GG run is borrowed from GGGG.

## Settled Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Deliverable | Combinator engine + internal lab page; analyzer revived alongside |
| Liberties on inputs | Spatial transform of B (90° family + mirror/flip), re-phase LOOPs, color swap. NO rewind/invert (time direction is part of the card's identity) |
| Mechanisms | One algorithm (closed alternating walks); concat / interleave / braid are labels, not code paths |
| Seam rule | **Letter-true:** position continuity only; orientations re-derive from the walk's start (same machinery as QR restore). Grip may differ from the card; letters survive |
| Closure | **Closed loops only.** A result must return to its start position |
| Connectives | No special mechanism. ΦΨΦΨ (and kin) are base sequences; "bridged" results are just hybrids that borrowed ambient base material |
| Analyzer | Revive `src/lib/shared/comparison/` as a visible similarity panel + near-duplicate warning |

## Architecture: Three Cooperating Parts

### Layer 0 — Letter calculus (word-level sieve + vocabulary)

Letters are edges in a tiny position-family graph (nodes: α, β, γ, …; edge
examples: F: β→α, A: α→α, L: α→β, G/H: β→β, Ψ: α→β, Φ: β→α). Word-level
combinability = existence of a closed walk using the ingredient words'
letters. Runs in microseconds, before any concrete search.

- Produces **candidate hybrid words** with their derivations ("FALG = FL + AA + GG").
- Proves word-level impossibility as a first sieve.
- Necessary but not sufficient: cards contribute fixed concrete material
  (specific position instances — alpha3 vs alpha5), so Layer 1 decides.

**Base-sequence registry** (new data module): the ingredient vocabulary.
Austen counts 19 base sequences; the MCP alphabet reference already names the
compound bases (DJ, EK, FL as β↔α cycles; MP, NQ, OR as γ cycles; ΦΨ as the
dash cycle) plus the self-looping single letters. Austen additionally
promotes ΦΨΦΨ, WΣYθ, and XΔZΩ to first-class base sequences. The exact
roster ships as reviewed data — **finalize the list with Austen during
implementation; do not guess it.** Each entry: word, letter edges,
rotation character per hand, LOOP structure.

### Layer 1 — Seam-graph search (the engine)

A **seam** is the total position state between steps: (blue location, red
location). At most 64 (typically ≤16 in one grid mode) seam states exist —
the space is tiny.

1. **Variant precompute for B:** dihedral 90° family (4 rotations × mirror ×
   flip, via `sequence-transformer.ts`) × color swap (`swapMotionColor`) ×
   every phase of the loop. A stays fixed (only relative transform matters;
   results render in A's frame). 45° rotations cross grid modes
   (diamond↔box) and are deferred — see Future.
2. **Search:** bounded DFS for closed alternating walks. Consume a contiguous
   block of steps from the current source; at any seam whose state matches
   another source's seam, optionally jump. Sources: card A, every B-variant,
   and (toggleable) the ambient base vocabulary. Close when the walk returns
   to its starting seam. Must consume ≥1 block from each card.
3. **Continuity fork:** at every seam the walk branches:
   - *Letter-faithful:* rotation direction may reverse; letters preserved;
     `rev` flags recorded.
   - *Rotation-faithful:* rotation direction flows; pro/anti letters mutate
     to their partner (G↔H, A↔B); mixed-motion letters survive as their own
     variation.
   Both branches are explored; every result is labeled with which it took and
   where.
4. **Post-processing:** re-derive orientations from the walk's start
   (letter-true rule), re-derive the word (word-deriver +
   `simplifyRepeatedWord` for display), validate against the app's own
   continuity rules, dedup via `SequenceCanonicalizer`.

**Pruning knobs** (surfaced as lab controls): min block size, max result
length (≤ app cap 64), result cap, "whole repeat-units only" toggle, ambient
vocabulary on/off, per-liberty toggles.

### Verdicts and ranking

Labels derived from a found walk's block structure — one search, many names:

- `SEQUENTIAL` — one block of each card (A then B, closed).
- `FUSED` — alternating whole repeat-units (DJGGDJGG).
- `BRAIDED` — blocks smaller than a repeat unit.
- `HYBRID` — irregular block structure that still closes.
- Any of the above `+ ambient` — borrowed base-vocabulary material,
  annotated ("with a pinch of ΦΨ").
- `IMPOSSIBLE` — exhaustive search found no closed alternating walk even
  with the ambient vocabulary enabled. A proof, not a shrug.

Ranking: 100% card material first; then whole-unit consumption; then balance
of material between the two cards; then brevity.

### Layer 2 — Lab page + analyzer revival

**Route:** `src/routes/test/sequence-combinator/`.

- **Inputs:** two sequence slots. Pick from library (reuse `BrowsePanel` +
  `createBrowseEngine`, the established picker pattern) or generate (deck
  generator / MCP presets).
- **Output:** ranked combination results rendered as real pictograph
  sequences (existing sequence renderer / `.tka-seq-cell` primitives), each
  with verdict badge, ingredient derivation ("= FL + AA + GG"), transform
  annotation ("B rotated 90°, colors swapped, phase +2"), continuity-branch
  markers, and rev-flag indicators.
- **Analyzer panel:** first consumers for `src/lib/shared/comparison/`:
  `SimilarityCalculator` overall % + word/motion/position/structural
  breakdown (weights adjustable in the lab), alignment view from
  `SequenceAligner`, and a near-duplicate warning ("92% similar — fusions
  will feel repetitive"). Rot found while wiring gets fixed in place.

## Code Placement

- `src/lib/shared/combination/` — new sibling of `shared/comparison/`:
  - `domain/base-sequence-registry.ts` — the reviewed vocabulary data
  - `services/letter-calculus.ts` — Layer 0
  - `services/variant-generator.ts` — B-variant precompute
  - `services/sequence-combinator.ts` — walk search
  - `services/walk-classifier.ts` — verdict labels + ranking
  All pure functions, no Svelte, fully unit-testable.
- Reused (never-hand-roll accounting): `sequence-transformer.ts`
  (rotate/mirror/flip), `swapMotionColor`, `SequenceCanonicalizer` (dedup),
  word-deriver + `simplifyRepeatedWord` (naming), QR-path orientation
  re-derivation, `BrowsePanel`/`createBrowseEngine` (picker), existing
  sequence renderer (display). Searched: no existing combinator/enumerator
  covers two-sequence merging — the Fuse tab overlays two solo HAND PATHS
  (different operation, stays untouched); `shared/comparison/` analyzes but
  never combines.

## Proof of Understanding — Educational Examples

Novel figures derived by letter calculus alone (none previously generated),
to be rendered via MCP in the lab handoff:

1. **EBKH** (mirrored, 8 beats) = E(β→α) B(α→α) K(α→β) H(β→β) — the FALG
   analog built from the OTHER β↔α compound and the anti partners:
   EK + BB + HH.
2. **ABAB** (4 beats) — alpha-world twin of Austen's GHGH: A (pro/pro α→α)
   and B (anti/anti α→α) are alpha-land's G/H duality.
3. **AAAΨHHHΦ** (rotated, 16 beats) — the BBBΨGGGΦ analog crossing the
   diagonal: pro alpha-world + anti beta-world, stitched by ΦΨ-base pinches.
4. **DJGGEKHH** (rotated, 16 beats) — the 8+8→16 challenge: two 8-count
   hybrids (DJGG = DJ+GG, EKHH = EK+HH) fused four bases deep.

## Testing

- **Fixture pairs** (generated via MCP, stored as JSON): a known-fusable pair
  must yield its expected fusion (DJDJ+GGGG must find DJGGDJGG); a provably
  impossible pair must return `IMPOSSIBLE`.
- **Property test:** every emitted combination re-validates against the app's
  continuity rules AND closes as a loop.
- **Both continuity branches:** a fixture where letter-faithful and
  rotation-faithful diverge (GG continuation vs HH mutation) must produce
  both, correctly labeled.
- **Dedup:** rotated/re-phased duplicates of one discovery collapse to one
  result.
- Acceptance demo, verified visually in the lab: two 4-counts → 8-count
  closed hybrids; two 8-counts → 16-count hybrids.

## Future (explicitly out of v1)

- 45° rotations / diamond↔box cross-mode tunnels (needs a 45° sequence
  rotation the transformer may not have; opens gamma-world bridging).
- Skewed grid participation.
- Rewind/invert liberties (excluded by decision, revisitable).
- N-way combination (>2 cards) — the walk model supports it; UI doesn't yet.
- The consumer scan flow (two-card scan → combination picker) — own spec,
  built on this engine.
- Hand overlay as a reported combination type (kept out; Fuse tab territory).

## Risks / Open Items

- **Base-sequence roster**: must be confirmed with Austen (his count: 19,
  plus ΦΨΦΨ / WΣYθ / XΔZΩ promotions). Blocking for Layer 0 data, not for
  engine code.
- **Result explosion** at small block sizes: mitigated by knobs + ranking +
  caps; tuning is real work, planned as its own implementation phase.
- **MCP render dependency**: local MCP server's `canvas` native binary was
  repaired 2026-08-04 (pnpm never fetched the prebuild); server process needs
  reconnect to pick it up.
