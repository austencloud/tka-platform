# Mobile Export Bottom Bar Redesign

**Date:** 2026-03-11
**Status:** Approved

## Problem

On mobile (375px), the export panels (video and image) consume most of the screen with settings rows (FPS, Resolution, Repeat, Effects / Include, Columns, Theme), leaving almost no room for the animation preview or choreo card.

## Solution

Replace the current "all settings visible" mobile layout with a compact bottom bar pattern:

- **Export button always visible** — one Tap to download
- **Settings behind a gear icon** — opens a half-sheet overlay when tapped
- **Content gets full screen** — animation/choreo card never compressed

### Video Export (mobile bottom layout)

**Bottom bar:** `[Play/Pause] [Export Video ▼] [⚙ Settings]`

- Play/Pause controls playback inline
- Export button is the primary CTA
- Settings gear opens half-sheet with: FPS, Resolution, Repeat, Effects
- During export: bar shows progress bar + cancel button (replaces the three buttons)

**Settings half-sheet:** Slides up from bottom, covers ~50% of screen. Same setting rows as current panel (FPS chips, Resolution chips, Repeat stepper, Effects toggles). Backdrop tap or X closes it.

### Image Export (mobile bottom layout)

**Bottom bar:** `[Download Image ▼] [⚙ Settings]`

- No play/pause needed for image
- Export button is the primary CTA
- Settings gear opens half-sheet with: Include toggles, Columns, Theme

### Desktop (unchanged)

Desktop sidebar layout is unaffected. The `layout` prop already distinguishes "sidebar" vs "bottom". The mobile changes only apply to the "bottom" layout.

### Implementation

Both ExportVideoDrawer and ExportImagePanel get a `settingsOpen` state toggle. When `layout === "bottom"`:
- Render compact bottom bar instead of full settings
- Settings live in a positioned overlay that slides up with animation
- Backdrop closes settings

When `layout === "sidebar"` (desktop): no change, all settings visible as before.
