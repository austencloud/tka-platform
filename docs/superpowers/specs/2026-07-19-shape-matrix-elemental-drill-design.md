# Shape Matrix Elemental Drill — Design Spec

> Status: Design approved by Austen (2026-07-19, in-session brainstorm).
> Supersedes the Phase 2 card-thumbnail drill on the PUBLIC route only; the lab
> drill modal keeps its card/QA presentation.
> Execution: hand this spec + the companion plan to a fresh agent at effort
> xhigh (Austen's routing call, 2026-07-19).

## Problem

The `/notation/shape-matrix` drill panel currently shows six baked choreo-card
thumbnails (deck QA artifacts: card frames, parity badges) and a two-screen
crossfade to `InlineAnimationPlayer`. Three failures:

1. **No trails.** The player feeds the engine the VISITOR'S global
   `animationSettings.trail`; nothing forces the trails effect, so the public
   payoff lacks the look the lab bake harness produces
   (`bake-mandala-clips.ts` forces `setActiveEffect("trails")`, dark mode,
   chrome off, `seamlessTrailLoop`).
2. **No mandala over the animation.** The mandala-over-animation drawing
   (`buildMandalaOverlayDraw`, opacity 0.55, engine-alignment math) exists only
   in the MP4 bake path. The live canvas never shows the shape being traced.
3. **The six thumbnails are informationally empty.** All six realizations trace
   the SAME shape — six near-identical pictures. The differing dimension is
   timing-and-direction, which the 6-element model encodes. The PNG card bakes
   are also ~all of the drill's ~14s cold cost.

## Approved decisions (Austen, 2026-07-19)

| Fork | Decision |
|---|---|
| First beat on cell click | Static mandala, no auto-play. Motion starts only when an element is picked. |
| Picker layout | One row of six compact chips (icon + VTG code + element name). |
| Selection persistence | Element stays sticky across cell changes; deselecting the active chip returns to the static mandala. |
| Choreo-card explanation | Skipped entirely on the public page. No card fronts, no parity badges. |

## Panel anatomy (one stable screen, no sub-navigation)

```
REALIZATIONS                        six per cell
[🜄 SS Water][🜃 TS Earth][☀ QS Sun][🜂 SO Fire][🜁 TO Air][☽ QO Moon]
┌──────────────────────────────┐
│         HERO STAGE           │  ← mandala layer + animation layer
└──────────────────────────────┘
 Fire · Split-Opp · JD             ← caption, one line, space always reserved
```

- **No cell selected:** chips render dimmed/disabled; hero shows the
  "Pick a cell" hint. Panel structure is constant from load (replaces the
  ghost-card empty state; no layout shift on first selection).
- **Cell selected, no element:** hero renders that cell's mandala big and
  still, full opacity. Instant — `MandalaPaths` are already in memory from the
  grid build (`ShapeMatrixData.blue/red` maps).
- **Element picked:** mandala dims to a ghost (opacity ~0.55, the bake's proven
  value) and the props draw the shape over it with trails forced on, chrome
  minimal, dark mode. Both hands render (clubs), not the single-club rosetta
  prep.
- **Active chip clicked again:** deselect → back to the still mandala.
- **New cell clicked with an element active:** new shape animates immediately
  in the sticky element.
- **"Back to the six" button and the two-screen crossfade are removed.** Chips
  and hero coexist on one screen.

## The six elements (grounded via MCP `get_domain_topic("elemental-model")`, 2026-07-19)

Mapping mode → TnD family → element, all data already in
`src/lib/features/choreo-card/domain/tnd-element.ts` (`TND_ELEMENTS`,
`TND_BY_FAMILY`: accentColor, darkComplement, iconPath PNGs under
`/images/elements/`):

| VTG | Family | Element | Accent |
|---|---|---|---|
| SS | split-same | Water | #3568a0 |
| TS | tog-same | Earth | #75A874 |
| QS | quarter-same | Sun | #ffde17 |
| SO | split-opp | Fire | #f2673a |
| TO | tog-opp | Air | #bce4f7 |
| QO | quarter-opp | Moon | #6a4199 |

**Diamond-grid caveat (canon):** same-direction elements (Water/Earth/Sun) are
grid-mode invariant; opposite-direction elements permute in box mode (Air/Fire
↔ Moon). This matrix is diamond-grid, so the static mapping above is valid
HERE. The mapping must carry a code comment saying it is diamond-specific.

Chip order = `MODE_ORDER` (SS TS QS SO TO QO): same-direction trio then
opposite-direction trio.

## Architecture

### New lean realization builder (public path)

`buildModeRealizations(pair, overlay)` in
`src/lib/shared/shape-matrix/services/` — per mode: `resolveBase` →
`verifyAndCorrect` → `{ mode, modeLabel, word, element (TnDElement), seq }`.

- NO `bakeVariationFront/Back` → no PNG baking → drill build becomes
  effectively instant, and this path sheds the `resolve-rotation-style-matrices`
  lab import. `buildModeCards` remains for the lab modal.
- Build all six eagerly on cell select (cheap without bakes) so element
  switching is instant. Parity auto-correction still runs; the parity VERDICT
  is not displayed (QA detail).
- The mode→family map (`FAMILY_BY_MODE`) moves/copies into this builder with
  the diamond-only comment.

### Hero stage: two stacked layers, one square box

1. **Mandala layer** — a static canvas rendering the cell's `MandalaPaths` via
   `renderMandalaToCanvas`, using the engine-alignment math from
   `render-mandala-overlay-layer.ts` (`alignScale`: mandala grid radius →
   engine hand orbit, 150/950 viewbox — proven by the bake path). Extract the
   alignment/scale math into the shared module (e.g.
   `services/mandala-hero-layer.ts`); the lab bake keeps working (import from
   new home or keep its local copy — executor's call, no behavior change).
   Full opacity when no element; CSS-transitions to ~0.55 when animating.
2. **Animation layer** — `InlineAnimationPlayer` (LazyMount, per-instance
   playback stack) with `chrome: minimal`, `fill`, autoplay, clubs both hands,
   and a NEW explicit trail/effects override prop (see below). Crossfade
   between element switches via the existing `Crossfade` primitive (`fill`
   mode) or a plain mount fade if the player already handles source swaps
   without remount — executor verifies which; no layout shift either way.

The two canvases share the same square box so coordinates correspond (the bake
proves the mapping; the alignment math is the contract).

### InlineAnimationPlayer trail forcing (no extension needed — verified 2026-07-19)

`InlineAnimationPlayer` already has `trailSettingsOverride?: TrailSettings |
null`, added for the homepage hero specifically so a vivid preset never leaks
into the global `animationSettings.trail` singleton. It flows straight into
`AnimatorCanvas` (`trailSettings={trailSettingsOverride ?? animationSettings.trail}`).
The drill passes `HERO_TRAIL_PRESET`
(`src/lib/shared/landing/data/hero-trail-preset.ts` — FADE mode, GLOW effect,
tuned for "clearly visible trail at small canvas size"), reusing the proven
preset rather than defining a new one. Chrome minimal + `fill` +
`beatIndicators: false` cover the chrome; do NOT touch the global visibility
manager (that is the bake harness's offscreen trick and it leaks in-app).

### ElementChip (bespoke, justified)

Bespoke `ElementChip.svelte` in `src/lib/shared/shape-matrix/components/`.
Not `SegmentedControl` (cannot represent the none-selected state; deselect on
re-click is required). Not `FilterChipBase` (cannot do the stacked
icon + code + name elemental treatment with per-option accent colors). This is
the chip rule's explicit carve-out (per-option colors + icons + bespoke
layout); cite `chip-primitives.md` in the component comment.

- Chip: element icon PNG (~28px), VTG code, element name, accent-colored
  border/tint from `TnDElement`; active = filled tint + strong border;
  disabled (no cell) = dimmed, non-interactive. 44px+ touch target,
  `aria-pressed`, real `<button>`s.
- Desktop: one row of six (grid `repeat(6, 1fr)`). Below ~480px: two rows of
  three.

### Caption

One always-reserved line under the hero:
`{Element} · {VTG term} · {simplifyRepeatedWord(word)}` — e.g.
"Water · Split-Same · A". Fixed line height so selection changes never shift
layout (`no-layout-shift.md`). Word goes through the simplifier
(`simplified-word-display.md`).

## What is removed

- Six card thumbnails, card fronts/backs, parity badges (public path only).
- "Back to the six" control and the two-screen picker→hero crossfade.
- The ghost-card empty state (replaced by the disabled-chips + hint structure).

## Optional (Austen strikes or keeps at review)

One credit line for the elemental lenses in the `/notation` lineage band:
Leonardo Icaza's four-element mapping, Ronan McLoughlin's teaching video,
Austen's Sun/Moon extension. Grounded via MCP; keep to a single sentence, no
em dashes, fire-jam test.

## Verification (per-phase, no full check/build — Austen's standing directive)

- Targeted vitest: `tests/unit/shape-matrix-engine-contract.test.ts` stays
  green; tighten its lab-import allowlist if the drill path sheds the bake
  import.
- Grep proofs: no `type="checkbox"`, no em dash (U+2014) in user-visible text,
  no "half/quarter turn" phrasing, `\.word` hits routed through the simplifier.
- Browser evidence (read-only unless Austen grants control): mandala renders on
  cell click; element pick animates with visible trails AND ghosted mandala;
  chip deselect returns to static; sticky element carries across cells; no
  layout shift chip↔hero↔caption. Screenshot at ~1920 CSS width.
- One full `npm run check` only at the very end of the whole effort, in the
  main loop.

## Related

- Rules: `never-hand-roll.md`, `chip-primitives.md` (carve-out),
  `crossfade-primitive.md`, `no-layout-shift.md`, `simplified-word-display.md`,
  `mcp-ground-truth.md`, `commit-only-your-own-changes.md`, `fable-routing.md`.
- Prior spec: `2026-07-18-notation-shape-matrix-destination-design.md` (the
  destination + first drill; Phases 0–4 shipped, aesthetic pass d07f3628d9).
- Key files: `ShapeMatrixDrill.svelte` (rework in place),
  `build-realization-cards.ts` (stays, lab), `shape-matrix-realizations.ts`
  (MODE_ORDER/MODE_LABEL), `tnd-element.ts`, `render-mandala-overlay-layer.ts`
  (alignment math source), `bake-mandala-clips.ts` (target look reference),
  `InlineAnimationPlayer.svelte` (extend), `mandala-renderer.ts`.
