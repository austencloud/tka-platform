# Visibility Tab — Stacked Layout Redesign

## Problem

On wide screens (4K), the Visibility tab splits into three equal-width columns (~380px each within a 1200px max-width container). Each preview canvas is capped at 280x280px. Fire effects, trails, smoke — all invisible at that size. You can't visually inspect what the sliders and toggles are actually doing.

## Solution

Replace the 3-column desktop layout with vertically stacked full-width sections. Each section places its preview canvas and controls side by side, giving previews up to 500px width.

## Layout

### Desktop (container >= 700px)

Three stacked rows, each a horizontal flex container:

```
┌─────────────────────────────────────────────┐
│  ◉ Pictograph                          [▾]  │
│  ┌──────────────────┐  ┌────────────────┐   │
│  │                  │  │  TKA    VTG    │   │
│  │  BIG PREVIEW     │  │  Elemental     │   │
│  │  (up to 500px)   │  │  Positions     │   │
│  │                  │  │  Reversals     │   │
│  └──────────────────┘  │  Grid  Step#   │   │
│                        │  Hand Points   │   │
│                        └────────────────┘   │
├─────────────────────────────────────────────┤
│  ◉ Animation                           [▾]  │
│  ┌──────────────────┐  ┌────────────────┐   │
│  │                  │  │  Loop / Step   │   │
│  │  BIG PREVIEW     │  │  BPM presets   │   │
│  │  (up to 500px)   │  │  Trails On/Off │   │
│  │  flames visible  │  │  TKA / Word    │   │
│  │  trails clear    │  │  Fire/Charcoal │   │
│  └──────────────────┘  │  Intensity 70% │   │
│                        │  Smoke     0%  │   │
│                        │  Color    Col  │   │
│                        └────────────────┘   │
├─────────────────────────────────────────────┤
│  ◉ Image Export                        [▾]  │
│  ┌──────────────────┐  ┌────────────────┐   │
│  │                  │  │  Word  StartPos│   │
│  │  BIG PREVIEW     │  │  Difficulty    │   │
│  │  (up to 500px)   │  │  Name  Notes   │   │
│  │                  │  │  Birthday      │   │
│  └──────────────────┘  │  Dark mode     │   │
│                        │  Custom notes  │   │
│                        └────────────────┘   │
└─────────────────────────────────────────────┘
```

- Each row: preview left (flex-shrink: 0, max-width: 500px), controls right (flex: 1)
- Collapse chevron [▾] in each header hides preview + controls, keeps header visible
- All sections start expanded
- Scroll to see all three

### Within each row (responsive)

- Row width >= 500px: preview left, controls right (horizontal)
- Row width < 500px: preview on top, controls below (vertical)

### Mobile (container < 700px)

No change. Keep current segment-control tab switcher (one panel at a time).

## Files Changed

- `VisibilityTab.svelte` — panels container: `flex-direction: column` on desktop (remove the row switch at 700px)
- `AnimationPanel.svelte` — horizontal layout (preview + controls side by side), add collapse toggle
- `PictographPanel.svelte` — same horizontal layout + collapse toggle
- `ImagePanel.svelte` — same horizontal layout + collapse toggle
- Preview frame: raise `max-width` from 280px to 500px

## Files NOT Changed

- Mobile layout (segment control stays)
- AnimationDesktopControls, AnimationMobileControls (control components unchanged)
- State management, handlers, observers
- Preview controller components (AnimationPreviewController, PictographPreviewController, ImagePreviewController)
