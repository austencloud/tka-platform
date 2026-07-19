# Poi Legal Matrix — Design (2026-07-19)

## Purpose

Answer "which VTG pattern combinations are poi-legal?" with Austen's eye as
the sole authority, aided by beautiful poi-style flower rendering. No
simulation, no tempo math, no slack modeling — that whole direction was
built, judged unusable, and reverted (`47402bab2c`). Ratified restart
framings (Austen, 2026-07-18/19):

- **Flowers first.** The VTG pattern matrix (the shared shape-matrix engine)
  is the base. Most patterns are poi-performable once momentum is present;
  the exceptions (e.g. isolations) are categorical, not tempo-dependent.
- **Legality is curated by eye**, cell by cell, with the flowers rendered in
  front of him. The curated set becomes the data a future composer poi
  filter reads. No structural rule pre-paints the matrix.
- **Approach A approved:** a poi layer beside (not inside) the in-flight
  `/notation/shape-matrix` destination, built on the same shared engine.

## Architecture

### 1. Poi trail cell renderer (new painter, existing geometry)

`src/lib/shared/shape-matrix/services/shape-matrix-poi-render.ts`

The engine already produces per-flower `MandalaPaths` from real TKA
sequences (`loadShapeMatrix` → `buildFlowerSequence` → mandala calculator),
and `shape-matrix-render.ts` paints them club-style. The poi mode adds a
second painter over the SAME paths — no new geometry, so cells stay
TKA-canon by construction:

- Light-painting look ported from the poi-notation clone's `draw.ts`
  technique (C:/poi-notation): layered translucent strokes under
  `globalCompositeOperation: "lighter"` for glow (NOT shadowBlur — ~100×
  cheaper, per that file's perf notes), spectral hue drift along the trail,
  black stage.
- Blue hand trails render in the cyan→blue band, red hand in the
  amber→magenta band, overlaid per cell (rows = blue flower, columns = red
  flower, same contract as `renderCell`).
- Exports `renderPoiCell(blue, red, sizePx, tipDx)` and
  `renderPoiHeader(paths, hand, sizePx, tipDx)` mirroring the existing
  render service's signatures, returning data URLs the grid already knows
  how to consume.

### 2. Legality curation store + data file

- **Data file (committed, the product of this feature):**
  `src/lib/features/levels/poi-lab/data/poi-legal-matrix.json`
  ```json
  { "version": 1, "verdicts": { "<blueFlowerKey>|<redFlowerKey>": "legal" } }
  ```
  Verdict values: `"legal" | "illegal" | "unsure"`. Missing key = unjudged.
  Keys use the engine's `flowerKey()` for both hands.
- **Store:** `src/lib/features/levels/poi-lab/services/poi-legal-verdicts.svelte.ts`
  — loads the JSON, holds live edits in `$state`, tracks dirty keys.
- **Persistence:** dev-only endpoint
  `src/routes/test/poi-matrix/save/+server.ts` (guarded `if (!dev) error(404)`)
  that writes the JSON file to disk, so a curation session lands judgments
  directly in the repo working tree for a normal scoped commit afterward.
  No Firestore, no localStorage as source of truth (localStorage only
  backs up unsaved edits against accidental tab loss).

### 3. Curation page

`src/routes/test/poi-matrix/+page.svelte`

- Renders the matrix via the shared engine (`loadShapeMatrix`,
  `matrixFiltersForSize`, existing filter surface) with the poi painter.
- Cell interaction: click cycles unjudged → legal → illegal → unsure →
  unjudged. Verdict shows as a border/badge tint (green / red / amber /
  none) that never changes cell box size (`no-layout-shift`).
- Header row/column render poi-style single-hand flowers.
- Toolbar: matrix size preset control (reuse the engine's presets +
  `SegmentedControl`), verdict filter chips (show all / unjudged only /
  illegal only — `FilterChipBase` toggles), progress readout
  ("N of M judged", `tabular-nums`), and a Save button that POSTs dirty
  verdicts to the dev endpoint and reports the write result.
- No checkboxes anywhere; all single-select groups are `SegmentedControl`.

## Data flow

shared engine (flowers + paths) → poi painter (data URLs) → grid cells →
click → verdict store ($state) → Save → dev endpoint → committed JSON →
(future, out of scope) composer poi filter consumes the JSON.

## Error handling

Earned, not defensive: the save endpoint returns the fs error message on
failure and the page surfaces it verbatim next to the Save button; the
store throws if the JSON file shape is unrecognized (schema version gate).

## Testing

- Unit: verdict store round-trip (load JSON → edit → serialize) and
  key construction from flower pairs (`flowerKey` composition).
- Unit: `renderPoiCell` smoke — returns a non-empty data URL for a real
  loaded flower pair (jsdom canvas permitting; if OffscreenCanvas is
  unavailable in the test env, gate the smoke test to browser mode per
  `component-testing.md` conventions rather than mocking canvas).
- The visual bar (do the trails look like the poi-notation page) is
  Austen's call on the live page — explicitly not automatable.

## Out of scope

- Wiring the composer poi filter to the JSON (next feature, after the
  matrix is substantially curated).
- Tempo/min-BPM/simulation of any kind.
- Touching `/notation/shape-matrix` or the other session's in-flight
  extraction (this page only imports the shared engine's public surface
  per its README).
- Realization drill / six-mode cards on this page.

## Reuse justification (never-hand-roll)

- Matrix, flowers, filters, grid component, cell pipeline: shared
  shape-matrix engine (`src/lib/shared/shape-matrix/README.md` public
  surface only).
- Trail aesthetic: ported technique from C:/poi-notation `draw.ts`
  (layered-lighter glow, spectral bands, dpr-capped canvas sizing) —
  technique port, not a dependency; that repo is a separate Vite app.
- Controls: `SegmentedControl`, `FilterChipBase` per `chip-primitives.md`.
- Nothing new is invented except the poi painter and the verdict store,
  both of which have no existing equivalent (grepped: no poi render mode,
  no legality persistence anywhere in the engine or poi-lab).
