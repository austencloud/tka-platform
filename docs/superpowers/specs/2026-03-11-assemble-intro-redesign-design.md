# Assemble Tab Initial State Redesign

**Date:** 2026-03-11
**Status:** Approved

## Problem

The Assemble tab's initial state is confusing and visually bland on mobile:
- Giant flat black pictograph background dominates the screen
- "Tap start for blue" instruction is tiny and tucked in a corner
- Grid dot hit targets are relatively small for touch
- Turn switcher pills are cramped with minimal padding
- Overall layout feels technical, not inviting

## Design

### 1. Instruction Banner (top, centered)

Replaces the small corner badge with a full-width centered header above the grid.

- **Step label**: small, uppercase, muted — "Step 1 of 2" / "Step 2 of 2"
- **Main text**: large (20px), bold — "Tap a starting point" with a 14px glowing dot in the active hand color
- Phase text mapping:
  - `idle`: "Tap a starting point"
  - `placing`: "Tap destination"
  - `building`/`animating`: "Tap next point"
  - `done`: "Blue path set" / step label updates
  - `complete`: "Sequence complete"
- Lives outside the grid card as its own section, not overlaid

### 2. Grid Card Background

Replace flat black with a warm gradient card:

```css
background: linear-gradient(145deg, rgba(20,25,40,0.95), rgba(10,12,22,0.98));
border-radius: 20px;
border: 1.5px solid rgba(255,255,255,0.08);
box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
```

The SVG background rect fill changes from `#0a0a0f` to a matching dark gradient (via SVG linearGradient or simply a darker warm tone like `#0e1118`).

### 3. Grid Hit Targets

- Hit target radius: increase from 45 to **60 SVG units** in `GridHitTargetCalculator`
- Pulse animation: keep current keyframes, slightly increase glow intensity at peak
- Non-tappable reference dots: no change needed (these are part of GridSvg, not hit targets)

### 4. Turn Switcher Bar

Moves from floating overlay on grid to its own section below the grid card.

```css
/* Card treatment */
background: linear-gradient(145deg, rgba(20,25,40,0.9), rgba(15,18,30,0.95));
border-radius: 16px;
border: 1.5px solid rgba(255,255,255,0.08);
padding: 8px;
box-shadow: 0 4px 16px rgba(0,0,0,0.3);

/* Turn pills */
.turn-pill {
  font-size: 14px;
  min-height: 44px;
  border-radius: 10px;
  flex: 1; /* equal width distribution */
}

/* CW toggle */
.rotation-toggle {
  padding: 10px 14px;
  background: rgba(255,255,255,0.06);
  border-radius: 12px;
}

/* Gap between pills */
.turns-strip { gap: 4px; }
```

### 5. Layout Restructure

**Current:** Grid fills panel, all controls float as absolute overlays.

**Proposed:** Vertical flex stack with three sections:

```
┌──────────────────────┐
│  Instruction Header  │  flex-shrink: 0
├──────────────────────┤
│                      │
│     Grid Card        │  flex: 1
│                      │
├──────────────────────┤
│  Turn Switcher Bar   │  flex-shrink: 0
└──────────────────────┘
```

BuilderControls splits into two parts:
1. **Instruction + orientation pills** → rendered above grid in AssembleToolPanel
2. **Turn bar** → rendered below grid in AssembleToolPanel
3. **Action buttons** (undo, next:red, complete, trash) → stay as absolute overlays on the grid section

### 6. File Changes

| File | Change |
|------|--------|
| `AssembleToolPanel.svelte` | Restructure layout: instruction section, grid section, turn bar section |
| `BuilderControls.svelte` | Split into three components or accept layout mode prop |
| `InteractiveGrid.svelte` | Update grid background styling, border-radius |
| `GridHitTargetCalculator.ts` | Increase hit target radius from 45 to 60 |

### What Doesn't Change

- Action buttons (undo, next:red, complete, trash) — stay as grid overlays
- Orientation pills — still appear on placement, position TBD (either stay on grid or move to instruction area)
- Grid line rendering (GridSvg) — unchanged
- Prop animation system — unchanged
- All state management — unchanged
- Desktop layout — same vertical stack, just more breathing room
