# Sequence Combinator + the TKA Letter Algebra — Handoff (2026-08-05)

## Mission

Two threads, one session.

**The near thread:** the sequence combinator shipped 2026-08-04 and was rejected
on output quality — it emitted freeform walks instead of LOOPs, with a UI that
buried results under six control groups. Austen: *"not a single one of these
sequences is a LOOP and I don't want freeform crap sequences."* It was
re-brainstormed from scratch. Design:
`2026-08-05-sequence-combinator-redesign-design.md`.

**The far thread, which is now the more important one:** while testing the
redesign's assumptions against real data, the session uncovered a **finite
algebraic structure underneath the whole letter system** — 13 families, a total
involution, and closure laws that predict a combination's length before you build
it. Austen wants this formalised: *"I'm trying to formalize this essentially into
its own algebra where we can make definitive statements about how this works
consistently ... the finite number of interactions that are possible and the
finite rules that occur when specific interactions are set in motion is exactly
what I want to enumerate with clarity and confirm using the generator."*

His closing instruction: *"the enumeration is getting really super sick so maybe
it's time to go from spec into reality."* Build it.

## Done — verified

Everything below was computed or generated in-session. Reproduce with
`node scripts/combinator-research/<script>` (see that directory's README for
limits) or the cited MCP call.

### 1. The 13 letter-gap families — the core discovery

Hold one hand fixed, rotate the other by 90/180/270. **Every letter maps onto
another legal letter. 100% coverage, zero exceptions**, over the diamond and box
dataframes.

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

**A letter is not an atom — it is (motion character, gap).** Nothing about the
dance changes under the rotation; each hand keeps its path, pro/anti, and spin
direction. Only the *distance between the hands* changes, and the position family
is merely a name for that distance: same point is beta, right angle is gamma,
opposite is alpha.

**TKA already named this.** Split-Same, Together-Same, Quarter-Same are one motion
at three separations — Split/Together/Quarter *is* the gap coordinate. The system
has been saying so all along.

Full detail, including the 180° involution table and why S is self-paired:
`docs/reference/letter-gap-families.md` (committed).

### 2. Sequence orbits

A sequence's orbit is every letter walking its family in lockstep. EK+GG:

| Red rotated | Word | World | Closes |
|---|---|---|---|
| 0° | EKGG | diamond α/β | yes |
| 90° | NQSS | gamma | yes |
| 180° | KEAA | diamond α/β | yes |
| 270° | QNSS | gamma | yes |

Reversal structure is invariant across the orbit — rotating locations never
touches spin direction — so all four faces carry the same 3 prop reversals. Same
loop, same flaw, four labels.

**Independent confirmation:** running the rule on ALGF reproduced two sequences
Austen had hand-built in the constructor before the rule existed — 90° gives
SRSO, 180° gives GFAL, letter for letter.

### 3. The crossing law — verified against real generations

Circle length = unit length × the order of the closing transform. Plain closes in
one pass, mirror/flip/swap/180° in two, 90°/270° in four.

**Matched crossings close at 4; mixed crossings force 16.** Shift crossings
(J, K, L, D, E, F) advance the loop 90°; dash crossings (Ψ, Φ) advance it 180°.
Match them and the residues cancel; mix them and a 90° residue survives.

| Generation | Result |
|---|---|
| `AJGD` — shift out, shift back | alpha3 → **alpha3**, closes plain in 4 |
| `AJGΦ` — shift out, dash back | alpha3 → **alpha5**, does not close |
| `AJGΦ` rotated/quartered | **16 steps, `isCircular: true`**, alpha1 → alpha7 → alpha5 → alpha3 → alpha1 |

Measured buckets for A+G (unit ≤ 6, connectors ≤ 2, diamond): 4-count 10 words ·
5-count 18 · 6-count 60 · 8-count 32 · 10-count 80 · 12-count 144 · **16-count 12
(every one a mixed crossing)** · 20-count 50 · 24-count 54.

### 4. Pair fingerprints

Distinct words per pair, box held identical (unit ≤ 6, ≤ 2 connectors, diamond):

| Pair | Relationship | Words |
|---|---|---|
| A+G, B+H, C+I | cross-world, matched spin | **256** |
| A+H, B+G | cross-world, mismatched spin | **512** |
| A+S, G+S | cross-world into gamma | **512** |
| A+DJ, G+EK, A+FL | card + opposite-direction compound | **7620** |
| A+B, G+H | same world | **7396** |
| S+T | same world, gamma (double variations) | **23466** |

Cross-world pairs need a bridge at every seam, which constrains hard; sharing
spin character halves it again. Same-world pairs need no bridge — A+B's shortest
result is **2 steps** against A+G's 4 — so every interleaving is legal and the
space explodes. A+B and G+H returning the identical 7396, and A+DJ / G+EK / A+FL
all returning 7620, is the family structure reappearing: the alpha and beta
versions of one question have one answer.

### 5. LOOP admissibility — the rule, and the footgun

The rule is position-pair membership in a **period-specific** validation set.
`packages/sequence-engine/src/loop/validation/LOOPValidator.ts` builds
`HALVED_LOOPS` from a 180° map and `QUARTERED_LOOPS` from 90° CW/CCW maps;
`isLOOPValidForPositionPair(loopType, positionPair, period)` selects by period
(`:343`).

**`validate_loop_options` declares `period: periodSchema.optional().default("halved")`**
(`mcp-server-pkg/src/tools/loop-tools.ts:86`). Any call omitting it gets a
halved-only answer and **every quartered LOOP is silently invisible.** This
produced a false "the app disagrees with my computation" conclusion mid-session
that took real work to unwind. Passing `period: "quartered"` for alpha3→alpha5
returns rotated, rotated_inverted and rotated_swapped — matching the group
computation exactly.

**Binding: query BOTH periods for every candidate unit**, or the entire 16-count
bucket disappears.

### 6. A word does not determine its closure

`list_letter_variations("Ψ")`: from alpha7, blue-dashes lands beta7 and
red-dashes lands beta3 — 180° apart, same letter, same start. The same word
admits different closures depending on realized variations. **Any logic reasoning
from a word string is structurally wrong.**

### 7. Dash continuity — Austen was right, and there is a bug

Austen: *"dashes that don't have rotation applied to them are considered
continuous from that which came before even though they stop momentum."*
Confirmed in code. The app's CONTINUOUS filter walks *past* noRotation motions
with a `continue`, carrying the last real spin direction across
(`option-picker/services/reversal-checker.ts:188,204`); the engine does the same
deliberately (`deriveReversals.ts:164,181`, documented as "transparent chains").

**The bug:** `mcp-server-pkg/src/core/constraints/analysis/transition-analyzer.ts:111`
excludes `static` from the effective-prop-rotation read but **not `dash`**, so a
dash's literal `noRotation` is compared against `cw` and counted as a reversal.
The guard is present in five other implementations and missing only here. This is
why `analyze_word_feasibility` claims A→Ψ "always requires prop reversal" while
the generator's own report on the same sequence says "Perfect continuity: no
reversals." **The prop half of `analyze_word_feasibility` is untrustworthy for any
word containing a dash letter** (Type 3/4/5, Φ, Ψ, Λ). One-line fix; not applied.

### 8. Type 2 and Type 3 base sequences: exactly 2 each

Σ is alpha→gamma and W is gamma→alpha, both with the shifting hand pro (verified
directly); Y and Θ cover gamma→beta and beta→gamma. The closed cycle using each
pro letter once is **ΣYΘW**; the anti mirror is **ΔZΩX**. Type 3 is the same
eight letters with the static hand replaced by a dash, giving **Σ-Y-Θ-W-** and
**Δ-Z-Ω-X-**. Two each, matching Austen's prediction. Roster total: 19 + 2 + 2 + 1
= **24 base sequences**.

### 9. Smaller confirmed facts

- **K cannot run.** Every K variation is alpha→beta, so KK does not exist; the "K
  card" is the EK compound. Generalises: crossing letters never repeat.
- **EKGG** closes in 4 steps beta3→beta3 with **3 unavoidable prop reversals** — E
  and K spin their hands in opposite directions while G spins both the same way.
  A+G has fully continuous answers; K+G structurally does not.
- **Skew is performable but undescribed.** Austen built a closed 4-step skewed
  loop, and skew preserves the original letter names. But
  `SkewedPictographDataframe.csv` (byte-identical in `static/data/pictographs/`
  and `mcp-server-pkg/assets/`) has **no rows starting from a skewed position** —
  `scripts/generate-skewed-dataframe.ts` only applies skew to existing
  diamond/box pictographs. No closed skewed loop can be expressed from shipped
  data. Extending that generator is the unlock for 45° orbit faces.
- **Exhaustive search is cheap:** 2,057,344 walks in 8 seconds, single-threaded.
  The old engine's "raw-walk cap fired" banner was an artifact of hunting whole
  circles to depth 16, not a real limit.

## Believed done — unverified

- **Y and Θ position families** came from a subagent's dataframe read, not a
  direct lookup. Σ, W, S, K were verified personally. One lookup short of proven.
- Two `LOOPDetector` defects reported but not personally re-read:
  `reduceRepeatedMotionSkeleton` may over-reduce (`:317-336`), and
  `deriveLoopTypeFromComponents` may lack `flipped` in multi-component
  combinations, degrading confidence and disabling compositional QR encoding.
- The **7620** figure for A+DJ / G+EK / A+FL comes from a sweep that was still
  running at session end; the last rows (DJ+EK, DJ+FL, S+MP, MP+NQ) never
  completed.

## In flight

Nothing uncommitted. Five commits pushed to `main` today:

| Artifact | Path |
|---|---|
| Detection handoff | `docs/superpowers/specs/2026-08-05-loop-detection-false-negatives-handoff.md` |
| Families reference | `docs/reference/letter-gap-families.md` |
| Redesign spec | `docs/superpowers/specs/2026-08-05-sequence-combinator-redesign-design.md` |
| Research scripts | `scripts/combinator-research/` (+ README with limits) |
| This handoff | `docs/superpowers/specs/2026-08-05-sequence-combinator-algebra-handoff.md` |

Note: `git status` carries ~28 modified files from other sessions (animation
engine, compose, export). **Not related to this work.** Commit with explicit
pathspecs only (`.claude/rules/commit-only-your-own-changes.md`).

## Loose ends (ranked)

**#1 — Enumerate the 13×13 family interaction table.** This is the algebra Austen
asked for and the natural next computation. For every ordered pair of families,
answer with the generator confirming: can they meet directly or is a crossing
required; which crossings are legal; what count buckets result; what the
fingerprint number is. 169 cells, heavily reduced by symmetry. `theory-512.mjs`
already does one cell — generalise it, run it overnight, and the output *is* the
formal statement he wants. Watch runtime: same-world pairs took 11 minutes each.

**#2 — Build the combinator for real.** Austen: *"maybe it's time to go from spec
into reality."* The design is written and its blocking question is resolved.
Rebuild in `src/lib/shared/combination/`, calling the app's
`isLOOPValidForPositionPair` for **both periods**, never the word-based detector.
`by-count.mjs` is the prototype and stays as the oracle to check output against.

**#3 — Settle the equivalence relation.** Still the one thing only Austen can
decide, and every number moves with it. He said *"counting words is right"* — but
the counts depend on quotienting by cyclic rotation, whole-sequence symmetry, and
the orbit. Get the definition pinned before the UI shows a total.

**#4 — Name the boxes.** See below; wholly unresolved.

**#5 — Build the missing motion-type classifier.** Nothing analyses a finished
sequence for dash/static content; `motionTypeFilter` exists only as a
generation-time steering bias. Needed to sort results by "has dashes." Small.

**#6 — Fix `transition-analyzer.ts:111`** (the dash prop-reversal bug). One line.
Consider whether `analyze_word_feasibility`'s prop output should be suppressed
until then, since it is confidently wrong.

**#7 — Extend the skewed dataframe** to cover skew→skew transitions, unlocking
45° orbit faces.

**#8 — The detection workstream** — separate handoff, unstarted.

## The naming question — open, and Austen's to answer

He asked directly: *"what labels do the boxes get and what labels do the
connections between the boxes get, what is the master box that holds all of these
boxes called?"* Nothing here is decided. What is known:

- **He rejected sister / cousin / complementary** for family members, and the
  reasoning stands: those words imply *different things that are related*. A and G
  are not different things. They are one motion at two separations. The existing
  correct word is **timing** (Split/Together/Quarter).
- **"Twin" is taken** by the pro/anti involution (A↔B, G↔H, S↔T) and must not be
  reused for the gap involution (A↔G, E↔K, Φ↔Ψ). **Two distinct involutions act on
  the same letter set.**
- Working terms used in this session's docs, all provisional: *family* for the 13
  groups, *gap* for the coordinate within one, *orbit* / *faces* for a sequence's
  rotations, *crossing* for a world-changing letter, *count bucket* for circle
  length, *fingerprint* for a pair's word total.

**The unexplored heart of the algebra:** the gap involution and the twin
involution generate a group together, and nobody has composed them. A→G (gap) and
A→B (twin) means A relates to H by the composite. That group, its order, and its
orbits are very likely the "master box" he is reaching for — and it is a
computation, not a naming debate. Do it before naming anything.

## Gotchas

- **`validate_loop_options` defaults `period` to `"halved"`.** Omit it and every
  quartered LOOP vanishes. This cost real time; do not repeat it.
- **`analyze_word_feasibility`'s prop-reversal output is wrong for any word with a
  dash.** Its hand-path output is fine. See Done §7.
- **`detect_loop_pattern` is non-deterministic** — three identical calls returned
  three different realizations. It builds one random variation walk from the word.
  Never use it to validate combinator output.
- **MCP sequence rendering is down.** `generate_pictograph` works; `generate_sequence`
  fails on the missing `canvas` package. Single pictographs only until the server
  is restarted.
- **The MCP server is a separate package** at `E:\tka-platform\mcp-server-pkg`
  running `dist/index.js`. Editing `src/` there does nothing until rebuilt and the
  server restarted.
- **Do not reimplement LOOP admissibility.** It was done in-session as a research
  instrument and it *does* agree with the app — but the shipping engine calls
  `isLOOPValidForPositionPair`.
- **Counting is fragile.** An early orbit-dedup bug reported 512 for A+G where the
  correct number is 256. Any count claim needs its equivalence relation stated
  alongside it.
- **Austen tests theories by generating.** His stated protocol: *"anytime you have
  a theory you can say let me try to generate a sequence which tests that
  theory."* Every claim in this document that says "verified" was checked that
  way. Keep doing it — three of this session's best findings came from a
  prediction that failed against a real generation.
