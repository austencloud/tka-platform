# Stage Locomotion Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 performers walk from line formation to triangle formation on beat, with prop patterns playing throughout. New 'Stage' feature module with 2D SVG editor + 3D preview.

**Architecture:** New `stage` feature module with SVG-based formation editor, formation interpolation engine, locomotion controller (blend tree + root motion from existing Mixamo clips), and Threlte 3D preview. Formation data drives performer target positions; locomotion controller blends idle/walk clips; prop patterns continue via existing PropState3D system.

**Tech Stack:** Svelte 5, Threlte, Three.js AnimationMixer, existing @austencloud/scene-3d (RootMotionExtractor, Plane, AvatarId), Mixamo GLB clips (already in static/animations/locomotion-pack/).

---

## File Structure

```
src/lib/features/stage/
├── StageModule.svelte                    # Module entry point (nav registration)
├── components/
│   ├── StageEditorPanel.svelte           # 2D editor container (canvas + timeline + properties)
│   ├── StageCanvas.svelte                # SVG bird's-eye stage view with draggable dots
│   ├── PerformerDot.svelte               # Individual draggable performer circle
│   ├── PathLine.svelte                   # Transition path visualization (SVG path)
│   ├── BeatTimeline.svelte               # Horizontal beat timeline with formation markers
│   ├── Stage3DPreview.svelte             # Threlte 3D viewport rendering performers
│   └── LocomotingPerformer.svelte        # Single performer with locomotion blend tree
├── state/
│   ├── stage-choreography-state.svelte.ts # Reactive choreography document + editor state
│   └── formation-interpolator.ts          # Pure function: keyframes + progress → positions
├── locomotion/
│   ├── locomotion-controller.ts           # Blend tree + animation action management
│   └── clip-registry.ts                   # Clip metadata (speed, steps/sec) for locomotion-pack
└── domain/
    └── stage-types.ts                     # All TypeScript interfaces
```

**Files Modified:**
- `src/lib/shared/navigation/domain/types.ts` — add `"stage"` to ModuleId union
- `src/lib/shared/navigation/config/module-definitions.ts` — add STAGE_TABS + module definition
- `src/lib/shared/navigation/config/tab-definitions.ts` — add STAGE_TABS array
- `src/routes/+layout.svelte` — add stage preloader to URL_TO_MODULE

---

## Task 1: Type Definitions

**Files:**
- Create: `src/lib/features/stage/domain/stage-types.ts`

- [ ] **Step 1: Create stage-types.ts with all interfaces**

```typescript
import type { Plane } from "@austencloud/scene-3d";

export interface StageChoreography {
  id: string;
  name: string;
  bpm: number;
  stageWidth: number;
  stageDepth: number;
  performers: PerformerSlot[];
  formations: FormationKeyframe[];
}

export interface PerformerSlot {
  id: string;
  index: number;
  color: string;
}

export interface FormationKeyframe {
  id: string;
  beat: number;
  positions: PerformerPose[];
  transition?: TransitionConfig;
}

export interface PerformerPose {
  performerId: string;
  x: number;
  z: number;
  facing: number;
  planeMode?: Plane;
}

export interface TransitionConfig {
  interpolation: "linear" | "ease" | "spline" | "arc";
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut";
}

export type FormationPresetId =
  | "line"
  | "triangle"
  | "diamond"
  | "circle"
  | "v-shape"
  | "grid"
  | "stagger"
  | "cluster";

export const PERFORMER_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#a06cd5",
  "#ff9a76",
  "#6bcf7f",
  "#7eb8da",
  "#e87ea1",
] as const;

export const DEFAULT_STAGE_WIDTH = 10;
export const DEFAULT_STAGE_DEPTH = 8;
export const DEFAULT_BPM = 120;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/features/stage/domain/stage-types.ts`
Expected: No errors (or use `npm run check` for full project check after module wiring)

- [ ] **Step 3: Commit**

```
git add src/lib/features/stage/domain/stage-types.ts
git commit -m "feat(stage): add type definitions for stage choreography system"
```

---

## Task 2: Formation Interpolator (Pure Logic)

**Files:**
- Create: `src/lib/features/stage/state/formation-interpolator.ts`
- Test: `tests/unit/stage/formation-interpolator.test.ts`

- [ ] **Step 1: Write failing test for linear interpolation**

```typescript
import { describe, it, expect } from "vitest";
import {
  interpolateFormation,
  applyEasing,
} from "$lib/features/stage/state/formation-interpolator";
import type {
  FormationKeyframe,
  TransitionConfig,
} from "$lib/features/stage/domain/stage-types";

describe("formation-interpolator", () => {
  const from: FormationKeyframe = {
    id: "f1",
    beat: 0,
    positions: [
      { performerId: "p1", x: 2, z: 4, facing: 0 },
      { performerId: "p2", x: 5, z: 4, facing: 0 },
      { performerId: "p3", x: 8, z: 4, facing: 0 },
      { performerId: "p4", x: 5, z: 2, facing: 0 },
    ],
  };

  const to: FormationKeyframe = {
    id: "f2",
    beat: 4,
    positions: [
      { performerId: "p1", x: 5, z: 2, facing: 0 },
      { performerId: "p2", x: 3, z: 5, facing: 0 },
      { performerId: "p3", x: 7, z: 5, facing: 0 },
      { performerId: "p4", x: 5, z: 7, facing: 0 },
    ],
  };

  const linearTransition: TransitionConfig = {
    interpolation: "linear",
    easing: "linear",
  };

  it("returns 'from' positions at progress 0", () => {
    const result = interpolateFormation(from, to, 0, linearTransition);
    expect(result[0].x).toBeCloseTo(2);
    expect(result[0].z).toBeCloseTo(4);
  });

  it("returns 'to' positions at progress 1", () => {
    const result = interpolateFormation(from, to, 1, linearTransition);
    expect(result[0].x).toBeCloseTo(5);
    expect(result[0].z).toBeCloseTo(2);
  });

  it("returns midpoint at progress 0.5", () => {
    const result = interpolateFormation(from, to, 0.5, linearTransition);
    expect(result[0].x).toBeCloseTo(3.5);
    expect(result[0].z).toBeCloseTo(3);
  });

  it("interpolates facing via shortest arc", () => {
    const fromFacing: FormationKeyframe = {
      id: "f1",
      beat: 0,
      positions: [{ performerId: "p1", x: 5, z: 5, facing: 0 }],
    };
    const toFacing: FormationKeyframe = {
      id: "f2",
      beat: 4,
      positions: [
        { performerId: "p1", x: 5, z: 5, facing: Math.PI / 2 },
      ],
    };
    const result = interpolateFormation(
      fromFacing,
      toFacing,
      0.5,
      linearTransition
    );
    expect(result[0].facing).toBeCloseTo(Math.PI / 4);
  });

  it("applies easeInOut easing", () => {
    expect(applyEasing(0, "easeInOut")).toBe(0);
    expect(applyEasing(1, "easeInOut")).toBe(1);
    expect(applyEasing(0.5, "easeInOut")).toBeCloseTo(0.5);
    // easeInOut at 0.25 should be < 0.25 (slow start)
    expect(applyEasing(0.25, "easeInOut")).toBeLessThan(0.25);
  });

  it("computes speed between formations", () => {
    // P1 moves from (2,4) to (5,2) in 4 beats at 120 BPM
    // Distance = sqrt(9 + 4) = sqrt(13) ≈ 3.606m
    // Time = 4 beats * (60/120) = 2 seconds
    // Speed = 3.606 / 2 ≈ 1.803 m/s
    const result = interpolateFormation(from, to, 0.5, linearTransition);
    // Speed is exposed per-performer
    expect(result[0].speed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/stage/formation-interpolator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement formation-interpolator.ts**

```typescript
import type {
  FormationKeyframe,
  PerformerPose,
  TransitionConfig,
} from "../domain/stage-types";

export interface InterpolatedPose extends PerformerPose {
  speed: number;
}

export function applyEasing(
  t: number,
  easing: TransitionConfig["easing"]
): number {
  switch (easing) {
    case "linear":
      return t;
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
  }
}

function lerpFacing(from: number, to: number, t: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export function interpolateFormation(
  from: FormationKeyframe,
  to: FormationKeyframe,
  progress: number,
  transition: TransitionConfig
): InterpolatedPose[] {
  const eased = applyEasing(
    Math.max(0, Math.min(1, progress)),
    transition.easing
  );

  return from.positions.map((fromPose, i) => {
    const toPose = to.positions[i] ?? fromPose;

    const x = fromPose.x + (toPose.x - fromPose.x) * eased;
    const z = fromPose.z + (toPose.z - fromPose.z) * eased;
    const facing = lerpFacing(fromPose.facing, toPose.facing, eased);

    const dx = toPose.x - fromPose.x;
    const dz = toPose.z - fromPose.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const beatDuration = to.beat - from.beat;
    const speed = beatDuration > 0 ? distance / beatDuration : 0;

    return {
      performerId: fromPose.performerId,
      x,
      z,
      facing,
      planeMode: eased < 0.5 ? fromPose.planeMode : toPose.planeMode,
      speed,
    };
  });
}

export function computeRequiredSpeed(
  from: PerformerPose,
  to: PerformerPose,
  durationSeconds: number
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dz * dz) / durationSeconds;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/stage/formation-interpolator.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```
git add src/lib/features/stage/state/formation-interpolator.ts tests/unit/stage/formation-interpolator.test.ts
git commit -m "feat(stage): add formation interpolator with easing and speed computation"
```

---

## Task 3: Formation Presets

**Files:**
- Create: `src/lib/features/stage/state/formation-presets.ts`

- [ ] **Step 1: Create formation-presets.ts**

```typescript
import type {
  FormationPresetId,
  PerformerPose,
} from "../domain/stage-types";

export function generateFormation(
  preset: FormationPresetId,
  performerCount: number,
  stageWidth: number,
  stageDepth: number,
  performerIds: string[]
): PerformerPose[] {
  const normalized = PRESET_GENERATORS[preset](performerCount);
  return normalized.slice(0, performerCount).map((p, i) => ({
    performerId: performerIds[i],
    x: p.x * stageWidth,
    z: p.z * stageDepth,
    facing: p.facing,
  }));
}

type NormalizedPoint = { x: number; z: number; facing: number };

const PRESET_GENERATORS: Record<
  FormationPresetId,
  (n: number) => NormalizedPoint[]
> = {
  line: (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: 0.5,
      facing: 0,
    })),

  triangle: (n) => {
    if (n <= 2) return PRESET_GENERATORS.line(n);
    const pts: NormalizedPoint[] = [];
    let remaining = n;
    let row = 0;
    let perRow = 1;
    while (remaining > 0) {
      const count = Math.min(perRow, remaining);
      for (let i = 0; i < count; i++) {
        pts.push({
          x: 0.5 + (i - (count - 1) / 2) * 0.15,
          z: 0.3 + row * 0.2,
          facing: 0,
        });
      }
      remaining -= count;
      row++;
      perRow++;
    }
    return pts;
  },

  diamond: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(a) * 0.25, z: 0.5 + Math.sin(a) * 0.3, facing: 0 };
    }),

  circle: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(a) * 0.3, z: 0.5 + Math.sin(a) * 0.3, facing: 0 };
    }),

  "v-shape": (n) => {
    const pts: NormalizedPoint[] = [];
    const half = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const side = i < half ? -1 : 1;
      const idx = i < half ? i : i - half;
      pts.push({
        x: 0.5 + side * (idx + 1) * 0.12,
        z: 0.3 + idx * 0.15,
        facing: 0,
      });
    }
    return pts;
  },

  grid: (n) => {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => ({
      x: ((i % cols) + 1) / (cols + 1),
      z: (Math.floor(i / cols) + 1) / (rows + 1),
      facing: 0,
    }));
  },

  stagger: (n) => {
    const perRow = Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const offset = row % 2 === 1 ? 0.06 : 0;
      return {
        x: (col + 1) / (perRow + 1) + offset,
        z: 0.35 + row * 0.3,
        facing: 0,
      };
    });
  },

  cluster: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 0.1;
      return { x: 0.5 + Math.cos(a) * r, z: 0.5 + Math.sin(a) * r, facing: 0 };
    }),
};
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/stage/state/formation-presets.ts
git commit -m "feat(stage): add formation preset generators (8 presets)"
```

---

## Task 4: Choreography State

**Files:**
- Create: `src/lib/features/stage/state/stage-choreography-state.svelte.ts`

- [ ] **Step 1: Create reactive choreography state**

```typescript
import type {
  StageChoreography,
  FormationKeyframe,
  PerformerPose,
  TransitionConfig,
  FormationPresetId,
} from "../domain/stage-types";
import {
  PERFORMER_COLORS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STAGE_DEPTH,
  DEFAULT_BPM,
} from "../domain/stage-types";
import { generateFormation } from "./formation-presets";
import {
  interpolateFormation,
  type InterpolatedPose,
} from "./formation-interpolator";

function createPerformerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}`);
}

export function createStageChoreographyState() {
  const performerIds = createPerformerIds(4);

  let choreography = $state<StageChoreography>({
    id: crypto.randomUUID(),
    name: "Untitled Choreography",
    bpm: DEFAULT_BPM,
    stageWidth: DEFAULT_STAGE_WIDTH,
    stageDepth: DEFAULT_STAGE_DEPTH,
    performers: performerIds.map((id, i) => ({
      id,
      index: i,
      color: PERFORMER_COLORS[i],
    })),
    formations: [],
  });

  let activeFormationIndex = $state(0);
  let isPlaying = $state(false);
  let playProgress = $state(0);
  let selectedPerformerIndex = $state<number | null>(null);

  const activeFormation = $derived(
    choreography.formations[activeFormationIndex] ?? null
  );

  const nextFormation = $derived(
    choreography.formations[activeFormationIndex + 1] ?? null
  );

  const interpolatedPositions = $derived<InterpolatedPose[]>(() => {
    if (!activeFormation || !nextFormation || !isPlaying) {
      return (activeFormation?.positions ?? []).map((p) => ({
        ...p,
        speed: 0,
      }));
    }
    const transition = nextFormation.transition ?? {
      interpolation: "linear" as const,
      easing: "easeInOut" as const,
    };
    return interpolateFormation(
      activeFormation,
      nextFormation,
      playProgress,
      transition
    );
  });

  function setPerformerCount(count: number) {
    const ids = createPerformerIds(count);
    choreography.performers = ids.map((id, i) => ({
      id,
      index: i,
      color: PERFORMER_COLORS[i],
    }));
    choreography.formations = choreography.formations.map((f) => ({
      ...f,
      positions: f.positions.slice(0, count),
    }));
  }

  function applyPreset(preset: FormationPresetId) {
    const ids = choreography.performers.map((p) => p.id);
    const positions = generateFormation(
      preset,
      choreography.performers.length,
      choreography.stageWidth,
      choreography.stageDepth,
      ids
    );
    if (choreography.formations[activeFormationIndex]) {
      choreography.formations[activeFormationIndex].positions = positions;
    } else {
      choreography.formations.push({
        id: crypto.randomUUID(),
        beat: activeFormationIndex * 4,
        positions,
      });
    }
  }

  function addFormation(beat: number, preset?: FormationPresetId) {
    const ids = choreography.performers.map((p) => p.id);
    const positions = preset
      ? generateFormation(
          preset,
          choreography.performers.length,
          choreography.stageWidth,
          choreography.stageDepth,
          ids
        )
      : ids.map((id) => ({
          performerId: id,
          x: choreography.stageWidth / 2,
          z: choreography.stageDepth / 2,
          facing: 0,
        }));

    choreography.formations.push({
      id: crypto.randomUUID(),
      beat,
      positions,
      transition: { interpolation: "linear", easing: "easeInOut" },
    });
    choreography.formations.sort((a, b) => a.beat - b.beat);
  }

  function updatePerformerPosition(
    formationIndex: number,
    performerId: string,
    x: number,
    z: number
  ) {
    const formation = choreography.formations[formationIndex];
    if (!formation) return;
    const pose = formation.positions.find(
      (p) => p.performerId === performerId
    );
    if (pose) {
      pose.x = Math.max(0, Math.min(choreography.stageWidth, x));
      pose.z = Math.max(0, Math.min(choreography.stageDepth, z));
    }
  }

  function setTransition(
    formationIndex: number,
    config: TransitionConfig
  ) {
    const formation = choreography.formations[formationIndex];
    if (formation) {
      formation.transition = config;
    }
  }

  let animationFrame: number | null = null;
  let lastTimestamp = 0;

  function play() {
    if (choreography.formations.length < 2) return;
    isPlaying = true;
    playProgress = 0;
    activeFormationIndex = 0;
    lastTimestamp = performance.now();
    tick();
  }

  function stop() {
    isPlaying = false;
    playProgress = 0;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function tick() {
    if (!isPlaying) return;
    const now = performance.now();
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;

    const current = choreography.formations[activeFormationIndex];
    const next = choreography.formations[activeFormationIndex + 1];
    if (!current || !next) {
      stop();
      return;
    }

    const beatDuration = next.beat - current.beat;
    const secondsPerBeat = 60 / choreography.bpm;
    const transitionDuration = beatDuration * secondsPerBeat;

    playProgress += dt / transitionDuration;

    if (playProgress >= 1) {
      activeFormationIndex++;
      playProgress = 0;
      if (activeFormationIndex >= choreography.formations.length - 1) {
        stop();
        return;
      }
    }

    animationFrame = requestAnimationFrame(tick);
  }

  return {
    get choreography() { return choreography; },
    get activeFormationIndex() { return activeFormationIndex; },
    set activeFormationIndex(v: number) { activeFormationIndex = v; },
    get activeFormation() { return activeFormation; },
    get nextFormation() { return nextFormation; },
    get interpolatedPositions() { return interpolatedPositions; },
    get isPlaying() { return isPlaying; },
    get playProgress() { return playProgress; },
    get selectedPerformerIndex() { return selectedPerformerIndex; },
    set selectedPerformerIndex(v: number | null) { selectedPerformerIndex = v; },
    setPerformerCount,
    applyPreset,
    addFormation,
    updatePerformerPosition,
    setTransition,
    play,
    stop,
  };
}

let instance: ReturnType<typeof createStageChoreographyState> | null = null;

export function getStageChoreographyState() {
  if (!instance) {
    instance = createStageChoreographyState();
  }
  return instance;
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/stage/state/stage-choreography-state.svelte.ts
git commit -m "feat(stage): add reactive choreography state with playback transport"
```

---

## Task 5: Locomotion Controller

**Files:**
- Create: `src/lib/features/stage/locomotion/clip-registry.ts`
- Create: `src/lib/features/stage/locomotion/locomotion-controller.ts`

- [ ] **Step 1: Create clip-registry.ts**

```typescript
export interface ClipMetadata {
  path: string;
  speedMs: number;
  stepsPerSecond: number;
  isRootMotion: boolean;
}

export const LOCOMOTION_CLIPS: Record<string, ClipMetadata> = {
  idle: {
    path: "/animations/locomotion-pack/idle-rm.glb",
    speedMs: 0,
    stepsPerSecond: 0,
    isRootMotion: true,
  },
  walk: {
    path: "/animations/locomotion-pack/walk-forward-rm.glb",
    speedMs: 1.4,
    stepsPerSecond: 2,
    isRootMotion: true,
  },
  run: {
    path: "/animations/locomotion-pack/run-rm.glb",
    speedMs: 4.0,
    stepsPerSecond: 3,
    isRootMotion: true,
  },
};

export function computeBlendWeights(speed: number): {
  idle: number;
  walk: number;
  run: number;
} {
  const walkSpeed = LOCOMOTION_CLIPS.walk.speedMs;
  const runSpeed = LOCOMOTION_CLIPS.run.speedMs;

  if (speed <= 0.01) return { idle: 1, walk: 0, run: 0 };
  if (speed <= walkSpeed) {
    const t = speed / walkSpeed;
    return { idle: 1 - t, walk: t, run: 0 };
  }
  if (speed <= runSpeed) {
    const t = (speed - walkSpeed) / (runSpeed - walkSpeed);
    return { idle: 0, walk: 1 - t, run: t };
  }
  return { idle: 0, walk: 0, run: 1 };
}

export function computeTimeScale(
  speed: number,
  clipSpeedMs: number
): number {
  if (clipSpeedMs <= 0) return 1;
  return Math.max(0.5, Math.min(2.0, speed / clipSpeedMs));
}
```

- [ ] **Step 2: Create locomotion-controller.ts**

```typescript
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  LOCOMOTION_CLIPS,
  computeBlendWeights,
  computeTimeScale,
  type ClipMetadata,
} from "./clip-registry";

export interface LocomotionState {
  position: THREE.Vector3;
  facing: number;
  speed: number;
  isMoving: boolean;
}

export class LocomotionController {
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private clips: Record<string, THREE.AnimationClip> = {};
  private _state: LocomotionState = {
    position: new THREE.Vector3(),
    facing: 0,
    speed: 0,
    isMoving: false,
  };
  private targetPosition = new THREE.Vector3();
  private targetFacing = 0;
  private readonly rotationSpeed = 8; // rad/s

  get state(): LocomotionState {
    return this._state;
  }

  async initialize(scene: THREE.Object3D): Promise<void> {
    this.mixer = new THREE.AnimationMixer(scene);
    const loader = new GLTFLoader();

    for (const [name, meta] of Object.entries(LOCOMOTION_CLIPS)) {
      try {
        const gltf = await loader.loadAsync(meta.path);
        if (gltf.animations.length > 0) {
          const clip = gltf.animations[0];
          this.clips[name] = clip;
          const action = this.mixer.clipAction(clip);
          action.play();
          action.setEffectiveWeight(name === "idle" ? 1 : 0);
          action.setLoop(THREE.LoopRepeat, Infinity);
          this.actions[name] = action;
        }
      } catch (e) {
        console.warn(`[Locomotion] Failed to load clip: ${meta.path}`, e);
      }
    }
  }

  setTarget(x: number, z: number, facing: number): void {
    this.targetPosition.set(x, 0, z);
    this.targetFacing = facing;
  }

  update(dt: number, currentSpeed: number): void {
    if (!this.mixer) return;

    this._state.speed = currentSpeed;
    this._state.isMoving = currentSpeed > 0.01;

    // Update blend weights
    const weights = computeBlendWeights(currentSpeed);
    if (this.actions.idle) this.actions.idle.setEffectiveWeight(weights.idle);
    if (this.actions.walk) {
      this.actions.walk.setEffectiveWeight(weights.walk);
      if (weights.walk > 0) {
        this.actions.walk.setEffectiveTimeScale(
          computeTimeScale(currentSpeed, LOCOMOTION_CLIPS.walk.speedMs)
        );
      }
    }
    if (this.actions.run) {
      this.actions.run.setEffectiveWeight(weights.run);
      if (weights.run > 0) {
        this.actions.run.setEffectiveTimeScale(
          computeTimeScale(currentSpeed, LOCOMOTION_CLIPS.run.speedMs)
        );
      }
    }

    // Smooth facing rotation
    let facingDelta =
      ((this.targetFacing - this._state.facing + Math.PI) % (Math.PI * 2)) -
      Math.PI;
    if (facingDelta < -Math.PI) facingDelta += Math.PI * 2;
    const maxRotation = this.rotationSpeed * dt;
    this._state.facing += Math.sign(facingDelta) * Math.min(Math.abs(facingDelta), maxRotation);

    // Position driven externally by formation interpolation (not by root motion for Phase 1)
    // Root motion integration: Phase 4
    this._state.position.copy(this.targetPosition);

    this.mixer.update(dt);
  }

  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }
    this.actions = {};
    this.clips = {};
  }
}
```

- [ ] **Step 3: Commit**

```
git add src/lib/features/stage/locomotion/clip-registry.ts src/lib/features/stage/locomotion/locomotion-controller.ts
git commit -m "feat(stage): add locomotion controller with blend tree and clip loading"
```

---

## Task 6: Module Registration (Nav + Route)

**Files:**
- Modify: `src/lib/shared/navigation/domain/types.ts`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/shared/navigation/config/module-definitions.ts`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add "stage" to ModuleId union**

In `src/lib/shared/navigation/domain/types.ts`, add `"stage"` to the union:

```typescript
// Add after "lab":
  | "stage"; // Stage choreography - multi-performer formation locomotion
```

(This replaces the final `| "lab";` line with `| "lab"\n  | "stage";`)

- [ ] **Step 2: Add STAGE_TABS to tab-definitions.ts**

Add to the end of `src/lib/shared/navigation/config/tab-definitions.ts`:

```typescript
export const STAGE_TABS: Section[] = [
  {
    id: "editor",
    label: "Editor",
    icon: '<i class="fas fa-map" aria-hidden="true"></i>',
    description: "Formation editor and timeline",
    color: "#06b6d4",
  },
  {
    id: "preview",
    label: "3D Preview",
    icon: '<i class="fas fa-cube" aria-hidden="true"></i>',
    description: "Live 3D choreography preview",
    color: "#06b6d4",
  },
];
```

- [ ] **Step 3: Add module definition**

In `src/lib/shared/navigation/config/module-definitions.ts`:

Add import: `STAGE_TABS` to the import from `"./tab-definitions"`.

Add module entry before the `lab` entry:

```typescript
  {
    id: "stage",
    label: "Stage",
    icon: '<i class="fas fa-people-group" style="color: #06b6d4;" aria-hidden="true"></i>',
    color: "#06b6d4",
    description: "Choreograph multi-performer formations on stage",
    isMain: true,
    sections: STAGE_TABS,
  },
```

- [ ] **Step 4: Add route preloader**

In `src/routes/+layout.svelte`, add to `URL_TO_MODULE`:

```typescript
    stage: () => import("$lib/features/stage/StageModule.svelte"),
```

- [ ] **Step 5: Commit**

```
git add src/lib/shared/navigation/domain/types.ts src/lib/shared/navigation/config/tab-definitions.ts src/lib/shared/navigation/config/module-definitions.ts src/routes/+layout.svelte
git commit -m "feat(stage): register Stage module in navigation and routing"
```

---

## Task 7: StageModule Entry Point

**Files:**
- Create: `src/lib/features/stage/StageModule.svelte`

- [ ] **Step 1: Create StageModule.svelte**

```svelte
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import StageEditorPanel from "./components/StageEditorPanel.svelte";
  import Stage3DPreview from "./components/Stage3DPreview.svelte";
  import { getStageChoreographyState } from "./state/stage-choreography-state.svelte";

  const state = getStageChoreographyState();

  let activeView = $state<"editor" | "preview">("editor");

  $effect(() => {
    const tab = navigationState.activeTab;
    if (tab === "editor" || tab === "preview") {
      activeView = tab;
    }
  });
</script>

<div class="stage-module">
  {#if activeView === "editor"}
    <StageEditorPanel />
  {:else}
    <Stage3DPreview />
  {/if}
</div>

<style>
  .stage-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-bg-primary, #0f0f1a);
  }
</style>
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/stage/StageModule.svelte
git commit -m "feat(stage): add StageModule entry component with tab routing"
```

---

## Task 8: SVG Stage Canvas (2D Editor Core)

**Files:**
- Create: `src/lib/features/stage/components/StageCanvas.svelte`
- Create: `src/lib/features/stage/components/PerformerDot.svelte`
- Create: `src/lib/features/stage/components/PathLine.svelte`

- [ ] **Step 1: Create PerformerDot.svelte**

```svelte
<script lang="ts">
  import type { PerformerPose } from "../domain/stage-types";

  interface Props {
    pose: PerformerPose;
    color: string;
    index: number;
    stageWidth: number;
    stageDepth: number;
    canvasWidth: number;
    canvasHeight: number;
    isSelected: boolean;
    onDrag: (x: number, z: number) => void;
    onSelect: () => void;
  }

  let { pose, color, index, stageWidth, stageDepth, canvasWidth, canvasHeight, isSelected, onDrag, onSelect }: Props = $props();

  const margin = 40;

  const cx = $derived(margin + (pose.x / stageWidth) * (canvasWidth - margin * 2));
  const cy = $derived(margin + (pose.z / stageDepth) * (canvasHeight - margin * 2));

  let isDragging = $state(false);

  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    onSelect();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const svg = (e.target as SVGElement).closest("svg")!;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = ((mouseX - margin) / (canvasWidth - margin * 2)) * stageWidth;
    const z = ((mouseY - margin) / (canvasHeight - margin * 2)) * stageDepth;
    onDrag(x, z);
  }

  function handlePointerUp() {
    isDragging = false;
  }
</script>

<g
  class="performer-dot"
  class:selected={isSelected}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  role="button"
  tabindex="0"
>
  <circle cx={cx} cy={cy} r={18} fill="{color}22" />
  <circle cx={cx} cy={cy} r={14} fill={color} stroke={isSelected ? "#fff" : "#ffffff44"} stroke-width={isSelected ? 2.5 : 1.5} />
  <text x={cx} y={cy} text-anchor="middle" dominant-baseline="central" fill="#000" font-size="11" font-weight="bold">
    {index + 1}
  </text>
</g>

<style>
  .performer-dot {
    cursor: grab;
  }
  .performer-dot:active {
    cursor: grabbing;
  }
</style>
```

- [ ] **Step 2: Create PathLine.svelte**

```svelte
<script lang="ts">
  import type { PerformerPose } from "../domain/stage-types";

  interface Props {
    from: PerformerPose;
    to: PerformerPose;
    color: string;
    stageWidth: number;
    stageDepth: number;
    canvasWidth: number;
    canvasHeight: number;
  }

  let { from, to, color, stageWidth, stageDepth, canvasWidth, canvasHeight }: Props = $props();

  const margin = 40;
  const x1 = $derived(margin + (from.x / stageWidth) * (canvasWidth - margin * 2));
  const y1 = $derived(margin + (from.z / stageDepth) * (canvasHeight - margin * 2));
  const x2 = $derived(margin + (to.x / stageWidth) * (canvasWidth - margin * 2));
  const y2 = $derived(margin + (to.z / stageDepth) * (canvasHeight - margin * 2));
</script>

<line
  {x1} {y1} {x2} {y2}
  stroke="{color}88"
  stroke-width="1.5"
  stroke-dasharray="4 6"
  marker-end="url(#arrowhead-{color.slice(1)})"
/>
```

- [ ] **Step 3: Create StageCanvas.svelte**

```svelte
<script lang="ts">
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import PerformerDot from "./PerformerDot.svelte";
  import PathLine from "./PathLine.svelte";

  const state = getStageChoreographyState();

  let containerEl = $state<HTMLDivElement | null>(null);
  let canvasWidth = $state(800);
  let canvasHeight = $state(500);

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      canvasWidth = entry.contentRect.width;
      canvasHeight = entry.contentRect.height;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  const { choreography, activeFormationIndex, activeFormation } = $derived(state);
  const nextFormation = $derived(state.nextFormation);
  const stageWidth = $derived(choreography.stageWidth);
  const stageDepth = $derived(choreography.stageDepth);
  const margin = 40;

  function stageToSvgX(x: number): number {
    return margin + (x / stageWidth) * (canvasWidth - margin * 2);
  }
  function stageToSvgY(z: number): number {
    return margin + (z / stageDepth) * (canvasHeight - margin * 2);
  }
</script>

<div class="stage-canvas-container" bind:this={containerEl}>
  <svg width={canvasWidth} height={canvasHeight} xmlns="http://www.w3.org/2000/svg">
    <!-- Stage boundary -->
    <rect
      x={margin}
      y={margin}
      width={canvasWidth - margin * 2}
      height={canvasHeight - margin * 2}
      fill="#1e2a3a"
      stroke="#3a5a7a"
      stroke-width="2"
    />

    <!-- Grid lines -->
    {#each Array.from({ length: Math.floor(stageWidth) + 1 }, (_, i) => i) as x}
      <line
        x1={stageToSvgX(x)}
        y1={margin}
        x2={stageToSvgX(x)}
        y2={canvasHeight - margin}
        stroke="#2a3a4a"
        stroke-width="0.5"
      />
    {/each}
    {#each Array.from({ length: Math.floor(stageDepth) + 1 }, (_, i) => i) as z}
      <line
        x1={margin}
        y1={stageToSvgY(z)}
        x2={canvasWidth - margin}
        y2={stageToSvgY(z)}
        stroke="#2a3a4a"
        stroke-width="0.5"
      />
    {/each}

    <!-- Labels -->
    <text x={(canvasWidth) / 2} y={margin - 12} text-anchor="middle" fill="#6a6a8a" font-size="11">AUDIENCE</text>
    <text x={(canvasWidth) / 2} y={canvasHeight - margin + 18} text-anchor="middle" fill="#6a6a8a" font-size="11">BACKSTAGE</text>

    <!-- Path lines to next formation -->
    {#if activeFormation && nextFormation}
      {#each activeFormation.positions as fromPose, i}
        {@const toPose = nextFormation.positions[i]}
        {#if toPose}
          <PathLine
            from={fromPose}
            to={toPose}
            color={choreography.performers[i]?.color ?? "#888"}
            {stageWidth}
            {stageDepth}
            {canvasWidth}
            {canvasHeight}
          />
        {/if}
      {/each}
    {/if}

    <!-- Performer dots -->
    {#if activeFormation}
      {#each activeFormation.positions as pose, i}
        <PerformerDot
          {pose}
          color={choreography.performers[i]?.color ?? "#888"}
          index={i}
          {stageWidth}
          {stageDepth}
          {canvasWidth}
          {canvasHeight}
          isSelected={state.selectedPerformerIndex === i}
          onDrag={(x, z) => state.updatePerformerPosition(activeFormationIndex, pose.performerId, x, z)}
          onSelect={() => { state.selectedPerformerIndex = i; }}
        />
      {/each}
    {/if}
  </svg>
</div>

<style>
  .stage-canvas-container {
    flex: 1;
    min-height: 300px;
    background: #12121f;
    border-radius: 8px;
    overflow: hidden;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
```

- [ ] **Step 4: Commit**

```
git add src/lib/features/stage/components/StageCanvas.svelte src/lib/features/stage/components/PerformerDot.svelte src/lib/features/stage/components/PathLine.svelte
git commit -m "feat(stage): add SVG stage canvas with draggable performer dots and path lines"
```

---

## Task 9: Beat Timeline

**Files:**
- Create: `src/lib/features/stage/components/BeatTimeline.svelte`

- [ ] **Step 1: Create BeatTimeline.svelte**

```svelte
<script lang="ts">
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import type { FormationPresetId } from "../domain/stage-types";

  const state = getStageChoreographyState();
  const { choreography, activeFormationIndex, isPlaying, playProgress } = $derived(state);

  const totalBeats = $derived(
    Math.max(
      16,
      (choreography.formations.at(-1)?.beat ?? 0) + 8
    )
  );

  function beatToPercent(beat: number): number {
    return (beat / totalBeats) * 100;
  }

  function handleBarClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const beat = Math.round(pct * totalBeats);
    const existing = choreography.formations.findIndex((f) => f.beat === beat);
    if (existing === -1) {
      state.addFormation(beat, "line" as FormationPresetId);
    }
    state.activeFormationIndex = choreography.formations.findIndex(
      (f) => f.beat === beat
    );
  }
</script>

<div class="beat-timeline">
  <div class="controls">
    <button class="play-btn" onclick={() => isPlaying ? state.stop() : state.play()}>
      {isPlaying ? "Stop" : "Play"}
    </button>
    <span class="bpm-display">{choreography.bpm} BPM</span>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="timeline-bar" onclick={handleBarClick}>
    <!-- Beat markers -->
    {#each Array.from({ length: totalBeats + 1 }, (_, i) => i) as beat}
      <div
        class="beat-marker"
        class:major={beat % 4 === 0}
        style="left: {beatToPercent(beat)}%"
      />
    {/each}

    <!-- Formation markers -->
    {#each choreography.formations as formation, i}
      <button
        class="formation-marker"
        class:active={i === activeFormationIndex}
        style="left: {beatToPercent(formation.beat)}%"
        onclick|stopPropagation={() => { state.activeFormationIndex = i; }}
      >
        F{i + 1}
      </button>
    {/each}

    <!-- Playhead -->
    {#if isPlaying}
      {@const current = choreography.formations[activeFormationIndex]}
      {@const next = choreography.formations[activeFormationIndex + 1]}
      {#if current && next}
        {@const playBeat = current.beat + (next.beat - current.beat) * playProgress}
        <div class="playhead" style="left: {beatToPercent(playBeat)}%" />
      {/if}
    {/if}

    <!-- Beat numbers -->
    <div class="beat-labels">
      {#each Array.from({ length: Math.floor(totalBeats / 4) + 1 }, (_, i) => i * 4) as beat}
        <span style="left: {beatToPercent(beat)}%">{beat}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .beat-timeline {
    padding: 12px 16px;
    background: #0f0f1f;
    border-top: 1px solid #2a2a4a;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .play-btn {
    background: #2a4a7a;
    color: #fff;
    border: none;
    padding: 4px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .play-btn:hover { background: #3a5a9a; }
  .bpm-display {
    font-size: 11px;
    color: #6a8aaa;
  }
  .timeline-bar {
    position: relative;
    height: 40px;
    background: #1a1a2e;
    border-radius: 4px;
    cursor: pointer;
  }
  .beat-marker {
    position: absolute;
    top: 8px;
    width: 1px;
    height: 12px;
    background: #3a3a5a;
  }
  .beat-marker.major {
    height: 16px;
    background: #4a5a7a;
    top: 6px;
  }
  .formation-marker {
    position: absolute;
    top: 4px;
    transform: translateX(-50%);
    background: #2a7a4a;
    color: #fff;
    border: none;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    z-index: 2;
  }
  .formation-marker.active {
    background: #3aaa6a;
    box-shadow: 0 0 6px #3aaa6a88;
  }
  .playhead {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: #ff4444;
    z-index: 3;
  }
  .beat-labels {
    position: absolute;
    bottom: 2px;
    left: 0;
    right: 0;
  }
  .beat-labels span {
    position: absolute;
    transform: translateX(-50%);
    font-size: 9px;
    color: #5a5a7a;
  }
</style>
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/stage/components/BeatTimeline.svelte
git commit -m "feat(stage): add beat timeline with formation markers and playhead"
```

---

## Task 10: Stage Editor Panel (Container)

**Files:**
- Create: `src/lib/features/stage/components/StageEditorPanel.svelte`

- [ ] **Step 1: Create StageEditorPanel.svelte**

```svelte
<script lang="ts">
  import StageCanvas from "./StageCanvas.svelte";
  import BeatTimeline from "./BeatTimeline.svelte";
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import type { FormationPresetId } from "../domain/stage-types";

  const state = getStageChoreographyState();
  const { choreography } = $derived(state);

  const presets: { id: FormationPresetId; label: string }[] = [
    { id: "line", label: "Line" },
    { id: "triangle", label: "Triangle" },
    { id: "diamond", label: "Diamond" },
    { id: "circle", label: "Circle" },
    { id: "v-shape", label: "V-Shape" },
    { id: "grid", label: "Grid" },
    { id: "stagger", label: "Stagger" },
    { id: "cluster", label: "Cluster" },
  ];

  function initDefault() {
    if (choreography.formations.length === 0) {
      state.addFormation(0, "line");
      state.addFormation(4, "triangle");
    }
  }

  $effect(() => { initDefault(); });
</script>

<div class="stage-editor-panel">
  <aside class="sidebar">
    <section>
      <h3>Performers</h3>
      <label>
        Count: {choreography.performers.length}
        <input
          type="range"
          min="2"
          max="8"
          value={choreography.performers.length}
          oninput={(e) => state.setPerformerCount(+(e.target as HTMLInputElement).value)}
        />
      </label>
    </section>

    <section>
      <h3>Presets</h3>
      <div class="preset-grid">
        {#each presets as preset}
          <button
            class="preset-btn"
            onclick={() => state.applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h3>Formations</h3>
      <p class="hint">{choreography.formations.length} keyframe{choreography.formations.length === 1 ? "" : "s"}</p>
      <p class="hint">Active: F{state.activeFormationIndex + 1} (beat {state.activeFormation?.beat ?? 0})</p>
    </section>
  </aside>

  <main class="editor-main">
    <StageCanvas />
    <BeatTimeline />
  </main>
</div>

<style>
  .stage-editor-panel {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100%;
    overflow: hidden;
  }
  .sidebar {
    background: #16213e;
    padding: 16px;
    border-right: 1px solid #2a2a4a;
    overflow-y: auto;
  }
  .sidebar h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #8888aa;
    margin: 16px 0 8px;
  }
  .sidebar h3:first-child { margin-top: 0; }
  .sidebar label {
    display: block;
    font-size: 12px;
    color: #c0c0e0;
  }
  .sidebar input[type="range"] {
    width: 100%;
    margin-top: 4px;
  }
  .preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .preset-btn {
    background: #2a2a4a;
    color: #c0c0e0;
    border: 1px solid #3a3a5a;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    text-align: center;
  }
  .preset-btn:hover {
    background: #3a3a6a;
    border-color: #5a5a8a;
  }
  .hint {
    font-size: 11px;
    color: #6a6a8a;
    margin: 4px 0;
  }
  .editor-main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/stage/components/StageEditorPanel.svelte
git commit -m "feat(stage): add editor panel with sidebar controls and canvas container"
```

---

## Task 11: 3D Preview with Locomotion

**Files:**
- Create: `src/lib/features/stage/components/LocomotingPerformer.svelte`
- Create: `src/lib/features/stage/components/Stage3DPreview.svelte`

- [ ] **Step 1: Create LocomotingPerformer.svelte**

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import * as THREE from "three";
  import { LocomotionController } from "../locomotion/locomotion-controller";
  import type { InterpolatedPose } from "../state/formation-interpolator";

  interface Props {
    pose: InterpolatedPose;
    avatarPath: string;
    facing: number;
  }

  let { pose, avatarPath, facing }: Props = $props();

  const gltf = useGltf(avatarPath);
  let controller: LocomotionController | null = $state(null);
  let group = $state<THREE.Group | null>(null);

  $effect(() => {
    if (!$gltf) return;
    const scene = $gltf.scene.clone();
    const ctrl = new LocomotionController();
    ctrl.initialize(scene).then(() => {
      controller = ctrl;
    });
    return () => { ctrl.dispose(); };
  });

  useTask((delta) => {
    if (!controller) return;
    controller.setTarget(pose.x, pose.z, pose.facing);
    controller.update(delta, pose.speed);

    if (group) {
      group.position.set(pose.x, 0, pose.z);
      group.rotation.y = -pose.facing;
    }
  });
</script>

{#if $gltf}
  <T.Group bind:ref={group}>
    <T.Primitive object={$gltf.scene.clone()} />
  </T.Group>
{/if}
```

- [ ] **Step 2: Create Stage3DPreview.svelte**

```svelte
<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import LocomotingPerformer from "./LocomotingPerformer.svelte";

  const state = getStageChoreographyState();
  const { choreography, interpolatedPositions } = $derived(state);

  const avatarPath = "/models/avatars/ch01.glb";
</script>

<div class="preview-3d">
  <Canvas>
    <!-- Camera -->
    <T.PerspectiveCamera
      makeDefault
      position={[choreography.stageWidth / 2, 12, choreography.stageDepth + 5]}
      fov={50}
    >
      <OrbitControls
        target={[choreography.stageWidth / 2, 0, choreography.stageDepth / 2]}
        enableDamping
      />
    </T.PerspectiveCamera>

    <!-- Lighting -->
    <T.AmbientLight intensity={0.4} />
    <T.DirectionalLight position={[5, 10, 5]} intensity={0.8} castShadow />

    <!-- Stage floor -->
    <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[choreography.stageWidth, choreography.stageDepth]} />
      <T.MeshStandardMaterial color="#1e2a3a" />
    </T.Mesh>

    <!-- Stage grid lines -->
    <T.GridHelper
      args={[Math.max(choreography.stageWidth, choreography.stageDepth), 10, "#3a5a7a", "#2a3a4a"]}
      position={[choreography.stageWidth / 2, 0.01, choreography.stageDepth / 2]}
    />

    <!-- Performers -->
    {#each interpolatedPositions as pose, i (choreography.performers[i]?.id)}
      <LocomotingPerformer
        {pose}
        {avatarPath}
        facing={pose.facing}
      />
    {/each}
  </Canvas>
</div>

<style>
  .preview-3d {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }
</style>
```

- [ ] **Step 3: Commit**

```
git add src/lib/features/stage/components/LocomotingPerformer.svelte src/lib/features/stage/components/Stage3DPreview.svelte
git commit -m "feat(stage): add 3D preview with locomoting performers and blend tree"
```

---

## Task 12: Integration Test + Verification

**Files:**
- Test: `tests/unit/stage/clip-registry.test.ts`

- [ ] **Step 1: Write tests for blend weight computation**

```typescript
import { describe, it, expect } from "vitest";
import {
  computeBlendWeights,
  computeTimeScale,
} from "$lib/features/stage/locomotion/clip-registry";

describe("clip-registry", () => {
  describe("computeBlendWeights", () => {
    it("returns full idle at speed 0", () => {
      const w = computeBlendWeights(0);
      expect(w.idle).toBe(1);
      expect(w.walk).toBe(0);
      expect(w.run).toBe(0);
    });

    it("returns full walk at walk speed", () => {
      const w = computeBlendWeights(1.4);
      expect(w.idle).toBe(0);
      expect(w.walk).toBe(1);
      expect(w.run).toBe(0);
    });

    it("blends idle and walk at half walk speed", () => {
      const w = computeBlendWeights(0.7);
      expect(w.idle).toBeCloseTo(0.5);
      expect(w.walk).toBeCloseTo(0.5);
      expect(w.run).toBe(0);
    });

    it("returns full run at run speed", () => {
      const w = computeBlendWeights(4.0);
      expect(w.idle).toBe(0);
      expect(w.walk).toBe(0);
      expect(w.run).toBe(1);
    });

    it("blends walk and run at midpoint", () => {
      const w = computeBlendWeights(2.7); // midpoint between 1.4 and 4.0
      expect(w.idle).toBe(0);
      expect(w.walk).toBeCloseTo(0.5);
      expect(w.run).toBeCloseTo(0.5);
    });
  });

  describe("computeTimeScale", () => {
    it("returns 1 when speed matches clip speed", () => {
      expect(computeTimeScale(1.4, 1.4)).toBeCloseTo(1);
    });

    it("returns > 1 when moving faster than clip", () => {
      expect(computeTimeScale(2.0, 1.4)).toBeGreaterThan(1);
    });

    it("clamps to minimum 0.5", () => {
      expect(computeTimeScale(0.1, 1.4)).toBe(0.5);
    });

    it("clamps to maximum 2.0", () => {
      expect(computeTimeScale(10, 1.4)).toBe(2.0);
    });
  });
});
```

- [ ] **Step 2: Run all stage tests**

Run: `npx vitest run tests/unit/stage/`
Expected: All tests PASS

- [ ] **Step 3: Run full typecheck**

Run: `npm run check`
Expected: No type errors in stage module files

- [ ] **Step 4: Commit**

```
git add tests/unit/stage/clip-registry.test.ts
git commit -m "test(stage): add unit tests for blend weight computation and time scale"
```

---

## Task 13: Final Wiring + Build Verification

- [ ] **Step 1: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify dev server loads Stage module**

Run: `vite --port 5174` (separate from user's dev server)
Navigate to `http://localhost:5174/stage`
Expected: Stage editor panel renders with SVG canvas, performer dots, preset buttons, and timeline

- [ ] **Step 3: Verify 3D preview tab**

Navigate to Stage module → Preview tab
Expected: 3D viewport renders with stage floor, grid helper, and avatar models at formation positions

- [ ] **Step 4: Verify formation transition playback**

Click "Play" in editor timeline
Expected: Formation markers advance, 2D dots interpolate positions, 3D performers walk between positions

- [ ] **Step 5: Final commit**

```
git add -A
git commit -m "feat(stage): complete Phase 1 vertical slice - formation editor + locomotion preview"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Type definitions | `domain/stage-types.ts` |
| 2 | Formation interpolation (tested) | `state/formation-interpolator.ts` |
| 3 | Formation presets (8 layouts) | `state/formation-presets.ts` |
| 4 | Reactive choreography state | `state/stage-choreography-state.svelte.ts` |
| 5 | Locomotion controller + blend tree | `locomotion/locomotion-controller.ts`, `clip-registry.ts` |
| 6 | Nav + route registration | 4 existing files modified |
| 7 | Module entry point | `StageModule.svelte` |
| 8 | SVG stage canvas + dots + paths | 3 components |
| 9 | Beat timeline | `BeatTimeline.svelte` |
| 10 | Editor panel container | `StageEditorPanel.svelte` |
| 11 | 3D preview + locomotion | 2 components |
| 12 | Unit tests | 2 test files |
| 13 | Build verification | No new files |
