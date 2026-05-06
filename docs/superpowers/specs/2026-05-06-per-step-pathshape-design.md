# Per-Step Path Shape Overrides

**Date:** 2026-05-06  
**Depends on:** `2026-05-06-concave-hand-paths-design.md` (already implemented)

## Concept

Like musical accidentals override a key signature, per-step pathShape overrides the global path shape for individual motions. A creator sets a global default (arc/linear/concave or motion-aware), then marks specific beats with a different path — e.g., "this anti-spin beat should follow an arc instead of concave."

No glyph notation on pictographs. Path shape is a playback/animation property, not structural notation. Visible via the path lines overlay when enabled.

## Data Model

### MotionData (per-hand)

Add one optional field:

```typescript
interface MotionData {
  // ... existing fields ...
  readonly pathShape?: "arc" | "linear" | "concave";
}
```

- `undefined` = use global setting (no override)
- Per-hand, not per-step — a pro and anti motion in the same beat can have different overrides
- Serializes to JSON only when defined — zero overhead for existing sequences
- `createDefaultMotionData()` does not set it (stays undefined)

### Resolution Order

All three interpolators (2D PropInterpolator, 3D PropStateInterpolator, 3D standalone) and HandPathAnimator use the same logic:

```typescript
function resolvePathType(motionType: MotionType, motionPathShape?: "arc" | "linear" | "concave"): PathShapeType {
  // 1. Per-hand override wins
  if (motionPathShape) return motionPathShape;

  // 2. DASH always linear, STATIC always arc (unchanged)
  if (motionType === MotionType.DASH) return "linear";
  if (motionType === MotionType.STATIC) return "arc";

  // 3. Motion-aware global toggle
  const vm = getAnimationVisibilityManager();
  if (vm.getMotionAwarePaths()) {
    if (motionType === MotionType.PRO) return "arc";
    if (motionType === MotionType.ANTI) return "concave";
  }

  // 4. Global pathShape setting
  return vm.getPathShape();
}
```

Note: per-hand override even overrides DASH's forced-linear behavior. If a creator explicitly sets an override on a dash motion, they mean it.

## Step Editor UI

### PathShapeHandler.ts

New handler in `src/lib/features/create/shared/services/implementations/step-operations/`. Same immutable pattern as `TurnsHandler.ts`:

```
1. Get current StepData from state
2. Get target motion (blue or red)
3. Create updated MotionData with pathShape set (or cleared)
4. Replace step in sequence
5. Persist via setCurrentSequence()
```

Public API:
- `setPathShape(stepIndex: number, color: "blue" | "red", shape: "arc" | "linear" | "concave"): void`
- `clearPathShape(stepIndex: number, color: "blue" | "red"): void` — removes override, reverts to global
- `getPathShape(stepIndex: number, color: "blue" | "red"): "arc" | "linear" | "concave" | undefined`

### StepEditorPanel UI Addition

Below existing controls (turns, rotation, duration), add a "Path Shape" section:

```
Path Shape
┌─────┐ ┌────────┐ ┌─────────┐ ┌───────┐
│ Arc │ │ Linear │ │ Concave │ │ Reset │
└─────┘ └────────┘ └─────────┘ └───────┘
```

- One row per hand (blue section / red section), matching how turns are shown per-hand
- Active button highlighted with hand color
- "Reset" clears override → grayed out when no override is set
- When no override: all three buttons are unselected (dimmed), showing "Global: Arc" or similar hint text

## Files to Modify

| File | Change |
|------|--------|
| `MotionData.ts` | Add optional `pathShape` field + update `createDefaultMotionData()` docs |
| `PropInterpolator.ts` | Pass `motion.pathShape` to `resolvePathType()` |
| `PropStateInterpolator.ts` (class) | Same — pass override to resolve |
| `prop-state-interpolator.ts` (functions) | Same |
| `HandPathAnimator.ts` | Accept optional pathShape in path generation |
| `PathLinesOverlay.svelte` | Pass per-step pathShape to `getPathD()` |
| `PathShapeHandler.ts` | NEW — step operation handler |
| `StepEditorPanel.svelte` | Add path shape control section |
| `StepEditorCoordinator.svelte` | Wire PathShapeHandler |
| `AnimationPathCache.ts` / `AnimationPrecomputer` | Cache key includes per-step shapes |

## Serialization

`pathShape` on MotionData is optional. When serializing to JSON:
- Present only when explicitly set by creator
- `undefined` fields are stripped by `JSON.stringify` — no storage cost for unset steps
- Deserialization via `createDefaultMotionData()` treats missing field as `undefined`

## Path Lines Overlay Integration

Already built. Once interpolators read `motion.pathShape`, the overlay's `resolvePathTypeForMotion()` function will also need the per-step value. Pass it from the current step's MotionData.

## Interaction with Motion-Aware Mode

| Scenario | Result |
|----------|--------|
| Global: motion-aware ON, no per-step override | Pro→arc, Anti→concave |
| Global: motion-aware ON, step override = "linear" | That step uses linear regardless |
| Global: pathShape = "arc", step override = "concave" | That step uses concave |
| Global: pathShape = "concave", step override = undefined | Uses concave |

Per-step override always wins when defined. Global settings (including motion-aware) are the fallback.
