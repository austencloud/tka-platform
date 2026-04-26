# Sticker Lab MVP — Design

**Date:** 2026-04-20
**Status:** Approved, ready for implementation plan
**Companion spec:** [`2026-04-20-mandala-canonical-form-scoping-memo.md`](./2026-04-20-mandala-canonical-form-scoping-memo.md) — research memo for Phase 2 dedup / directory

## Problem

The TKA mandala renderer (`src/lib/shared/mandala/`) produces strikingly beautiful petal decompositions of LOOP sequences. Today, mandalas appear only in two places: card backs (physical print) and column-0 fills on ChoreoCard front (`2026-04-18-choreo-card-mandala-fill-design.md`). The art is trapped inside composite artifacts.

Stickers are a new product surface. A 3" round mandala sticker is a gorgeous, giveaway-able physical object. Austen has an Epson ET-16650 tabloid printer and is ready to produce and distribute stickers as workshop swag, apprentice gifts, and promotional giveaways.

This spec defines **Phase 1** of a three-phase sticker platform:

- **Phase 1 (this spec):** Sticker Lab MVP — user picks LOOPs from the deck browser, packs a sheet, exports a print-ready PDF that works for both self-print and service-print paths.
- **Phase 2 (separate spec, research memo committed):** Mandala Canonical Form algorithm + "Browse unique mandalas" directory. Unlocks deduplication.
- **Phase 3 (future spec):** Chimera Mandala Builder. Left column (canonical blue paths) + right column (canonical red paths) + center remix. Produces stickers with `sourceLoop: null`.

## Scope

### In scope (MVP)

- New Lab tab: **Stickers**
- LOOP-only source (non-LOOP sequences ineligible)
- Source picker: **deck browser integration** — "Send to sticker sheet" action on every LOOP card
- Fixed 3" round sticker unit
- Three mandala variants per LOOP: **blue**, **red**, **full** (both-hands overlaid with overlap coloring)
- Stroke + filled layered rendering (maximum visual weight; ink unchecked)
- Three background options inside the circle: **transparent** (default), **white**, **radial-gradient**
- Per-sticker copy count (1+)
- Two sheet physical sizes: **8.5×11** (default) and **13×19** (ET-16650 tabloid)
- Auto-grid packing (3" rounds tile naturally; no free-drag needed)
- **Universal PDF export** — layered artifact that works unchanged for:
  - StickerYou "Make Your Own Page" (service, mixed sheet, qty 1)
  - StickerApp custom sheets (service, qty 1)
  - Silhouette Cameo 5 Print & Cut (self-print, die-cut)
  - Hand-punch + guillotine workflow (self-print, straight cuts + circle punch)
- Single active sheet per user, persisted to localStorage
- Documentation page covering the four print paths

### Out of scope (Phase 1)

- Multiple saved sheets / sheet history
- Firestore persistence (deferred to Phase 1.5 after pattern is proven)
- Chimera builder (Phase 3)
- Mandala directory / canonical dedup (Phase 2)
- Curated drop authoring (themed packs like "Six Elements")
- Die-cut-to-petal-boundary outlines (Phase 2+ — requires cut-path generation per mandala)
- Word labels or QR codes on stickers (explicitly rejected during brainstorm — "no space for QR in a mandala sticker")
- Holographic / glitter / specialty substrate previews (service-specific; handled by each service's upload flow)
- Non-3" sizes (size field is versioned for future expansion)
- Non-round shapes
- Print queue / order submission integration with services (user uploads the PDF themselves)

## Phase Map

| Phase | Title | Source | Status |
|---|---|---|---|
| 1 | Sticker Lab MVP (this spec) | Deck browser "Send to sticker sheet" | Approved |
| 2 | Mandala Canonical Form + Directory | All unique canonical mandalas | Scoping memo committed; awaits brainstorm |
| 3 | Chimera Mandala Builder | Canonical blue pool × canonical red pool | Concept captured |

Phase 1 ships without Phase 2. Phase 3 depends on Phase 2. The data model below bakes in both forward-compatibility hooks so neither phase requires migration.

## Architecture

### Feature module

New module: `src/lib/features/sticker-lab/`

Follows the established factory + context pattern (see `state-management` skill). Directory:

```
src/lib/features/sticker-lab/
├── StickerLabTab.svelte                       # tab entry (mounted by LabModule)
├── components/
│   ├── StickerList.svelte                     # left column
│   ├── StickerSheetPreview.svelte             # center
│   ├── StickerExportPanel.svelte              # right column
│   ├── StickerListItem.svelte                 # one LOOP row with variant toggles
│   └── SheetSizePicker.svelte
├── context/
│   └── sticker-lab-context.ts                 # get/set pattern
├── state/
│   └── sticker-lab-state.svelte.ts            # factory + $state/$derived
├── services/
│   ├── contracts/
│   │   ├── IStickerSheetRepository.ts         # persistence
│   │   ├── IStickerSheetPdfExporter.ts        # PDF generation
│   │   └── IStickerUnitRenderer.ts            # single sticker → canvas/SVG
│   └── implementations/
│       ├── LocalStickerSheetRepository.ts     # localStorage-backed
│       ├── StickerSheetPdfExporter.ts         # uses pdf-lib (audit first)
│       └── StickerUnitRenderer.ts             # composes MandalaRenderer output
└── domain/
    ├── sticker-types.ts                       # StickerSheet, StickerUnit types
    └── sticker-constants.ts                   # 3" = 900px @ 300dpi, bleed = 30px, etc.
```

Registered in `src/lib/shared/navigation/config/module-definitions.ts` as a lab sub-tab. DI bindings added to `src/lib/shared/di/container-types.ts` and `src/lib/shared/di/index.ts`.

### Data model

```ts
// sticker-types.ts
export type StickerVariant = 'blue' | 'red' | 'full';
export type StickerBackground = 'transparent' | 'white' | 'radial-gradient';
export type StickerSize = '3in-round';              // versioned; future: '2in-round', '5in-round'
export type StickerPresentation = 'pure';           // Phase 1 only; future: 'word-label', 'qr'
export type SheetSize = '8.5x11' | '13x19';

export interface StickerUnit {
  id: string;                                       // uuid
  sourceLoop: LoopRef | null;                       // null reserved for Phase 3 chimera
  variant: StickerVariant;
  size: StickerSize;
  background: StickerBackground;
  copies: number;                                   // default 1, min 1
  presentation: StickerPresentation;                // 'pure' for Phase 1
}

export interface StickerSheet {
  id: string;
  name: string;
  sheetSize: SheetSize;
  stickers: StickerUnit[];
  createdAt: number;
  updatedAt: number;
}

export interface LoopRef {
  sequenceId: string;                               // canonical id the deck browser uses
  word: string;                                     // denormalized for display
  loopType: string;                                 // rotated / mirrored / inverted / etc.
}
```

### Persistence

MVP: single active sheet stored in localStorage at key `tka:sticker-lab:active-sheet`. Repository abstracts read/write; swapping to Firestore in Phase 1.5 only requires replacing the binding.

No multi-sheet management in MVP. "Send to sticker sheet" always targets the active sheet. Users can clear the sheet (fresh start) but cannot save multiple named sheets. Simpler scope; the pattern extends cleanly later.

## Source: Deck Browser Integration

### The action

Every LOOP card in the deck browser (`src/lib/features/choreo-card/components/**` — the LOOP-rendering surfaces) gains a **"Send to sticker sheet"** action. Two affordances:

1. **Primary:** a small sticker icon button on the card (visible on hover for desktop, always-visible on touch)
2. **Secondary:** a "Send to sticker sheet" entry in the existing card context menu (right-click / long-press)

Both call `stickerLabContext.addLoop(loopRef)`.

### Behavior on add

- If the LOOP is not already on the sheet → append a new StickerUnit with default `variant: 'full'`, `background: 'transparent'`, `copies: 1`.
- If the LOOP is already on the sheet → no-op, briefly highlight the existing entry in the sticker list (user can toggle additional variants there).
- Toast confirmation: `"[WORD] added to sticker sheet"` with a "View sheet" action that navigates to the Stickers lab tab.

### Reuse, don't duplicate

**Do not** build a dedicated sticker picker. The deck browser already filters, categorizes, and surfaces all enumerated LOOPs. Adding a second picker duplicates that work and creates drift. Phase 2 may introduce a canonical-mandala directory as a *second* source — it doesn't replace the deck browser.

## UI / UX

Three-column layout inside the Stickers tab:

### Left column — Sticker list

One row per LOOP on the sheet. Each row:

- Small mandala thumbnail (reflects currently selected variant)
- LOOP word + type (e.g., "ALPHA · rotated-loop")
- Three variant toggle buttons: **Blue / Red / Full** (user picks which appear on the sheet; one, two, or all three)
- Background picker: **transparent / white / gradient**
- Copies counter: `[−] 1 [+]` (min 1, max 50)
- Remove button (×)

Empty state: illustrative copy — *"Open the deck browser and send LOOPs here to build your sheet."* With a button that navigates to the deck browser.

### Center column — Sheet preview

Canvas showing the sheet at true aspect ratio (8.5×11 or 13×19), scaled to fit.

- Stickers auto-packed as a grid (3" rounds, 0.15" gap, centered)
- Fit calculation:
  - 8.5×11 portrait: 2 × 3 = 6 stickers per sheet
  - 13×19 portrait: 3 × 5 = 15 stickers per sheet
- Overflow: when total copies exceed one sheet's capacity, render paginated previews (Sheet 1 of N, swipe/arrow to page)
- **Cut-line overlay toggle** — toggle shows/hides the dashed circles that guide cutting
- **Bleed overlay toggle** — shows the 0.1" bleed zone
- **Zoom control** (50 / 100 / 200%)

Packing order: as added, left-to-right, top-to-bottom. No drag-reorder in MVP (auto-grid is deterministic and 3" rounds are interchangeable in most layouts). Reorder lives in Phase 1.1 if requested.

### Right column — Export panel

- **Sheet size:** 8.5×11 / 13×19 radio
- **Download PDF** button (primary action) — triggers `IStickerSheetPdfExporter.export(sheet)`
- **Total count** summary: *"24 stickers across 2 sheets"*
- **Print path help** — accordion or drawer linking to the four documented workflows:
  - Upload to StickerYou "Make Your Own Page"
  - Upload to StickerApp custom sheets
  - Open in Silhouette Studio (Cameo 5 Print & Cut)
  - Self-print + circle punch + guillotine

## Rendering

### Each sticker unit

- Canvas / SVG at 3" = **900 px** (300 DPI) square. The mandala art is inscribed in a circle of radius 450 px centered in this square. An additional 0.1" bleed = **30 px** extends all edges, making the full per-sticker canvas **960 × 960 px**.
- Reuses `MandalaRenderer` from `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts`
- Options passed:
  - `style: 'filled'` plus stroke composition (the layered look requires rendering stroke over filled; renderer already supports this or will be extended minimally)
  - `show: 'blue' | 'red' | 'both'` mapping from variant
  - `palette:` **light-mode palette** (sticker paper is white; the default dark-mode palette produces illegible results)
  - `transparentBackground: true` when `background === 'transparent'`; else composite onto the chosen background before mandala draw
  - `showGridDots: false` (grid dots belong on cards, not standalone stickers)
  - `strokeWidth:` tuned for 3" standalone — wider than card-back default; exact value tuned in implementation
- Gradient background: radial gradient from a subtle off-white center to transparent or white at the circle edge. Non-directional (no light/shadow cue). Lives in `StickerUnitRenderer` as a pre-pass.

### Palette source

The existing light-mode prop palette is already defined for ChoreoCard front mandalas. Reuse it verbatim — blue stroke + blue fill, red stroke + red fill, purple stroke + purple fill for overlap. No new color tokens.

## Export: Universal PDF Format

### The artifact

Single PDF, one page per sheet. Each page contains up to N sticker units packed as described above.

### Layers

PDF layers (OCG — Optional Content Groups) enable the downstream workflows:

1. **Art** (always on) — the composited mandala art for every sticker on the page
2. **Bleed** (always on) — the 0.1" color extension past each cut boundary
3. **Cut Line** (default on, toggleable) — dashed circle at exactly 3" diameter around each sticker. Services that auto-detect cut lines (StickerApp, Silhouette Studio) read this layer; hand-cut workflows use it as a visual guide.
4. **Registration Marks** (default on) — four corner fiducials required by Silhouette Cameo 5 Print & Cut. Services ignore them.

### Spec

- Page size: exactly matches `sheetSize` (8.5×11 or 13×19 inches)
- DPI: art rasterized at **300 DPI** minimum (SVG paths are vectors but the bleed / gradient passes may rasterize)
- Color space: **sRGB** (services standardize on sRGB; CMYK conversion is the service's job)
- PDF version: 1.7 with OCG support
- Embedded fonts: none required (MVP has no text on stickers)
- File name: `TKA-Stickers-{sheetName}-{yyyymmdd}.pdf`

### Generation library

Candidate: `pdf-lib` (pure JS, works in-browser, supports layers/OCG, no server round-trip). Alternative: `pdfmake` or `jsPDF`. Implementation plan verifies which library best matches the OCG requirements and bundle-size budget; an audit task is included.

### Print-path documentation

Shipped as an in-app help drawer (not external docs). Covers the four paths with concrete click-by-click steps. Written in the project's AI writing style — no superlatives, no marketing puff.

## Phase 2 / Phase 3 Hooks

Already wired in MVP so later phases don't require migration:

| Hook | Phase 2 use | Phase 3 use |
|---|---|---|
| `sourceLoop: null` allowed | — | chimera stickers have no source LOOP |
| `size` as versioned string | `'2in-round'`, `'5in-round'` additions | — |
| `presentation` extensible | `'word-label'`, `'qr'` additions | — |
| `background` extensible | more gradients / textures | — |
| Deck browser as ONE source (not THE source) | canonical-mandala directory adds as second source | chimera builder adds as third source |

## Dependencies

### Code to touch
- `src/lib/shared/navigation/config/module-definitions.ts` — register Stickers lab tab
- `src/lib/shared/di/container-types.ts` + `index.ts` — register new services
- Deck browser LOOP-card surfaces — add "Send to sticker sheet" action (plan phase identifies exact files)
- `messages/en.json` — new strings
- `src/lib/features/sticker-lab/` — new module (scaffolded by `new-module` skill during implementation)

### Existing assets reused
- `MandalaRenderer` + `MandalaGeometryCalculator` (no changes expected, minor extension possible for stroke+fill layered composition if not already supported)
- Light-mode palette from ChoreoCard front
- Auto-LOOP detection (already identifies LOOPs in the deck browser)
- Deck browser's LOOP catalog

### New external deps
- PDF generation library (likely `pdf-lib`) — one addition, bundle-size audited during implementation plan

## Open Questions for Implementation Plan

Deferred to the planning phase, not blocking design approval:

1. Does `MandalaRenderer` already support stroke + fill layered in one pass, or does `StickerUnitRenderer` need to composite two renders? Spot check before planning.
2. Best PDF library for OCG + in-browser generation — audit `pdf-lib`, `pdfmake`, `jsPDF` for exact OCG semantics and bundle cost.
3. Exact stroke width at 3" for "gorgeous at 3 feet" readability — tune visually in implementation.
4. Auto-grid packing when copies > page capacity: how to split across pages when a single LOOP has `copies: 30` on an 8.5×11 (capacity 6) — prefer keeping copies of one sticker contiguous across pages, or spread variety per page? Implementation plan proposes and user picks.
5. Does the deck browser LOOP card have an established action-icon slot, or does this require a small component extension? Identify during plan phase.

## Non-goals (explicit)

These have been considered and ruled out for MVP to preserve scope:

- **No marketplace integration.** User uploads the PDF to StickerYou / StickerApp themselves. TKA does not broker orders.
- **No physical fulfillment.** TKA doesn't print or ship stickers. The artifact is the PDF.
- **No mandala art search/filter.** Source is the deck browser's existing filters only. Phase 2 introduces mandala-aesthetic search.
- **No print order history.** MVP is stateless beyond the active sheet.
- **No sharing.** Sheets are local-only. Phase 1.5 may introduce share links via short-codes.
