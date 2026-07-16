# Half-Motion Notation Canon — Design

- **Date:** 2026-07-16
- **Status:** Design (brainstormed with Austen in-session; token + scope ratified, drawn mark pending visual A/B)
- **Author:** Austen + Claude
- **Scope:** Canonize how halved motions are written (typed token) and displayed (glyph mark). Feeds the future halved/skew domain dataframe (its schema needs this vocabulary) and the Phase 3 guide rewire (halved pictographs will carry glyphs).

---

## 1. The domain distinction this notation must preserve

Skew and halve can produce the identical hand geometry with different orientations, so they are different motion identities and get different marks:

- **Skew (`+`/`-`)** — path-length modifier. The hand stops short or overshoots; the base motion's orientation rules apply unchanged. Anti N→E in→out skewed- lands at NE **still out**.
- **Halve (`/`)** — motion fraction. The entire motion freezes at t=0.5 — hand AND rotation. The same anti motion halved lands at NE with a **nonradial** orientation (clock/counter), per `calculateOrientationAt` (proven by the Phase 1 suite: a halved 0-turn anti shift lands on clock/counter, not the endpoint's out — `orientation-at.test.ts:75-90`).
- **Hash (`#`)** — already canon: the official name for dash- (MCP `get_term_definition("hash")`). Hash and a *halved dash* share geometry (perimeter↔center) but differ in orientation rules — the skew-vs-halve distinction in miniature. **`#` is never reused for halving.**

## 2. Ratified decisions (2026-07-16)

| Decision | Canon | Rationale |
|---|---|---|
| Typed half token | **`/`** | One keystroke, the fraction mark, reads as a cut. No collisions: `+`/`-` = skew, `#` = hash, parens = tuple structure. |
| Fraction scope v1 | **Midpoint only** — `/` = frozen at t=0.5 | Quarters (t=0.25/0.75) and piece-selection (second half {0.5→1}) are deferred until a real consumer forces them. `//` (cut twice = quarter) is **reserved**, mirroring the skew `+`→`++` doubling precedent. |
| Placement | **Per-hand, in the turns column slot** — never wrapping the letter | Halving is a per-hand fact ("only the right hand halved" must be expressible). The turns column's high/low PADS slots are the canonical per-hand surface; turns and float already live there, and per-hand `+`/`-` for skew is the same canon convention. Wrappers (`[B]`, `{B}`) are structurally wrong for per-hand facts and are retired. |
| Naming | **Derived names: "half-B"** — letter + modifier, no new letter identities | Austen's own coinage. Identity = parent letter + fraction annotation. |
| Word/prose shorthand | **`B/`** when the modifier applies to the whole letter | Word strings never encoded per-hand detail (no turns in "BOOK" either); per-hand precision lives in beat data + glyph. |
| Typed ≠ drawn | The token is the *text* form (tuples, CSV, search); the glyph renders designed art | Float precedent: typed `fl`, drawn as `float.svg` cursive art. Keyboard-typability constrains only the text layer. |

## 3. Drawn mark — pending Austen's eye (the one open decision)

Two candidates, A/B'd on the test page `src/routes/test/half-notation/+page.svelte`
([localhost:5173/test/half-notation](http://localhost:5173/test/half-notation)):

1. **Cut through the number** (Austen's lean, if feasible) — a diagonal stroke over the
   turn number art. Feasibility concern (varying number widths 30–83.67) is resolved:
   the mark is a *programmatic* stroke sized from `getTurnNumberWidth`, not per-number
   assets. Zero new assets.
2. **Standalone mark beside the number** — one designed cut-stroke asset next to the
   number, float-style. One new asset + width-table entry.

Whichever wins, skew's `+`/`-` drawn marks should be designed in the same pass (neither
exists as an asset today — the web renderer currently has zero modifier notation).

## 4. Data-layer representation

- **Beat data:** already canonical — `MotionData.segment: {t0, t1}` (shipped Phase 2a). `/` ⇔ `{t0: 0, t1: 0.5}`. The token is a *display/serialization* of segment, not a second source of truth.
- **Tuple grammar:** the modifier composes with the turn value in the hand's slot: `(s, 1.5/, 2)`. Parser change in `turn-tuple-parser.ts` (`parseTurnValue` learns the `/` suffix), plus `getTurnNumberWidth` and `TurnsColumn.svelte`.
- **Future dataframe columns:** per-hand fraction column stores the token (`/` for v1), aligned with the typed vocabulary. Orientations and halvability legality are NEVER columns — they stay derived (`calculateOrientationAt`; legality = half-integer turns on-lattice). One rule set.

## 5. Explicitly deferred

- Quarter freezes (t=0.25 / 0.75) and second-half segments — notation reserved (`//`), semantics decided when the guide rewire or Phase 4 UX needs them.
- Skew mark rendering (`+`/`-` in the turns column) — same implementation pattern, own pass.
- The halved/skew domain dataframe generator (cats 3/4 closure + halved enumeration) — separate spec; consumes this vocabulary.

## 6. Implementation surface (small, contained)

| Touch | File |
|---|---|
| Tuple parse (`1.5/`) | `src/lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser.ts` |
| Width table | same file, `getTurnNumberWidth` |
| Render mark | `src/lib/shared/pictograph/tka-glyph/components/TurnsColumn.svelte` |
| Tuple emit | `src/lib/shared/pictograph/arrow/positioning/placement/services/turns-tuple-generator.ts` (segment-aware) |
| Asset (option 2 only) | `static/images/numbers/` |

## 7. Ledger

- [x] Token `/`, midpoint-only scope, per-hand placement, derived naming — ratified 2026-07-16
- [ ] Drawn mark A/B on `/test/half-notation` — Austen picks
- [ ] Implement parser + TurnsColumn rendering per the pick
- [ ] Turns-tuple generator emits `/` for segment motions
- [ ] Skew `+`/`-` marks (follow-up pass, same pattern)
