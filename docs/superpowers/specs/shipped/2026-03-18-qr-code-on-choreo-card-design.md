# QR Code on ChoreoCard — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Problem

QR codes only appear when exporting from the Choreo Cards module. They should appear whenever a choreo card is visible — in the sequence viewer (interactive), in exports from the sequence viewer, and in the choreo card module. This enables passive discovery: someone sees a sequence on your screen, scans the QR, and gets it instantly.

Additionally, QR codes need dark mode support — white modules on dark backgrounds instead of the current dark-on-white only.

## Design

### 1. Dark Mode QR Style — QRCodeGenerator

Add a `darkMode` option to `QRCodeOptions`. When true, the generator uses white module color (`#ffffff`) on transparent background (`#00000000`).

**File:** `src/lib/shared/qr/services/contracts/IQRCodeGenerator.ts`
- Add `darkMode?: boolean` to `QRCodeOptions`

**File:** `src/lib/shared/qr/services/implementations/QRCodeGenerator.ts`
- In `generateQR()`, when `options.darkMode` is true, override resolved style colors: modules = `#ffffff`, background = transparent

### 2. Shared ChoreoCard — Interactive QR Display

**File:** `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

Add prop: `showQRCode?: boolean` (default `false`).

When enabled:
- After cell render completes, async-generate QR via `container.items.qrCodeGenerator.generateForSequence()`
- Place QR in the bottom-left empty cell of column 1 (under start position) — same heuristic as ImageComposer's `findEmptyCellForQR`
- Render as `<img>` element in a grid cell with the same styling as pictograph cells
- Pass `darkMode` prop to QR generator for correct colors
- Cache QR data URL keyed by `sequenceId:darkMode` to avoid regeneration on re-render
- Only generate when `includeStartPosition` is true (QR goes under start position)

Grid placement:
- Standard layout: column 1, last occupied row + 1 (or last row if empty)
- Duration layout: inside `duration-start-col`, below the start position image
- If no empty cell exists (start position fills entire column), skip QR display

### 3. Sequence Viewer Export — ImageComposer Dark Mode Fix

**File:** `src/lib/shared/render/services/implementations/ImageComposer.ts`

`renderQRCode()` already works but ignores `isDarkMode`. Update:
- When `isDarkMode` is true, pass `darkMode: true` to `generateAsImage()`
- When `isDarkMode` is true, fill cell background with dark color (`#000000` or `#0a0a0f`) instead of `#ffffff`

### 4. Wiring — SequenceViewerDrawerHost

**File:** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Pass `showQRCode={true}` to the ChoreoCard it renders.

### 5. Export Options — Sequence Viewer

Ensure `showQRCode: true` is included in visibility overrides when exporting from the sequence viewer. Check `ExportImagePanel` and its option flow.

## Scope Boundaries

- No new UI toggle for QR visibility — always on
- No changes to QR short code system or URL format
- No changes to grid layout algorithm — uses existing empty cells
- Feature ChoreoCard (choreo-card module) already passes `showQRCodes` — just needs the ImageComposer dark mode fix

## Files Modified

1. `src/lib/shared/qr/services/contracts/IQRCodeGenerator.ts` — add `darkMode` option
2. `src/lib/shared/qr/services/implementations/QRCodeGenerator.ts` — dark mode color logic
3. `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` — `showQRCode` prop + QR rendering
4. `src/lib/shared/render/services/implementations/ImageComposer.ts` — dark mode QR colors
5. `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — pass `showQRCode`
