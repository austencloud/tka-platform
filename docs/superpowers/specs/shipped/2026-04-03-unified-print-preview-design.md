# Unified Print Preview View

## Problem

The Choreo Cards deck browser has too many views: Grid, Cards (fronts-only page layout), and a separate Print Prep destination. None of them show what the printed output actually looks like — pages of fronts followed by their matching backs, ready for duplex printing.

## Design

### Two Views Only

The toolbar becomes:

**Grid** (browse/explore individual cards) | **Print Preview** (pages as they'll print)

### Print Preview — What It Shows

A scrollable vertical stack of US Letter pages (8.5"x11") showing exactly what comes out of the printer:

- Page 1: Fronts in a grid (3x3 for poker, 3x2 for tarot)
- Page 2: Matching backs, columns mirrored for long-edge duplex flip
- Page 3: Next batch of fronts
- Page 4: Next batch of backs
- ...alternating until all cards are covered

Each page is a white rectangle at the correct aspect ratio with cards positioned at their print locations. Front pages show the sequence pictographs. Back pages show the mandala card backs rendered via CardBackDomRenderer.

### Export Controls

A compact toolbar strip within the Print Preview (not a separate sidebar):

- **Card size toggle**: Poker 2.5"x3.5" / Tarot 2.75"x4.75"
- **Theme picker**: Compact row of 8 theme swatches for card back style
- **Export PDF button**: Home printing with duplex-aligned pages (uses existing PrintPDFExporter.exportHomePrintPDF)
- **Export ZIP button**: Individual front/back PNGs for MPC upload (uses existing PrintZipExporter)
- **MPC guide**: Small expandable info section near ZIP button with the 4-step upload instructions

### Progressive Rendering

Cards render progressively as they did in PrintPrepView. The page layout fills in as card images become available. A progress bar shows rendering status.

### What Gets Removed

| File | Status |
|------|--------|
| `CardPageLayout.svelte` | Replaced by new PrintPreviewPages component |
| `PrintPrepView.svelte` | Removed — functionality merged into print preview |
| `PrintPrepSidebar.svelte` | Removed — controls inline in toolbar |
| `PrintPrepCardGrid.svelte` | Removed — pages replace the grid |
| `PrintPrepDetailModal.svelte` | Removed |
| `CardPreviewSettings.svelte` | Removed if only used by Cards view |
| `printPrepActive` state in ChoreoCardTab | Removed |
| Print button in DeckBrowser/VtgFamilyDrillDown toolbars | Removed |

### What Stays

| Component | Role |
|-----------|------|
| `PrintCardRenderer` | Renders individual card fronts/backs to canvas |
| `CardBackDomRenderer` | Renders card back via CardBack.svelte → html2canvas |
| `PrintPDFExporter` | Generates duplex-aligned PDF |
| `PrintZipExporter` | Generates numbered front/back ZIP |
| `CardSizeToggle` | Size picker (reused in toolbar) |
| Grid view in DeckBrowser | Unchanged |

### New Component

`PrintPreviewPages.svelte` — The core new component. It:

1. Takes sequences + card size + theme as props
2. Groups sequences into pages using `getPageLayout(cardSize)` 
3. For each page-worth of cards, renders a front page and a back page
4. Front page: cards left-to-right, top-to-bottom in the grid
5. Back page: same cards but columns mirrored (3,2,1 instead of 1,2,3)
6. Each page rendered as a white rectangle at 8.5:11 aspect ratio
7. Cards rendered progressively via PrintCardRenderer
8. Displays rendered card images as `<img>` tags positioned in a CSS grid within each page

### VTG Family Drill-Down

The VTG drill-down view gets the same Grid/Print Preview toggle. When switching to Print Preview, it builds the synthetic deck (same as current onPrintPrep flow) and passes sequences to PrintPreviewPages.

### Toolbar Layout

```
[Grid] [Print Preview]   |   Poker 2.5x3.5  Tarot 2.75x4.75   |   [theme swatches]   |   [Export PDF] [Export ZIP]
```

Card size, theme, and export controls only visible when Print Preview is active.
