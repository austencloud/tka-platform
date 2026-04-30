---
status: shipped
value: 4
effort: S
score: 16
remaining: ""
shipped: 2026-04-26
last_triaged: 2026-04-26
---
# MPC Print Prep Tab — Design Spec

## Problem

TKA Scribe can render choreo card fronts as PNGs, but there's no way to produce print-ready files for professional card printing services like MakePlayingCards.com (MPC). Users must manually pair fronts with backs and prepare files in the printer's required format.

## Solution

A new **Print Prep** tab in the Choreo Cards module that:
1. Takes the currently loaded deck as input
2. Renders every card front and back at MPC's exact specifications (822x1122px at 300 DPI)
3. Shows a browsable preview of all front/back pairs
4. Exports a single alternating-page PDF (Front 1, Back 1, Front 2, Back 2, ...)

---

## MPC Specifications (Poker Size)

| Zone | Dimension | Pixels (300 DPI) |
|------|-----------|-----------------|
| Print size | 2.5" x 3.5" | 750 x 1050 |
| Bleed | +1/8" each side | +36px each side |
| Full canvas | 2.75" x 3.75" | **822 x 1122** |
| Safe area | 1/8" inside print edge | 678 x 978 (centered) |

Source: [MPC Image Upload FAQ](https://www.makeplayingcards.com/pops/faq-photo.html)

All card faces (fronts and backs) render at **822 x 1122 pixels**. Content occupies the center 750x1050 area. Background extends into the 36px bleed zone. Text and critical imagery stay within the 678x978 safe area.

---

## Architecture

### Tab Integration

Add `"print-prep"` as a fourth mode in `ChoreoCardTab.svelte`:

```typescript
type ChoreoCardMode = "library" | "decks" | "designer" | "print-prep";
```

Add to `CHOREO_CARD_TABS` in `tab-definitions.ts`:
```typescript
{
  id: "print-prep",
  label: "Print Prep",
  icon: '<i class="fas fa-print" aria-hidden="true"></i>',
  description: "Prepare cards for professional printing",
  color: "#059669",
  gradient: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
}
```

### Data Flow

```
Deck loaded in Decks tab
  → User switches to Print Prep tab
  → Tab reads selectedDeckId + deckSequences (already in ChoreoCardTab state)
  → If no deck loaded: show message pointing to Decks tab
  → If deck loaded:
      → For each sequence (in family order):
          → Render front at 822x1122 via ImageComposer (with bleed wrapper)
          → Render back at 822x1122 via CardBackCanvasRenderer (new)
      → Optionally prepend info card pair (front + back)
      → Display as scrollable grid of front/back pairs
      → Export button generates alternating-page PDF via pdf-lib
```

### Entry Condition

The Print Prep tab requires a loaded deck. When no deck is selected:

```
"No deck loaded. Go to the Decks tab to select a deck, then return here to prepare it for printing."
```

With a link/button that switches to the Decks tab.

---

## New Services

### 1. IPrintCardRenderer / PrintCardRenderer

Orchestrates rendering a complete print-ready card (front or back) at MPC dimensions.

**Interface:** `src/lib/features/choreo-card/services/contracts/IPrintCardRenderer.ts`

```typescript
export interface IPrintCardRenderer {
  renderFront(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement>;
  renderBack(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement>;
  renderInfoCardFront(): Promise<HTMLCanvasElement>;
  renderInfoCardBack(): Promise<HTMLCanvasElement>;
}

export interface PrintRenderOptions {
  // MPC dimensions (defaults provided)
  canvasWidth?: number;   // 822
  canvasHeight?: number;  // 1122
  bleedPx?: number;       // 36
  // Visibility flags (inherited from choreo card settings)
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;
  handPointsVisible: boolean;
}
```

**Implementation:** `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts`

**Front rendering:** Delegates to the existing `ImageComposer.composeSequenceImage()` to render the sequence at 750x1050, then composites onto an 822x1122 canvas with the edge colors extended into the bleed zone.

**Back rendering:** Delegates to `CardBackCanvasRenderer` (see below).

### 2. ICardBackCanvasRenderer / CardBackCanvasRenderer

Pure canvas renderer that draws CardBackV5's layout directly using Canvas 2D API.

**Interface:** `src/lib/features/choreo-card/services/contracts/ICardBackCanvasRenderer.ts`

```typescript
export interface ICardBackCanvasRenderer {
  render(data: CardBackData, options: CardBackCanvasOptions): HTMLCanvasElement;
}

export interface CardBackCanvasOptions {
  width: number;     // 822 (full with bleed)
  height: number;    // 1122
  bleedPx: number;   // 36
  theme: string;     // background theme name for gradient/decorations
}
```

**Implementation:** `src/lib/features/choreo-card/services/implementations/CardBackCanvasRenderer.ts`

Draws the same visual layout as `CardBackV5.svelte` using Canvas 2D:
- Gradient border frame (from `card-back-theme-visuals.ts`)
- Themed background with decorative elements
- Corner badges: level (top-left), LOOP icons (top-right), step count (bottom-left), start position glyph (bottom-right)
- Center content: word, pronunciation guide, LOOP explanation
- Branding header ("Choreo Card · TKA")
- URL footer ("tkaflowarts.com")

Data input: `CardBackData` from the existing `deriveCardBackData()` function. No new data derivation needed.

### 3. IInfoCardCanvasRenderer / InfoCardCanvasRenderer

Pure canvas renderer for the info/rules card pair.

**Interface:** `src/lib/features/choreo-card/services/contracts/IInfoCardCanvasRenderer.ts`

```typescript
export interface IInfoCardCanvasRenderer {
  renderFront(options: CardBackCanvasOptions): HTMLCanvasElement;
  renderBack(options: CardBackCanvasOptions): HTMLCanvasElement;
}
```

Draws the same content as `InfoCardFront.svelte` and `InfoCardBack.svelte` on canvas. Since these are static (no per-sequence data), they render once and are cached.

### 4. IPrintPDFExporter / PrintPDFExporter

Assembles rendered canvases into a single alternating-page PDF.

**Interface:** `src/lib/features/choreo-card/services/contracts/IPrintPDFExporter.ts`

```typescript
export interface CardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string; // for progress reporting (e.g., the word)
}

export interface IPrintPDFExporter {
  exportDeckPDF(
    pairs: CardPair[],
    deckName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;
}
```

**Implementation:** Uses `pdf-lib` to:
1. Create a PDF document
2. For each card pair: add front page (822x1122), then back page (822x1122)
3. Pages are sized to match MPC's expected dimensions at 300 DPI (2.74" x 3.74")
4. Embed each canvas as a PNG image on its page
5. Return the PDF as a Blob for download

**Dependency:** `pdf-lib` (MIT, ~170KB, zero dependencies, works in browser)

---

## UI Component

### PrintPrepView.svelte

Main component for the Print Prep tab.

**Layout:**
- **Header bar:** Deck name, card count, toggle for info cards, export button
- **Preview area:** Scrollable grid of card pairs

**Card pair display:**
Each pair shows front and back side-by-side at a reduced preview size (scaled down from 822x1122 to fit the viewport). Cards are grouped by family with family labels as section headers.

**States:**
- **No deck:** Message with link to Decks tab
- **Rendering:** Progress bar ("Rendering card 12 of 64...")
- **Ready:** Scrollable preview with export button enabled
- **Exporting:** Progress bar ("Building PDF... page 24 of 128")

**Controls:**
- Info cards toggle (default: on, persisted to `printPrep.includeInfoCards`)
- Export PDF button (disabled during rendering)
- Family section headers (collapsible, matching DeckBrowser pattern)

**Preview card sizing:**
Cards scale to fit the viewport while maintaining the 822:1122 aspect ratio (≈ 0.732). At 2 columns on desktop, each preview card is roughly 300px wide x 410px tall.

---

## Card Ordering in PDF

1. Info card front (if enabled)
2. Info card back (if enabled)
3. For each family in deck order:
   - For each sequence in family order:
     - Sequence front
     - Sequence back

---

## DI Registration

New services registered in the choreo card container:

```typescript
.add({ printCardRenderer: () => new PrintCardRenderer(/* deps */) })
.add({ cardBackCanvasRenderer: () => new CardBackCanvasRenderer() })
.add({ infoCardCanvasRenderer: () => new InfoCardCanvasRenderer() })
.add({ printPDFExporter: () => new PrintPDFExporter() })
```

Interfaces added to `container-types.ts`.

---

## Settings

| Key | Type | Default | Persisted |
|-----|------|---------|-----------|
| `printPrep.includeInfoCards` | boolean | `true` | localStorage |

---

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `features/choreo-card/components/PrintPrepView.svelte` | Tab UI component |
| `features/choreo-card/services/contracts/IPrintCardRenderer.ts` | Print orchestrator interface |
| `features/choreo-card/services/implementations/PrintCardRenderer.ts` | Print orchestrator |
| `features/choreo-card/services/contracts/ICardBackCanvasRenderer.ts` | Card back canvas interface |
| `features/choreo-card/services/implementations/CardBackCanvasRenderer.ts` | Card back canvas renderer |
| `features/choreo-card/services/contracts/IInfoCardCanvasRenderer.ts` | Info card canvas interface |
| `features/choreo-card/services/implementations/InfoCardCanvasRenderer.ts` | Info card canvas renderer |
| `features/choreo-card/services/contracts/IPrintPDFExporter.ts` | PDF assembly interface |
| `features/choreo-card/services/implementations/PrintPDFExporter.ts` | PDF assembly with pdf-lib |

### Modified Files

| File | Change |
|------|--------|
| `shared/navigation/config/tab-definitions.ts` | Add "print-prep" to `CHOREO_CARD_TABS` |
| `features/choreo-card/components/ChoreoCardTab.svelte` | Add print-prep mode routing, pass deck state |
| `shared/di/containers/choreo-card-container.ts` (or equivalent) | Register new services |
| `shared/di/container-types.ts` | Add new service types |
| `package.json` | Add `pdf-lib` dependency |

---

## Out of Scope (Future)

- Library or manual selection as card source (currently deck-only)
- Named image pairs zip export (Shuffled Ink format)
- Custom card ordering / drag-to-reorder
- Bleed visualization overlay (showing trim/safe lines on preview)
- Deck-as-quest composition concept (separate spec)
- Multiple printer format support
