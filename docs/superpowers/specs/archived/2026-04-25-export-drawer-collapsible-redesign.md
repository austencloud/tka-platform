# Export Drawer: Collapsible Stack Redesign

**Date:** 2026-04-25
**Status:** In progress

## Problem

The 5-pill horizontal nav (Effects / Effort / Playback / Display / Export) at 380px sidebar width = ~70px per pill. Labels get hidden, density is poor, vertical space underutilized. Effort and Display pills have sparse content that doesn't justify dedicated pills.

## Decision

Replace the pill navigation system with a vertically-stacked collapsible sections pattern, matching the existing `Animation3DSidePanel` pattern in the codebase.

## Architecture

### Desktop (layout="sidebar")

Scrollable column of collapsible sections. Effects expanded by default, others collapsed showing summary badges. Download button pinned in footer.

**Section order:**
1. **Effects** — expanded by default. Full EffectsPanel (15-chip grid + presets + customize + layer toggle)
2. **Effort** — collapsed. Badge: current effort name. Body: EffortPanel (4x2 grid)
3. **Playback** — collapsed. Badge: "60 BPM · Cont." Body: TempoControl + PlaybackModeToggle
4. **Display** — collapsed. Badge: "5/7 visible · arc". Body: DisplayPanel + PathShapePanel
5. **Export** — collapsed. Badge: "1080p · 60fps · 3×". Body: FPS/Resolution/Quality/Timing/Loops controls

### Mobile (layout="bottom")

Same collapsible stack rendered inside a single RailBentoSheet. One trigger button ("Settings" gear icon) opens the sheet. Close sheet → back to canvas + download button. Eliminates the cramped 5-pill row entirely.

### Section header anatomy

```
[icon]  LABEL                    badge text  [chevron]
```

- `<button>` with `aria-expanded`
- Icon: Font Awesome (`fa-sparkles`, `fa-gauge`, `fa-play`, `fa-eye`, `fa-sliders`)
- Label: uppercase, 11px, semi-bold
- Badge: dim text, current state summary (reuses pill-summaries.ts pure functions)
- Chevron: `fa-chevron-down`, rotated when collapsed

### Multi-open behavior

Multiple sections can be open simultaneously. Sidebar scrolls to accommodate. No accordion constraint — users need Effects + Export open together.

## What's killed

- `DownloadPillNav.svelte`
- `PillBody.svelte`
- `pill-types.ts`
- `pill-nav.css`

## What's kept

- `pill-summaries.ts` — pure functions repurposed for collapsed section badges
- All a11y patterns: `aria-expanded`, keyboard nav, `prefers-reduced-motion`, focus management
- All existing sub-panels: EffectsPanel, MobileEffectsPanel, EffortPanel, DisplayPanel, PathShapePanel
- AnimationVisibilityManager observer pattern
- RailBentoSheet for mobile
- Export button + progress bar + cancel flow

## Responsive strategy

- iPhone SE (375px): full-width sections in bottom sheet, touch-friendly 44px min headers
- Standard mobile: same
- Tablet: depends on layout prop — could be sidebar or bottom
- Desktop 380px sidebar: scrollable stack, all sections visible
- 4K+: same 380px sidebar (parent constrains width), content scales via relative units

## A11y

- Section headers: `<button aria-expanded="true|false">`
- Keyboard: Enter/Space toggles section. Arrow keys navigate between section headers.
- Focus management: opening a section does NOT move focus (user stays on header). Mobile sheet: focus trap + return-focus-to on close.
- Screen reader: `aria-live="polite"` announcer for section state changes
- `prefers-reduced-motion`: skip expand/collapse animations
- `prefers-contrast: more`: thicker borders, higher contrast badges
