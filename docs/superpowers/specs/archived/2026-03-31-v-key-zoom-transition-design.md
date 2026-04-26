# V-Key Camera Zoom Transition

**Goal:** Replace the hard cut between first-person and third-person camera modes with a smooth dolly animation. Pressing V animates the camera distance between 0 (inside the player's head) and ~3m (behind and above the player) over 0.3-0.5 seconds. Controls stay responsive during the transition.

**Inspiration:** Skyrim's scroll-wheel zoom, Fallout's V-key toggle, SmoothCam mod's frame-interpolated POV transitions.

**Tech Stack:** Three.js, Threlte `useTask`, existing `UnifiedCameraController.svelte`

---

## Core Concept: Distance as the Only Parameter

The current UCC has two separate code paths: an `if (mode === FIRST_PERSON)` branch and an `else` (third-person) branch. The V key flips between them instantly.

The new design collapses these into a single computation parameterized by `currentDistance`. At distance=0 the camera is at eye level (first-person). At distance=3 the camera is in orbit behind the player (third-person). The V key animates this distance. There is no hard mode switch during the transition.

```
V pressed (third-person):
  targetDistance: 3.0 ──► 0.0 over 0.4s

V pressed (first-person):
  targetDistance: 0.0 ──► 3.0 over 0.4s
```

---

## State

### New Variables

```typescript
// The distance we're animating toward (set instantly on V press)
let targetDistance = 3.0; // Matches SETTINGS.thirdPerson.distance

// The current animated distance (lerped each frame toward targetDistance)
let currentDistance = 3.0;

// Transition timing
const TRANSITION_DURATION = 0.4; // seconds
let transitionElapsed = 0;
let transitionFrom = 3.0; // distance when V was pressed
let isTransitioning = false;
```

### Mode Derivation

The `mode` variable still exists for preference persistence and UI labels, but camera positioning no longer branches on it. Instead:

```typescript
const isEffectivelyFirstPerson = currentDistance < 0.3;
const isEffectivelyThirdPerson = currentDistance >= 0.3;
```

The 0.3m threshold is where the camera is close enough to the player's head that first-person behavior (no avatar, eye-level look direction) kicks in.

---

## V-Key Handler

```typescript
function cycleMode() {
  // Still cycle the mode enum for persistence and UI
  mode = cameraPreferences.cycleMode(destinationId);
  onModeChange?.(mode);

  // Start the distance transition
  transitionFrom = currentDistance;
  transitionElapsed = 0;
  isTransitioning = true;

  // Set target based on new mode
  if (mode === CameraMode.FIRST_PERSON) {
    targetDistance = 0;
  } else if (mode === CameraMode.THIRD_PERSON) {
    targetDistance = SETTINGS.thirdPerson.distance; // 3.0
  }
  // ORBIT mode: handled separately (exits game loop entirely)
}
```

---

## Frame Update: Distance Animation

Inside the `useTask` callback, before camera positioning:

```typescript
// Animate currentDistance toward targetDistance
if (isTransitioning) {
  transitionElapsed += delta;
  const t = Math.min(transitionElapsed / TRANSITION_DURATION, 1.0);

  // Ease-out cubic: fast start, soft deceleration
  const eased = 1 - Math.pow(1 - t, 3);

  currentDistance = transitionFrom + (targetDistance - transitionFrom) * eased;

  if (t >= 1.0) {
    currentDistance = targetDistance;
    isTransitioning = false;
  }
}
```

### Why Ease-Out Cubic

- Feels responsive: the camera starts moving immediately on V press
- Decelerates into the final position: no abrupt stop
- Matches Skyrim SmoothCam's "fast start, soft landing" feel
- `1 - (1 - t)^3` is cheap to compute (no trig, no lookup table)

---

## Frame Update: Unified Camera Positioning

Replace the current `if (mode === FIRST_PERSON) { ... } else { ... }` with a single distance-parameterized computation:

```typescript
const cfg_fp = SETTINGS.firstPerson;
const cfg_tp = SETTINGS.thirdPerson;

if (currentDistance < 0.3) {
  // === FIRST-PERSON BEHAVIOR ===
  // Camera at eye level, looking where the player looks
  (avatarState.snapFacingAngle ?? avatarState.setFacingAngle)(yaw);

  const camX = targetX + Math.sin(yaw) * cfg_fp.forwardOffset;
  const camY = targetY + cfg_fp.height;
  const camZ = targetZ + Math.cos(yaw) * cfg_fp.forwardOffset;

  camera.current.position.set(camX, camY, camZ);

  const lookDistance = 100;
  const lookX = camX + Math.sin(yaw) * lookDistance * Math.cos(pitch);
  const lookY = camY - Math.sin(pitch) * lookDistance;
  const lookZ = camZ + Math.cos(yaw) * lookDistance * Math.cos(pitch);
  camera.current.lookAt(lookX, lookY, lookZ);

} else {
  // === THIRD-PERSON BEHAVIOR (distance-parameterized) ===
  // Uses currentDistance instead of cfg_tp.distance for all orbit math
  const cosPitch = Math.cos(pitch);

  // Height scales with distance (at distance=0.3 use near-FP height, at 3.0 use full TP height)
  const distanceRatio = currentDistance / cfg_tp.distance; // 0..1
  const height = cfg_fp.height + (cfg_tp.height - cfg_fp.height) * distanceRatio;
  const lookAtHeight = cfg_tp.lookAtHeight * distanceRatio;

  // Raycast collision (same as current, but uses currentDistance as max)
  let safeDistance = currentDistance;
  // ... existing raycast logic, replacing cfg_tp.distance with currentDistance ...

  // Smooth the safe distance (existing CAMERA_LERP_IN / CAMERA_LERP_OUT logic)
  const lerpFactor = safeDistance < smoothedCameraDistance
    ? CAMERA_LERP_IN : CAMERA_LERP_OUT;
  smoothedCameraDistance += (safeDistance - smoothedCameraDistance) * lerpFactor;
  smoothedCameraDistance = Math.max(
    MIN_CAMERA_DISTANCE,
    Math.min(currentDistance, smoothedCameraDistance)
  );

  // Place camera at smoothed distance
  const finalCamX = targetX - Math.sin(yaw) * smoothedCameraDistance * cosPitch;
  const finalCamY = targetY + height + Math.sin(pitch) * smoothedCameraDistance * 0.5;
  const finalCamZ = targetZ - Math.cos(yaw) * smoothedCameraDistance * cosPitch;

  // Position damping (existing smoothedCam logic)
  // ...

  camera.current.position.set(smoothedCamX, smoothedCamY, smoothedCamZ);
  camera.current.lookAt(targetX, targetY + lookAtHeight, targetZ);
}
```

### The 0.3m Threshold

At distance < 0.3m, the third-person orbit math breaks down (camera is nearly inside the head, look-at target is behind the camera). Below this threshold we snap to first-person behavior. The easing curve spends very little time in the 0-0.3 range because the ease-out decelerates at the end (zooming in) or accelerates at the start (zooming out), so the switch point is crossed quickly.

---

## Avatar Visibility

Currently derived as:

```typescript
const showAvatar = $derived(cameraMode !== CameraMode.FIRST_PERSON);
```

This needs to become distance-aware. Two options:

### Option A: Distance-Based (Preferred)

Expose `currentDistance` from UCC via a callback or bindable prop:

```typescript
// In WorldScene.svelte / GalleryScene.svelte
let cameraDistance = $state(3.0);

// UCC reports distance each frame
onDistanceChange={(d) => cameraDistance = d}

// Avatar visibility
const showAvatar = $derived(cameraDistance > 0.5);
```

The 0.5m threshold hides the avatar before the camera enters the head mesh, preventing the player from seeing inside their own skull.

### Option B: Transition-Aware Mode

```typescript
const showAvatar = $derived(
  cameraMode !== CameraMode.FIRST_PERSON || isTransitioning
);
```

This keeps the avatar visible during the zoom-in and hides it only when the transition completes. Simpler but less precise. The avatar would pop invisible at the end rather than fading.

### Recommendation

Option A. It's a single extra callback and produces a smooth visual result. The avatar disappears naturally as the camera pushes through the 0.5m boundary.

---

## Avatar Opacity Fade (Optional Enhancement)

For extra polish, fade the avatar's opacity as distance approaches the threshold:

```typescript
// In the avatar material or group
const avatarOpacity = $derived(
  cameraDistance < 0.5 ? 0 :
  cameraDistance < 1.0 ? (cameraDistance - 0.5) / 0.5 :
  1.0
);
```

This requires the avatar materials to support transparency. If the avatar uses opaque materials, this can be deferred.

---

## Pointer Lock Interaction

Pointer lock behavior during the transition:

| From | To | Pointer Lock |
|------|----|-------------|
| Third-person (locked) | First-person | Stay locked. No change needed. Both modes use pointer lock. |
| First-person (locked) | Third-person | Stay locked. No change needed. |
| Third-person (locked) | Orbit | Exit pointer lock (existing behavior). |
| First-person (locked) | Orbit | Exit pointer lock (existing behavior). |

The transition between first and third person is purely a distance animation. Pointer lock state is unchanged. Mouse look continues to work identically during the dolly.

---

## Pitch Clamping During Transition

First-person and third-person have different pitch limits:

| Mode | minPitch | maxPitch |
|------|----------|----------|
| First-person | -1.4 | 1.4 |
| Third-person | -1.2 | 1.2 |

During the transition, interpolate the pitch clamp:

```typescript
const distanceRatio = Math.min(currentDistance / cfg_tp.distance, 1.0);
const minPitch = cfg_fp.minPitch + (cfg_tp.minPitch - cfg_fp.minPitch) * distanceRatio;
const maxPitch = cfg_fp.maxPitch + (cfg_tp.maxPitch - cfg_fp.maxPitch) * distanceRatio;
pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
```

This prevents a jarring pitch snap when the clamp range changes.

---

## FOV Transition (Optional Enhancement)

The existing `CameraConfig` type already defines `fovFirstPerson: 75` and `fovThirdPerson: 60`. During the distance transition:

```typescript
if (camera.current instanceof PerspectiveCamera) {
  const distanceRatio = Math.min(currentDistance / cfg_tp.distance, 1.0);
  const targetFov = 75 - (75 - 60) * distanceRatio; // 75 at FP, 60 at TP
  camera.current.fov = targetFov;
  camera.current.updateProjectionMatrix();
}
```

The wider FOV at first-person gives peripheral awareness. The narrower FOV at third-person reduces distortion. Lerping between them during the dolly feels natural. This is optional and can be added after the base transition works.

---

## Edge Cases

### V Pressed During Transition

If the player presses V while already transitioning:

```typescript
// In cycleMode():
transitionFrom = currentDistance; // Start from wherever we are right now
transitionElapsed = 0;           // Reset timer
// targetDistance set to new mode's distance
```

The animation restarts from the current position, smoothly reversing or continuing. No abrupt jumps.

### Mode Cycle Order

Current cycle: Orbit -> Third -> First -> Orbit.

During the zoom transition, the mode enum updates immediately (for persistence), but the camera follows via the distance animation. If the player presses V twice quickly (Third -> First -> Orbit), the distance animation restarts each time from the current interpolated position. The orbit transition exits the game loop entirely, so the distance snaps to whatever orbit controls dictate.

### Orbit Mode Entry

Orbit mode is fundamentally different (no avatar following, OrbitControls take over). When transitioning TO orbit:

1. Distance animation is irrelevant (orbit has its own positioning)
2. Exit pointer lock
3. Hand off to OrbitControls immediately

No smooth zoom when entering/leaving orbit. The zoom transition only applies between first-person and third-person.

### Rapid V Spam

The easing function handles this gracefully. Each press resets `transitionFrom = currentDistance` and `transitionElapsed = 0`. The camera smoothly redirects from wherever it currently is. No state corruption possible because `currentDistance` is always a valid float between 0 and `cfg_tp.distance`.

---

## Performance

The transition adds zero allocations per frame. All math is scalar arithmetic (no Vector3 allocations, no object creation). The easing is a single power function. The raycast already runs every frame in third-person mode, so no new raycasts are introduced.

The only new per-frame cost during transition: one comparison (`isTransitioning`), one addition, one min, one power, two multiplications. Negligible.

---

## Implementation Scope

### Minimum Viable

1. Add `targetDistance`, `currentDistance`, `transitionFrom`, `transitionElapsed`, `isTransitioning` variables
2. Modify `cycleMode()` to set transition state instead of just flipping mode
3. Add distance animation block at top of `useTask`
4. Replace the `if (mode === FIRST_PERSON)` branch with `if (currentDistance < 0.3)` using `currentDistance` for orbit radius
5. Add `onDistanceChange` callback prop
6. Update avatar visibility in WorldScene/GalleryScene to use distance threshold

### Polish (Later)

- Avatar opacity fade in the 0.5-1.0m range
- FOV interpolation (75 at FP, 60 at TP)
- Configurable transition duration per destination
- Scroll wheel to manually scrub the distance (Skyrim-style continuous zoom)

---

## Reference Implementations

- **Skyrim SmoothCam** ([Nexus](https://www.nexusmods.com/skyrimspecialedition/mods/41252)): Frame-interpolated third-person camera with configurable smoothing. Uses offset-based positioning with ease-in/ease-out curves for POV transitions.
- **Three.js camera-controls** ([GitHub](https://github.com/yomotsu/camera-controls)): OrbitControls alternative with built-in smooth transitions via `dolly()` and `setPosition()` with configurable damping.
- **Game AI Pro Ch. 47** ([PDF](http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter47_Tips_and_Tricks_for_a_Robust_Third-Person_Camera_System.pdf)): Industry reference for third-person camera distance management, collision avoidance, and smooth state transitions.
- **Little Polygon Camera Breakdown** ([Blog](https://blog.littlepolygon.com/posts/cameras/)): Technical analysis of third-person camera systems including distance interpolation and collision response.
