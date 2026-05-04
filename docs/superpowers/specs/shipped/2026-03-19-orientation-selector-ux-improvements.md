---
status: shipped
value: 2
effort: S
remaining: ""
depends_on: ""
plan_path: plans/backlog/2026-03-19-orientation-selector-ux.md
tags: []
last_triaged: 2026-05-04
---
# Orientation Selector UX Improvements

**Date:** 2026-03-19
**Status:** Draft
**Context:** User testing revealed the orientation selector labels (CW/CCW) are confusing to users unfamiliar with TKA. The selector also has a positioning bug after recent refactoring.

---

## Problem

1. **Labels "CW"/"CCW" are misleading.** In TKA, "CW/CCW" means *moving* in that direction. Orientation is about *facing* a direction. The correct terms are "clock"/"counter". The enum values already use these — only the display labels are wrong.

2. **Selector positioning is broken on mobile.** After a recent refactor moving the trigger to `.top-left-control`, the popover calculates its `top` from `getBoundingClientRect()` but appears detached from its trigger. It should emerge naturally from the top-left control area.

3. **Orientation is a foreign concept.** Users who don't know what orientation means have no way to learn from the UI itself. The prop already animates when orientation changes, but there's no visual cue connecting "I tapped a button" to "the prop now faces this direction."

---

## Changes

### 1. Fix labels: "CW" → "clock", "CCW" → "counter"

Two files define the `ORIENTATIONS` array with display labels:

- `BuilderControls.svelte` lines 46-51
- `BuilderTurnBar.svelte` lines 48-53

Change:
| Old label | New label | Old ariaLabel | New ariaLabel |
|-----------|-----------|---------------|---------------|
| `In` | `in` | `In orientation` | `in orientation` |
| `Out` | `out` | `Out orientation` | `out orientation` |
| `CW` | `clock` | `Clockwise orientation` | `clock orientation` |
| `CCW` | `counter` | `Counter-clockwise orientation` | `counter orientation` |

All lowercase per project convention.

### 2. Fix popover positioning

The orientation popover should visually emerge from the top-left trigger button, not float disconnected.

**Current bug:** `getPopoverTop()` uses `triggerRef.getBoundingClientRect().bottom + 8px` with `position: fixed`. The calculation works in principle but the popover's horizontal centering (`left: 8px; right: 8px; margin: 0 auto`) pushes it to screen center instead of anchoring it near the trigger.

**Fix:** Anchor the popover below and aligned-left with the trigger button:
- `top`: `rect.bottom + 8px` (keep existing vertical calc)
- `left`: `rect.left` (align with trigger's left edge)
- Remove `right: 8px` and `margin: 0 auto` centering
- Keep `width: fit-content` so it sizes to its pill content

### 3. Transient directional arrow on orientation change

When the user changes orientation, a glowing arrow appears overlaid on or near the prop, pointing in the direction the prop now faces. It pulses once, then fades out.

**Behavior:**
- Appears only when `currentPosition` is non-null and the user explicitly changes orientation. No arrow on initial placement or when orientation changes before a prop is placed.
- Each orientation change cancels any in-progress arrow animation and restarts the sequence with the new direction.
- The orientation selector is interaction-locked during the `animating` phase, so arrow + animation conflicts cannot occur.
- Arrow direction is computed from the grid point's angle relative to center. `LOCATION_ANGLES` defines the center-to-point angle `theta` (E=0, S=90, W=180, N=270). Since the arrow points in the direction the prop *faces*:
  - `in`: arrow rotated to `theta + 180` (points toward center, opposite of center-to-point)
  - `out`: arrow rotated to `theta` (points away from center, same as center-to-point)
  - `clock`: arrow rotated to `theta + 90` (perpendicular CW tangent)
  - `counter`: arrow rotated to `theta - 90` (perpendicular CCW tangent)
- This formula works uniformly for all 8 cardinal and intercardinal positions.
- Animation: fade in (100ms) → hold + pulse glow (600ms) → fade out (300ms). Total ~1s.
- Styling: semi-transparent, glowing (CSS `filter: drop-shadow` with accent color), overlaid on the prop SVG group
- Respects `prefers-reduced-motion`: skip pulse, just show/hide

**Implementation:**
- Add an SVG `<path>` arrow element inside the active prop's `<g>` group in InteractiveGrid.svelte
- Rotate the arrow based on orientation + grid position angle using the formula above
- Toggle visibility via a reactive `showArrow` state that auto-clears after ~1s timeout. New changes reset the timeout.
- The arrow is purely decorative — no interaction, `pointer-events: none`

### 4. Help button → slide-up explainer panel

A small "?" button appears inside the orientation selector (both mobile popover and desktop turn bar). Tapping it opens a slide-up panel that explains orientation as a concept.

**Trigger:**
- Small circle button with "?" icon, positioned at the right end of the orientation pill row
- Same styling as other builder controls (theme-aware)

**Panel content:**
- Title: "Orientation"
- Brief explanation: what orientation means for a prop at a grid point (which direction the prop faces relative to the grid center)
- Interactive demo: a prop at the south grid point with four buttons (in/out/clock/counter). Tapping each rotates the prop and shows the directional arrow, so the user sees the concept in action before returning to the builder. South is chosen because the arrow directions are visually intuitive (in = up, out = down, clock = left, counter = right).
- "Got it" button to dismiss

**Panel behavior:**
- Slide-up from bottom (reuse existing Drawer component patterns)
- Covers the grid but not the full screen — ~60% height
- Dismissible via "Got it" button, backdrop tap, or swipe down
- Does not affect builder state. The demo uses component-local `$state` variables for orientation and arrow visibility. It does NOT access the builder's `AssembleState` context.

**Note on rotation labels:** The `rotLabel` for rotation direction in BuilderTurnBar retains "CW"/"CCW" — these labels are correct for rotation (actual movement direction), unlike orientation.

---

## Out of Scope

- **Swipe-to-orient gesture:** Rejected. The directional mapping changes per grid point, collides with tap gestures, and has zero discoverability. The arrow + help panel solve the comprehension problem without adding gesture complexity.
- **Drag-between-positions:** The tap model was chosen deliberately for precision on small screens. Not revisiting here.
- **Full app tutorial/guide:** Valid need, separate project.

---

## Files Affected

| File | Change |
|------|--------|
| `src/lib/features/assemble-lab/components/BuilderControls.svelte` | Label fix, popover positioning fix, add "?" button |
| `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte` | Label fix, add "?" button |
| `src/lib/features/assemble-lab/components/InteractiveGrid.svelte` | Add arrow SVG overlay, arrow animation logic |
| `src/lib/features/assemble-lab/components/OrientationExplainer.svelte` | **New.** Slide-up help panel with interactive demo |
| `src/lib/features/assemble-lab/state/assemble-state.svelte.ts` | Add `showOrientationArrow` transient state |
