# VTG Lab Explorer — ChoreoCard Rebuild (Approach B)

Date: 2026-06-16
Status: Design — awaiting user review

## Problem

The VTG Lab Explorer renders each mode's sequences as bare pictograph cells laid
4-across (`SequenceStrip` → 4× `PictographContainer`). It reinvents a sequence
display that `ChoreoCard` already does properly, and it shows algorithmic
`ChainDef` hand-path cycles rather than the real catalog sequences the rest of
the app uses.

## Decision

Replace the Explorer's per-mode content with the deck-releaser's TnD catalog
sequences, rendered as `ChoreoCard`s, laid out in a 7×7 turn matrix per base
seed. (User chose Approach B + full turn enumeration + matrix layout.)

The 6 VTG modes map 1:1 to the 6 TnD families:

| VTG mode | TnD family |
|----------|------------|
| SS | split-same |
| TS | tog-same |
| SO | split-opp |
| TO | tog-opp |
| QS | quarter-same |
| QO | quarter-opp |

(`FAMILY_ORDER`, deck-composer.ts:301.)

## Data Flow

```
selectedMode (SS…QO)
  → familyId (table above)
  → loadSequencesByIds(TND_BASE_CATALOG_ID, …)        catalog-loader.ts:130
  → buildTnDSeedClasses(seqs)                          deck-composer.ts:328
  → getTnDFamilyOptions(seedClasses, grids)            deck-composer.ts:383
  → pick the family option → its seed entries (mirror-deduped)
  → for each seed × 49 turn patterns (TURN_VALUES²):
        buildTnDCards([family], {familyId}, allPatterns) deck-composer.ts:453
  → resolveDeckSequences(cards, edges)                 deck-variation.ts:343
        (applies turn pattern / grid / start-ori via applyVariationDescriptor:276)
  → <ChoreoCard cardMode> per resolved SequenceData, placed at cell [blue][red]
```

Grid mode: diamond only for the first pass (matches the current lab, which is
diamond-only). Box is a later tweak.

## Layout

Per selected mode:

1. **Mode header (kept).** Name, Type, TKA position + motion — from
   `VTG_MODE_GROUPS` metadata (`vtg-pattern-data.ts`). Unchanged.
2. **One 7×7 turn matrix per base seed.** Seed word as a section header (TnD
   element color/footer). Inside: blue-turns (rows) × red-turns (cols), each cell
   a `ChoreoCard` for that seed at that turn pattern. Empty turn cells (no
   resolvable sequence) render a placeholder, mirroring `TnDTurnMatrix`.

Most families have a small seed count, so a mode screen is one (or a few)
stacked 7×7 matrices.

## Components

### New
- **`TurnMatrixGrid.svelte`** (shared, in `choreo-card/components/`). Extracted
  from `TnDTurnMatrix`: the corner + red column headers + blue row headers + the
  `grid-template: auto repeat(7,1fr)` body with cqi sizing. Exposes a
  `cell` snippet `(blue: number, red: number)` for arbitrary cell content.
  `TnDTurnMatrix` is refactored to consume it (its select/navigate cell markup
  becomes the snippet body) so there is exactly one matrix geometry. **No fork.**
- **`VtgModeMatrix.svelte`** (lab). Given a `familyId`, owns the load → enumerate
  → resolve pipeline, and renders one `TurnMatrixGrid` per seed with `ChoreoCard`
  cells.
- **`resolveTnDFamilyCards(familyId, grids): Promise<Array<{ seedId, byTurn: Map<turnPattern, SequenceData> }>>`**
  adapter (lab or choreo-card service). Wraps the data-flow functions above.

### Reused
- `ChoreoCard.svelte` (`cardMode`, footer = TnD element, `showWord`).
- `getTnDFamilyOptions`, `buildTnDCards`, `buildTnDSeedClasses`,
  `loadSequencesByIds`, `resolveDeckSequences`, `applyVariationDescriptor`.

### Changed
- **`ModeExplorer.svelte`** — drops the rotation-group + `SequenceStrip` loop;
  renders the mode header (kept) + `VtgModeMatrix` for the selected family.

### Retired
- **`SequenceStrip.svelte`** — used only by `ModeExplorer`; delete after rewrite.
- `vtg-sequence-data.ts` **stays** — `RosettaPanel` still imports `getModeChains`
  / `expandChain` (RosettaPanel.svelte:12). Do NOT delete it.
- `PictographContainer` stays (shared; Rosetta still uses it).

## Performance

49 live `ChoreoCard`s per seed is heavy (each renders a sequence thumbnail via
`PropAwareThumbnail`). First pass:
- **Lazy-render cells** via `IntersectionObserver` — a cell renders its
  `ChoreoCard` only when scrolled near view; offscreen cells show a sized
  placeholder (reserve the box, no layout shift).
- Reuse `ChoreoCard`'s `preRenderedImageUrl` / thumbnail caching that the deck
  releaser already relies on, so a card renders once and is cached.

(No explicit "render all" button — lazy is the default, confirmed with user.)

## Open items to resolve in planning
- Exact signature of `resolveDeckSequences` / what `edges` it needs (read
  deck-variation.ts:343 before writing the adapter).
- Confirm `getTnDFamilyOptions` seed count per family from the live catalog (size
  the matrices, confirm no pagination needed).
- Whether `TurnMatrixGrid` extraction can be done without regressing
  `TnDTurnMatrix`'s two existing consumers (deck-releaser picker, catalog
  browser) — verify both render identically after refactor.

## Out of scope
- Rosetta tab (unchanged).
- Box grid mode, start-ori registers (later tweaks).
- The deck-releaser itself (only its composer functions are reused).
