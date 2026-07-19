# /notation/loops — The LOOP Algebra Destination

**Date:** 2026-07-19
**Status:** Approved (brainstormed with Austen, full-send authorized)
**Route:** `/notation/loops` (sibling of `/notation/shape-matrix`)

## Problem

The LOOP algebra is the juiciest, most novel piece of the TKA system — six transformation
components, compositional `+`/`/` notation, a fixed-point theorem, composability matrices,
a two-period length model — and it has **zero user-facing explanation as a system**. Every
surface teaches fragments (generate overlay chips, gallery drill descriptions, card-back
icon strips, shop "Flavor" reframing) but nothing presents the algebra itself. The deepest
in-app teaching (`/guide/level-1` LOOP pages) predates compositional theory entirely
(CAP-era Type 1/Type 2 framing).

## Audiences — one page, four depths

Serve all four via **descent**: scroll = difficulty curve, each audience exits satisfied at
a different floor. No audience segmentation, no mush.

1. **Flow artists outside TKA** — hero + explorer top. Zero prerequisites.
2. **Existing TKA users** — explorer middle: recognize the chips they already use, finally
   see the system behind them.
3. **Nerds (HN/math-curious tier)** — theorem floor: fixed points, forced nesting order,
   composability matrices, two-period model.
4. **Deck buyers** — card-back literacy section + shop CTA woven in, not appended.

## IA & Placement

- New destination `src/routes/(public)/notation/loops/+page.svelte` following the
  shape-matrix pattern exactly: self-contained page, own `Seo` component + JSON-LD, no
  shared layout dependency, `public-editorial.css`.
- Teaser card on the `/notation` hub (alongside the existing `ShapeMatrixTeaser`).
- **Two new launchpad bento tiles** in `launchpad-tiles.ts`: **LOOPs** (with a small
  looping media embed — tiles support media) and **Shape Matrix** (live today but absent
  from tiles/nav — rides along in this work).
- Both destinations added to the `NAV` const in `SiteHeader.svelte` (Notation group) and to
  `sitemap.xml/+server.ts`.

## Page Structure (top to bottom)

### 1. Hero — the hook
Full-bleed LOOP sequence animating on repeat (real renderer, never mockups). One claim:
every pattern here returns to where it started, and there are exactly six ways to do it.
Zero-prerequisite copy, fire-jam-test voice.

### 2. The Explorer — the core instrument
The page's centerpiece. Details below.

### 3. The Theorem — the deep floor
Typeset prose + tables + real-pictograph mini-diagrams (v1 static; interactive fixed-point
visualizer is a later phase). Content, grounded in MCP `get_domain_topic("loop")`:
- Compositional notation: `/` simultaneous, `+` sequential; order matters
  (`SWAP + MIRROR/INV` ≠ `MIRROR/INV + SWAP`).
- The fixed-point theorem: an outer transform's starting position must be its fixed point.
- Computed fixed-point table (MIRROR: alpha1/alpha5/beta1/beta5; FLIP: alpha3/alpha7/
  beta3/beta7; SWAP: all beta; ROTATE: none at L1–L4; INVERTED: all).
- Why rotation is always innermost — mathematical constraint, not design choice.
- Beta as the universal connector.
- The two-period model: realized length = seed × LCM(position period, orientation period);
  why one LOOP type renders at two lengths.
- Honest novelty claim: known symmetry operations, applied to a movement space nobody
  formalized; the orientation-period structure has no prior art we know of. No superlatives.

### 3.5 Lineage — CAPs (credit where due)

Short section between theorem and deck. Grounded in MCP `get_term_definition("CAP")`:
CAPs (Continuous Assembly Patterns) come from the poi community — coined by Damien
(Zaltymbunk) on the Home of Poi forums, promoted by Alien Jon, popularized by Nick
Woolsey/PlayPoi, documented by DrexFactor, extended by Charlie Cushing (8-step CAP,
9-Square Theory). **CAPs and LOOPs are parallel concepts, not parent/child**: CAPs compose
per-hand trajectories (overlay left path + right path); LOOPs compose per-beat snapshots
(one letter = both hands). This page credits the lineage honestly and links to the
dedicated CAP destination (separate spec — see Non-Goals).

### 4. The Deck — product woven in
"The icon strip on every card back? Now you can read it." Physical card imagery, card-back
icon strip decoded inline, CTA → `/shop/loop-deck`.

### 5. Build your own
CTA → composer (`/composer` funnel or app entry — match existing public-page CTA pattern).

## Explorer Mechanics

**Header — component picker.** Six color-coded chips (Rotated, Mirrored, Flipped, Swapped,
Inverted, Rewound), multi-select, built on `FilterChipBase` `mode="toggle"` per
chip-primitives rule. Colors/descriptions from `LOOP_COMPONENT_MAP` (gallery drill
precedent). Legality live from `IMPLEMENTED_COMBOS` (`loop-type-utils.ts`): illegal
selections disable with a why-tooltip (FLIPPED and REWOUND compose with nothing; the
{ROTATED, MIRRORED, SWAPPED, INVERTED} family composes freely — 16 combos). For
rotation-containing selections, a halved/quartered (180°/90°) slice control appears —
quartered is gated to rotated types (`ROTATED_LOOP_TYPES`), matching `resolveLoopConfig`.

**Showcase — the example.** One generated sequence rendered as a step grid using
`.tka-seq-cell` primitives and the shared pictograph renderer. 16-count in a 4×4 grid is
the default aspiration (quartered rotated needs 16 to shine); when the selected type's
multiplier yields 8, render 8-count (4×2). Word display goes through
`simplifyRepeatedWord` (simplified-word-display rule). Refresh button generates a new
example.

**Self-verifying generation (trust model — decided).**
1. Generate via the canonical config path — `resolveLoopConfig()` is the single source of
   truth; never hand-build loop `GenerationOptions`.
2. Run the canonical detector (`src/lib/shared/create/services/loop-detector.ts`, which
   delegates to `@tka/sequence-engine`).
3. Show the sequence only if detected components exactly match the selection.
4. On mismatch, silently regenerate; after N failures (N=3), fall back to a curated,
   pre-verified seed pool shipped as static data.

**Two-pane linked explanation.** Beside (desktop) / below (mobile) the grid: prose
explaining WHY the sequence is what it is, with concrete relation citations
("beat 9 = beat 1 rotated 180°"). Source of truth: the engine detector's pair-relation
output — (beatA, beatB, transform) tuples. Hovering/clicking a relation sentence highlights
its beat pair in the grid, and clicking a beat highlights its relations in the prose —
bidirectional. Prose generation extends `loop-explanation-text-generator.ts` and the
card-back `loop-explainer.ts` rather than starting fresh.

**Terminology guard.** Rotation slices are "180°"/"90°"/"halved"/"quartered" — never
"turns" (reserved for prop/body turns, `tka-domain.md`).

## Verification Harness (ship gate)

Offline script (`scripts/` + report): for every implemented combo × both slices where
legal, mass-generate sequences, then:
- Cross-check app-side detection vs engine detection vs Flow Arts MCP
  `detect_loop_pattern` (three independent implementations — agreement is the signal).
- Diff generated explanation claims against detected pair relations.
- Emit an accuracy report; page ships only when the shipped path (generator + detector +
  explainer) is clean. Doubles as a generator-bug detector (the 40/54 deck mislabel class,
  the `mirrored_rotated_swapped` halved end-position crash — both get surfaced here, and
  the curated fallback pool covers any combo that can't pass yet).

## Mobile

Single column: sticky chip header → grid → explanation stack. Tap-to-highlight replaces
hover. Standard 768 breakpoint; no new breakpoints. No layout shift: grid box reserves its
aspect before load; chip header height fixed.

## Reuse Inventory (never-hand-roll)

| Need | Reusing |
|---|---|
| Component chips | `FilterChipBase` (`mode="toggle"`), `LOOP_COMPONENT_MAP` |
| Legality gating | `IMPLEMENTED_COMBOS`, `generateLOOPType` (`loop-type-utils.ts`) |
| Generation | canonical circular generation path via `resolveLoopConfig` / `config-mapper.ts` |
| Detection | `shared/create/services/loop-detector.ts` → `@tka/sequence-engine` |
| Explanation prose | `loop-explanation-text-generator.ts`, `choreo-card/services/loop-explainer.ts` |
| Step grid | `.tka-seq-cell` selection primitive + shared pictograph renderer |
| Crossfades on selection change | `Crossfade` primitive (`fill` mode inside the sized showcase stage) |
| Word display | `simplifyRepeatedWord` |
| Page shell | shape-matrix destination page pattern, `Seo`, `public-editorial.css` |

New code lives in `src/lib/shared/loop-explorer/` (mirrors `src/lib/shared/shape-matrix/`
placement — consumed by a public route, not an app feature module).

## Non-Goals (v1)

- Interactive fixed-point visualizer (later phase; theorem floor is typeset v1).
- Orientation-domain reserved primitives (ZONE_HOLD_INVERT / ZONE_HOLD_FLIP / ZONE_CROSS)
  in the picker — engine-internal, stays hidden per `generate-models.ts`.
- Quartered slices for non-rotated combos (unsupported in the engine; gated).
- Guide content migration — `/guide/level-1` LOOP pages stay as-is; this page links to
  them, doesn't replace them.
- Thorough CAP treatment — own spec entirely (Austen, 2026-07-19). This page carries only
  the lineage section (3.5) and a link; the CAP destination (likely `/notation/caps`) gets
  its own brainstorm + spec.
- Composer-embedded explorer — this is the public destination only.

## Phases

- **P0 — Front doors:** shape-matrix launchpad tile + NAV entry (independent, ships alone).
- **P1 — Explorer core:** `src/lib/shared/loop-explorer/` module — picker, showcase grid,
  self-verifying generation, two-pane linked explanation.
- **P2 — Page assembly:** hero, theorem floor, deck section, CTAs, Seo/JSON-LD, `/notation`
  teaser, LOOPs launchpad tile + NAV + sitemap.
- **P3 — Harness:** offline verification script + accuracy report; curate fallback seeds
  from its verified output.

P3's curated output feeds P1's fallback pool; a stub pool (hand-verified handful) unblocks
P1 until then.
