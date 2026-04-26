# 3D Effects: Infrastructure + Trails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared 3D effects infrastructure (quality tiers, 2D overlay suppression, tip position bridge) and the first effect — GPU ribbon trails with Catmull-Rom interpolation, environment lighting, and quality tier degradation.

**Architecture:** Per-effect specialized renderers sharing a quality tier system and dynamic light manager. The trail renderer replaces the existing `RibbonTrail3D.svelte` Verlet-physics ribbon with a proper Catmull-Rom interpolated GPU ribbon mesh that matches the 2D trail quality. The `EffectOrchestrator3D` replaces `EffectsLayer.svelte` as the central coordinator.

**Tech Stack:** Three.js + Threlte v8/v9, Svelte 5 runes, custom `ShaderMaterial`, ITI dependency injection.

**Spec:** `docs/superpowers/specs/2026-04-04-3d-effects-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/shared/3d/effects/quality/QualityTierDetector.ts` | Auto-detect High/Medium/Low tier from GPU capabilities |
| `src/lib/shared/3d/effects/quality/contracts/IQualityTierDetector.ts` | Interface for quality tier detection |
| `src/lib/shared/3d/effects/TipPositionBridge3D.ts` | Convert PropState3D to per-tip world positions with velocity/jerk |
| `src/lib/shared/3d/effects/contracts/ITipPositionBridge3D.ts` | Interface for tip position bridge |
| `src/lib/shared/3d/effects/lighting/DynamicLightManager.ts` | Pooled THREE.PointLight management with tier-based caps |
| `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` | Routes TipEffectMap assignments to 3D renderers |
| `src/lib/shared/3d/effects/trails/TrailRenderer3D.ts` | Ring buffer + Catmull-Rom + triangle strip mesh generation |
| `src/lib/shared/3d/effects/trails/TrailMaterial3D.ts` | Custom ShaderMaterial for emissive fading ribbon |
| `src/lib/shared/3d/effects/trails/Trail3D.svelte` | Threlte component wrapper for trail rendering |
| `tests/unit/3d-effects/quality-tier-detector.test.ts` | Tests for tier detection logic |
| `tests/unit/3d-effects/tip-position-bridge.test.ts` | Tests for 3D tip position transforms |
| `tests/unit/3d-effects/trail-ring-buffer.test.ts` | Tests for ring buffer wrap-around correctness |
| `tests/unit/3d-effects/dynamic-light-manager.test.ts` | Tests for light pool capping and lifecycle |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` | Add `suppress2DOverlays` to `RenderFrameParams` |
| `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` | Check `suppress2DOverlays` flag before rendering overlays |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | Replace EffectsLayer with EffectOrchestrator3D |
| `src/lib/shared/3d/effects/types.ts` | Add `QualityTier` enum and `TipPositionData3D` type |
| `src/lib/shared/di/containers/3d-container.ts` | Register QualityTierDetector and TipPositionBridge3D |
| `src/lib/shared/di/container-types.ts` | Add new service types to IAppContainerItems |

### Files to Delete (after trails are working)

| File | Replaced By |
|------|-------------|
| `src/lib/shared/3d/effects/trails/RibbonTrail3D.svelte` | `trails/Trail3D.svelte` |
| `src/lib/shared/3d/effects/trails/TrailRenderer.svelte` | `trails/TrailRenderer3D.ts` |

---

## Task 1: Quality Tier Types and Detection

**Files:**
- Create: `src/lib/shared/3d/effects/quality/contracts/IQualityTierDetector.ts`
- Create: `src/lib/shared/3d/effects/quality/QualityTierDetector.ts`
- Modify: `src/lib/shared/3d/effects/types.ts`
- Test: `tests/unit/3d-effects/quality-tier-detector.test.ts`

- [ ] **Step 1: Add QualityTier enum to types.ts**

Add to the existing `src/lib/shared/3d/effects/types.ts`:

```typescript
export enum QualityTier {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export interface QualityTierConfig {
  tier: QualityTier;
  maxParticles: number;
  maxDynamicLights: number;
  enableShadows: boolean;
  enableBloom: boolean;
  enableGroundInteraction: boolean;
}

export const TIER_CONFIGS: Record<QualityTier, QualityTierConfig> = {
  [QualityTier.HIGH]: {
    tier: QualityTier.HIGH,
    maxParticles: 50000,
    maxDynamicLights: 4,
    enableShadows: true,
    enableBloom: true,
    enableGroundInteraction: true,
  },
  [QualityTier.MEDIUM]: {
    tier: QualityTier.MEDIUM,
    maxParticles: 10000,
    maxDynamicLights: 2,
    enableShadows: false,
    enableBloom: true,
    enableGroundInteraction: false,
  },
  [QualityTier.LOW]: {
    tier: QualityTier.LOW,
    maxParticles: 2000,
    maxDynamicLights: 0,
    enableShadows: false,
    enableBloom: false,
    enableGroundInteraction: false,
  },
};
```

- [ ] **Step 2: Write the failing test for QualityTierDetector**

Create `tests/unit/3d-effects/quality-tier-detector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { QualityTierDetector } from "$lib/shared/3d/effects/quality/QualityTierDetector";
import { QualityTier } from "$lib/shared/3d/effects/types";

describe("QualityTierDetector", () => {
  it("returns HIGH for desktop-class capabilities", () => {
    const detector = new QualityTierDetector();
    const tier = detector.detectFromCapabilities({
      maxTextureUnits: 16,
      floatTextures: true,
      hardwareConcurrency: 12,
      isWebGPU: false,
    });
    expect(tier).toBe(QualityTier.HIGH);
  });

  it("returns MEDIUM for mid-range capabilities", () => {
    const detector = new QualityTierDetector();
    const tier = detector.detectFromCapabilities({
      maxTextureUnits: 8,
      floatTextures: true,
      hardwareConcurrency: 4,
      isWebGPU: false,
    });
    expect(tier).toBe(QualityTier.MEDIUM);
  });

  it("returns LOW for weak capabilities", () => {
    const detector = new QualityTierDetector();
    const tier = detector.detectFromCapabilities({
      maxTextureUnits: 4,
      floatTextures: false,
      hardwareConcurrency: 2,
      isWebGPU: false,
    });
    expect(tier).toBe(QualityTier.LOW);
  });

  it("allows manual override", () => {
    const detector = new QualityTierDetector();
    detector.setOverride(QualityTier.LOW);
    expect(detector.currentTier).toBe(QualityTier.LOW);
  });

  it("clears override to return detected tier", () => {
    const detector = new QualityTierDetector();
    detector.detectFromCapabilities({
      maxTextureUnits: 16,
      floatTextures: true,
      hardwareConcurrency: 12,
      isWebGPU: false,
    });
    detector.setOverride(QualityTier.LOW);
    detector.clearOverride();
    expect(detector.currentTier).toBe(QualityTier.HIGH);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/3d-effects/quality-tier-detector.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create the IQualityTierDetector interface**

Create `src/lib/shared/3d/effects/quality/contracts/IQualityTierDetector.ts`:

```typescript
import type { QualityTier, QualityTierConfig } from "../../types";

export interface GPUCapabilities {
  maxTextureUnits: number;
  floatTextures: boolean;
  hardwareConcurrency: number;
  isWebGPU: boolean;
}

export interface IQualityTierDetector {
  readonly currentTier: QualityTier;
  readonly currentConfig: QualityTierConfig;
  detectFromCapabilities(capabilities: GPUCapabilities): QualityTier;
  detectFromRenderer(renderer: unknown): QualityTier;
  setOverride(tier: QualityTier): void;
  clearOverride(): void;
  downgrade(): void;
}
```

- [ ] **Step 5: Implement QualityTierDetector**

Create `src/lib/shared/3d/effects/quality/QualityTierDetector.ts`:

```typescript
import { QualityTier, TIER_CONFIGS } from "../types";
import type { QualityTierConfig } from "../types";
import type {
  GPUCapabilities,
  IQualityTierDetector,
} from "./contracts/IQualityTierDetector";

const STORAGE_KEY = "tka-3d-quality-tier-override";

export class QualityTierDetector implements IQualityTierDetector {
  private detectedTier: QualityTier = QualityTier.MEDIUM;
  private overrideTier: QualityTier | null = null;

  constructor() {
    this.loadOverride();
  }

  get currentTier(): QualityTier {
    return this.overrideTier ?? this.detectedTier;
  }

  get currentConfig(): QualityTierConfig {
    return TIER_CONFIGS[this.currentTier];
  }

  detectFromCapabilities(capabilities: GPUCapabilities): QualityTier {
    if (capabilities.isWebGPU) {
      this.detectedTier = QualityTier.HIGH;
    } else if (
      capabilities.floatTextures &&
      capabilities.hardwareConcurrency >= 8 &&
      capabilities.maxTextureUnits >= 16
    ) {
      this.detectedTier = QualityTier.HIGH;
    } else if (
      capabilities.floatTextures &&
      capabilities.hardwareConcurrency >= 4
    ) {
      this.detectedTier = QualityTier.MEDIUM;
    } else {
      this.detectedTier = QualityTier.LOW;
    }
    return this.currentTier;
  }

  detectFromRenderer(renderer: unknown): QualityTier {
    // Cast to Three.js WebGLRenderer to read capabilities
    const gl = renderer as {
      capabilities?: {
        maxTextures?: number;
        floatFragmentTextures?: boolean;
        isWebGPU?: boolean;
      };
    };
    const caps = gl?.capabilities;
    return this.detectFromCapabilities({
      maxTextureUnits: caps?.maxTextures ?? 8,
      floatTextures: caps?.floatFragmentTextures ?? false,
      hardwareConcurrency: typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency ?? 4
        : 4,
      isWebGPU: caps?.isWebGPU ?? false,
    });
  }

  setOverride(tier: QualityTier): void {
    this.overrideTier = tier;
    this.persistOverride(tier);
  }

  clearOverride(): void {
    this.overrideTier = null;
    this.removePersistedOverride();
  }

  downgrade(): void {
    const order = [QualityTier.HIGH, QualityTier.MEDIUM, QualityTier.LOW];
    const currentIndex = order.indexOf(this.currentTier);
    if (currentIndex < order.length - 1) {
      this.detectedTier = order[currentIndex + 1];
    }
  }

  private loadOverride(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && Object.values(QualityTier).includes(stored as QualityTier)) {
        this.overrideTier = stored as QualityTier;
      }
    } catch {
      // localStorage unavailable
    }
  }

  private persistOverride(tier: QualityTier): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, tier);
    } catch {
      // localStorage unavailable
    }
  }

  private removePersistedOverride(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/3d-effects/quality-tier-detector.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/effects/quality/ src/lib/shared/3d/effects/types.ts tests/unit/3d-effects/quality-tier-detector.test.ts
git commit -m "feat(3d-effects): add quality tier detection with High/Medium/Low tiers"
```

---

## Task 2: 2D Overlay Suppression

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

- [ ] **Step 1: Add `suppress2DOverlays` to RenderFrameParams**

In `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`, add to `RenderFrameParams` interface (after the `tipEffectMap` field at line 120):

```typescript
  /** When true, skip fire/charcoal/LED/trail overlay rendering (3D mode handles effects) */
  suppress2DOverlays?: boolean;
```

- [ ] **Step 2: Guard overlay rendering in AnimationRenderLoop.ts**

In `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`, find the `render()` method. Add the suppression check before the trail overlay block (~line 419), before the fire/charcoal block (~line 488), and before the LED block (~line 587).

The cleanest approach: add a single early-return guard at the start of the overlay section. Find the line after the Canvas2D `renderScene()` call (after line ~484) and before the fire overlay section. Add:

```typescript
    // Skip all 2D effect overlays when 3D mode is handling effects
    if (params.suppress2DOverlays) {
      return;
    }
```

Also add the same guard before the trail overlay block (~line 419):

```typescript
    // Trail overlay
    if (this.trailOverlay && effectiveTrailsVisible && !params.suppress2DOverlays) {
```

- [ ] **Step 3: Wire the flag from AnimationEngine**

The `RenderFrameParams` is assembled in `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`, in the `getFrameParams()` method (~line 2074). This method mutates a reusable `frameParams` object.

After the `fp.tipEffectMap` assignment (~line 2143), add:

```typescript
    // Suppress 2D effect overlays when 3D mode is active
    fp.suppress2DOverlays = this.state.suppress2DOverlays ?? false;
```

The `AnimationEngine` gets its state from a reactive `AnimationEngineState`. The `suppress2DOverlays` flag needs to be added to that state and set by the component that manages the 2D/3D toggle (`SequenceViewerOrchestrator.svelte` or wherever `viewer3DState.renderMode` is read). Set it to `true` when `renderMode === "3d"`.

The exact wiring depends on how `AnimationEngineState` is constructed — trace from `Viewer3DScene` up to the orchestrator that owns both the 2D engine and the 3D state.

- [ ] **Step 4: Verify by building**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts
# Also add whichever file constructs the RenderFrameParams
git commit -m "feat(3d-effects): suppress 2D effect overlays when in 3D mode"
```

---

## Task 3: Tip Position Bridge

**Files:**
- Create: `src/lib/shared/3d/effects/contracts/ITipPositionBridge3D.ts`
- Create: `src/lib/shared/3d/effects/TipPositionBridge3D.ts`
- Modify: `src/lib/shared/3d/effects/types.ts`
- Test: `tests/unit/3d-effects/tip-position-bridge.test.ts`

- [ ] **Step 1: Add TipPositionData3D type to types.ts**

```typescript
import { Vector3 } from "three";

export interface TipPositionData3D {
  position: Vector3;
  velocity: Vector3;
  jerk: Vector3;
  speed: number;
}

export interface PropTipPositions3D {
  tips: TipPositionData3D[];
  propIndex: number;
}
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/3d-effects/tip-position-bridge.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TipPositionBridge3D } from "$lib/shared/3d/effects/TipPositionBridge3D";
import { Vector3, Quaternion } from "three";

function makePropState(pos: Vector3, rot: Quaternion) {
  return {
    worldPosition: pos,
    worldRotation: rot,
    staffRotationAngle: 0,
    plane: "WALL" as const,
    centerPathAngle: 0,
  };
}

describe("TipPositionBridge3D", () => {
  it("computes tip positions from prop state", () => {
    const bridge = new TipPositionBridge3D();
    const propState = makePropState(
      new Vector3(0, 1, 0),
      new Quaternion().identity()
    );
    const result = bridge.update(0, propState, 0.5, 1 / 60);
    expect(result.tips.length).toBe(2); // staff has 2 tips
    expect(result.propIndex).toBe(0);
  });

  it("computes velocity from position changes", () => {
    const bridge = new TipPositionBridge3D();
    const state1 = makePropState(new Vector3(0, 1, 0), new Quaternion());
    const state2 = makePropState(new Vector3(1, 1, 0), new Quaternion());

    bridge.update(0, state1, 0.5, 1 / 60);
    const result = bridge.update(0, state2, 0.5, 1 / 60);

    // Velocity should be non-zero after position change
    const tipVelocity = result.tips[0].velocity;
    expect(tipVelocity.length()).toBeGreaterThan(0);
  });

  it("resets velocity on first frame (no previous data)", () => {
    const bridge = new TipPositionBridge3D();
    const state = makePropState(new Vector3(5, 3, 1), new Quaternion());
    const result = bridge.update(0, state, 0.5, 1 / 60);

    // First frame: velocity should be zero
    expect(result.tips[0].velocity.length()).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/3d-effects/tip-position-bridge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create the interface**

Create `src/lib/shared/3d/effects/contracts/ITipPositionBridge3D.ts`:

```typescript
import type { PropTipPositions3D } from "../types";

export interface PropState3DLike {
  worldPosition: { x: number; y: number; z: number };
  worldRotation: { x: number; y: number; z: number; w: number };
  staffRotationAngle: number;
  plane: string;
  centerPathAngle: number;
}

export interface ITipPositionBridge3D {
  update(
    propIndex: number,
    propState: PropState3DLike,
    staffHalfLength: number,
    deltaTime: number
  ): PropTipPositions3D;
  reset(): void;
}
```

- [ ] **Step 5: Implement TipPositionBridge3D**

Create `src/lib/shared/3d/effects/TipPositionBridge3D.ts`:

```typescript
import { Vector3, Quaternion, Euler } from "three";
import type { PropTipPositions3D, TipPositionData3D } from "./types";
import type {
  ITipPositionBridge3D,
  PropState3DLike,
} from "./contracts/ITipPositionBridge3D";

interface TipHistory {
  prevPosition: Vector3;
  prevVelocity: Vector3;
  hasData: boolean;
}

export class TipPositionBridge3D implements ITipPositionBridge3D {
  // Keyed by "propIndex-tipIndex"
  private history = new Map<string, TipHistory>();

  // Reusable temporaries (avoid allocation in hot path)
  private readonly tempQuat = new Quaternion();
  private readonly tempAxis = new Vector3();

  update(
    propIndex: number,
    propState: PropState3DLike,
    staffHalfLength: number,
    deltaTime: number
  ): PropTipPositions3D {
    const center = new Vector3(
      propState.worldPosition.x,
      propState.worldPosition.y,
      propState.worldPosition.z
    );
    const rotation = new Quaternion(
      propState.worldRotation.x,
      propState.worldRotation.y,
      propState.worldRotation.z,
      propState.worldRotation.w
    );

    // Staff axis: apply the same rotation logic as Staff3D.svelte
    // Staff3D applies a horizontal quaternion (Z = PI/2) then the prop rotation
    const horizontalQuat = this.tempQuat.setFromEuler(
      new Euler(0, 0, Math.PI / 2)
    );
    const finalQuat = rotation.clone().multiply(horizontalQuat);

    this.tempAxis.set(0, 1, 0).applyQuaternion(finalQuat);
    const axis = this.tempAxis;

    // Two tips: positive end and negative end
    const positivePos = center
      .clone()
      .add(axis.clone().multiplyScalar(staffHalfLength));
    const negativePos = center
      .clone()
      .sub(axis.clone().multiplyScalar(staffHalfLength));

    const tips: TipPositionData3D[] = [
      this.computeTipData(propIndex, 0, positivePos, deltaTime),
      this.computeTipData(propIndex, 1, negativePos, deltaTime),
    ];

    return { tips, propIndex };
  }

  reset(): void {
    this.history.clear();
  }

  private computeTipData(
    propIndex: number,
    tipIndex: number,
    position: Vector3,
    deltaTime: number
  ): TipPositionData3D {
    const key = `${propIndex}-${tipIndex}`;
    let hist = this.history.get(key);

    if (!hist) {
      hist = {
        prevPosition: position.clone(),
        prevVelocity: new Vector3(),
        hasData: false,
      };
      this.history.set(key, hist);
      return {
        position: position.clone(),
        velocity: new Vector3(),
        jerk: new Vector3(),
        speed: 0,
      };
    }

    const invDt = deltaTime > 0 ? 1 / deltaTime : 60;
    const velocity = position.clone().sub(hist.prevPosition).multiplyScalar(invDt);
    const jerk = velocity.clone().sub(hist.prevVelocity).multiplyScalar(invDt);
    const speed = velocity.length();

    hist.prevPosition.copy(position);
    hist.prevVelocity.copy(velocity);
    hist.hasData = true;

    return { position: position.clone(), velocity, jerk, speed };
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/3d-effects/tip-position-bridge.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/effects/TipPositionBridge3D.ts src/lib/shared/3d/effects/contracts/ITipPositionBridge3D.ts src/lib/shared/3d/effects/types.ts tests/unit/3d-effects/tip-position-bridge.test.ts
git commit -m "feat(3d-effects): add tip position bridge for 3D world-space tracking"
```

---

## Task 4: Dynamic Light Manager

**Files:**
- Create: `src/lib/shared/3d/effects/lighting/DynamicLightManager.ts`

- [ ] **Step 1: Implement DynamicLightManager**

Create `src/lib/shared/3d/effects/lighting/DynamicLightManager.ts`:

```typescript
import { PointLight, Color, Scene, Vector3 } from "three";
import type { QualityTierConfig } from "../types";

export interface LightHandle {
  id: number;
}

export class DynamicLightManager {
  private scene: Scene;
  private maxLights: number;
  private pool: PointLight[] = [];
  private activeHandles = new Map<number, PointLight>();
  private nextId = 0;

  constructor(scene: Scene, tierConfig: QualityTierConfig) {
    this.scene = scene;
    this.maxLights = tierConfig.maxDynamicLights;

    // Pre-allocate the light pool
    for (let i = 0; i < this.maxLights; i++) {
      const light = new PointLight(0xffffff, 0, 10);
      light.visible = false;
      this.scene.add(light);
      this.pool.push(light);
    }
  }

  requestLight(
    position: Vector3,
    color: Color,
    intensity: number,
    range: number
  ): LightHandle | null {
    if (this.maxLights === 0) return null;

    // Find an available light from the pool
    const light = this.pool.find((l) => !l.visible);
    if (!light) {
      // All lights in use — could merge nearby lights, for now reject
      return null;
    }

    light.position.copy(position);
    light.color.copy(color);
    light.intensity = intensity;
    light.distance = range;
    light.visible = true;

    const id = this.nextId++;
    this.activeHandles.set(id, light);
    return { id };
  }

  updateLight(
    handle: LightHandle,
    position: Vector3,
    intensity: number,
    color?: Color
  ): void {
    const light = this.activeHandles.get(handle.id);
    if (!light) return;
    light.position.copy(position);
    light.intensity = intensity;
    if (color) light.color.copy(color);
  }

  releaseLight(handle: LightHandle): void {
    const light = this.activeHandles.get(handle.id);
    if (!light) return;
    light.visible = false;
    light.intensity = 0;
    this.activeHandles.delete(handle.id);
  }

  releaseAll(): void {
    for (const light of this.activeHandles.values()) {
      light.visible = false;
      light.intensity = 0;
    }
    this.activeHandles.clear();
  }

  dispose(): void {
    for (const light of this.pool) {
      this.scene.remove(light);
      light.dispose();
    }
    this.pool = [];
    this.activeHandles.clear();
  }
}
```

- [ ] **Step 2: Write DynamicLightManager tests**

Create `tests/unit/3d-effects/dynamic-light-manager.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { DynamicLightManager } from "$lib/shared/3d/effects/lighting/DynamicLightManager";
import { Vector3, Color, Scene } from "three";
import { QualityTier, TIER_CONFIGS } from "$lib/shared/3d/effects/types";

function createManager(maxLights: number) {
  const scene = new Scene();
  const config = { ...TIER_CONFIGS[QualityTier.HIGH], maxDynamicLights: maxLights };
  return { manager: new DynamicLightManager(scene, config), scene };
}

describe("DynamicLightManager", () => {
  it("returns null when pool is exhausted", () => {
    const { manager } = createManager(2);
    const pos = new Vector3();
    const color = new Color(1, 0, 0);

    const h1 = manager.requestLight(pos, color, 1, 5);
    const h2 = manager.requestLight(pos, color, 1, 5);
    const h3 = manager.requestLight(pos, color, 1, 5);

    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    expect(h3).toBeNull(); // Pool exhausted
  });

  it("recycles released lights", () => {
    const { manager } = createManager(1);
    const pos = new Vector3();
    const color = new Color(1, 0, 0);

    const h1 = manager.requestLight(pos, color, 1, 5);
    expect(h1).not.toBeNull();
    manager.releaseLight(h1!);

    const h2 = manager.requestLight(pos, color, 1, 5);
    expect(h2).not.toBeNull(); // Recycled
  });

  it("returns null when tier has zero lights", () => {
    const { manager } = createManager(0);
    const result = manager.requestLight(new Vector3(), new Color(), 1, 5);
    expect(result).toBeNull();
  });

  it("disposes all lights from scene", () => {
    const { manager, scene } = createManager(3);
    const initialChildren = scene.children.length;
    expect(initialChildren).toBe(3); // Pre-allocated pool

    manager.dispose();
    expect(scene.children.length).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-effects/dynamic-light-manager.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/effects/lighting/DynamicLightManager.ts tests/unit/3d-effects/dynamic-light-manager.test.ts
git commit -m "feat(3d-effects): add pooled dynamic light manager with tests"
```

---

## Task 5: DI Container Registration

**Files:**
- Modify: `src/lib/shared/di/containers/3d-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Register services in 3D container**

In `src/lib/shared/di/containers/3d-container.ts`, add imports and register `QualityTierDetector` and `TipPositionBridge3D` in a new tier after the existing tiers:

```typescript
import { QualityTierDetector } from "$lib/shared/3d/effects/quality/QualityTierDetector";
import { TipPositionBridge3D } from "$lib/shared/3d/effects/TipPositionBridge3D";

// Inside createAnimation3DContainer, after tier 3:
// Tier 4: 3D effects infrastructure
const container = tier3.add({
  qualityTierDetector: () => new QualityTierDetector(),
  tipPositionBridge: () => new TipPositionBridge3D(),
});
```

Note: Adjust the final `return container` to use the new tier variable name.

- [ ] **Step 2: Add types to container-types.ts**

In `src/lib/shared/di/container-types.ts`, the `Animation3DContainer` type is already derived from `ReturnType<typeof createAnimation3DContainer>`, so the new services will automatically be included in the type. Verify by building.

- [ ] **Step 3: Verify by building**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/3d-container.ts
git commit -m "feat(3d-effects): register QualityTierDetector and TipPositionBridge in DI"
```

---

## Task 6: Trail Material (Custom Shader)

**Files:**
- Create: `src/lib/shared/3d/effects/trails/TrailMaterial3D.ts`

- [ ] **Step 1: Implement the trail shader material**

Create `src/lib/shared/3d/effects/trails/TrailMaterial3D.ts`:

```typescript
import {
  ShaderMaterial,
  Color,
  DoubleSide,
  AdditiveBlending,
} from "three";

const vertexShader = /* glsl */ `
  attribute float alpha;
  attribute vec3 instanceColor;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = alpha;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uBaseColor;
  uniform float uEmissiveStrength;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Use instance color if provided (rainbow mode), otherwise base color
    vec3 color = length(vColor) > 0.01 ? vColor : uBaseColor;

    // Add emissive glow — brighter at high alpha (near tip)
    vec3 emissive = color * uEmissiveStrength * vAlpha;
    vec3 finalColor = color + emissive;

    float finalAlpha = vAlpha * uOpacity;
    if (finalAlpha < 0.001) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export interface TrailMaterialOptions {
  color: string;
  opacity: number;
  emissiveStrength?: number;
  rainbow?: boolean;
}

export function createTrailMaterial(options: TrailMaterialOptions): ShaderMaterial {
  const baseColor = new Color(options.color === "rainbow" ? "#ffffff" : options.color);

  return new ShaderMaterial({
    uniforms: {
      uBaseColor: { value: baseColor },
      uOpacity: { value: options.opacity },
      uEmissiveStrength: { value: options.emissiveStrength ?? 0.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/effects/trails/TrailMaterial3D.ts
git commit -m "feat(3d-effects): add trail shader material with emissive glow"
```

---

## Task 7: Trail Renderer (Ring Buffer + Catmull-Rom + Mesh)

**Files:**
- Create: `src/lib/shared/3d/effects/trails/TrailRenderer3D.ts`
- Test: `tests/unit/3d-effects/trail-ring-buffer.test.ts`

- [ ] **Step 1: Write failing ring buffer test**

Create `tests/unit/3d-effects/trail-ring-buffer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TrailRingBuffer } from "$lib/shared/3d/effects/trails/TrailRenderer3D";
import { Vector3 } from "three";

describe("TrailRingBuffer", () => {
  it("stores points up to capacity", () => {
    const buf = new TrailRingBuffer(4);
    buf.push(new Vector3(0, 0, 0));
    buf.push(new Vector3(1, 0, 0));
    buf.push(new Vector3(2, 0, 0));
    expect(buf.length).toBe(3);
  });

  it("overwrites oldest when full", () => {
    const buf = new TrailRingBuffer(3);
    buf.push(new Vector3(0, 0, 0));
    buf.push(new Vector3(1, 0, 0));
    buf.push(new Vector3(2, 0, 0));
    buf.push(new Vector3(3, 0, 0)); // overwrites index 0

    expect(buf.length).toBe(3);
    // Oldest should now be (1,0,0), newest (3,0,0)
    const points = buf.toOrderedArray();
    expect(points[0].x).toBe(1);
    expect(points[2].x).toBe(3);
  });

  it("returns points in oldest-to-newest order", () => {
    const buf = new TrailRingBuffer(5);
    for (let i = 0; i < 7; i++) {
      buf.push(new Vector3(i, 0, 0));
    }
    // Capacity 5, pushed 7: oldest is 2, newest is 6
    const points = buf.toOrderedArray();
    expect(points[0].x).toBe(2);
    expect(points[4].x).toBe(6);
  });

  it("clears all points", () => {
    const buf = new TrailRingBuffer(4);
    buf.push(new Vector3(1, 2, 3));
    buf.push(new Vector3(4, 5, 6));
    buf.clear();
    expect(buf.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/3d-effects/trail-ring-buffer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TrailRenderer3D**

Create `src/lib/shared/3d/effects/trails/TrailRenderer3D.ts`:

```typescript
import {
  Vector3,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  Color,
  ShaderMaterial,
} from "three";
import { createTrailMaterial } from "./TrailMaterial3D";
import type { QualityTier } from "../types";

// Exported for testing
export class TrailRingBuffer {
  private buffer: Vector3[];
  private timestamps: Float64Array;
  private head = 0;
  private count = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.timestamps = new Float64Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.buffer[i] = new Vector3();
    }
  }

  get length(): number {
    return this.count;
  }

  push(point: Vector3, timestamp?: number): void {
    this.buffer[this.head].copy(point);
    this.timestamps[this.head] = timestamp ?? performance.now() / 1000;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  toOrderedArray(): Vector3[] {
    if (this.count === 0) return [];
    const result: Vector3[] = [];
    const start =
      this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx].clone());
    }
    return result;
  }

  // Non-allocating iterator for hot path
  getPoint(orderedIndex: number): Vector3 {
    const start =
      this.count < this.capacity ? 0 : this.head;
    const idx = (start + orderedIndex) % this.capacity;
    return this.buffer[idx];
  }

  getTimestamp(orderedIndex: number): number {
    const start =
      this.count < this.capacity ? 0 : this.head;
    const idx = (start + orderedIndex) % this.capacity;
    return this.timestamps[idx];
  }
}

// Catmull-Rom interpolation between 4 points
function catmullRom(
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  t: number,
  out: Vector3
): Vector3 {
  const t2 = t * t;
  const t3 = t2 * t;
  out.x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  out.z =
    0.5 *
    (2 * p1.z +
      (-p0.z + p2.z) * t +
      (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
      (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
  return out;
}

export type TrailMode = "fade" | "loop_clear" | "persistent";

export interface TrailRendererConfig {
  maxPoints: number;
  subdivisions: number; // Catmull-Rom subdivisions between each pair
  width: number;
  color: string;
  opacity: number;
  rainbow: boolean;
  qualityTier: QualityTier;
  mode: TrailMode;
  fadeDuration: number; // seconds — only used in fade mode
}

const DEFAULT_CONFIG: TrailRendererConfig = {
  maxPoints: 120,
  subdivisions: 4,
  width: 0.03, // meters
  color: "#3b82f6",
  opacity: 0.85,
  rainbow: false,
  qualityTier: "medium" as QualityTier,
  mode: "fade",
  fadeDuration: 2.0,
};

export class TrailRenderer3D {
  private ringBuffer: TrailRingBuffer;
  private geometry: BufferGeometry;
  private mesh: Mesh;
  private config: TrailRendererConfig;

  // Pre-allocated attribute arrays
  private positions: Float32Array;
  private alphas: Float32Array;
  private colors: Float32Array;
  private maxVertices: number;

  // Reusable temporaries
  private readonly tempVec = new Vector3();
  private readonly tempTangent = new Vector3();
  private readonly tempNormal = new Vector3();
  private readonly tempUp = new Vector3(0, 1, 0);
  private readonly tempCR = new Vector3();
  private readonly tempColor = new Color(); // Reuse for rainbow (avoid alloc in hot loop)

  private sampleCounter = 0;
  private sampleRate: number;

  constructor(config: Partial<TrailRendererConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Low tier: sample every 2nd frame
    this.sampleRate = this.config.qualityTier === "low" ? 2 : 1;

    const effectiveMaxPoints =
      this.config.qualityTier === "low"
        ? Math.floor(this.config.maxPoints / 2)
        : this.config.maxPoints;

    this.ringBuffer = new TrailRingBuffer(effectiveMaxPoints);

    // Max interpolated points = (maxPoints - 1) * subdivisions + 1
    // Each interpolated point produces 2 vertices (left/right of ribbon)
    const maxInterpolated =
      (effectiveMaxPoints - 1) * this.config.subdivisions + 1;
    this.maxVertices = maxInterpolated * 2;

    // Pre-allocate buffers
    this.positions = new Float32Array(this.maxVertices * 3);
    this.alphas = new Float32Array(this.maxVertices);
    this.colors = new Float32Array(this.maxVertices * 3);

    // Build geometry with pre-allocated buffers
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new BufferAttribute(this.positions, 3)
    );
    this.geometry.setAttribute(
      "alpha",
      new BufferAttribute(this.alphas, 1)
    );
    this.geometry.setAttribute(
      "instanceColor",
      new BufferAttribute(this.colors, 3)
    );

    const material = createTrailMaterial({
      color: this.config.color,
      opacity: this.config.opacity,
      rainbow: this.config.rainbow,
    });

    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false; // Trails can span large areas
  }

  get object3D(): Mesh {
    return this.mesh;
  }

  addPoint(position: Vector3): void {
    this.sampleCounter++;
    if (this.sampleCounter % this.sampleRate !== 0) return;
    this.ringBuffer.push(position);
  }

  clear(): void {
    this.ringBuffer.clear();
  }

  update(cameraPosition: Vector3): void {
    const pointCount = this.ringBuffer.length;
    if (pointCount < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // Build interpolated ribbon vertices
    let vertexIndex = 0;
    const subdivisions = this.config.subdivisions;
    const totalSegments = pointCount - 1;
    const totalInterpolatedPoints = totalSegments * subdivisions + 1;

    for (let seg = 0; seg < totalSegments; seg++) {
      const numSubdivs = seg === totalSegments - 1 ? subdivisions + 1 : subdivisions;

      for (let sub = 0; sub < numSubdivs; sub++) {
        const t = sub / subdivisions;

        // Get 4 control points for Catmull-Rom (clamp at boundaries)
        const i0 = Math.max(0, seg - 1);
        const i1 = seg;
        const i2 = Math.min(pointCount - 1, seg + 1);
        const i3 = Math.min(pointCount - 1, seg + 2);

        const p0 = this.ringBuffer.getPoint(i0);
        const p1 = this.ringBuffer.getPoint(i1);
        const p2 = this.ringBuffer.getPoint(i2);
        const p3 = this.ringBuffer.getPoint(i3);

        // Interpolated point
        catmullRom(p0, p1, p2, p3, t, this.tempVec);

        // Tangent (derivative of Catmull-Rom)
        const tNext = Math.min(t + 0.01, 1);
        catmullRom(p0, p1, p2, p3, tNext, this.tempCR);
        this.tempTangent.subVectors(this.tempCR, this.tempVec).normalize();

        // Normal: perpendicular to tangent and camera direction
        // This makes the ribbon always face the camera
        const toCamera = this.tempNormal
          .subVectors(cameraPosition, this.tempVec)
          .normalize();
        const normal = this.tempNormal
          .crossVectors(this.tempTangent, toCamera)
          .normalize();

        // Taper: width decreases from tip (newest) to tail (oldest)
        const progress =
          (seg * subdivisions + sub) / (totalInterpolatedPoints - 1);
        const taper = 1.0 - progress * 0.8; // Keep 20% width at tail
        const halfWidth = this.config.width * 0.5 * taper;

        // Alpha: depends on trail mode
        let alpha: number;
        if (this.config.mode === "fade") {
          // Time-based fade: oldest points fade based on age
          const now = performance.now() / 1000;
          const pointTime = this.ringBuffer.getTimestamp(
            Math.min(seg, pointCount - 1)
          );
          const age = now - pointTime;
          alpha = Math.max(0, 1.0 - age / this.config.fadeDuration);
        } else {
          // Persistent / loop_clear: position-based gradient
          alpha = 1.0 - progress;
        }

        // Left vertex
        const li = vertexIndex * 3;
        this.positions[li] = this.tempVec.x + normal.x * halfWidth;
        this.positions[li + 1] = this.tempVec.y + normal.y * halfWidth;
        this.positions[li + 2] = this.tempVec.z + normal.z * halfWidth;
        this.alphas[vertexIndex] = alpha;

        // Rainbow color (reuse tempColor to avoid allocation)
        if (this.config.rainbow) {
          const hue = progress * 360;
          this.tempColor.setHSL(hue / 360, 1, 0.5);
          this.colors[li] = this.tempColor.r;
          this.colors[li + 1] = this.tempColor.g;
          this.colors[li + 2] = this.tempColor.b;
        }

        vertexIndex++;

        // Right vertex
        const ri = vertexIndex * 3;
        this.positions[ri] = this.tempVec.x - normal.x * halfWidth;
        this.positions[ri + 1] = this.tempVec.y - normal.y * halfWidth;
        this.positions[ri + 2] = this.tempVec.z - normal.z * halfWidth;
        this.alphas[vertexIndex] = alpha;

        if (this.config.rainbow) {
          this.colors[ri] = this.colors[li];
          this.colors[ri + 1] = this.colors[li + 1];
          this.colors[ri + 2] = this.colors[li + 2];
        }

        vertexIndex++;
      }
    }

    // Update geometry
    (this.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.alpha as BufferAttribute).needsUpdate = true;
    if (this.config.rainbow) {
      (this.geometry.attributes.instanceColor as BufferAttribute).needsUpdate = true;
    }

    // Triangle strip: vertexIndex vertices
    this.geometry.setDrawRange(0, vertexIndex);
  }

  /** Called by orchestrator when sequence loops (for loop_clear mode) */
  onLoopReset(): void {
    if (this.config.mode === "loop_clear") {
      this.clear();
    }
  }

  dispose(): void {
    this.geometry.dispose();
    const material = this.mesh.material as ShaderMaterial;
    material.dispose();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/3d-effects/trail-ring-buffer.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/effects/trails/TrailRenderer3D.ts tests/unit/3d-effects/trail-ring-buffer.test.ts
git commit -m "feat(3d-effects): add Catmull-Rom trail renderer with ring buffer"
```

---

## Task 8: Trail3D Svelte Component

**Files:**
- Create: `src/lib/shared/3d/effects/trails/Trail3D.svelte`

- [ ] **Step 1: Implement Trail3D.svelte**

Create `src/lib/shared/3d/effects/trails/Trail3D.svelte`:

```svelte
<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { Vector3, Color } from "three";
  import { TrailRenderer3D } from "./TrailRenderer3D";
  import type { DynamicLightManager, LightHandle } from "../lighting/DynamicLightManager";
  import type { QualityTier } from "../types";

  interface Props {
    tipPosition: Vector3 | null;
    color: string;
    propId: "blue" | "red";
    width?: number;
    opacity?: number;
    maxPoints?: number;
    rainbow?: boolean;
    enabled?: boolean;
    qualityTier?: QualityTier;
    lightManager?: DynamicLightManager | null;
    mode?: "fade" | "loop_clear" | "persistent";
    fadeDuration?: number;
  }

  let {
    tipPosition,
    color,
    propId,
    width = 0.03,
    opacity = 0.85,
    maxPoints = 120,
    rainbow = false,
    enabled = true,
    qualityTier = "medium" as QualityTier,
    lightManager = null,
    mode = "fade",
    fadeDuration = 2.0,
  }: Props = $props();

  const { camera } = useThrelte();

  const renderer = new TrailRenderer3D({
    maxPoints,
    subdivisions: 4,
    width,
    color,
    opacity,
    rainbow,
    qualityTier,
    mode,
    fadeDuration,
  });

  let lightHandle: LightHandle | null = null;
  const lightColor = new Color(color === "rainbow" ? "#ffffff" : color);

  useTask(() => {
    if (!enabled || !tipPosition) {
      if (lightHandle && lightManager) {
        lightManager.releaseLight(lightHandle);
        lightHandle = null;
      }
      return;
    }

    // Add current tip position to trail
    renderer.addPoint(tipPosition);

    // Update mesh geometry
    const cam = camera.current;
    if (cam) {
      renderer.update(cam.position);
    }

    // Update dynamic light at tip position
    if (lightManager) {
      if (!lightHandle) {
        lightHandle = lightManager.requestLight(
          tipPosition,
          lightColor,
          0.5,  // intensity
          3.0   // range in meters
        );
      } else {
        lightManager.updateLight(lightHandle, tipPosition, 0.5);
      }
    }
  });

  // Cleanup
  import { onDestroy } from "svelte";
  onDestroy(() => {
    if (lightHandle && lightManager) {
      lightManager.releaseLight(lightHandle);
    }
    renderer.dispose();
  });
</script>

{#if enabled}
  <T is={renderer.object3D} />
{/if}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/effects/trails/Trail3D.svelte
git commit -m "feat(3d-effects): add Trail3D Threlte component with dynamic lighting"
```

---

## Task 9: Effect Orchestrator

**Files:**
- Create: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`

- [ ] **Step 1: Implement EffectOrchestrator3D**

Create `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`:

```svelte
<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { Vector3 } from "three";
  import { container } from "$lib/shared/di";
  import Trail3D from "./trails/Trail3D.svelte";
  import { DynamicLightManager } from "./lighting/DynamicLightManager";
  import { TipPositionBridge3D } from "./TipPositionBridge3D";
  import { resolveEffect } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { PropState3D } from "$lib/shared/3d/domain/models/PropState3D";
  import type { QualityTier, QualityTierConfig } from "./types";
  import { TIER_CONFIGS } from "./types";

  interface Props {
    bluePropState: PropState3D | null;
    redPropState: PropState3D | null;
    isPlaying: boolean;
    staffHalfLength: number;
    tipEffectMap?: TipEffectMap;
    globalTipEffectMap?: TipEffectMap;
    trailConfig?: {
      color?: string;
      width?: number;
      opacity?: number;
      maxPoints?: number;
      rainbow?: boolean;
    };
  }

  let {
    bluePropState,
    redPropState,
    isPlaying,
    staffHalfLength = 0.5,
    tipEffectMap,
    globalTipEffectMap = {},
    trailConfig = {},
  }: Props = $props();

  const { scene } = useThrelte();
  const qualityTierDetector = container.items.qualityTierDetector;
  const tipBridge = new TipPositionBridge3D();

  const tierConfig: QualityTierConfig = $derived(
    TIER_CONFIGS[qualityTierDetector.currentTier]
  );

  const lightManager = new DynamicLightManager(scene, tierConfig);

  // Compute tip positions each frame
  let blueTips = $state<{ position: Vector3 | null; effect: string }[]>([
    { position: null, effect: "none" },
    { position: null, effect: "none" },
  ]);
  let redTips = $state<{ position: Vector3 | null; effect: string }[]>([
    { position: null, effect: "none" },
    { position: null, effect: "none" },
  ]);

  $effect(() => {
    if (!isPlaying) {
      tipBridge.reset();
      return;
    }

    const dt = 1 / 60; // Threlte runs at requestAnimationFrame rate

    if (bluePropState) {
      const result = tipBridge.update(0, bluePropState, staffHalfLength, dt);
      blueTips = result.tips.map((tip, tipIndex) => ({
        position: tip.position,
        effect: resolveEffect(0, tipIndex, tipEffectMap, globalTipEffectMap),
      }));
    }

    if (redPropState) {
      const result = tipBridge.update(1, redPropState, staffHalfLength, dt);
      redTips = result.tips.map((tip, tipIndex) => ({
        position: tip.position,
        effect: resolveEffect(1, tipIndex, tipEffectMap, globalTipEffectMap),
      }));
    }
  });

  // Determine which tips have trail effects
  const blueTrailTips = $derived(
    blueTips.filter((t) => t.effect === "trails" && t.position)
  );
  const redTrailTips = $derived(
    redTips.filter((t) => t.effect === "trails" && t.position)
  );

  onDestroy(() => {
    lightManager.dispose();
    tipBridge.reset();
  });
</script>

<!-- Blue prop trails -->
{#each blueTrailTips as tip, i}
  <Trail3D
    tipPosition={tip.position}
    color={trailConfig.color ?? "#3b82f6"}
    propId="blue"
    width={trailConfig.width}
    opacity={trailConfig.opacity}
    maxPoints={trailConfig.maxPoints}
    rainbow={trailConfig.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    lightManager={lightManager}
  />
{/each}

<!-- Red prop trails -->
{#each redTrailTips as tip, i}
  <Trail3D
    tipPosition={tip.position}
    color={trailConfig.color ?? "#ef4444"}
    propId="red"
    width={trailConfig.width}
    opacity={trailConfig.opacity}
    maxPoints={trailConfig.maxPoints}
    rainbow={trailConfig.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    lightManager={lightManager}
  />
{/each}

<!-- Future: LED, Charcoal, Fire components go here -->

<!--
  Loop reset wiring:
  The EffectOrchestrator3D receives an `onLoopReset` prop (or listens to the
  AnimationRenderLoop's existing loop detection callback). When triggered,
  it calls onLoopReset() on each active TrailRenderer3D instance that's in
  "loop_clear" mode. The Trail3D component exposes this via a prop callback
  or bind:this pattern. Wire this when integrating into Viewer3DScene (Task 10).
-->
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors (may need import adjustments — Trail3D is a .svelte component, verify the import path)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/effects/EffectOrchestrator3D.svelte
git commit -m "feat(3d-effects): add EffectOrchestrator3D with TipEffectMap routing"
```

---

## Task 10: Wire Orchestrator into Viewer3DScene

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

- [ ] **Step 1: Replace EffectsLayer with EffectOrchestrator3D**

In `Viewer3DScene.svelte`:

1. Remove the import of `EffectsLayer` (if present)
2. Add import of `EffectOrchestrator3D`:
   ```typescript
   import EffectOrchestrator3D from "$lib/shared/3d/effects/EffectOrchestrator3D.svelte";
   ```
3. In the template, add the orchestrator inside the scene content, after the Avatar3D and Prop3D components:
   ```svelte
   <EffectOrchestrator3D
     bluePropState={effectiveBluePropState}
     redPropState={effectiveRedPropState}
     {isPlaying}
     staffHalfLength={0.5}
   />
   ```

The exact prop names (`effectiveBluePropState`, etc.) may differ — match whatever the existing component uses for blue/red `PropState3D`. Check the existing template for the correct variable names derived from `avatarState`.

- [ ] **Step 2: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat(3d-effects): wire EffectOrchestrator3D into Viewer3DScene"
```

---

## Task 11: Delete Old Trail Files

Only do this after verifying the new trails work visually in the 3D viewer.

**Files:**
- Delete: `src/lib/shared/3d/effects/trails/RibbonTrail3D.svelte`
- Delete: `src/lib/shared/3d/effects/trails/TrailRenderer.svelte`
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte` (remove trail-related code, or delete entirely if nothing else uses it)

- [ ] **Step 1: Ask user to verify new trails work**

Tell user: "Please switch to 3D mode in the sequence viewer with trails enabled and confirm the new trails render correctly. I cannot verify this visually."

- [ ] **Step 2: Delete old files after user confirms**

```bash
git rm src/lib/shared/3d/effects/trails/RibbonTrail3D.svelte
git rm src/lib/shared/3d/effects/trails/TrailRenderer.svelte
```

- [ ] **Step 3: Remove trail references from EffectsLayer.svelte**

Remove the `RibbonTrail3D` imports and rendering blocks from `EffectsLayer.svelte`. Keep the rest (fire, sparkle, electricity, motion) until those are replaced by their own 3D renderers.

- [ ] **Step 4: Verify build compiles**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(3d-effects): remove old trail implementations, replaced by Trail3D"
```

---

## Task 12: Final Build Verification

- [ ] **Step 1: Run full type check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including the 3 new test files

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit any remaining fixes**

If any issues found in steps 1-3, fix and commit.
