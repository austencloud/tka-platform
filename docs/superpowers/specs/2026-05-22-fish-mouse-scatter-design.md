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
- Scatter is purely radial -- all fish flee outward like a force field bubble. Real schools exhibit fountain effects (lateral splitting) and wave propagation (delayed onset by distance).

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

The existing shader scatter is functional but crude. Five changes make it feel natural:

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

#### 3b. Fountain Effect (Replaces Pure Radial Repulsion)

**Problem with pure radial scatter:** The existing `away` vector pushes all fish outward from the scatter origin. This looks like a force field bubble -- every fish moves directly away, producing a symmetric expanding ring. Real fish schools do not behave this way.

**What real fish do:** Fish approaching the threat head-on split into two lateral streams that curve around the predator and rejoin behind it (the "fountain effect"). Fish caught broadside still flash outward radially. The result is a teardrop-shaped parting that looks alive, not a spherical explosion that looks computed.

**References:** Podila et al., Information Visualization 2020; Boids-based escape maneuvers, SIGGRAPH i3D 2017 "Animating Escape Maneuvers for Fish Schools." Both ABZU and Subnautica implement variants of this.

**Implementation:** After computing the radial `away` vector, compute a tangential component via cross product with the up axis. Blend between tangential (fountain) and radial (flash expansion) based on the fish's approach angle relative to the scatter origin.

```glsl
// Inside the scatter block, after computing `away`:
vec3 tangent = normalize(cross(away, vec3(0.0, 1.0, 0.0)));

// dotFwd: how head-on is this fish relative to the scatter origin?
// fish velocity direction vs. away direction
vec3 fishDir = normalize(vel.xyz + vec3(0.001));
float dotFwd = abs(dot(fishDir, away)); // 1.0 = head-on, 0.0 = broadside

// Head-on fish get more tangential (fountain split), broadside get more radial (flash)
float tangentWeight = smoothstep(0.3, 0.8, dotFwd) * 0.6; // max 60% tangential
vec3 fleeDir = normalize(mix(away, tangent, tangentWeight));

steer += fleeDir * uScatterForce * proximity * proximity * (1.5 - boldness);
```

This adds 4 GLSL lines to the velocity shader. The `smoothstep` ramp prevents discontinuous switching between fountain and flash modes. The 0.6 cap ensures radial force always dominates -- the tangential component steers fish around the threat rather than replacing the flee impulse entirely.

**Visual result:** Instead of a symmetric expanding ring, fish approaching the cursor split left and right, curve around, and rejoin behind. Fish caught from the side still flash outward. The combined effect looks like a school parting around a predator -- the ABZU aesthetic.

#### 3c. Trafalgar Wave Propagation (Replaces Instant Scatter)

**Problem with instant scatter:** The current shader applies scatter force to all fish within `uScatterRadius` simultaneously. Every fish within range reacts in the same frame. Real fish schools exhibit the "Trafalgar effect" -- a wave of agitation that propagates outward from the threat faster than individual swim speed but is NOT instantaneous.

**Reference:** Marras et al., PLOS ONE "Schooling of Light Reflecting Fish" (Trafalgar effect). Both ABZU and Subnautica use delayed reaction based on distance to create visible cascading panic through the school.

**Implementation:** Add a time-based delay to scatter onset proportional to distance from the scatter origin. Fish closest to the cursor react first; the reaction wave ripples outward through the school.

```glsl
// New uniform required:
uniform float uScatterStartTime; // set when mouse enters scatter radius (or on pointermove)

// In the scatter block, before applying force:
float delay = distToRay * 0.15; // 0.15s per unit distance -- tunable
float timeSinceScatter = uTime - uScatterStartTime;
float waveReached = step(delay, timeSinceScatter); // 0.0 until wave arrives, 1.0 after
```

Then multiply the final steer contribution by `waveReached`:

```glsl
steer += fleeDir * uScatterForce * proximity * proximity * (1.5 - boldness) * waveReached;
```

**OceanMouseRaycast.svelte** sets `uScatterStartTime = clock.elapsedTime` whenever the scatter origin moves by more than a threshold distance (e.g., 0.5 units) from its previous position. This means:
- Mouse entering the school: wave propagates outward from entry point.
- Mouse sweeping through the school: wave continuously resets at the leading edge, creating a wake-like cascade.
- Mouse stationary inside the school: all fish eventually reached, no ongoing pulsing.

**Cost:** One new uniform (`uScatterStartTime`), one subtraction + one multiply + one `step()` in the velocity shader. Negligible.

**Visual result:** Instead of a "force field pop" where all fish react simultaneously, a visible cascade of panic ripples outward from the cursor. Fish near the cursor scatter first; fish at the edge of the radius react 0.3-0.6 seconds later. The transformation from "computed repulsion" to "biological panic wave" is significant and cheap.

#### 3d. Behavior Shader -- Same Guard

**Behavior shader change** (lines 48-55):
```glsl
float rayDist = distance(pos, uScatterOrigin);
if (rayDist < uScatterRadius && uScatterOrigin.y > -900.0 && myTrophic != 0 && myTrophic != 5) {
  // ... existing flee state trigger
}
```

#### 3e. Reform Behavior

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
  scatterWaveSpeed: number;   // NEW -- Trafalgar wave propagation (seconds per unit distance, default 0.15)
  perceptionAngle: number;    // already exists
};
```

**Default values** (in `createDefaultOceanAbyssConfig`):
```typescript
fish: {
  // ... existing ...
  scatterRadius: 4.0,       // existing
  scatterForce: 3.0,        // new
  scatterEnabled: true,     // new
  scatterWaveSpeed: 0.15,   // new -- Trafalgar delay factor
}
```

The `scatterForce` uniform already exists in the velocity shader (`uScatterForce`, line 340 of FishSchool.svelte) at a hardcoded value of `3.0`. Change it to read from `activeConfig.fish.scatterForce` and pass through as a FishSchool prop.

### 5. File Change Summary

| File | Change |
|------|--------|
| `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte` | **NEW** -- ~50 lines. Pointer-to-world raycast against swim-height plane. Tracks scatter start time for wave propagation. |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Import OceanMouseRaycast, add `fishScatterTarget` state, wire to FishSchool's `rayPosition` prop. ~10 lines changed. |
| `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` | Velocity shader: add boldness modulation, fountain effect (tangential split), Trafalgar wave delay, sentinel guard. ~18 lines changed. |
| `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts` | State shader: add sentinel guard to scatter-origin check. ~1 line changed. |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `scatterForce`, `scatterEnabled`, `scatterWaveSpeed` to `OceanSceneConfig.fish` interface + defaults. ~6 lines changed. |
| `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` | Accept `scatterForce` prop and `scatterStartTime` uniform, use instead of hardcoded values. ~5 lines changed. |

### 6. Performance Considerations

- **Raycast cost:** One `ray.intersectPlane()` per pointermove event. This is a single dot product + division -- effectively zero cost compared to the GPGPU boids compute pass.
- **No new GPU work:** The scatter logic already runs in the velocity shader every frame. The fountain cross product, smoothstep, and wave step() add ~6 ALU ops per fish per frame -- invisible against the existing boids compute cost.
- **Pointermove throttling:** Not needed. The raycast is trivial and the uniform update happens once per frame in `useTask` regardless of how many pointermove events fire.
- **New uniforms:** One additional uniform (`uScatterStartTime`) -- single float, zero bandwidth impact.

### 7. Edge Cases

- **Mouse outside canvas:** `pointerleave` event resets `mouseWorldPos` to `(0, -999, 0)`. The `y > -900` sentinel guard prevents phantom scatter at the origin.
- **Camera directly above (looking straight down):** The swim-height plane is horizontal, so the ray always intersects at a sensible XZ position. No degenerate angle.
- **Camera at extreme oblique angles:** The ray may intersect the plane very far from the viewport center. This is fine -- fish that far away are in fog and the scatter has no visible effect.
- **Multiple Threlte instances:** OceanMouseRaycast binds to its own renderer's canvas via `useThrelte()`, same pattern as ManualRaycaster. No cross-instance conflicts.
- **Touch devices:** `pointermove` fires for touch too. Scatter on touch-drag is a nice side effect. Touch-end triggers `pointerleave` equivalent to reset.
- **Wave propagation during fast mouse sweep:** `uScatterStartTime` resets when the cursor moves >0.5 units, so the wave continuously re-originates at the leading edge. No stale-wave artifacts.

### 8. Nice-to-Have Extensions (Document Only -- Not Required for V1)

#### 8a. School Splitting

During scatter, temporarily offset `uSchoolCenters[speciesIdx]` to two points flanking the scatter origin (perpendicular to the cursor velocity vector). After scatter ends, lerp the offset back to zero over ~2 seconds. This leverages the existing school-center homing force to produce macroscopic school bifurcation -- the school splits into two sub-groups that flow around the threat and merge behind it.

**Why it works:** The boids system already homes fish toward `uSchoolCenters`. Splitting one center into two during scatter naturally produces two sub-schools without any per-fish logic changes. The lerp-back merges them smoothly.

**Implementation sketch:**
```glsl
// CPU side: compute split offset
const cursorVel = cursorPos.clone().sub(prevCursorPos).normalize();
const splitDir = new Vector3().crossVectors(cursorVel, UP).normalize();
const splitOffset = splitDir.multiplyScalar(scatterRadius * 0.7);

// During scatter: schoolCenter[i] ± splitOffset
// After scatter: lerp splitOffset toward zero
```

**Cost:** CPU-side vector math per frame + two modified uniform values. Zero shader changes.

**Reference:** arXiv:2210.03989 "Stochastic predator-avoidance models" -- formalizes the split/merge behavior in schools under threat.

#### 8b. Cursor Velocity Influence

Track the cursor's world-space velocity (delta position / delta time, exponentially smoothed). Pass as a `uScatterVelocity` vec3 uniform. Use it to bias the scatter radius elliptically in the cursor's travel direction -- fish ahead of a fast-moving cursor scatter at a larger radius than fish behind it.

**Implementation sketch:**
```glsl
// In velocity shader:
vec3 toFish = normalize(pos - uScatterOrigin);
float velBias = dot(toFish, normalize(uScatterVelocity)) * 0.3 + 1.0;
float effectiveRadius = boldScatter * velBias;
```

**Cost:** One new vec3 uniform, two GLSL lines.

**Visual result:** A fast-moving cursor creates an asymmetric scatter cone -- fish ahead flee farther, fish behind barely react. Stationary cursor remains symmetric. Matches the intuition that a moving predator is more threatening to fish in its path.

### 9. Future Extensions (Out of Scope)

- **Scatter ripple:** A visual shockwave ring expanding from the scatter point. Requires a separate shader effect.
- **Predator cursor modes:** Different scatter behaviors for click (sharp burst) vs hover (gentle push). The current design treats all pointer presence equally.
- **Per-species scatter sensitivity:** Currently boldness modulates scatter per-fish. Per-species overrides (e.g., cleaner wrasse ignores cursor) would need a species-indexed uniform array.

### 10. References

- Podila et al., "Visual Analytics of Collective Animal Behavior," Information Visualization, 2020 -- fountain effect taxonomy in schooling fish
- "Animating Escape Maneuvers for Fish Schools," SIGGRAPH i3D 2017 -- GPU-friendly boids scatter with tangential flee components
- Marras et al., "Schooling of Light Reflecting Fish," PLOS ONE -- Trafalgar effect (wave propagation of agitation through a school)
- arXiv:2210.03989, "Stochastic models for predator-avoidance in fish schools" -- school splitting and merge dynamics under threat
- ABZU (Giant Squid Studios, 2016) -- reference implementation of fountain scatter + wave propagation in a shipped title
- Subnautica (Unknown Worlds, 2018) -- distance-delayed scatter reaction in open-world ocean
