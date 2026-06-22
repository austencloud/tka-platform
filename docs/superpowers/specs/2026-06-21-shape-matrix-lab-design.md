# Shape Matrix Lab — Design

**Date:** 2026-06-21
**Status:** Design (awaiting review)
**Origin:** Evolution of the Mandala Rosetta test page (`/test/vtg-base-rotation`). We drop the path-shape axis (linear/concave) and the effort axis, and rebuild around a single idea: **flower-on-flower combination**.

## What this is

A reconstruction of **Lorq Nichols' Shape Matrix** — a multiplication table cross-referencing left-hand and right-hand flower patterns — built on TKA's own rendering engine.

Grounded in the Flow Arts Knowledge MCP (`vtg-deep` topic): Lorq's Shape Matrix is *"a multiplication table cross-referencing left-hand and right-hand flower patterns,"* conceptually adjacent to TKA's per-beat encoding. He also defined the 9 Flower Families and 144 Atomic Hybrids. Austen took his class in 2017. This lab makes that matrix interactive and renders every cell from the live engine.

VTG is **ground-referenced to the downbeat (south)**, so every flower in this lab is south-anchored. `tog` = both props cross the downbeat together; `split` = 180° out of phase. These are temporal and do not appear in a static cell (see below).

## The two levels

### 1. The Matrix (top level) — a times-table

- **Left edge (rows):** a column of single-hand flowers — the **blue hand's** options.
- **Top edge (columns):** the same list of single-hand flowers — the **red hand's** options.
- **Each interior cell** at (blueᵢ, redⱼ): the two flowers **overlaid** as a single static tip-path mandala.

Every cell is live. The two hands are independent, so **every blue-flower × red-flower pairing is a realizable two-hand pattern** — there are no impossible combos and no gap cells. (Confirmed by Austen; consistent with the independence of the two hands in the motion space.) The matrix is therefore **synthesized**, not filtered from the named-letter catalog: a catalog filter would show false gaps wherever no letter happens to be named, but the *pattern* still exists.

### 2. The Drill-down (cell click) — modal overlay

Clicking a cell opens a **focused modal** (over a dimmed matrix) using the canonical `BaseModal` (`lib/shared/foundation/ui/modal/BaseModal.svelte` + `ModalHeader`/`ModalFooter`). The modal shows every concrete way to realize that shape pairing. Each realization is shown as:

- a **2D animation** of the two-hand sequence, and
- a **card titled with its TKA letter** (A, B, C…) where a named letter maps to that pattern.

This is where the temporal VTG categories live: **SS / TS / SO / TO** (+ community QS/QO) and the specific letters all surface here, because they are distinguished by **timing (tog/split)** and **arc direction (same/opp)** — neither of which is visible in the static cell.

## Why the cell is static and what it can/can't show

A static mandala is the tip-path **locus over a full cycle**. The locus is **phase- and direction-independent**: both hands trace the same set of points regardless of *when* (timing) or *which way* (direction) they travel.

- **Visible in a cell:** each hand's flower **shape** (prop-spin style × turns) and each hand's **start orientation** — including the up/down odd-petal distinction. Orientation rotates where the petals sit in space (in↔out = 180°), so for **odd petal counts it produces a genuinely distinct flower**; for even petal counts it maps onto itself.
- **Not visible in a cell:** **tog/split** and **same/opp**. These are temporal and belong to the drill-down.

Petal math from the existing page: `prospin petals = 2·turns`, `antispin petals = 2·turns + 2`. So the 0.5t antispin "triquetra" = 3 petals (odd → up/down distinct); even-petal flowers collapse under the orientation flip.

## The flower axis (what populates rows/columns)

Each single-hand flower is defined by:

| Dimension | Values |
|---|---|
| Prop-spin style | `prospin` (iso), `antispin` |
| Turns | 0, 0.5, 1, 1.5, 2, 2.5, 3 |
| Start orientation | `in`, `out` (south-anchored) |

Pure prospin/antispin only — **hybrids are not base flowers**; they emerge from pairings (matches Lorq's "Atomic Hybrids" being derived).

**All in/out variants are shown — no de-dup.** Even-petal flowers render identically for `in` and `out` (no 180° distinction), but both stay in the grid for completeness and a regular axis. Full axis length = 2 × 7 × 2 = **28 flowers per hand** → a **28 × 28 = 784-cell** matrix. We can trim later (hide the redundant even-petal duplicates) if the grid is too dense.

## Engine approach (implementation, owned by me)

Cells are **synthesized from two independent single-hand flowers**, not pulled from a catalog member — a catalog seed carries a fixed (blue-style, red-style) pair and cannot cover the independent per-hand style/turns the 28×28 grid needs. The existing `resolveRotationStyleMatrices` (group-by-style) supplies only the two **archetype seeds** (pure-pro, pure-anti).

1. **Flower signature.** A per-hand flower key `{ style: "pro"|"anti", turns, orientation: "in"|"out", petals }`, with `petals = style==="pro" ? 2·turns : 2·turns + 2`. New `flower-signature.ts`; reuse the `spin()` pro/anti resolution from `classify-rotation-style.ts`.
2. **Single-hand flower sequence.** For a flower `{style, turns, ori}` on the **blue** axis: take the style's archetype, `applyVariationDescriptor(archetype, { turnPattern: "<t>|<t>", gridMode:"diamond", startOriPair:{ blue: ori } }, edges)` on the **full two-hand** sequence (the proven rosetta order — its per-hand turn/closure logic expects both hands), THEN strip to the blue hand via `prepareMandalaClubSequence(seq, { show:"blue", pathShape:"arc" })`. Symmetric for the **red** axis (`startOriPair:{ red: ori }`, `show:"red"`). South-anchored by the archetype.
3. **Flower → MandalaPaths (cached).** `calculate(flowerSeq.steps, undefined, undefined, { tipEnds: 1, pathShape:"arc" }, { dx: clubTipDx, dy: 0 })` (`mandala-geometry-calculator.ts`) → `MandalaPaths`. The blue-axis flower populates `.blue`; the red-axis flower populates `.red`. Cache 28 blue + 28 red path sets by flower key.
4. **Cell render (static).** Merge `{ blue: leftFlowerPaths.blue, red: topFlowerPaths.red, purple: [] }` and call `renderMandalaToCanvas(ctx, merged, { size, style:"stroke", show:"both", tipDx: clubTipDx, palette: DARK, offsetX:0, offsetY:0, glow })` (`mandala-renderer.ts`). One call → blue⊕red overlay (+ purple intersection). Headers render a single flower (`show:"blue"`/`"red"`).
5. **Drill-down realizations (modal).** Open `BaseModal`. Enumerate diamond edges (`loadDiamondEdges`) whose `(blueMotionType, redMotionType) === (blueFlower.style, redFlower.style)`; each distinct `letter` is a realization. Build that letter's two-hand sequence from the edge, apply the cell's `turnPattern` + `startOriPair` via `applyVariationDescriptor`, render motion with `AnimationPlayer` (`lib/shared/sequence-viewer/components/AnimationPlayer.svelte`, `{ sequence, autoPlay:true, controlsLevel:"minimal" }`) and the title with `TKAWordGlyph` (`{ word: letter }`). The SS/TS/SO/TO badge reads each edge's `timing`/`direction` fields.

### Reuse (per never-hand-roll — verified present)

- `lib/shared/mandala/services/mandala-renderer.ts`, `mandala-geometry-calculator.ts` — tip-path → mandala.
- `lib/features/lab/vtg-lab/services/prepare-mandala-club-sequence.ts` — single-hand stripping for both axis flowers and headers.
- `lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices.ts` (archetype seeds), `domain/classify-rotation-style.ts` (`spin()`), `applyVariationDescriptor` — turn/orientation application + style classification.
- `lib/features/lab/vtg-lab/services/render-mandala-overlay-layer.ts` — existing club-tip + path-options helper to mirror (`getTipPoints("club")`, `pathOptionsFor`).
- `lib/shared/choreo-card/components/TKAWordGlyph.svelte` — drill-down letter titles.
- `lib/shared/sequence-viewer/components/AnimationPlayer.svelte` — 2D drill-down animation (`{ sequence, autoPlay, controlsLevel:"minimal" }`).
- `lib/shared/foundation/ui/modal/BaseModal.svelte` (+ `ModalHeader`/`ModalFooter`) — the drill-down modal overlay.
- `SegmentedControl` / `FilterChipBase` — any control bars (grid mode, etc.), per chip-primitives rule.

## Where it lives

New test page `src/routes/test/shape-matrix/+page.svelte`, real Svelte components in HMR (per visualization-routing — test page is the default for restyling/rearranging existing primitives). Services under `lib/features/lab/vtg-lab/`. No new module; no deck/print wiring.

## Scope (v1) and YAGNI

**In:**
- Diamond grid.
- Flower axis = {prospin, antispin} × 7 turns × {in, out}, south-anchored — all 28 shown, no de-dup (28 × 28 = 784 cells).
- Static overlay mandala per cell, synthesized.
- Drill-down: 2D animation + letter card per realization.

**Out (later, not v1):**
- Box grid.
- L6+ quarter-turn interradial orientations; the 4-cardinal start-point axis (south-anchored only for now).
- Baked MP4 cells (cells are static; drill-down animation is live, on demand — no N×N bake).
- Deck/print/elemental-theming integration.
- Lorq's named 9 Flower Families / 144 Atomic Hybrids labeling overlay (no canonical list in MCP; revisit if a source is found).

## Open implementation decisions (for the plan phase)

1. Per-hand flower-signature key shape and where it lives (extend `classify-rotation-style.ts` vs new `flower-signature.ts`).
2. Cell synthesis: direct per-hand `MotionData` construction vs catalog-seed composition.
3. Drill-down realization enumeration: how the timing/direction variants are generated and reverse-mapped to letters.
4. Matrix axis ordering (by style, then turns, then orientation).
5. Performance: 784 static-mandala cells — render-on-scroll / virtualization is likely required, plus a per-flower-signature render cache (even-petal in/out duplicates share an image).
