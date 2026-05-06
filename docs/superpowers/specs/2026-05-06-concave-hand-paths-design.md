# Concave Hand Paths

**Date:** 2026-05-06

## Concept

Three hand path shapes for shift interpolation, forming a symmetric spectrum around the straight line:

```
concave  ←——  linear  ——→  arc
  -d           0            +d
```

- **Arc** (existing): Hand follows the grid circle. Convex outward. Matches pro-spin real-world hand path.
- **Linear** (existing): Hand cuts straight between grid points. Diamond shape.
- **Concave** (new): Hand curves inward toward center. Astroid/4-pointed-star shape. Matches anti-spin real-world hand path.

The concave path mirrors the arc path's distance from the straight line — at any interpolation point t, the concave point is exactly as far inside the straight line as the arc point is outside it.

## Math

At each interpolation step t (0→1):

```
θ(t)           = lerpAngle(startAngle, endAngle, t)
circlePoint    = (R·cos(θ), R·sin(θ))
straightPoint  = (1-t)·startXY + t·endXY
concavePoint   = 2·straightPoint - circlePoint
```

This reflection formula guarantees symmetric curvature. No tunable parameters needed.

## Motion-Aware Mode

New boolean setting `motionAwarePaths`. When enabled, overrides the base `pathShape` for shift motions:
- **PRO** → arc path (circle)
- **ANTI** → concave path (astroid)
- **FLOAT** → uses base `pathShape` setting
- **DASH** → always linear (unchanged)
- **STATIC** → no movement (unchanged)

When disabled, all shift motions use whichever `pathShape` is selected (existing behavior + concave option).

## Settings Model Changes

`AnimationVisibilitySettings`:
- `pathShape: "arc" | "linear" | "concave"` — extend existing union
- `motionAwarePaths: boolean` — new field, default `false`

`SequenceData.metadata.pathShape` — extend doc comment to include `"concave"`

## Files to Modify

| File | Change |
|------|--------|
| `animation-visibility-state.svelte.ts` | Extend `pathShape` type, add `motionAwarePaths`, getter/setter/toggle |
| `animation-visibility-migrations.ts` | Add `motionAwarePaths` default migration |
| `PropInterpolator.ts` (2D) | Add `interpolateConcaveMotion()`, update routing logic |
| `PropStateInterpolator.ts` (3D) | Add `interpolateConcavePosition()`, update routing logic |
| `HandPathAnimator.ts` | Add concave branch to `getPathPoints()` and `animate()` |
| `PathShapePanel.svelte` | Add third "Concave" button, add motion-aware toggle |
| `pill-summaries.ts` | Extend `PathShape` type |

## Path Resolution Logic

```typescript
function resolvePathType(motionType: MotionType): "arc" | "linear" | "concave" {
  if (motionType === MotionType.DASH) return "linear";
  if (motionType === MotionType.STATIC) return "arc"; // no movement anyway

  const vm = getAnimationVisibilityManager();

  if (vm.getMotionAwarePaths()) {
    if (motionType === MotionType.PRO) return "arc";
    if (motionType === MotionType.ANTI) return "concave";
    // FLOAT falls through to base setting
  }

  return vm.getPathShape();
}
```

## UI

PathShapePanel gets:
1. Three buttons in a row: Arc | Linear | Concave
2. Below: "Motion-Aware" toggle (button + toggle-indicator pattern, no checkbox)
   - When active, shows hint: "Pro → Arc · Anti → Concave"
   - Disables the 3-button row (since motion type overrides it for pro/anti)
