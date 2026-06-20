# VTG Lab Explorer — Rotation-Style Reframe

Date: 2026-06-16
Status: Design — awaiting user review
Supersedes the family-organized gallery (`2026-06-16-vtg-lab-choreocard-rebuild-design.md`) for the Explorer tab.

## The Insight

The mandala (tip-path fingerprint) is determined by **prop rotation style × turns**, not by VTG mode.

Mechanism (verified in `mandala-geometry-calculator.ts`):
- PRO: `staffDelta = +centerMovement + turns·π`
- ANTI: `staffDelta = −centerMovement + turns·π`

`centerMovement` is the hand's arc between grid positions. The VTG **mode**
(split/tog/quarter × same/opp) only selects *which* grid positions → it **rotates**
the rosette in space, which the centered mandala normalizes away. The petal/shape is
set by the prop spin sign (pro vs anti) and the turn count.

`tnd-deriver.ts` confirms the orthogonality: TnD direction is the hand orbital arc
(the mode), explicitly NOT the prop `rotationDirection`. "A/B/C share the same hand
paths and are all split-same despite different prop rotations." So:

- **Rotation style** = prop spin: ISO (pro/pro), ANTISPIN (anti/anti), HYBRID (one of each). This drives the mandala.
- **VTG mode** = hand arc / position. Cosmetic to the centered mandala.

Organizing the Explorer by mode shows six relabeled copies of the same fingerprint
set. Organizing by rotation style shows what actually varies.

## Model

The Explorer tab becomes **three matrices in a row** (replacing the 6 mode chips and
the per-family gallery):

| Panel | Rotation style | Prop spin | Example variations |
|---|---|---|---|
| ISO | pro / pro | both inspin | A, G, DJ, MP, S, T |
| ANTISPIN | anti / anti | both antispin | B, H, EK, NQ, U, V |
| HYBRID | one pro, one anti | mixed | C, F, I, L, OR |

Each panel is the same **7×7 blue×red turn grid**; each cell shows that style's
canonical mandala for that turn combination. The cell mandala is rendered from any
one representative sequence of the style (they coincide; even if two variations
aren't pixel-identical, the cell is a thumbnail and the card is exact).

## Drill-down

Click a cell → the (style, blue, red) is fixed. A **variation picker** lists that
style's letters, each tagged with its VTG mode (A = split-same, G = tog-same, …) so
the mode framing survives where it matters. Click a letter → resolve that word's
sequence with the cell's turn pattern → `CardInspectModal` (full card front+back,
QR + mandala). Hybrid's blue↔red color-swap is one of the listed variations, not a
separate column.

## Data

- **`classifyRotationStyle(seq: SequenceData): "iso" | "antispin" | "hybrid"`** — read
  the rotating-shift steps' `motions[BLUE].motionType` / `motions[RED].motionType`
  (`pro` / `anti`). Both pro → iso; both anti → antispin; mixed → hybrid. Pure,
  unit-testable. (Mirrors how `deck-composer.classifyTnDSeedForGrid` derives the
  family, but reads prop spin instead of hand arc.)
- **`resolveRotationStyleMatrices(): Promise<RotationStyleMatrix[]>`** — load the base
  catalog once (`loadCatalogSequences(TND_BASE_CATALOG_ID)`), classify each seed by
  rotation style + derive its VTG mode (`deriveTnDFromPictograph`) + seed word
  (`split("-").pop()`), group into the 3 styles. Per style: a representative seed
  (for the 7×7 cell mandalas, resolved via the existing
  `buildTnDCards`-style turn application + `resolveDeckSequences`) and a deduped
  `variations: { word, modeTag, seedId }[]` list for the picker.
  `RotationStyleMatrix = { style, label, accent, byTurn: Map<turnPattern, SequenceData>, variations: Variation[] }`.

The turn-pattern enumeration + resolve pipeline reuse the existing
`allTurnPatterns()` / `resolveDeckSequences` / `loadDiamondEdges` (same as
`resolve-tnd-family-cards.ts`).

## Components

### New
- **`RotationStyleExplorer.svelte`** (lab) — replaces `ModeSelector` + `ModeExplorer`
  in the Explorer tab. Loads `resolveRotationStyleMatrices()`, renders 3 glass panels
  (ISO/ANTISPIN/HYBRID) each via `TurnMatrixGrid showAxes={false}`, with the shared
  axis key, diagonal glow, and bloom carried over from the gallery. A short header
  explains the model (rotation style drives the mandala; mode is a tag).
- **`VariationPicker.svelte`** (lab) — given a style's `variations` + the clicked
  `(blue,red)`, lists the letter+mode chips; on pick, resolves the chosen word's
  sequence at that turn pattern and opens `CardInspectModal`. Lightweight popover or
  inline panel.
- **`classify-rotation-style.ts`** + **`resolve-rotation-style-matrices.ts`** (lab
  domain/services) with the functions above.

### Reused (unchanged)
- `TurnMatrixGrid` (the `showAxes` prop already added), `SequenceMandala`,
  `CardInspectModal`, `allTurnPatterns`, `resolveDeckSequences`, `loadDiamondEdges`,
  `loadCatalogSequences`, `deriveTnDFromPictograph`.

### Changed
- **`VtgLabModule.svelte`** — Explorer tab renders `<RotationStyleExplorer />` instead
  of `ModeSelector` + `ModeExplorer`. The `selectedMode` state for the explorer is no
  longer needed (Rosetta is independent).

### Retired
- **`ModeSelector.svelte`**, **`ModeExplorer.svelte`**, **`VtgModeMatrix.svelte`** —
  the family/mode-organized explorer path. Confirm no other importer before deleting
  (Rosetta uses `RosettaPanel`, separate). `vtg-sequence-data.ts` stays (Rosetta).

## Coloring

NOT elemental (rule: elemental colors are TnD-deck-only). Each rotation style gets its
own accent: **ISO = cyan**, **ANTISPIN = warm-red**, **HYBRID = violet**. Threads
through panel border/glow, diagonal ring, and bloom (the `--el` custom property is
repurposed as `--accent`).

## Verify during implementation
- Confirm the base catalog seeds populate all 3 styles (aggregated across modes they
  do: ISO/ANTISPIN globally, HYBRID from C/F/I/L/O/R). If a style is sparse, the panel
  still renders what exists.
- Confirm `motionType` values are `"pro"`/`"anti"` on the seed steps' motions (read a
  seed's `StepData.motions`), and pick the right step (first rotating shift) for
  classification.
- Confirm all variations within a style render the same mandala at a given turn cell
  (the user's observation); if not exact, the representative-thumbnail design still
  holds.

## Out of scope
- Rosetta tab (unchanged).
- Box grid mode, start-ori registers.
- Reseeding the catalog.

## Self-review
- Coverage: insight→model (3 panels), drill-down (picker→card), data (classifier +
  adapter), components (new/reused/retired), coloring, mode-chip removal. All present.
- The mandala-invariance assumption is de-risked: cells are representative thumbnails,
  cards are exact per chosen variation, so the design is correct even if invariance is
  approximate.
