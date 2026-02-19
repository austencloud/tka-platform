# Visual Sequence Builder - Design Document

**Date:** 2026-02-18
**Feedback ID:** Y5nIcX2PEkePR6QIa1cW
**Status:** Approved, ready for implementation

---

## Problem

The Create module's assembler and constructor tabs require users to understand TKA notation before they can build sequences. There's no way to just *point at where you want the prop to go* and see it happen. The Visual Builder bridges that gap: click grid points, watch the prop animate, build sequences visually.

## Architecture Decision: SVG Backbone

**Chosen over animation canvas backbone.** Rationale:

The animation canvas is a Canvas2D rendering pipeline with ~20 services (trail rendering, pre-computation at 120fps, video export, frame budget monitoring, device tier detection). It's designed for continuous multi-beat playback, not interactive single-motion building.

The Visual Builder needs:
- Clickable grid points (SVG hit targets)
- Prop rendering (PropSvg, already SVG)
- Arrow rendering in resting state (ArrowSvg, already SVG)
- Grid lines (GridSvg, already SVG)

All existing rendering components are SVG. The animation canvas would require either porting ArrowSvg to Canvas2D or managing three rendering layers (Canvas2D + SVG arrows + SVG hit targets).

The only thing SVG doesn't have is arc interpolation for shift animations. That's ~30 lines of trigonometry extracted from PropInterpolator.

---

## Interaction Model

### Sequential Per-Hand Path Building

1. **Blue phase starts.** Empty grid with pulsing hit targets.
2. User clicks a grid point. Blue prop appears (scale-in animation).
3. User optionally sets orientation (default: `in`) and rotation direction (default: CW).
4. User clicks another point. Prop animates along the correct path:
   - **Adjacent point** = shift (curved arc, pro or anti based on rotation direction)
   - **Opposite point** = dash (straight line through center)
   - **Same point** = static (no movement, just rotation)
5. After animation completes, an arrow appears at the motion's position showing the completed beat.
6. Repeat for additional beats. Each beat's start = previous beat's end.
7. User clicks **"Done"** to lock blue's path.
8. **Red phase starts.** Same flow. Blue arrows remain visible but dimmed.
9. User clicks "Done" to lock red's path.
10. Both paths merge into a dual-prop sequence.

### Per-Beat Controls

Before each click (while in BUILDING state):
- **Rotation direction**: CW / CCW toggle (determines pro vs anti for shifts)
- **Turn count**: Default 0, adjustable (0, 0.5, 1, 1.5, 2, 2.5, 3)
- **Starting orientation**: in / out / clock / counter (for first placement only; subsequent beats inherit end orientation from previous beat)

### Path End Signal

Explicit **"Done with [blue/red]"** button. The user clicks it when they're finished placing beats for the current hand.

---

## Rendering Architecture

### Single SVG Surface

One `<svg viewBox="0 0 950 950">` with layered content:

```
Layer 0: Dark background rect (fill: rgba(10, 10, 18, 0.95))
Layer 1: GridSvg (grid lines/circles, existing component)
Layer 2: ArrowSvg instances (completed motions, existing component)
Layer 3: PropSvg x2 (blue + red props, existing component)
Layer 4: Hit target circles (clickable grid points, interactive)
```

All existing components from `src/lib/shared/pictograph/`. No new rendering primitives.

### Resting State = Static Pictograph

After each animation completes, the view IS a proper static pictograph:
- PropSvg at the correct grid position with correct orientation
- ArrowSvg showing the motion that was just completed
- GridSvg showing the grid

This is the "hybrid of animation canvas and static pictograph" vision. No view switching, no flicker.

### Coordinate System

Same 950x950 viewBox used everywhere in the app:
- Grid center: (475, 475)
- Grid radius: 143.1 (distance from center to hand points)
- Diamond points: N(475, 331.9), E(618.1, 475), S(475, 618.1), W(331.9, 475)
- Box points: NE(576.2, 373.8), SE(576.2, 576.2), SW(373.8, 576.2), NW(373.8, 373.8)

---

## Animation System

### SvgPropAnimator Service

Extracts interpolation math from `PropInterpolator` (compose module) into a standalone service that drives SVG element transforms via requestAnimationFrame.

```typescript
interface ISvgPropAnimator {
  animate(params: {
    element: SVGGElement;
    startPosition: GridLocation;
    endPosition: GridLocation;
    motionType: 'shift' | 'dash' | 'static';
    rotationDirection: 'cw' | 'ccw';
    turnCount: number;
    startOrientation: Orientation;
    durationMs: number;
  }): Promise<void>;  // Resolves when animation completes
}
```

### Shift Animation (Curved Arc)

For shifts between adjacent grid points:

```
angle(t) = lerp(startAngle, endAngle, easeInOut(t))
x(t) = 475 + cos(angle(t)) * 143.1
y(t) = 475 + sin(angle(t)) * 143.1
staffRotation(t) = startRotation + rotationDelta * easeInOut(t)
```

Direction of arc travel (CW vs CCW) determines pro vs anti. The rotation delta depends on turn count (0 turns = base rotation only, 1 turn = +180 degrees additional, etc).

### Dash Animation (Straight Line)

For dashes between opposite grid points:

```
x(t) = lerp(startX, endX, easeInOut(t))
y(t) = lerp(startY, endY, easeInOut(t))
staffRotation(t) = startRotation + rotationDelta * easeInOut(t)
```

Dashes travel straight through center. At 0 turns, no staff rotation occurs.

### Animation Timing

- Duration: 400ms default
- Easing: cubic ease-in-out
- `prefers-reduced-motion`: instant jump (0ms duration)
- During animation, hit targets are disabled (prevent double-clicks)

---

## State Machine

```
IDLE
  → click grid point
PLACING_FIRST (blue)
  → prop appears, orientation controls shown
  → click another point
ANIMATING
  → prop moves, targets disabled
  → animation completes
BUILDING (blue)
  → arrow appears for completed motion
  → click another point → ANIMATING
  → click "Done" → hand locked
PLACING_FIRST (red)
  → same flow as blue
  → ...
BUILDING (red)
  → click "Done" → both hands locked
COMPLETE
  → full dual-prop sequence visible
  → save / export / edit options
```

### State Shape

```typescript
interface VisualBuilderState {
  // Current phase
  phase: 'idle' | 'placing' | 'building' | 'animating' | 'complete';
  activeHand: 'blue' | 'red';

  // Per-hand paths
  bluePath: BuilderBeat[];
  redPath: BuilderBeat[];

  // Current beat being built
  currentPosition: GridLocation | null;
  currentOrientation: Orientation;

  // Controls
  rotationDirection: 'cw' | 'ccw';
  turnCount: number;

  // Derived
  readonly completedBeats: PictographData[];
  readonly isAnimating: boolean;
}

interface BuilderBeat {
  startPosition: GridLocation;
  endPosition: GridLocation;
  motionType: 'shift' | 'dash' | 'static';
  rotationDirection: 'cw' | 'ccw';
  turnCount: number;
  startOrientation: Orientation;
  endOrientation: Orientation;  // calculated from start + turns
}
```

---

## Component Structure

### Reuse As-Is

| Component | Location | Role |
|-----------|----------|------|
| `GridSvg` | `shared/pictograph/grid/components/` | Grid lines/circles |
| `PropSvg` | `shared/pictograph/prop/components/` | Staff SVG rendering |
| `ArrowSvg` | `shared/pictograph/arrow/components/` | Arrow rendering |
| `PictographPreparer` | `shared/pictograph/` | Calculates arrow positions from data |

### Modify

| Component | Change |
|-----------|--------|
| `InteractiveGrid.svelte` | Add PropSvg and ArrowSvg layers. Becomes the main SVG canvas. |
| `visual-builder-state.svelte.ts` | Rewrite from beat-interleaved to sequential per-hand. New state shape. |
| `VisualBuilderLabModule.svelte` | Add builder controls, wire up new state. |

### New Services

| Service | Interface | Purpose |
|---------|-----------|---------|
| `SvgPropAnimator` | `ISvgPropAnimator` | RAF-driven SVG animation with arc math |
| `VisualBuilderOrchestrator` | `IVisualBuilderOrchestrator` | Coordinates click → state → animation → arrow |
| `BuilderMotionDeriver` | `IBuilderMotionDeriver` | Determines motion type + parameters from two grid positions |

### New Components

| Component | Purpose |
|-----------|---------|
| `BuilderControls.svelte` | Orientation cycler + turn count + rotation direction + Done button |

### DI Registration

All new services registered in `visual-builder-container.ts` (already exists).

---

## Data Flow

```
User clicks grid point
  → VisualBuilderOrchestrator.handleClick(location)
    → BuilderMotionDeriver.deriveMotion(currentPos, clickedPos, rotationDir)
      → returns { motionType, startAngle, endAngle, ... }
    → State update: add beat to active hand's path
    → SvgPropAnimator.animate({ element, startPos, endPos, ... })
      → RAF loop updates SVG transform each frame
      → Promise resolves on completion
    → PictographPreparer.prepare(beatData)
      → returns arrow position + rotation for ArrowSvg
    → State update: phase = 'building', arrow visible
```

---

## Layout

Grid-centric design (already implemented):

```
┌──────────────────────────────────────┐
│  [Hand indicator] [Controls] [Done]  │  ← BuilderControls
├──────────────────────────────────────┤
│                                      │
│         ┌──────────────┐             │
│         │              │             │
│         │  950x950 SVG │             │
│         │   (square)   │             │
│         │              │             │
│         └──────────────┘             │
│                                      │
├──────────────────────────────────────┤
│  [Beat 1] [Beat 2] [Beat 3] ...     │  ← Completed beats strip
└──────────────────────────────────────┘
```

The SVG square fills available space while maintaining 1:1 aspect ratio. Controls are compact above, beat strip scrolls horizontally below.

---

## Future Considerations (Not in MVP)

- **Undo per-beat**: Remove last placed beat and its arrow
- **Playback**: Replay the built sequence as continuous animation
- **Export to Create module**: Convert visual builder output to standard sequence format
- **Turn count visualization**: Show rotation during animation
- **Multi-grid support**: Diamond, Box, Skewed modes (currently diamond only for MVP)
