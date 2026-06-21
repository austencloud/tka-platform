# Scene Selector Button — Design Spec

**Date:** 2026-05-13
**Status:** Approved

## Problem

Scene/background selection lives in Settings → Background tab — multiple clicks away from the 3D viewer. Users should be able to switch scenes directly from the viewer rail.

## Solution

Add a 5th button to the 3D viewer's right rail that opens a tile-grid popover for quick scene selection.

## Components

### 1. PopoverId Extension

Add `"scene"` to the `PopoverId` union in `viewer-3d-state.svelte.ts`.

### 2. RightRail Addition

New chip entry: `{ id: "scene", icon: "fa-mountain-sun", tooltip: "Background" }`. Positioned as the 5th button (after export). Renders `SceneSelectorPopover` when active.

### 3. SceneSelectorPopover (`src/lib/shared/3d/components/SceneSelectorPopover.svelte`)

- Glassmorphism popover matching `Viewer3DGearPopover` style (same bg, blur, border, shadow, border-radius)
- Opens to the left of the button (`right: calc(100% + 10px)`)
- Header: "Background" label
- Body: 3-column grid of scene tiles
- Each tile: FontAwesome icon + label, sourced from `ANIMATED_BACKGROUNDS`
- Active tile: blue highlight matching rail pressed state
- Click handler: sets `settingsService.settings.backgroundType` + applies theme via `applyThemeForBackground()`

### Data Source

Reuses `ANIMATED_BACKGROUNDS` from `src/lib/shared/settings/utils/public-page-backgrounds.ts` — 8 animated scenes with icon + label already defined.

### State Flow

`tile click → settingsService.settings.backgroundType = type → Viewer3DScene derives new backgroundType → Environment3D re-renders`

No new state. No new stores. Wires directly into existing reactive chain.
