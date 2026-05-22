# Fish Mouse Scatter -- Design Spec

**Date:** 2026-05-22
**Status:** Draft
**Depends on:** Fish swimming (the GPGPU boids system must be producing movement for scatter to be visible)

---

## Problem

The ocean scene has a GPGPU fish school with full boids simulation, predator/prey state machines, and scatter infrastructure (`uScatterOrigin`, `uScatterRadius`, `uScatterForce`). The scatter uniforms exist but `rayPosition` is never wired to the mouse -- it defaults to `Vector3(0,0,0)` and nothing updates it. Fish should flee the mouse cursor like real fish reacting to a shadow, then reform after the cursor moves away.

## Current State of the Code

### What exists

1. **FishSchool.svelte** accepts a `rayPosition: Vector3` prop (line 42), defaulting to `(0,0,0)`.
2. **FishEventSystem.ts** copies `rayPosition` into `uScatterOrigin` every tick (line 66).
3. **Velocity shader** (`fish-shaders.ts`, lines 256-261) already has scatter logic:
   ```glsl
   float distToRay = distance(pos, uScatterOrigin);
   if (distToRay < uScatterRadius && uScatterForce > 0.0) {
     vec3 away = normalize(pos - uScatterOrigin + vec3(0.001));
     float proximity = 1.0 - distToRay / uScatterRadius;
     steer += away * uScatterForce * proximity * proximity;
   }
   ```
4. **Behavior shader** (`fish-behavior-shader.ts`, lines 48-55) triggers flee state when fish are within `uScatterRadius` of `uScatterOrigin`.
5. **OceanScene.svelte** passes `scatterRadius` from config but does NOT pass `rayPosition` to FishSchool (line 1130-1141).
6. **ManualRaycaster.svelte** exists in `src/lib/shared/3d/components/` and handles pointer events + ground-plane raycasting for the scene composer. It is instantiated by `Scene3D.svelte`.

### What is missing

- No component converts mouse screen position to a world-space point in the ocean scene.
- `OceanScene.svelte` does not bind `rayPosition` on the `<FishSchool>` element.
- No invisible raycast target plane exists at swim height for the mouse ray to hit.
- No reform/cooldown behavior -- the scatter force is binary (present or absent). Fish scatter identically regardless of boldness (the trait exists in `tTraits` but `uScatterForce` is uniform).
- No config surface for scatter tuning in `OceanSceneConfig`.

## Design

### 1. Mouse-to-World Raycasting

**Approach:** Raycast from the camera through the mouse pointer onto a virtual horizontal plane at the fish school's midpoint swim height. This plane is invisible and exists only for the ray intersection math. No DOM elements, no visible geometry.

**Why a horizontal plane, not the seabed:** Fish swim at `swimHeight[0]` to `swimHeight[1]` (default 2-7m above ground). Raycasting to the seabed would place the scatter origin below the fish, weakening the XZ repulsion. A plane at midpoint height (`(swimHeight[0] + swimHeight[1]) / 2 + groundY`) intersects where the fish actually are.

**Implementation:** Create a new component `OceanMouseRaycast.svelte` in `src/lib/shared/3d/environments/scenes/ocean/`. It:
- Uses `useThrelte()` to get `camera`, `renderer`.
- Listens to `pointermove` on the canvas.
- Converts screen coords to NDC, creates a `Raycaster`, intersects with a `THREE.Plane`.
- Writes the hit point to a reactive `Vector3` prop (or a bound state variable).
- When the mouse leaves the canvas, resets to a sentinel value `(0, -999, 0)` to signal "no scatter."

```typescript
// Pseudocode
const swimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(groundY + midSwimHeight));

function onPointerMove(event: PointerEvent) {
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(swimPlane, hitPoint)) {
    mouseWorldPos.copy(hitPoint);
  }
}
```

**Why not reuse ManualRaycaster:** ManualRaycaster is designed for object picking (click-to-select performers, drag-to-move). Its `onDrag` callback provides ground-plane coordinates, but: (a) it only fires during active drag, not passive hover; (b) its ground plane is at y=0, not swim height; (c) coupling ocean scatter to the composer's drag system would create unwanted dependencies. A dedicated 40-line component is cleaner.

### 2. Wiring the Scatter Origin

**OceanScene.svelte** changes:
- Import and instantiate `<OceanMouseRaycast>` inside the fish-enabled block.
- Declare a `let fishScatterTarget = $state(new Vector3(0, -999, 0))`.
- Pass it to both `<OceanMouseRaycast bind:worldPosition={fishScatterTarget}>` and `<FishSchool rayPosition={fishScatterTarget}>`.

The `<FishSchool>` component already accepts `rayPosition` and feeds it through `FishEventSystem.tick()` into `uScatterOrigin`. No changes needed to FishSchool or FishEventSystem.

### 3. Scatter Algorithm Improvements

The existing shader scatter is functional but crude. Three changes make it feel natural:

#### 3a. Boldness-Modulated Scatter Radius

Currently `uScatterRadius` is uniform for all fish. Fish with high boldness (trait stored in `tTraits.b`) should scatter less.

**Velocity shader change** (replace lines 256-261):
```glsl
float distToRay = distance(pos, uScatterOrigin);
float boldScatter = uScatterRadius * (1.3 - boldness * 0.6); // bold fish: smaller flee zone
if (distToRay < boldScatter && uScatterForce > 0.0 && uScatterOrigin.y > -900.0) {
  vec3 away = normalize(pos - uScatterOrigin + vec3(0.001));
  float proximity = 1.0 - distToRay / boldScatter;
  steer += away * uScatterForce * proximity * proximity * (1.5 - boldness);
}
```

The `uScatterOrigin.y > -900.0` guard prevents scatter when the mouse is off-canvas (sentinel at y=-999).

#### 3b. Behavior Shader -- Same Guard

**Behavior shader change** (lines 48-55):
```glsl
float rayDist = distance(pos, uScatterOrigin);
if (rayDist < uScatterRadius && uScatterOrigin.y > -900.0 && myTrophic != 0 && myTrophic != 5) {
  // ... existing flee state trigger
}
```

#### 3c. Reform Behavior

Reform is already implicit: when the mouse moves away (or leaves the canvas), `uScatterOrigin` moves to `(0, -999, 0)`, the distance check fails, scatter force drops to zero, and the school-center pull (`uSchoolCenters` homing at line 226-232) draws fish back. The existing `uSchoolRadius` of 6.0 and cohesion forces handle regrouping.

No explicit "reform delay" timer is needed -- the boids cohesion + school-center pull produces a natural 2-4 second regathering that looks organic. Adding an artificial delay would fight the physics.

### 4. Config Interface Additions

Add scatter tuning fields to the existing `fish` block in `OceanSceneConfig`:

```typescript
// In scene-configs.ts, inside OceanSceneConfig.fish
fish: {
  // ... existing fields ...
  scatterRadius: number;      // already exists
  scatterForce: number;       // NEW -- strength of flee impulse (default 3.0)
  scatterEnabled: boolean;    // NEW -- master toggle for mouse scatter
  perceptionAngle: number;    // already exists
};
```

**Default values** (in `createDefaultOceanAbyssConfig`):
```typescript
fish: {
  // ... existing ...
  scatterRadius: 4.0,    // existing
  scatterForce: 3.0,     // new
  scatterEnabled: true,   // new
}
```

The `scatterForce` uniform already exists in the velocity shader (`uScatterForce`, line 340 of FishSchool.svelte) at a hardcoded value of `3.0`. Change it to read from `activeConfig.fish.scatterForce` and pass through as a FishSchool prop.

### 5. File Change Summary

| File | Change |
|------|--------|
| `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte` | **NEW** -- ~40 lines. Pointer-to-world raycast against swim-height plane. |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Import OceanMouseRaycast, add `fishScatterTarget` state, wire to FishSchool's `rayPosition` prop. ~8 lines changed. |
| `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` | Velocity shader: add boldness modulation to scatter, add sentinel guard. ~6 lines changed. |
| `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts` | State shader: add sentinel guard to scatter-origin check. ~1 line changed. |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `scatterForce` and `scatterEnabled` to `OceanSceneConfig.fish` interface + defaults. ~4 lines changed. |
| `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` | Accept `scatterForce` prop, use it instead of hardcoded `3.0`. ~3 lines changed. |

### 6. Performance Considerations

- **Raycast cost:** One `ray.intersectPlane()` per pointermove event. This is a single dot product + division -- effectively zero cost compared to the GPGPU boids compute pass.
- **No new GPU work:** The scatter logic already runs in the velocity shader every frame. Wiring a real position instead of `(0,0,0)` costs nothing extra.
- **Pointermove throttling:** Not needed. The raycast is trivial and the uniform update happens once per frame in `useTask` regardless of how many pointermove events fire.

### 7. Edge Cases

- **Mouse outside canvas:** `pointerleave` event resets `mouseWorldPos` to `(0, -999, 0)`. The `y > -900` sentinel guard prevents phantom scatter at the origin.
- **Camera directly above (looking straight down):** The swim-height plane is horizontal, so the ray always intersects at a sensible XZ position. No degenerate angle.
- **Camera at extreme oblique angles:** The ray may intersect the plane very far from the viewport center. This is fine -- fish that far away are in fog and the scatter has no visible effect.
- **Multiple Threlte instances:** OceanMouseRaycast binds to its own renderer's canvas via `useThrelte()`, same pattern as ManualRaycaster. No cross-instance conflicts.
- **Touch devices:** `pointermove` fires for touch too. Scatter on touch-drag is a nice side effect. Touch-end triggers `pointerleave` equivalent to reset.

### 8. Future Extensions (Out of Scope)

- **Scatter ripple:** A visual shockwave ring expanding from the scatter point. Requires a separate shader effect.
- **Predator cursor modes:** Different scatter behaviors for click (sharp burst) vs hover (gentle push). The current design treats all pointer presence equally.
- **Per-species scatter sensitivity:** Currently boldness modulates scatter per-fish. Per-species overrides (e.g., cleaner wrasse ignores cursor) would need a species-indexed uniform array.
