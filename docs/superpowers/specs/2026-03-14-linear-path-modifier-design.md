# Path Shape: Arc vs Linear — Animation Layer & Choreo Card Metadata

**Date:** 2026-03-14
**Status:** Design
**Author:** Austen Cloud + Claude

---

## Problem

When a hand translates from one grid point to another, there are two geometric paths it can take:

1. **Arc path** — follows the circle equidistant from center (current default for all shifts)
2. **Linear path** — straight line from origin to destination

Both are real, observable, distinguishable motions in flow arts. A spinner going directly from North to Southeast in a straight diagonal looks different from one who arcs through NE and E to get there. This is a real distinction that trained eyes can identify.

---

## Design Decision: Performance Layer, Not Notation

After extensive discussion, path shape belongs in the **performance layer** — the same conceptual tier as prop type, grip changes, negative space, and visual effects. The pictograph captures the **what** (start, end, rotation type, turns). The **how** (path shape) is a stylistic interpretation.

| Property | Real? | Notated in pictograph? | Where it lives |
|---|---|---|---|
| Prop type | Yes | No | Performer choice / setting |
| Grip changes | Yes | No | Performer technique |
| Negative space | Yes | No | Performer technique |
| Effects (fire, LED) | Yes | No | Animation layer |
| **Path shape (arc/linear)** | **Yes** | **No** | **Animation layer + choreo card metadata** |

The pictograph is an abstraction. Two performers can interpret the same pictograph with different path shapes and both are valid.

### Why Not in the Pictograph

- Path shape doesn't change the motion type, letter, position, or turns
- Adding a glyph modifier for every shift clutters the notation for a stylistic distinction
- It parallels existing "real but not notated" properties like prop type and grip
- The pictograph arrow already implies a path, but arrows are a visual convention, not a literal trace of the hand

---

## Two Deliverables

### 1. Animation Canvas Path Shape Toggle

A setting in the animation system that controls how shift interpolation is rendered.

**Current behavior (arc):**
```typescript
const angle = lerpAngle(startAngle, endAngle, t);
x = CENTER + Math.cos(angle) * GRID_RADIUS;
y = CENTER + Math.sin(angle) * GRID_RADIUS;
```

**Linear behavior:**
```typescript
const startX = CENTER + Math.cos(startAngle) * GRID_RADIUS;
const startY = CENTER + Math.sin(startAngle) * GRID_RADIUS;
const endX = CENTER + Math.cos(endAngle) * GRID_RADIUS;
const endY = CENTER + Math.sin(endAngle) * GRID_RADIUS;
x = startX + (endX - startX) * t;
y = startY + (endY - startY) * t;
```

**Scope:** This is an animation setting, not a motion data property. The same sequence data renders differently based on the toggle.

**Granularity options:**
- **Global toggle** — all shifts in the sequence render arc or linear
- **Per-beat toggle** — each beat can independently specify path shape
- **Per-hand toggle** — each hand in each beat can have its own path shape

Start with global toggle. Per-beat and per-hand can come later if needed.

### 2. Choreo Card Metadata

Each saved sequence (choreo card) carries a bag of stylistic metadata that describes how the creator intended it to be performed. Path shape is one property in this bag.

```typescript
interface ChoreoCardMetadata {
  // Path shape
  pathShape?: PathShapeConfig;

  // Other stylistic properties (future)
  propAssignments?: PropAssignment[];
  effects?: EffectConfig[];
  // ... extensible
}

type PathShapeConfig =
  | { mode: "global"; shape: "arc" | "linear" }
  | { mode: "per-beat"; beats: Record<number, BeatPathShape> };

interface BeatPathShape {
  left?: "arc" | "linear";  // per-hand from day one
  right?: "arc" | "linear";
}
```

**Note:** Per-hand independence is supported from the start. The global mode is a convenience — it's equivalent to setting every hand in every beat to the same value.

**Storage:** This metadata lives alongside the sequence data in the choreo card, not inside the motion data itself. The motion data (letters, positions, turns) stays pure and unchanged.

**Default:** When no metadata is present, all shifts render as arc (current behavior). Zero migration needed.

---

## Choreo Card Info Section

At the bottom of each choreo card, a metadata section shows how the creator intended the sequence to be performed:

- Path shape preference (arc, linear, or mixed)
- Prop assignments (left hand club, right hand triad, etc.)
- Applied effects (fire on left hand, LED trail, etc.)

Each saved representation is unique while the underlying notation data stays the same. Two people can save the same ABBD sequence — one with arc shifts on double staves, another with linear shifts on fans with fire effects — and both are valid interpretations displayed with their own metadata.

This section is **informational, not notational**. It describes the creator's intent without changing what the pictographs show.

---

## Terminology

| Term | Symbol | Meaning |
|------|--------|---------|
| **Arc** | ⌒ | Hand follows the circular perimeter between points |
| **Linear** | — | Hand travels in a straight line between points |

These terms appear in settings UI and choreo card metadata. They do not appear in pictographs.

---

## Animation Implementation

### Where to Branch

The interpolation logic checks the path shape setting at render time:

```typescript
type PathShape = "arc" | "linear";

// In the interpolator, not in motion data
function interpolatePosition(
  startAngle: number,
  endAngle: number,
  t: number,
  pathShape: PathShape
): { x: number; y: number } {
  if (pathShape === "linear") {
    const startX = CENTER + Math.cos(startAngle) * GRID_RADIUS;
    const startY = CENTER + Math.sin(startAngle) * GRID_RADIUS;
    const endX = CENTER + Math.cos(endAngle) * GRID_RADIUS;
    const endY = CENTER + Math.sin(endAngle) * GRID_RADIUS;
    return {
      x: startX + (endX - startX) * t,
      y: startY + (endY - startY) * t,
    };
  }
  // Default: arc
  const angle = lerpAngle(startAngle, endAngle, t);
  return {
    x: CENTER + Math.cos(angle) * GRID_RADIUS,
    y: CENTER + Math.sin(angle) * GRID_RADIUS,
  };
}
```

### Key Files

- `HandPathAnimator.ts` — hand path preview animation
- `PropInterpolator.ts` — main canvas animation interpolation

### What Stays the Same

- Motion data model — no changes
- Arrow rendering — unchanged
- Pictograph glyphs — unchanged
- Letter classification — unchanged
- All existing sequences — render identically

---

## Relationship to the Chu Dilemma

The Chu dilemma (skew++ float, documented in `hand-path-modifiers` domain topic) involves a hand traveling from one perimeter point to a distant point via an extended arc. The arc/linear distinction was initially explored as a possible solution to the Chu classification problem.

**Conclusion:** Arc vs linear does NOT solve the Chu dilemma. The Chu involves path *length* (how far around the arc), which is already handled by the skew modifier system (+/-/++). Arc vs linear is about path *shape* (curved vs straight), which is orthogonal.

The Chu remains expressible as a skew++ float shift within the existing framework. The arc/linear toggle is a separate, independent feature that enriches the animation layer without touching the classification system.

---

## Scope & Phases

### Phase 1: Animation Toggle
- Add path shape setting to animation system
- Implement linear interpolation branch in `PropInterpolator` and `HandPathAnimator`
- Global toggle (all shifts arc or all linear)
- Verify existing sequences render identically with default (arc)

### Phase 2: Choreo Card Metadata
- Define metadata schema alongside sequence data
- Save/load path shape preference per choreo card
- Display in choreo card info section
- Per-beat granularity if needed

### Phase 3: Choreo Card Info Section UI
- Design the metadata display at bottom of choreo cards
- Show path shape, prop assignments, effects
- Read-only for browsing, editable for owned sequences

---

## Resolved Questions

1. **Per-hand independence** — YES. One hand can arc while the other goes linear in the same beat. Spinners will adopt this once they see it animated and shared. Support per-hand path shape from the start.

2. **Compose module exposure** — YES. Path shape toggle lives alongside effects/efforts in the animation settings layer. Accessible via right-click canvas context menu. Per-hand boolean toggle (arc/linear).

3. **Arc dashes** — KILLED. Stress-tested renaming "shift" to "arc" which revealed the core problem: if the family name becomes "arc," then "linear arc" is an oxymoron. This proves "arc" and "linear" are path shape descriptors, not family names. "Shift" is the family (hand changes grid position). "Dash" is the other family (straight line through/to center). An "arc dash" would need shift physics (pro/anti), making it just a shift. The families are defined by their geometry — you can't swap it without changing what the motion fundamentally is.

4. **Naming** — RESOLVED. "Shift" stays as the motion family name (path-shape-agnostic). "Arc" and "linear" are the two path shapes. A "linear shift" is a shift where the hand travels a straight line. Clean three-layer naming: family (shift/dash/static) × path shape (arc/linear) × rotation (pro/anti/float/CW/CCW).

## Open Questions

1. **Interaction with skews** — a linear skew+ (straight line from S to NE) covers different ground than an arc skew+ (S arcing through SW, W, NW, N to NE). Does the path shape change the meaning of the skew modifier?
2. **Choreo card metadata schema** — exact shape of the metadata bag, how it relates to existing sequence data structures, and where it persists (alongside sequence in Firestore? separate subcollection?)
3. **Info section UI** — what does the bottom-of-choreo-card metadata display look like? How much space does it get? Is it collapsible?
