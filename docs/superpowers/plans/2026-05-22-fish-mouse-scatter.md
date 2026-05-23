# Fish Mouse Scatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fish scatter away from the mouse cursor with biologically-inspired fountain splitting and wave propagation.

**Architecture:** A new `OceanMouseRaycast.svelte` component raycasts the pointer onto a horizontal plane at swim height, writing the hit point into a bound `Vector3`. OceanScene passes that vector to FishSchool, which internally detects movement threshold crossings to record scatter start time in its own elapsed-time domain. The GPGPU velocity shader applies boldness-modulated, fountain-split scatter with Trafalgar wave delay.

**Tech Stack:** Svelte 5, Threlte v8, Three.js (Raycaster, Plane), GLSL (velocity + behavior compute shaders)

---

## File Structure

| File | Role |
|------|------|
| `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte` | **NEW** — pointer-to-world raycast against swim-height plane |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `scatterForce`, `scatterEnabled`, `scatterWaveSpeed` to fish config |
| `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` | Velocity shader: boldness, fountain effect, Trafalgar wave, sentinel guard |
| `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts` | Behavior shader: sentinel guard on scatter check |
| `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` | Accept new props, wire uniforms, track scatter start time internally |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Import OceanMouseRaycast, wire to FishSchool |

---

### Task 1: Config Interface — Add Scatter Tuning Fields

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts`

- [ ] **Step 1: Add fields to OceanSceneConfig.fish interface**

In `scene-configs.ts`, find the `fish` block in `OceanSceneConfig` interface. The block currently ends with:

```typescript
    scatterRadius: number;
    perceptionAngle: number;
    halfSpeedTime: number;
  };
```

Replace with:

```typescript
    scatterRadius: number;
    scatterForce: number;
    scatterEnabled: boolean;
    scatterWaveSpeed: number;
    perceptionAngle: number;
    halfSpeedTime: number;
  };
```

- [ ] **Step 2: Add defaults to createDefaultOceanAbyssConfig**

Find the `createDefaultOceanAbyssConfig` fish block. Currently:

```typescript
      scatterRadius: 4.0,
      perceptionAngle: 135,
      halfSpeedTime: 0.5,
```

Replace with:

```typescript
      scatterRadius: 4.0,
      scatterForce: 3.0,
      scatterEnabled: true,
      scatterWaveSpeed: 0.15,
      perceptionAngle: 135,
      halfSpeedTime: 0.5,
```

- [ ] **Step 3: Add defaults to ALL other config factory functions**

Find every other `createDefaultOcean*Config` function (`createDefaultOceanReefConfig`, `createDefaultOceanMysticalConfig`, `createDefaultOceanCinematicConfig`). Each has a `fish:` block with `scatterRadius`. After each `scatterRadius` line, add:

```typescript
      scatterForce: 3.0,
      scatterEnabled: true,
      scatterWaveSpeed: 0.15,
```

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/domain/models/scene-configs.ts
git commit -m "feat(ocean): add scatterForce, scatterEnabled, scatterWaveSpeed to fish config"
```

---

### Task 2: Velocity Shader — Boldness + Fountain + Trafalgar Wave

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts`

- [ ] **Step 1: Add new uniforms to the velocity shader**

In `fish-shaders.ts`, find the velocity shader uniform declarations. After `uniform float uScatterForce;` (line 100), add:

```glsl
uniform float uScatterStartTime;
uniform float uScatterWaveSpeed;
```

- [ ] **Step 2: Replace the scatter block**

Find the existing scatter block (lines 271-276):

```glsl
  float distToRay = distance(pos, uScatterOrigin);
  if (distToRay < uScatterRadius && uScatterForce > 0.0) {
    vec3 away = safeNormalize(pos - uScatterOrigin);
    float proximity = 1.0 - distToRay / uScatterRadius;
    steer += away * uScatterForce * proximity * proximity;
  }
```

Replace with:

```glsl
  float distToRay = distance(pos, uScatterOrigin);
  float boldScatter = uScatterRadius * (1.3 - boldness * 0.6);
  if (distToRay < boldScatter && uScatterForce > 0.0 && uScatterOrigin.y > -900.0) {
    vec3 away = safeNormalize(pos - uScatterOrigin);
    float proximity = 1.0 - distToRay / boldScatter;

    // Fountain effect: tangential split for head-on fish
    vec3 tangent = safeNormalize(cross(away, vec3(0.0, 1.0, 0.0)));
    vec3 fishDir = safeNormalize(vel.xyz);
    float dotFwd = abs(dot(fishDir, away));
    float tangentWeight = smoothstep(0.3, 0.8, dotFwd) * 0.6;
    vec3 fleeDir = safeNormalize(mix(away, tangent, tangentWeight));

    // Trafalgar wave: distance-delayed onset
    float delay = distToRay * uScatterWaveSpeed;
    float timeSinceScatter = uTime - uScatterStartTime;
    float waveReached = step(delay, timeSinceScatter);

    steer += fleeDir * uScatterForce * proximity * proximity * (1.5 - boldness) * waveReached;
  }
```

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts
git commit -m "feat(ocean): boldness-modulated fountain scatter with Trafalgar wave propagation"
```

---

### Task 3: Behavior Shader — Sentinel Guard

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts`

- [ ] **Step 1: Add sentinel guard to scatter check**

In `fish-behavior-shader.ts`, find the scatter check (line 54):

```glsl
  if (rayDist < uScatterRadius && myTrophic != 0 && myTrophic != 5) {
```

Replace with:

```glsl
  if (rayDist < uScatterRadius && uScatterOrigin.y > -900.0 && myTrophic != 0 && myTrophic != 5) {
```

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts
git commit -m "fix(ocean): add sentinel guard to behavior shader scatter check"
```

---

### Task 4: FishSchool — New Props + Internal Scatter Start Time

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte`

- [ ] **Step 1: Add new props**

In `FishSchool.svelte`, find the `Props` interface (line 34). Add after `scatterRadius?: number;` (line 41):

```typescript
    scatterForce?: number;
    scatterWaveSpeed?: number;
```

In the destructuring block (line 49), add after `scatterRadius = 4.0,` (line 56):

```typescript
    scatterForce = 3.0,
    scatterWaveSpeed = 0.15,
```

- [ ] **Step 2: Add internal scatter-start-time tracking**

After the existing state variables near the top of the script (around line 237 where `gpuFailed` is), add:

```typescript
  let scatterStartTime = 0;
  const prevScatterOrigin = new Vector3(0, -999, 0);
  const SCATTER_MOVE_THRESHOLD = 0.5;
```

- [ ] **Step 3: Wire new uniforms at GPU init**

Find line 436:
```typescript
      velU.uScatterForce = { value: 3.0 };
```

Replace with:
```typescript
      velU.uScatterForce = { value: scatterForce };
      velU.uScatterStartTime = { value: 0 };
      velU.uScatterWaveSpeed = { value: scatterWaveSpeed };
```

- [ ] **Step 4: Add scatter-start-time detection and uniform sync in the useTask tick**

Find the tick area around line 727 where `velUni.uScatterRadius.value` is set. Replace:

```typescript
    velUni.uScatterRadius.value = scatterRadius;
```

With:

```typescript
    velUni.uScatterRadius.value = scatterRadius;
    velUni.uScatterForce.value = scatterForce;
    velUni.uScatterWaveSpeed.value = scatterWaveSpeed;

    // Detect scatter origin movement to reset wave propagation timer
    if (rayPosition.distanceTo(prevScatterOrigin) > SCATTER_MOVE_THRESHOLD) {
      scatterStartTime = elapsed;
      prevScatterOrigin.copy(rayPosition);
    }
    velUni.uScatterStartTime.value = scatterStartTime;
```

- [ ] **Step 5: Run build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "feat(ocean): wire scatterForce/scatterWaveSpeed props, track scatter start time internally"
```

---

### Task 5: OceanMouseRaycast Component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte`

- [ ] **Step 1: Create the raycast component**

Create `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte`:

```svelte
<script lang="ts">
  import { useThrelte } from '@threlte/core';
  import { Raycaster, Plane, Vector3, Vector2 } from 'three';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    swimHeight: [number, number];
    groundY: number;
    worldPosition: Vector3;
  }

  let {
    swimHeight,
    groundY,
    worldPosition = $bindable(new Vector3(0, -999, 0)),
  }: Props = $props();

  const { renderer, camera } = useThrelte();

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const hitPoint = new Vector3();

  const midSwimY = $derived(groundY + (swimHeight[0] + swimHeight[1]) / 2);
  const swimPlane = $derived(new Plane(new Vector3(0, 1, 0), -midSwimY));

  function onPointerMove(event: PointerEvent) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = camera.current;
    if (!cam) return;

    raycaster.setFromCamera(ndc, cam);
    if (raycaster.ray.intersectPlane(swimPlane, hitPoint)) {
      worldPosition.copy(hitPoint);
    }
  }

  function onPointerLeave() {
    worldPosition.set(0, -999, 0);
  }

  let canvas: HTMLCanvasElement | null = null;

  onMount(() => {
    canvas = renderer.domElement;
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
  });

  onDestroy(() => {
    if (canvas) {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    }
  });
</script>
```

This component:
- Raycasts pointer position against a horizontal plane at the midpoint of the fish swim height range
- Writes the intersection into `worldPosition` (bound from OceanScene's `rayPosition`)
- Resets to sentinel `(0, -999, 0)` on pointer leave
- Has no time tracking — FishSchool handles scatter-start-time detection internally

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte
git commit -m "feat(ocean): add OceanMouseRaycast component for pointer-to-swim-plane raycast"
```

---

### Task 6: OceanScene — Wire Everything Together

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Import OceanMouseRaycast**

In `OceanScene.svelte`, find the import block. After the `FishSchool` import (line 25):

```typescript
  import FishSchool from "./ocean/FishSchool.svelte";
```

Add:

```typescript
  import OceanMouseRaycast from "./ocean/OceanMouseRaycast.svelte";
```

- [ ] **Step 2: Add OceanMouseRaycast to the template and pass new props to FishSchool**

Find the fish-enabled template block (lines 1131-1146). Replace the entire block:

```svelte
<!-- GPGPU fish school (boids simulation) -->
{#if activeConfig.fish.enabled}
  <FishSchool
    targetSize={activeConfig.fish.targetSize}
    swimHeight={activeConfig.fish.swimHeight}
    speed={activeConfig.fish.speed}
    stageRadius={zones.clearingRadius}
    boundRadius={zones.forestOuter}
    currentStrength={activeConfig.fish.currentStrength}
    scatterRadius={activeConfig.fish.scatterRadius}
    perceptionAngle={activeConfig.fish.perceptionAngle}
    halfSpeedTime={activeConfig.fish.halfSpeedTime}
    {rayPosition}
    {reefSdfData}
  />
{/if}
```

With:

```svelte
<!-- GPGPU fish school (boids simulation) -->
{#if activeConfig.fish.enabled}
  {#if activeConfig.fish.scatterEnabled}
    <OceanMouseRaycast
      swimHeight={activeConfig.fish.swimHeight}
      groundY={userProportionsState.groundY}
      bind:worldPosition={rayPosition}
    />
  {/if}
  <FishSchool
    targetSize={activeConfig.fish.targetSize}
    swimHeight={activeConfig.fish.swimHeight}
    speed={activeConfig.fish.speed}
    stageRadius={zones.clearingRadius}
    boundRadius={zones.forestOuter}
    currentStrength={activeConfig.fish.currentStrength}
    scatterRadius={activeConfig.fish.scatterRadius}
    scatterForce={activeConfig.fish.scatterForce}
    scatterWaveSpeed={activeConfig.fish.scatterWaveSpeed}
    perceptionAngle={activeConfig.fish.perceptionAngle}
    halfSpeedTime={activeConfig.fish.halfSpeedTime}
    {rayPosition}
    {reefSdfData}
  />
{/if}
```

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): wire OceanMouseRaycast to FishSchool scatter system"
```

---

### Task 7: Build Verification

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds with no new errors.

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -c "Error"`
Expected: Same pre-existing error count (28). No new errors from our files.

- [ ] **Step 3: Verify sentinel guard in both shaders**

Run: `grep -n "uScatterOrigin.y > -900" src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts`
Expected: One match in each file.

- [ ] **Step 4: Verify new uniforms declared and wired**

Run: `grep -n "uScatterStartTime\|uScatterWaveSpeed" src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte`
Expected: Uniform declarations in shader file, init + tick values in FishSchool.

- [ ] **Step 5: Verify no stale normalize in scatter code**

Run: `grep -n "normalize(pos - uScatter" src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts`
Expected: Zero matches (all should be `safeNormalize`).

- [ ] **Step 6: Manual verification**

Cannot verify visually from CLI. Report to user:

*"I cannot verify this visually. Please open the ocean scene, hover your mouse over the fish school, and check:
1. Fish scatter away from the cursor
2. Closest fish react first (wave delay visible)
3. Head-on fish split laterally (fountain) rather than fleeing radially
4. Fish reform after cursor moves away
5. Leaving the canvas stops scatter (no phantom scatter at origin)"*
