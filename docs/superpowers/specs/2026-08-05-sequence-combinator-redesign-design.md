# Sequence Combinator — Redesign (LOOPs only, family-factored)

**Date:** 2026-08-05
**Status:** Design, awaiting Austen's review
**Supersedes:** `2026-08-04-sequence-combinator-design.md` (shipped, rejected on output quality)
**Companion findings:** `docs/reference/letter-gap-families.md`,
`2026-08-05-loop-detection-false-negatives-handoff.md`

## Why a redesign

The 2026-08-04 build shipped working code that produced unusable output. Austen,
2026-08-05, looking at the lab: *"it gave me a bunch of combinations which are
literally nonsensible ... not a single one of these sequences is a LOOP and I
don't want freeform crap sequences."* The UI put six control groups, two JSON
paste boxes and a four-slider similarity panel above the results.

The engine was not broken. It was answering the wrong question — "which closed
alternating walks exist" instead of "which LOOPs can these two cards make."

## What this must deliver

Given two cards, a finite and complete answer: here is the taxonomy of ways they
combine, here are the results, and there are no others inside the stated box.
Austen: *"be confident that we've cracked the system."*

## Settled decisions

| Decision | Ruling (2026-08-05) |
|---|---|
| Result contract | **LOOPs only.** Full LOOP family — plain, rotated, mirrored, flipped, swapped, inverted, rewound, compounds. Freeform closures are discarded, not demoted. |
| Connectors | Minimal, only when the pair cannot close without them. Fewest possible, visibly marked. Roster = the 24 base sequences (19 + 2 Type 2 + 2 Type 3 + 1 Type 4). |
| Result display | **Full circles always**, every step shown. |
| Result grouping | **Grouped by LOOP type.** |
| List shape | **Flat rows, one per closure.** A flat list is auditable; a count you can see is the point. |
| UI | Stripped to the task: two card slots, one Combine button, results. Everything else behind a collapsed Advanced drawer. |

## The three findings that reshape the engine

### 1. A word does not determine its closure

`list_letter_variations("Ψ")`: from alpha7, blue-dashes lands beta7 and
red-dashes lands beta3 — 180° apart, same letter, same start. The same word
therefore admits several different closures depending on which variations get
realized. **Any logic reasoning from a word string is structurally wrong.** The
engine works on realized steps and asks the app which LOOP types the resulting
position pair admits.

### 2. Letters are (motion character, gap) — the family structure

Hold one hand fixed, rotate the other by 90°, and every letter maps onto another
legal letter. 100% coverage, no exceptions, yielding **13 families**
(`letter-gap-families.md`). A, G and S are one motion at three hand separations;
TKA's own VTG timing names — Split, Together, Quarter — already *are* the gap
coordinate.

A sequence's orbit is every letter walking its family in lockstep. EK+GG gives
EKGG (diamond) → NQSS (gamma) → KEAA (diamond) → QNSS (gamma): four faces, one
loop, identical reversal structure in all four. Confirmed independently by
running the rule on ALGF and reproducing two sequences Austen had hand-built
before the rule existed.

**Consequence:** search one gap regime and generate the orbit. Roughly 4× less
search, and gamma/box material arrives free rather than as the cross-mode
feature the old spec deferred to Future.

### 3. The answer has a shape, and the count fingerprints the pair

Exhaustive enumeration (unit ≤ 6 steps, ≤ 2 connectors, diamond, both cards
required). Every 4-step result for A + G has the same form:

```
AJGD  AJGE  AJGF  AJGΦ  AKGD  AKGE  AKGF  AKGΦ
ALGD  ALGE  ALGF  ALGΦ  AΨGD  AΨGE  AΨGF  AΨGΦ
```

That is **one shape** — *A-run · cross out · G-run · cross back* — with four
outbound crossers (J, K, L, Ψ), four return crossers (D, E, F, Φ), and a run
length. The count is not that many ideas; it is one idea enumerated.

**The totals are a fingerprint of how the two cards relate:**

| Pair | Relationship | Distinct words |
|---|---|---|
| A+G, B+H, C+I | cross-world, matched spin character | **256** |
| A+H, B+G | cross-world, mismatched spin | **512** |
| A+S, G+S | cross-world into gamma | **512** |
| A+B, G+H | same world, no crossing needed | **7396** |

Cards in different position worlds need a bridge at every seam, which constrains
the answer set hard; sharing spin character folds it in half again. Cards in the
*same* world need no connector at all — A+B's shortest result is 2 steps against
A+G's 4 — so every interleaving is legal and the space explodes. A+B and G+H
returning the identical 7396 is the family structure of finding 2 reappearing:
the alpha and beta versions of one question have one answer.

Austen's hypothesis (2026-08-05) that the count would be a constant 512 across
base pairs is therefore **refuted as stated but right in spirit** — the counts
come from a small stable set determined by the pair's symmetry, not from the
pair's identity.

## Architecture

Four stages, each independently testable, all pure functions.

**Stage 1 — Vocabulary.** From the two cards: their letters, plus the connector
roster (24 base sequences), each letter contributing its variations as edges.
Cards that cannot run are recognised here: K is always alpha→beta, so KK does not
exist and the "K card" is the EK compound.

**Stage 2 — Unit search.** Exhaustive DFS over realized steps, bounded by unit
length and connector budget, requiring both cards to contribute. Position
continuity prunes at every step. **No caps, no truncation banner** — the box is
declared and the search inside it finishes.

**Stage 3 — Closure.** For each candidate unit, hand the realized
`(startPosition, endPosition)` to the app's own LOOP machinery and ask which
types it admits. Emit one result per admissible type. **The engine must not
reimplement this** (see Open Questions).

**Stage 4 — Present.** Expand each unit through the existing LOOP executor into
its full circle; compute its orbit faces; group by LOOP type; rank by shape,
then connector count, then length.

Placement: rebuild inside `src/lib/shared/combination/`, retaining
`letter-calculus.ts` as the family-aware pre-sieve and replacing the walk search
and classifier. The 142 existing tests were written against the old contract;
expect most to be rewritten rather than kept.

## UI

Two card slots at the top — library picker (the currently-disabled placeholder,
wired for real via `BrowsePanel` + `createBrowseEngine`) plus the preset chips.
One Combine button. Then results.

Each result renders every step of the full circle, with a LOOP-type badge, the
simplified word (`simplifyRepeatedWord`, per `simplified-word-display.md`), steps
coloured by origin — card A, card B, connector — and its reversal counts. Above
them, the completeness statement:

> Vocabulary: A, G + 8 connectors. Explored 2,057,344 walks to unit length 6.
> One shape · 16 crossing pairs · 3 run lengths. Complete.

Behind a collapsed Advanced drawer: liberty toggles, length and connector
budgets, JSON paste, and the similarity panel with its sliders. Nothing there
greets you.

### Sorting and sub-categorising the results

Results are sequences, so **the browse gallery's existing filter bar points at
them directly** rather than getting a bespoke sorting UI — and the qualities you
sort combinations by become the same ones you already browse your library by.
Reuse `BrowseFilterType` (`src/lib/shared/persistence/domain/enums/filtering-enums.ts`)
and the shared `filter-chips/` components per `chip-primitives.md`.

Available on a realized sequence today, verified 2026-08-05:

| Quality | Source |
|---|---|
| Prop reversals **and** hand reversals, as two independent channels | `deriveReversals` — `packages/sequence-engine/src/analysis/deriveReversals.ts:105` |
| Named reversal pattern (continuous, book, red-book …) | `matchReversalPatternId` — `src/lib/features/choreo-card/domain/reversal-matcher.ts:65` |
| LOOP type / component | `LOOPDetector` (subject to Open Question 3) |
| Rotation period (halved / quartered) | `detectRotationPeriod` — `src/lib/shared/create/domain/detect-rotation-period.ts:26` |
| Difficulty level 1–3, and level 4–8 features | `analyzeDifficulty` — `sequence-difficulty-calculator.ts:22`; `detectLevelFeatures` — `level-feature-detector.ts:67` |
| Max turn intensity, step count, grid mode, start/end position group, TnD family | `browse-filter.ts` (all cached, all reusable) |

The prop/hand split is the correct form of the axis this session first got wrong:
a connector's character is *which flow it protects*, and both channels are
measurable per result rather than inferred from letter type.

**Must be built (nothing analyses a finished sequence for this):** motion-type
mix, i.e. contains-dashes / contains-statics, plus letter-type mix and VTG
category mix. Small, but currently absent — dash preference exists only as a
generation-time steering bias, never as a post-hoc classifier.

Follows `4k-native-layout.md` and `no-layout-shift.md`; verified at all seven
viewports per `visual-verification-mandatory.md` before it is called done.

## Open questions — these gate implementation

**1. What counts as ONE combination?** The blocker. Counting realizations gives
14,180 for G+A; counting words gives 512; counting shapes gives 1. Shapes is
clearly the right altitude, but "shape" needs a formal definition — provisionally
*the sequence of (card-A run, connector, card-B run, connector) block lengths,
ignoring which specific connector was chosen*. **Austen must confirm this before
the result list means anything.**

**2. LOOP admissibility must come from the app.** A scratch reimplementation
written during this session disagrees with `validate_loop_options`: for
alpha7→alpha5 the app offers only `rewound`, while a naive D4×swap group test
finds a 90° rotation mapping one to the other. The app's rule is stricter than
position-pair matching and is not yet understood. **Reimplementing it is exactly
the mistake this design forbids** — the engine calls the real machinery, and
someone must first document what that machinery actually requires.

**3. Detection cannot currently be trusted.** Three LOOP detectors exist with
three definitions of circular; `detect_loop_pattern` is non-deterministic; and
`loopType` is never written on the constructor save path. Tracked separately in
the handoff doc. The combinator must classify from realized steps and never
consult the word-based detector.

**4. Skew is performable but undescribed.** Rotating one hand 45° is real —
Austen built a closed skewed loop — but `SkewedPictographDataframe.csv` contains
no rows starting from a skewed position, so no closed skewed loop can be
expressed from shipped data. Extending `scripts/generate-skewed-dataframe.ts` to
cover skew→skew is the unlock. Out of scope here; 45° faces are omitted from
orbits until it lands.

**5. Turns are pinned at zero** for v1, taking cards as they are. Turn counts
multiply the space and nothing in this conversation established what they should
do.

## Evidence

- Exhaustive search is tractable: 2,057,344 walks in 8 seconds, single-threaded.
  The old engine's "raw-walk cap fired" banner was an algorithm artifact of
  hunting whole circles to depth 16, not a fundamental limit.
- The orbit rule reproduced Austen's hand-built SRSO and GFAL exactly.
- EKGG closes in 4 steps beta3→beta3 and carries 3 unavoidable prop reversals —
  E and K spin their hands in opposite directions while G spins both the same
  way, so the splice cannot be smooth. A+G has fully continuous answers; K+G
  structurally does not. That contrast is a feature of the output, not a defect.

## Testing

Fixtures asserting the settled facts: A+G yields the crossing shape and no
freeform; every emitted result re-validates as a LOOP against the app's own
rules; EK+GG reports its reversals; a discovered loop's orbit faces all resolve
to legal pictographs; dedup collapses the four faces of one loop to one family.
Property test: no emitted result is freeform, ever.
