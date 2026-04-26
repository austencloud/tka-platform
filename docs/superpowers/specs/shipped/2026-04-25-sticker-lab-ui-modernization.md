# Sticker Lab UI Modernization

**Date:** 2026-04-25
**Status:** Approved
**Scope:** UI-only modernization of existing Sticker Lab — no new features, no mandala creation flow

## Problem

Opus 4.7 shipped the Sticker Lab with 2021-era UI: native radio buttons, 11px fonts, 24px touch targets, hardcoded pixel values, and a permanently visible export panel wasting space. None of it uses the design system tokens that every other module in TKA follows.

## Design Decisions

### Layout: 2-Column + Drawer System

**Default view:** sticker list (left, 280px) + sheet preview (center, 1fr).

**Primitive picker:** right-side `Drawer` on desktop (≥1024px), bottom sheet on mobile. Replaces the current 480px centered modal. Reuses `$lib/shared/foundation/ui/Drawer.svelte` with responsive placement detection (same pattern as `CreatePanelDrawer`). Sheet preview stays visible while browsing — user sees stickers appear in real time.

**Export panel:** same `Drawer` component, triggered by "Export" button in sticker list footer. Contains sheet size picker, sticker count summary, Download PDF button, and printing instructions. Opens as right drawer on desktop, bottom sheet on mobile.

**Kill:** 3-column grid layout, `PrimitivePicker` modal with backdrop.

### Component Replacements

| Current | Replacement |
|---------|-------------|
| Variant radio group (blue/red/full) | `SegmentedControl` with `color="blue"` |
| Background radio group (clear/white/soft) | `SegmentedControl` with `color="accent"` |
| `SheetSizePicker` with `<input type="radio">` | `SegmentedControl` (2 options) |
| 480px centered modal picker | `Drawer` with responsive placement |
| 3-column permanent layout | 2-column + drawer system |

### Token Migration

Every component gets migrated from hardcoded values to design system tokens:

| Property | Before | After |
|----------|--------|-------|
| Body font size | 11–12px | `var(--font-size-sm)` (14px) |
| Label font size | 10–11px | `var(--font-size-compact)` (12px) |
| Touch targets | 24×24px | `var(--min-touch-target)` (44px) |
| Button padding | 4px 6px | `var(--spacing-sm) var(--spacing-md)` |
| Border radius | 4px / 6px | `var(--radius-2026-sm)` (10px) |
| Gaps | 4–6px | `var(--spacing-sm)` (8px) / `var(--spacing-md)` (16px) |
| Colors | hardcoded rgba | `var(--theme-*)` tokens |

### Minimum Standards (enforced)

- All interactive elements: `min-height: var(--min-touch-target)` (44px)
- No font below `--font-size-compact` (12px) — labels/badges only
- No body text below `--font-size-sm` (14px)
- No `<input type="radio">` or `<input type="checkbox">`
- No hardcoded color values — `--theme-*` variables only

## Files Changed

### 1. `StickerLab.svelte`
- 3-col grid → 2-col grid (`280px 1fr`)
- Remove `col-export` section
- Add Drawer host for primitive picker and export panel
- Responsive: single column on mobile (≤640px)

### 2. `StickerListItem.svelte`
- Variant selector → `SegmentedControl<"blue" | "red" | "full">` with `color="blue"`, `size="sm"`
- Background selector → `SegmentedControl<"transparent" | "white" | "radial-gradient">` with `color="accent"`, `size="sm"`
- Add section labels ("Variant", "Background") above each control
- Copy ± buttons: 44px touch targets, `--radius-2026-sm`
- Remove button: 44px, proper icon sizing
- Name text: `--font-size-base` (16px), weight 600
- All spacing via `--spacing-*` tokens

### 3. `StickerList.svelte`
- Add "Export" button next to "+ Add" in footer
- Button sizes: `min-height: var(--min-touch-target)`
- Font sizes: `--font-size-sm` for count, `--font-size-sm` for buttons
- Spacing: `--spacing-sm` / `--spacing-md`

### 4. `SheetSizePicker.svelte`
- Kill `<fieldset>` + `<input type="radio">` markup
- Replace with `SegmentedControl` — options: `{value: "8.5x11", label: "Letter 8.5×11"}` and `{value: "13x19", label: "Tabloid 13×19"}`
- `color="accent"`, no size override (default `md`)
- Retains section label "Sheet size" as uppercase `--font-size-compact`

### 5. `PrimitivePicker.svelte`
- Modal → Drawer with `placement` responsive to viewport width
- Desktop (≥1024px): right-side drawer, `width: clamp(300px, 30vw, 400px)`
- Mobile: bottom sheet, full width
- Tile grid: responsive columns (`repeat(auto-fill, minmax(80px, 1fr))`)
- Tile labels: `--font-size-compact` (12px), up from 10px
- Header: `--font-size-base` (16px), close button 44px
- Remove fixed 480px width, fixed 3-column grid
- Glass-surface styling from Drawer component
- Transparent backdrop (non-blocking, same as Create module drawers)

### 6. `StickerExportPanel.svelte`
- No longer a permanent column — rendered inside a Drawer
- Drawer opens from "Export" button in StickerList
- Internal layout unchanged (SheetSizePicker + summary + Download PDF + help details)
- Token migration on all internal elements
- Download PDF button: `min-height: var(--min-touch-target)`, `--radius-2026-sm`

### 7. `StickerSheetPreview.svelte`
- Toolbar toggle buttons: 44px touch targets, `--radius-2026-sm`
- Pager buttons: 44px, `--radius-2026-sm`
- Font sizes: `--font-size-sm` for toolbar text, `--font-size-compact` for sticker count
- Spacing: `--spacing-md` for toolbar gaps

## Not In Scope

- Mandala primitive creation flow
- New catalog entries beyond existing 60
- Stage B geometric canonicalization
- Search/filter in primitive picker (future enhancement)
- Drag-to-reorder stickers
