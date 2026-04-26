# ImageComposer Deck Card Mode Design

**Date:** 2026-04-04
**Status:** Approved
**Builds on:** `2026-04-04-card-visual-polish-design.md`

## Problem

The ImageComposer generates sequence images at sizes determined by beat count. A 4-beat sequence produces a ~1200px wide canvas, an 8-beat produces ~2400px. Header/footer heights and font sizes derive from `stepSize` (which is constant), but the canvas width varies. When these images are scaled down to fit a fixed-size playing card (750px content width), the header/footer text ends up at different sizes on every card. A 4-beat card has large text, a 16-beat card has tiny text.

Additionally, the header/footer background is near-white (`rgba(245, 245, 245, 0.98)`) in light mode, making it invisible on the white card content area.

## Solution

Add a `deckCard` option to `SequenceExportOptions` that tells the ImageComposer to render at fixed card dimensions with consistent header/footer sizing and gray backgrounds.

## Design

### The `deckCard` Option

```typescript
// In SequenceExportOptions
deckCard?: {
  contentWidth: number;   // 750 (poker) or 825 (tarot)
  contentHeight: number;  // 1050 (poker) or 1425 (tarot)
}
```

When `deckCard` is set, the compositor ignores the normal dimension calculation pipeline (`columns * stepSize`) and instead works from fixed card dimensions.

### Fixed Canvas Size

The canvas is always `deckCard.contentWidth × deckCard.contentHeight`. This is the content area of the card (inside the bleed/frame). The `PrintCardRenderer` wraps this in the stripe frame.

### Header/Footer Sizing

Heights are proportional to content width, consistent across all sequence lengths within a card size:

| Region | Formula | Poker (750px) | Tarot (825px) |
|--------|---------|---------------|---------------|
| Header | `contentWidth * 0.133` | ~100px | ~110px |
| Footer | `contentWidth * 0.067` | ~50px | ~55px |

These are passed to the existing `renderHeader()` and `renderFooter()` functions from `@tka/render-composition`. The font sizes inside those functions already scale proportionally from the header/footer height (word = 66%, badge = 90%, footer text = 55%), so all text is consistent.

### Header/Footer Background Color

A `backgroundColor` option is added to `HeaderOptions` and `FooterOptions` in the render-composition package:

```typescript
// header-renderer.ts
export interface HeaderOptions {
  // ... existing fields
  backgroundColor?: string;
}

// In renderHeader():
ctx.fillStyle = backgroundColor ?? (darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)");
```

Same for `FooterOptions` and `renderFooter()`.

When `deckCard` mode is active, the ImageComposer passes `backgroundColor: "#808080"` (neutral gray) so the header/footer are visible on the white card.

The text color for non-dark mode is already black (`"black"` in footer, dark gray in header), which reads well on gray.

### Header/Footer Border Stroke

The existing `darkMode: false` border stroke is `rgba(0, 0, 0, 0.1)` — too subtle on a gray background. Add a `borderColor` option alongside `backgroundColor`:

```typescript
// In HeaderOptions and FooterOptions:
borderColor?: string;
```

When `deckCard` mode is active, pass `borderColor: "rgba(0, 0, 0, 0.25)"` for a visible but not harsh separator between the gray header/footer and white grid area. Default behavior (no `borderColor`) unchanged.

### Grid Area Calculation

Available grid space = `contentHeight - headerHeight - footerHeight`.

The `stepSize` is calculated backwards to fit:

```typescript
const availableWidth = contentWidth;
const availableHeight = contentHeight - headerHeight - footerHeight;
let columns = calculateColumns(sequence); // existing logic
// If includeStartPosition with "column" layout, add 1 column for the start position
if (options.includeStartPosition && options.startPositionLayout === "column") {
  columns += 1;
}
const rows = Math.ceil(totalCells / columns); // totalCells includes start position if applicable
const stepSize = Math.floor(Math.min(availableWidth / columns, availableHeight / rows));
```

The start position column participates in the width budget so all cells (including start position) are the same size. The grid is centered in the available space (horizontally and vertically) using the same centering logic from the existing `composeCardImage` path.

### Grid Background

The area behind the pictograph grid remains white (matching the card content area). Only the header and footer get gray backgrounds.

### Threading Through the App

The `backgroundColor` must flow from ImageComposer through to the render-composition package:

1. `ImageComposer.composeSequenceImage()` — when `deckCard` is set, calculate fixed header/footer heights and pass `backgroundColor: "#808080"` to TextRenderer
2. `TextRenderer.renderWordHeader()` — add optional `backgroundColor` parameter, pass to `renderHeader()`
3. `TextRenderer.renderUserInfo()` — add optional `backgroundColor` parameter, pass to `renderFooter()`
4. `renderHeader()` / `renderFooter()` — use `backgroundColor` if provided (already designed above)

### PrintCardRenderer Changes

`PrintCardRenderer.renderFront()` passes `deckCard` dimensions from `CARD_SIZES`:

```typescript
const sizeSpec = CARD_SIZES[options.cardSize ?? 'poker'];
// In the imageComposer call:
deckCard: {
  contentWidth: sizeSpec.contentWidth,   // 750 or 825
  contentHeight: sizeSpec.contentHeight, // 1050 or 1425
}
```

Since the ImageComposer now produces an image at exactly the content dimensions, `renderFront()` can draw it directly into the content area without scaling (`drawImage` at 1:1). The `Math.min(scaleX, scaleY)` scaling becomes unnecessary for deck card renders — the image already fits perfectly.

### What Changes for PrintCardRenderer

The `renderFront()` method needs to know the card size to pass to `deckCard`. Currently it receives `canvasWidth/canvasHeight/bleedPx` which are the full card dimensions including bleed. It can derive content dimensions:

```typescript
const contentW = canvasW - bleed * 2;
const contentH = canvasH - bleed * 2;
```

These are already calculated. Pass them as `deckCard: { contentWidth: contentW, contentHeight: contentH }`.

## Files Changed

| File | Change |
|------|--------|
| `SequenceExportOptions.ts` | Add `deckCard?: { contentWidth: number; contentHeight: number }` |
| `ImageComposer.ts` | New code path in `composeSequenceImage` when `deckCard` is set: fixed canvas, proportional header/footer, backwards `stepSize`, gray backgrounds |
| `header-renderer.ts` | Add `backgroundColor?: string` to `HeaderOptions`, use in `renderHeader()` |
| `footer-renderer.ts` | Add `backgroundColor?: string` to `FooterOptions`, use in `renderFooter()` |
| `TextRenderer.ts` | Add `backgroundColor` parameter to `renderWordHeader()` and `renderUserInfo()`, pass through |
| `PrintCardRenderer.ts` | Pass `deckCard` dimensions in `composeSequenceImage` options |

## What Doesn't Change

- Standard exports (no `deckCard` flag) work exactly as before — no regression risk
- `composeCardImage()` still exists (not deprecated in this spec, but `deckCard` makes it redundant for card printing)
- `DimensionCalculator` is not modified — it's only used by the standard path
- Card back rendering (CardBackDomRenderer) is unaffected

## Calibration Notes

- Header proportion (0.133) and footer proportion (0.067) are starting points. May need tuning once real cards are printed.
- Gray background color (#808080) matches the stripe frame's neutral tone. May want to adjust for contrast with text.
- The border stroke between header/grid and footer/grid uses existing `darkMode: false` styling (dark stroke), which should be visible on gray.
