# Spatial Lab 3D Pivot — Design Spec

## Goal

Replace the 2D SVG canvas in the Spatial Lab with the existing 3D avatar scene (Scene3D + Avatar3D + Prop3D). Camera presets provide floor/wall/wheel views. Props are draggable in 3D via raycast-to-plane constraint. The analysis engine (reach, crossing, plane split, taxonomy) stays as the data layer powering HTML overlay panels.

## Decisions

- **Scope:** A+B — Scene3D rendering + hand/prop dragging. IK body reaction (C) is the body freedom project. Frame-by-frame editor (D) is future.
- **SVG fate:** Full replacement. SVG canvas and all `canvas/*` components deleted. Services and control panels stay.
- **Drag model:** Drag the prop in 3D space, constrained to the active grid plane. Snap to nearest GridLocation on release.

## Architecture

```
SpatialLab.svelte
├── SpatialScene.svelte          (NEW — Scene3D wrapper + drag state machine)
│   └── Scene3D (cameraPreset driven by ViewSwitcher)
│       ├── Avatar3D (position origin, facingAngle from body rotation)
│       ├── Prop3D × 2 (blue/red, PropState3D from grid locations)
│       └── [Grid3D, Stage3D built into Scene3D]
├── SpatialControls.svelte       (MODIFIED — remove SVG-specific wiring)
│   ├── ViewSwitcher.svelte      (MODIFIED — maps floor/wall/wheel → "top"/"front"/"side")
│   ├── InfoPanel.svelte         (REUSE — reach %, diagnosis)
│   ├── SequenceSelector.svelte  (REUSE)
│   ├── BeatTransport.svelte     (REUSE)
│   └── VisualizationToggles.svelte (MODIFIED — grid planes, stage visibility)
└── SpatialStatusBar.svelte      (REUSE)
```

### Deleted files

All SVG canvas components:
- `components/SpatialCanvas.svelte`
- `components/canvas/PropMarker.svelte`
- `components/canvas/ArmLine.svelte`
- `components/canvas/ReachEnvelope.svelte`
- `components/canvas/CrossingIndicator.svelte`
- `components/canvas/BodyDiagram.svelte`
- `components/canvas/PlaneLines.svelte`

### Kept services (analysis engine)

- `services/body-rotation-solver.ts` — body auto-rotation from prop positions
- `services/reach-calculator.ts` — shoulder distance / reach %
- `services/crossing-detector.ts` — arm crossing detection
- `services/plane-split-detector.ts` — behind-body plane split
- `services/reachability-taxonomy.ts` — unreachable diagnosis
- `services/projection.ts` — 3D→2D projection (still used for analysis math)
- `services/demo-sequences.ts` — built-in demo sequence data

### Kept tests (all 55)

All 7 test files stay. They test pure services, no SVG dependency.

## State Changes

`SpatialLabState` evolves:

**Remove:**
- `leftProp3D` / `rightProp3D` as raw Point3D (replaced by GridLocation)
- All SVG-specific derived positions

**Add:**
- `leftLocation: GridLocation` — which grid point the blue prop is on
- `rightLocation: GridLocation` — which grid point the red prop is on  
- `activePlane: Plane` — which grid plane props live on (WALL default)
- `bluePropState: PropState3D` — derived from location + plane via `makePropState()`
- `redPropState: PropState3D` — derived same way
- `cameraPreset: "front" | "top" | "side"` — derived from viewProjection mapping

**Keep:**
- `bodyRotation`, `bodyLocked`, `mode`, `activeSequence`, `beatIndex`, `playing`, `playbackBpm`
- All visualization toggles
- All derived analysis (reach %, crossing, diagnosis)
- `viewProjection` (floor/wall/wheel) — maps to cameraPreset + activePlane

**Analysis bridge:** The analysis services expect 2D Point2D inputs. A bridge function projects the 3D prop world positions to 2D for the solvers. This is what `projection.ts` already does.

## View ↔ Camera ↔ Plane Mapping

| View (UI) | cameraPreset | Primary plane | What you see |
|-----------|-------------|---------------|-------------|
| Wall | "front" | Plane.WALL | Avatar from front, X/Y grid |
| Wheel | "side" | Plane.WHEEL | Avatar from side, Z/Y grid |
| Floor | "top" | Plane.FLOOR | Avatar from above, X/Z grid |

ViewSwitcher selection drives both `cameraPreset` and `visiblePlanes` on Scene3D.

## Drag Interaction

### State machine

```
IDLE → (click prop mesh) → DRAGGING → (release) → SNAPPING → IDLE
```

### Implementation

1. **Click detection:** Scene3D's `onMeshClick` fires when user clicks a prop. Identify which prop by mesh name or userData.
2. **Drag start:** Set `isDragging = true`, `disableOrbitControls = true`. Record which prop ("blue" | "red").
3. **Drag move:** Scene3D's `onDrag` provides ground plane intersection point. Map to nearest valid position on the active grid plane. Update prop's GridLocation in real time (or show ghost position).
4. **Drag end:** Scene3D's `onPointerUp` fires. Snap to nearest GridLocation. Set `isDragging = false`, re-enable orbit controls. Analysis engine recalculates.

### Grid snapping

Use `gridLocationToPosition3D(plane, location)` for each of the 8 cardinal/intercardinal GridLocations. On drag move, find the location whose 3D position is closest to the drag point. Highlight it. On release, commit.

## Sequence Mode in 3D

Demo sequence beats store GridLocation pairs instead of raw Point3D. When a beat fires:
1. Set `leftLocation` and `rightLocation`
2. PropState3D deriveds update automatically
3. Avatar3D re-renders with new prop positions
4. Body rotation solver runs, updates `facingAngle`
5. Analysis panels update

Beat transitions are instant (grid-point-to-grid-point). Smooth interpolation between beats is future work (ties into the animation layer system).

## Demo Sequence Data Migration

Current demo sequences use raw `Point3D`. Migrate to `GridLocation` pairs:

```typescript
interface SequenceBeat {
  left: GridLocation;
  right: GridLocation;
  plane?: Plane; // defaults to WALL
  label?: string;
}
```

The normalized Point3D values in current sequences map to grid locations:
- `{x: 1, y: 0, z: 0}` → GridLocation.EAST (on WALL)
- `{x: -1, y: 0, z: 0}` → GridLocation.WEST
- `{x: 0, y: 1, z: 0}` → GridLocation.NORTH
- `{x: 0, y: -1, z: 0}` → GridLocation.SOUTH
- etc.

## What the User Sees

### Sandbox mode
- 3D avatar on wooden stage with grid planes visible
- Two staffs (blue/red) positioned at grid points
- Click and drag a staff to move it to a different grid point
- Body auto-rotates based on prop positions
- Side panel shows reach %, crossing status, diagnosis
- ViewSwitcher orbits camera between front/top/side

### Sequence mode
- Select a demo sequence from the panel
- Play/pause with BPM control
- Beat dots scrub through positions
- Avatar's props jump between grid points per beat
- Analysis updates per beat
- Can switch camera angles during playback

## Testing Strategy

Existing 55 tests cover the analysis engine — no changes needed.

New test: `spatial-lab-3d-state.test.ts`
- PropState3D derivation from GridLocation + Plane
- Camera preset mapping from viewProjection
- Drag snap: given a 3D point, find nearest GridLocation
- Sequence beat application: GridLocation → PropState3D

## Risk: @austencloud/scene-3d Imports

Avatar3D, Prop3D, PropState3D, Plane are all from the external `@austencloud/scene-3d` package. ThreeDControlsLab already imports and uses all of these successfully, so the pattern is proven.
