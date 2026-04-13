# Two-Pass Deterministic 3D Video Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace real-time RAF-based 3D video capture with a two-pass system (camera keyframe recording + offline deterministic render) so export quality is independent of scene render performance.

**Architecture:** Pass 1 records camera transforms at 60Hz during live playback. Pass 2 iterates frame-by-frame: sets animation time deterministically, interpolates camera from keyframes, ticks effects with correct dt, forces a Three.js render, captures, and encodes. The existing BackgroundVideoEncoder and CanvasFrameCapturer are reused unchanged.

**Tech Stack:** Svelte 5 + TypeScript + Threlte (Three.js) + ITI DI + WebCodecs VideoEncoder + mp4-muxer

**Spec:** `docs/superpowers/specs/2026-04-12-two-pass-deterministic-3d-export-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/video-export/domain/CameraKeyframe.ts` | Keyframe type + buffer class |
| `src/lib/shared/video-export/services/contracts/ICameraKeyframeInterpolator.ts` | Interpolation contract |
| `src/lib/shared/video-export/services/implementations/CameraKeyframeInterpolator.ts` | Lerp + slerp interpolation |
| `tests/unit/video-export/CameraKeyframeInterpolator.test.ts` | Interpolation tests |
| `src/lib/shared/3d/services/contracts/IOffline3DExporter.ts` | Offline exporter contract |
| `src/lib/shared/3d/services/implementations/Offline3DExporter.ts` | Core deterministic render loop |
| `tests/unit/video-export/CameraKeyframeBuffer.test.ts` | Buffer recording tests |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` | Accept dt parameter instead of hardcoding 1/60 |
| `src/lib/shared/3d/effects/fire/FireRenderer3D.ts` | Frame-rate-independent EMA smoothing |
| `src/lib/shared/3d/effects/led/LedRenderer3D.ts` | Time-based trail eviction |
| `src/lib/shared/3d/effects/trails/TrailRenderer3D.ts` | Accept explicit timestamp for offline mode |
| `src/lib/shared/3d/state/performer-manager.svelte.ts` | Accept timestamp parameter for formation transitions |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | isExporting gate on useTask |
| `src/lib/shared/3d/components/Avatar3D.svelte` | isExporting gate on useTask |
| `src/lib/shared/di/containers/animator-container.ts` | Register Offline3DExporter, remove Realtime3DExporter |
| `src/lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte.ts` | Use Offline3DExporter |
| `src/lib/shared/sequence-viewer/services/contracts/ISequenceModalExporter.ts` | Update Video3DExportDependencies |
| `src/lib/shared/video-export/domain/ExportDiagnostics.ts` | Offline mode variant |

### Removed Files (Phase 6)

| File | Reason |
|------|--------|
| `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts` | Replaced by Offline3DExporter |
| `src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts` | Replaced by IOffline3DExporter |

---

## Phase 1: Effects Delta-Time Fix (Prerequisite)

### Task 1: Parameterize dt in EffectOrchestrator3D

Makes the orchestrator accept real delta-time instead of hardcoding `1/60`.

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte:330`

- [ ] **Step 1: Replace hardcoded dt with Threlte's delta**

In `EffectOrchestrator3D.svelte`, the `useTask` callback at line 214 does not receive a `delta` parameter. Threlte's `useTask((delta) => { ... })` provides frame delta in seconds. Change the callback signature and replace line 330.

Find line 214:
```typescript
useTask(() => {
```

Replace with:
```typescript
useTask((delta) => {
```

Find line 330:
```typescript
const dt = 1 / 60;
```

Replace with:
```typescript
// Use actual frame delta from Threlte's render loop. Clamp to avoid
// physics explosions after tab-switch or debugger pause (same safeguard
// as CharcoalRenderer and FireRenderer use internally).
const dt = Math.min(delta, 1 / 15);
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds. No new type errors in EffectOrchestrator3D.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/effects/EffectOrchestrator3D.svelte
git commit -m "fix(effects): use real frame delta instead of hardcoded 1/60"
```

---

### Task 2: Frame-rate-independent EMA in FireRenderer3D

The EMA smoothing factor `VELOCITY_SMOOTHING = 0.25` is per-frame, meaning the smoothing behavior changes at different frame rates. Convert to a time-based exponential decay.

**Files:**
- Modify: `src/lib/shared/3d/effects/fire/FireRenderer3D.ts:22,137-139`

- [ ] **Step 1: Convert EMA smoothing to frame-rate-independent form**

The current code (lines 137-139):
```typescript
state.smoothVelX += (tip.velocityX - state.smoothVelX) * VELOCITY_SMOOTHING;
state.smoothVelY += (tip.velocityY - state.smoothVelY) * VELOCITY_SMOOTHING;
state.smoothVelZ += (tip.velocityZ - state.smoothVelZ) * VELOCITY_SMOOTHING;
```

At 60fps, `VELOCITY_SMOOTHING = 0.25` means the signal reaches ~95% of target in ~11 frames (~183ms). We need that same 183ms time constant at any frame rate.

The frame-rate-independent form is: `factor = 1 - Math.pow(1 - VELOCITY_SMOOTHING, safeDt * 60)`. At dt=1/60 this equals 0.25 (identical to current behavior). At dt=1/30 it's ~0.4375 (faster per-frame, same wall-clock response).

Change the constant at line 22:
```typescript
/** EMA smoothing — calibrated at 60fps. The time-invariant form in update()
 *  preserves the same ~183ms response time at any frame rate. */
const VELOCITY_SMOOTHING = 0.25;
```

Change lines 137-139 inside `update()`, after `const safeDt = Math.min(dt, 1 / 15);` (line 117):

Find:
```typescript
        state.smoothVelX += (tip.velocityX - state.smoothVelX) * VELOCITY_SMOOTHING;
        state.smoothVelY += (tip.velocityY - state.smoothVelY) * VELOCITY_SMOOTHING;
        state.smoothVelZ += (tip.velocityZ - state.smoothVelZ) * VELOCITY_SMOOTHING;
```

Replace with:
```typescript
        // Frame-rate-independent EMA: at dt=1/60 this equals VELOCITY_SMOOTHING
        // exactly. At other frame rates it preserves the same ~183ms response time.
        const emaFactor = 1 - Math.pow(1 - VELOCITY_SMOOTHING, safeDt * 60);
        state.smoothVelX += (tip.velocityX - state.smoothVelX) * emaFactor;
        state.smoothVelY += (tip.velocityY - state.smoothVelY) * emaFactor;
        state.smoothVelZ += (tip.velocityZ - state.smoothVelZ) * emaFactor;
```

- [ ] **Step 2: Convert WIND_DECAY to frame-rate-independent form**

`WIND_DECAY = 0.96` is applied per frame (line 157-159). Same issue.

Find lines 157-159:
```typescript
        state.windOffsetX = state.windOffsetX * WIND_DECAY + svx * WIND_STRENGTH * safeDt;
        state.windOffsetY = state.windOffsetY * WIND_DECAY + svy * WIND_STRENGTH * safeDt;
        state.windOffsetZ = state.windOffsetZ * WIND_DECAY + svz * WIND_STRENGTH * safeDt;
```

Replace with:
```typescript
        // Frame-rate-independent decay: at dt=1/60 this equals WIND_DECAY exactly.
        const windDecay = Math.pow(WIND_DECAY, safeDt * 60);
        state.windOffsetX = state.windOffsetX * windDecay + svx * WIND_STRENGTH * safeDt;
        state.windOffsetY = state.windOffsetY * windDecay + svy * WIND_STRENGTH * safeDt;
        state.windOffsetZ = state.windOffsetZ * windDecay + svz * WIND_STRENGTH * safeDt;
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/effects/fire/FireRenderer3D.ts
git commit -m "fix(effects): frame-rate-independent fire EMA and wind decay"
```

---

### Task 3: Time-based LED trail eviction

The `LedTrailRing` uses a fixed frame-count capacity (32 frames at HIGH tier). At 8.5fps that's 3.7 seconds of trail; at 30fps it's 1.1 seconds. Convert to time-based eviction so trails persist for a consistent duration regardless of frame rate.

**Files:**
- Modify: `src/lib/shared/3d/effects/led/LedRenderer3D.ts:40-44,56-107,228-264`

- [ ] **Step 1: Add time-based eviction to LedTrailRing**

The `TRAIL_FADE_DURATION` constant already exists at line 140 (= 1.0 seconds). The ring buffer should drop entries older than this duration. We keep the ring buffer for memory reuse but add age-based filtering in `getOrdered()`.

Find the `getOrdered()` method (lines 92-101):
```typescript
  /** Get trail entries oldest-first */
  getOrdered(): LedTrailEntry[] {
    if (this._count === 0) return [];
    const result: LedTrailEntry[] = [];
    const start = this._count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx]!);
    }
    return result;
  }
```

Replace with:
```typescript
  /** Get trail entries oldest-first, excluding entries older than maxAge seconds */
  getOrdered(currentTime: number, maxAge: number): LedTrailEntry[] {
    if (this._count === 0) return [];
    const result: LedTrailEntry[] = [];
    const start = this._count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._count; i++) {
      const idx = (start + i) % this.capacity;
      const entry = this.buffer[idx]!;
      if (currentTime - entry.timestamp <= maxAge) {
        result.push(entry);
      }
    }
    return result;
  }
```

- [ ] **Step 2: Increase ring buffer capacity to accommodate high frame rates**

At 60fps with a 1-second trail, we need 60 entries. At 120fps, 120. Increase the HIGH-tier capacity to handle any reasonable frame rate.

Find lines 40-44:
```typescript
const TRAIL_LENGTH: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 32,
  [QualityTier.MEDIUM]: 16,
  [QualityTier.LOW]: 0,
};
```

Replace with:
```typescript
/** Ring buffer capacity per quality tier. Sized to hold at least
 *  TRAIL_FADE_DURATION seconds of trail at up to 120fps. The actual
 *  visible trail length is controlled by time-based eviction in
 *  getOrdered(), not by capacity. */
const TRAIL_LENGTH: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 128,
  [QualityTier.MEDIUM]: 64,
  [QualityTier.LOW]: 0,
};
```

- [ ] **Step 3: Update the trail rendering loop to use time-based getOrdered**

Find the trail rendering section in `update()` (around line 228-264). The call to `trail.getOrdered()` needs to pass `currentTime` and `TRAIL_FADE_DURATION`.

Find:
```typescript
      const entries = trail.getOrdered();
```

Replace with:
```typescript
      const entries = trail.getOrdered(currentTime, TRAIL_FADE_DURATION);
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/effects/led/LedRenderer3D.ts
git commit -m "fix(effects): time-based LED trail eviction instead of frame-count"
```

---

### Task 4: Formation transition deterministic timestamp

`FormationManager.updateTransition()` uses `performance.now()` for timing. For offline export, we need to pass a deterministic timestamp.

**Files:**
- Modify: `src/lib/shared/3d/state/performer-manager.svelte.ts:165`
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte` (the call site)

- [ ] **Step 1: Add optional timestamp parameter to updateFormationTransition**

In `performer-manager.svelte.ts`, find line 162:
```typescript
  function updateFormationTransition() {
    if (!formationManager.isTransitioning) return;

    formationManager.updateTransition(performance.now());
```

Replace with:
```typescript
  function updateFormationTransition(timestamp?: number) {
    if (!formationManager.isTransitioning) return;

    formationManager.updateTransition(timestamp ?? performance.now());
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds. Existing call sites pass no argument, which falls through to `performance.now()`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/state/performer-manager.svelte.ts
git commit -m "feat(3d): formation transitions accept optional deterministic timestamp"
```

---

## Phase 2: Camera Keyframe System

### Task 5: CameraKeyframe type and CameraKeyframeBuffer

**Files:**
- Create: `src/lib/shared/video-export/domain/CameraKeyframe.ts`
- Create: `tests/unit/video-export/CameraKeyframeBuffer.test.ts`

- [ ] **Step 1: Write tests for CameraKeyframeBuffer**

```typescript
// tests/unit/video-export/CameraKeyframeBuffer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";

describe("CameraKeyframeBuffer", () => {
  let buffer: CameraKeyframeBuffer;

  beforeEach(() => {
    buffer = new CameraKeyframeBuffer();
  });

  it("starts empty with zero keyframes", () => {
    expect(buffer.keyframes).toHaveLength(0);
    expect(buffer.duration).toBe(0);
  });

  it("records keyframes from a mock camera at 60Hz", () => {
    const mockCamera = {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      fov: 50,
    };

    // Simulate 100ms of recording at 60Hz = ~6 samples
    vi.useFakeTimers();
    buffer.startRecording(mockCamera as any);

    // Advance 100ms — should trigger ~6 interval callbacks
    vi.advanceTimersByTime(100);

    buffer.stopRecording();
    vi.useRealTimers();

    expect(buffer.keyframes.length).toBeGreaterThanOrEqual(5);
    expect(buffer.keyframes.length).toBeLessThanOrEqual(7);

    const first = buffer.keyframes[0]!;
    expect(first.position).toEqual([1, 2, 3]);
    expect(first.quaternion).toEqual([0, 0, 0, 1]);
    expect(first.fov).toBe(50);
  });

  it("tracks duration from first to last keyframe", () => {
    const mockCamera = {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      fov: 50,
    };

    vi.useFakeTimers();
    buffer.startRecording(mockCamera as any);
    vi.advanceTimersByTime(500);
    buffer.stopRecording();
    vi.useRealTimers();

    // Duration should be ~500ms = ~0.5s
    expect(buffer.duration).toBeGreaterThan(0.4);
    expect(buffer.duration).toBeLessThan(0.6);
  });

  it("creates a single-keyframe buffer from static camera", () => {
    const mockCamera = {
      position: { x: 5, y: 3, z: -2 },
      quaternion: { x: 0, y: 0.707, z: 0, w: 0.707 },
      fov: 45,
    };

    buffer.captureStatic(mockCamera as any);

    expect(buffer.keyframes).toHaveLength(1);
    expect(buffer.keyframes[0]!.position).toEqual([5, 3, -2]);
    expect(buffer.duration).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/video-export/CameraKeyframeBuffer.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CameraKeyframe type and buffer**

```typescript
// src/lib/shared/video-export/domain/CameraKeyframe.ts

/**
 * A single camera state sample captured during pass 1 (live directing).
 */
export interface CameraKeyframe {
  /** Seconds since recording started */
  timestamp: number;
  /** Camera world position [x, y, z] */
  position: [number, number, number];
  /** Camera orientation as quaternion [x, y, z, w] */
  quaternion: [number, number, number, number];
  /** Field of view in degrees */
  fov: number;
}

/** Minimal camera-like object we read during recording */
interface CameraLike {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  fov: number;
}

/** Sampling rate in Hz — independent of render frame rate */
const SAMPLE_RATE_HZ = 60;
const SAMPLE_INTERVAL_MS = 1000 / SAMPLE_RATE_HZ;

/**
 * Camera Keyframe Buffer
 *
 * Records camera transforms at 60Hz during live playback (pass 1).
 * The buffer is consumed by CameraKeyframeInterpolator during the
 * deterministic render pass (pass 2).
 */
export class CameraKeyframeBuffer {
  private _keyframes: CameraKeyframe[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTimeMs = 0;

  get keyframes(): readonly CameraKeyframe[] {
    return this._keyframes;
  }

  /** Duration in seconds from first to last keyframe */
  get duration(): number {
    if (this._keyframes.length < 2) return 0;
    return this._keyframes[this._keyframes.length - 1]!.timestamp - this._keyframes[0]!.timestamp;
  }

  /**
   * Begin sampling the camera at 60Hz.
   * Sampling uses setInterval, not RAF, so it captures smooth input
   * even when the scene renders at low FPS.
   */
  startRecording(camera: CameraLike): void {
    this.stopRecording();
    this._keyframes = [];
    this.startTimeMs = performance.now();

    // Capture the first sample immediately
    this.sample(camera);

    this.intervalId = setInterval(() => {
      this.sample(camera);
    }, SAMPLE_INTERVAL_MS);
  }

  /** Stop recording and finalize the buffer. */
  stopRecording(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Capture a single keyframe from the current camera state.
   * Used for "quick export" — the user wants the current angle, no recording.
   */
  captureStatic(camera: CameraLike): void {
    this._keyframes = [
      {
        timestamp: 0,
        position: [camera.position.x, camera.position.y, camera.position.z],
        quaternion: [
          camera.quaternion.x,
          camera.quaternion.y,
          camera.quaternion.z,
          camera.quaternion.w,
        ],
        fov: camera.fov,
      },
    ];
  }

  private sample(camera: CameraLike): void {
    const timestamp = (performance.now() - this.startTimeMs) / 1000;
    this._keyframes.push({
      timestamp,
      position: [camera.position.x, camera.position.y, camera.position.z],
      quaternion: [
        camera.quaternion.x,
        camera.quaternion.y,
        camera.quaternion.z,
        camera.quaternion.w,
      ],
      fov: camera.fov,
    });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/video-export/CameraKeyframeBuffer.test.ts --config tests/config/vitest.config.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/video-export/domain/CameraKeyframe.ts tests/unit/video-export/CameraKeyframeBuffer.test.ts
git commit -m "feat(video-export): CameraKeyframe type and buffer with 60Hz recording"
```

---

### Task 6: CameraKeyframeInterpolator

**Files:**
- Create: `src/lib/shared/video-export/services/contracts/ICameraKeyframeInterpolator.ts`
- Create: `src/lib/shared/video-export/services/implementations/CameraKeyframeInterpolator.ts`
- Create: `tests/unit/video-export/CameraKeyframeInterpolator.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// tests/unit/video-export/CameraKeyframeInterpolator.test.ts
import { describe, it, expect } from "vitest";
import { CameraKeyframeInterpolator } from "$lib/shared/video-export/services/implementations/CameraKeyframeInterpolator";
import type { CameraKeyframe } from "$lib/shared/video-export/domain/CameraKeyframe";

function makeKeyframe(
  t: number,
  pos: [number, number, number],
  quat: [number, number, number, number] = [0, 0, 0, 1],
  fov = 50
): CameraKeyframe {
  return { timestamp: t, position: pos, quaternion: quat, fov };
}

describe("CameraKeyframeInterpolator", () => {
  const interp = new CameraKeyframeInterpolator();

  it("returns the only keyframe for a single-keyframe buffer", () => {
    const keyframes = [makeKeyframe(0, [1, 2, 3])];
    const result = interp.interpolate(keyframes, 5.0);
    expect(result.position).toEqual([1, 2, 3]);
    expect(result.fov).toBe(50);
  });

  it("clamps to first keyframe before t=0", () => {
    const keyframes = [
      makeKeyframe(1.0, [0, 0, 0]),
      makeKeyframe(2.0, [10, 0, 0]),
    ];
    const result = interp.interpolate(keyframes, 0.5);
    expect(result.position).toEqual([0, 0, 0]);
  });

  it("clamps to last keyframe after buffer ends", () => {
    const keyframes = [
      makeKeyframe(0, [0, 0, 0]),
      makeKeyframe(1, [10, 0, 0]),
    ];
    const result = interp.interpolate(keyframes, 5.0);
    expect(result.position).toEqual([10, 0, 0]);
  });

  it("linearly interpolates position at midpoint", () => {
    const keyframes = [
      makeKeyframe(0, [0, 0, 0]),
      makeKeyframe(1, [10, 0, 0]),
    ];
    const result = interp.interpolate(keyframes, 0.5);
    expect(result.position[0]).toBeCloseTo(5, 5);
    expect(result.position[1]).toBeCloseTo(0, 5);
    expect(result.position[2]).toBeCloseTo(0, 5);
  });

  it("linearly interpolates FOV", () => {
    const keyframes = [
      makeKeyframe(0, [0, 0, 0], [0, 0, 0, 1], 40),
      makeKeyframe(1, [0, 0, 0], [0, 0, 0, 1], 60),
    ];
    const result = interp.interpolate(keyframes, 0.5);
    expect(result.fov).toBeCloseTo(50, 5);
  });

  it("slerps quaternion between identity and 90-deg Y rotation", () => {
    // Identity quaternion
    const q0: [number, number, number, number] = [0, 0, 0, 1];
    // 90 degrees around Y: [0, sin(45deg), 0, cos(45deg)]
    const sin45 = Math.sin(Math.PI / 4);
    const cos45 = Math.cos(Math.PI / 4);
    const q1: [number, number, number, number] = [0, sin45, 0, cos45];

    const keyframes = [
      makeKeyframe(0, [0, 0, 0], q0),
      makeKeyframe(1, [0, 0, 0], q1),
    ];
    const result = interp.interpolate(keyframes, 0.5);

    // At t=0.5, rotation should be 45 degrees around Y
    const sin225 = Math.sin(Math.PI / 8);
    const cos225 = Math.cos(Math.PI / 8);
    expect(result.quaternion[0]).toBeCloseTo(0, 4);
    expect(result.quaternion[1]).toBeCloseTo(sin225, 4);
    expect(result.quaternion[2]).toBeCloseTo(0, 4);
    expect(result.quaternion[3]).toBeCloseTo(cos225, 4);
  });

  it("handles multi-segment interpolation", () => {
    const keyframes = [
      makeKeyframe(0, [0, 0, 0]),
      makeKeyframe(1, [10, 0, 0]),
      makeKeyframe(2, [10, 10, 0]),
    ];
    // t=1.5 is between keyframe 1 and 2
    const result = interp.interpolate(keyframes, 1.5);
    expect(result.position[0]).toBeCloseTo(10, 5);
    expect(result.position[1]).toBeCloseTo(5, 5);
    expect(result.position[2]).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/video-export/CameraKeyframeInterpolator.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the contract**

```typescript
// src/lib/shared/video-export/services/contracts/ICameraKeyframeInterpolator.ts
import type { CameraKeyframe } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface InterpolatedCamera {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov: number;
}

export interface ICameraKeyframeInterpolator {
  /**
   * Interpolate camera state at the given timestamp from a keyframe buffer.
   *
   * - Position: linear lerp
   * - Orientation: spherical lerp (slerp)
   * - FOV: linear lerp
   *
   * Clamps to first/last keyframe when t is outside the buffer range.
   */
  interpolate(
    keyframes: readonly CameraKeyframe[],
    t: number
  ): InterpolatedCamera;
}
```

- [ ] **Step 4: Write the implementation**

```typescript
// src/lib/shared/video-export/services/implementations/CameraKeyframeInterpolator.ts
import type { CameraKeyframe } from "$lib/shared/video-export/domain/CameraKeyframe";
import type {
  ICameraKeyframeInterpolator,
  InterpolatedCamera,
} from "../contracts/ICameraKeyframeInterpolator";

export class CameraKeyframeInterpolator implements ICameraKeyframeInterpolator {
  interpolate(
    keyframes: readonly CameraKeyframe[],
    t: number
  ): InterpolatedCamera {
    if (keyframes.length === 0) {
      return {
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        fov: 50,
      };
    }

    if (keyframes.length === 1) {
      const k = keyframes[0]!;
      return {
        position: [...k.position],
        quaternion: [...k.quaternion],
        fov: k.fov,
      };
    }

    // Clamp before first keyframe
    const first = keyframes[0]!;
    if (t <= first.timestamp) {
      return {
        position: [...first.position],
        quaternion: [...first.quaternion],
        fov: first.fov,
      };
    }

    // Clamp after last keyframe
    const last = keyframes[keyframes.length - 1]!;
    if (t >= last.timestamp) {
      return {
        position: [...last.position],
        quaternion: [...last.quaternion],
        fov: last.fov,
      };
    }

    // Find bracketing keyframes via binary search
    let lo = 0;
    let hi = keyframes.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (keyframes[mid]!.timestamp <= t) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const a = keyframes[lo]!;
    const b = keyframes[hi]!;
    const segmentDuration = b.timestamp - a.timestamp;
    const alpha = segmentDuration > 0 ? (t - a.timestamp) / segmentDuration : 0;

    return {
      position: lerpVec3(a.position, b.position, alpha),
      quaternion: slerp(a.quaternion, b.quaternion, alpha),
      fov: a.fov + (b.fov - a.fov) * alpha,
    };
  }
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function slerp(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number
): [number, number, number, number] {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

  // If dot is negative, negate one quaternion to take the shorter path
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  // If quaternions are nearly identical, use linear interpolation
  if (dot > 0.9995) {
    const result: [number, number, number, number] = [
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t,
    ];
    // Normalize
    const len = Math.sqrt(
      result[0] ** 2 + result[1] ** 2 + result[2] ** 2 + result[3] ** 2
    );
    result[0] /= len;
    result[1] /= len;
    result[2] /= len;
    result[3] /= len;
    return result;
  }

  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  return [
    a[0] * wa + bx * wb,
    a[1] * wa + by * wb,
    a[2] * wa + bz * wb,
    a[3] * wa + bw * wb,
  ];
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/video-export/CameraKeyframeInterpolator.test.ts --config tests/config/vitest.config.ts`
Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/video-export/services/contracts/ICameraKeyframeInterpolator.ts src/lib/shared/video-export/services/implementations/CameraKeyframeInterpolator.ts tests/unit/video-export/CameraKeyframeInterpolator.test.ts
git commit -m "feat(video-export): CameraKeyframeInterpolator with lerp + slerp"
```

---

## Phase 3: Offline Render Loop

### Task 7: IOffline3DExporter contract

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IOffline3DExporter.ts`

- [ ] **Step 1: Write the contract**

```typescript
// src/lib/shared/3d/services/contracts/IOffline3DExporter.ts
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface Offline3DExportOptions {
  fps: number;
  /** Target vertical resolution: 720, 1080, 2160, or 4320 */
  resolution: number;
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
}

/**
 * Dependencies the caller must supply from the live 3D scene.
 * The offline exporter uses these to drive the scene deterministically.
 */
export interface Offline3DExportDependencies {
  /** The WebGL canvas to capture frames from */
  webglCanvas: HTMLCanvasElement;
  /** The Three.js WebGLRenderer (from useThrelte().renderer) */
  renderer: { render(scene: any, camera: any): void };
  /** The Three.js Scene (from useThrelte().scene) */
  scene: any;
  /** The Three.js PerspectiveCamera (from useThrelte().camera) */
  camera: {
    position: { set(x: number, y: number, z: number): void };
    quaternion: { set(x: number, y: number, z: number, w: number): void };
    fov: number;
    updateProjectionMatrix(): void;
  };
  /** All performer instances to drive animation */
  performers: Array<{
    goToStep(index: number): void;
    setProgress(value: number): void;
    totalSteps: number;
  }>;
  /** Formation transition updater */
  updateFormationTransition(timestamp: number): void;
  /** Effect orchestrator update (receives dt in seconds) */
  updateEffects(dt: number): void;
  /** Beats per second for converting animation time to currentStep */
  beatsPerSecond: number;
  /** Total animation duration in seconds (single loop, no start/end hold) */
  totalDurationSeconds: number;
  /** Camera keyframe buffer from pass 1 (or static capture) */
  cameraKeyframes: CameraKeyframeBuffer;
  /** Callback to pause Threlte's auto-render loop */
  pauseAutoRender(): void;
  /** Callback to resume Threlte's auto-render loop */
  resumeAutoRender(): void;
}

export interface IOffline3DExporter {
  /**
   * Render every frame deterministically and produce an MP4 blob.
   *
   * For each frame:
   *   1. Set animation time = frameIndex / fps
   *   2. Interpolate camera from keyframes
   *   3. Tick effects with dt = 1/fps
   *   4. Force renderer.render(scene, camera)
   *   5. Capture frame and feed to encoder
   *   6. Yield to event loop for UI responsiveness
   */
  exportOffline(
    deps: Offline3DExportDependencies,
    onProgress: (progress: VideoExportProgress) => void,
    options: Offline3DExportOptions
  ): Promise<Blob>;

  /** Cancel an in-progress export and clean up resources. */
  cancel(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IOffline3DExporter.ts
git commit -m "feat(video-export): IOffline3DExporter contract"
```

---

### Task 8: Offline3DExporter implementation

**Files:**
- Create: `src/lib/shared/3d/services/implementations/Offline3DExporter.ts`

- [ ] **Step 1: Implement the offline render loop**

```typescript
// src/lib/shared/3d/services/implementations/Offline3DExporter.ts
import type { IBackgroundVideoEncoder } from "$lib/features/compose/services/contracts/IBackgroundVideoEncoder";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type {
  IOffline3DExporter,
  Offline3DExportDependencies,
  Offline3DExportOptions,
} from "../contracts/IOffline3DExporter";
import {
  getExportDimensions,
  calculateBitrate,
} from "$lib/features/compose/shared/domain/video-export-calculations";
import type { ICanvasFrameCapturer } from "$lib/shared/video-export/services/contracts/ICanvasFrameCapturer";
import type { ICameraKeyframeInterpolator } from "$lib/shared/video-export/services/contracts/ICameraKeyframeInterpolator";
import { ExportDiagnostics } from "$lib/shared/video-export/domain/ExportDiagnostics";

const KEYFRAME_INTERVAL = 30;
const FALLBACK_ASPECT_RATIO = 16 / 9;

export class Offline3DExporter implements IOffline3DExporter {
  private shouldCancel = false;

  constructor(
    private readonly backgroundEncoder: IBackgroundVideoEncoder,
    private readonly capturer: ICanvasFrameCapturer,
    private readonly cameraInterpolator: ICameraKeyframeInterpolator
  ) {}

  async exportOffline(
    deps: Offline3DExportDependencies,
    onProgress: (progress: VideoExportProgress) => void,
    options: Offline3DExportOptions
  ): Promise<Blob> {
    this.shouldCancel = false;

    const { fps, resolution, loopCount } = options;

    // Derive dimensions from the live canvas aspect ratio
    const liveWidth = deps.webglCanvas.width;
    const liveHeight = deps.webglCanvas.height;
    const aspectRatio =
      liveWidth > 0 && liveHeight > 0
        ? liveWidth / liveHeight
        : FALLBACK_ASPECT_RATIO;

    const { width, height } = getExportDimensions(resolution, aspectRatio);
    const bitrate = calculateBitrate(width, height, fps);

    const totalDurationSec = deps.totalDurationSeconds * loopCount;
    const totalFrames = Math.ceil(totalDurationSec * fps);

    if (totalFrames <= 0) {
      throw new Error(
        `Cannot export: computed 0 frames (duration=${totalDurationSec}s, fps=${fps})`
      );
    }

    // Initialize the background encoder
    await this.backgroundEncoder.initialize({
      width,
      height,
      fps,
      bitrate,
      totalFrames,
    });

    this.backgroundEncoder.onProgress = (frameIndex, total) => {
      onProgress({
        progress: frameIndex / total,
        stage: "encoding",
        currentFrame: frameIndex,
        totalFrames: total,
      });
    };

    const diag = new ExportDiagnostics(
      width,
      height,
      fps,
      totalFrames,
      this.capturer.preferredKind
    );

    // Pause Threlte's render loop — we're taking manual control
    deps.pauseAutoRender();

    const dt = 1 / fps;
    const keyframes = deps.cameraKeyframes.keyframes;

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.shouldCancel) {
          throw new Error("Export cancelled");
        }

        diag.startFrame();

        const animationTime = frameIndex / fps;
        const currentStep = animationTime * deps.beatsPerSecond;

        // 1. Set animation state for every performer
        const beatIndex = Math.floor(currentStep);
        const subBeatProgress = currentStep - beatIndex;

        for (const performer of deps.performers) {
          if (beatIndex >= performer.totalSteps) {
            performer.goToStep(performer.totalSteps - 1);
            performer.setProgress(1);
          } else {
            performer.goToStep(beatIndex);
            performer.setProgress(subBeatProgress);
          }
        }

        // 2. Update formation transitions with deterministic timestamp
        deps.updateFormationTransition(animationTime * 1000);

        // 3. Interpolate camera from recorded keyframes
        const cam = this.cameraInterpolator.interpolate(keyframes, animationTime);
        deps.camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
        deps.camera.quaternion.set(
          cam.quaternion[0],
          cam.quaternion[1],
          cam.quaternion[2],
          cam.quaternion[3]
        );
        deps.camera.fov = cam.fov;
        deps.camera.updateProjectionMatrix();

        diag.markDrawImage();

        // 4. Tick effects with deterministic delta
        deps.updateEffects(dt);

        // 5. Force render
        deps.renderer.render(deps.scene, deps.camera);

        // 6. Capture frame
        const timestampMicros = Math.round(animationTime * 1_000_000);
        const isKeyframe = frameIndex % KEYFRAME_INTERVAL === 0;
        const frame = this.capturer.capture(deps.webglCanvas, timestampMicros);
        diag.markCapture();

        this.backgroundEncoder.addFrameCaptured(frame, frameIndex, isKeyframe);
        diag.markAddFrame();

        // 7. Report progress
        onProgress({
          progress: frameIndex / totalFrames,
          stage: "capturing",
          currentFrame: frameIndex,
          totalFrames,
        });

        // 8. Yield to event loop so the browser can paint progress and
        // handle cancel button clicks. Cost: ~4ms per frame.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      diag.finish();

      // Finalize encoding
      const blob = await this.backgroundEncoder.finish();
      onProgress({ progress: 1, stage: "complete", totalFrames });
      return blob;
    } catch (err) {
      diag.finish();
      if ((err as Error).message !== "Export cancelled") {
        onProgress({
          progress: 0,
          stage: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    } finally {
      // Always restore Threlte's render loop
      deps.resumeAutoRender();
    }
  }

  cancel(): void {
    this.shouldCancel = true;
    this.backgroundEncoder.cancel();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/services/implementations/Offline3DExporter.ts
git commit -m "feat(video-export): Offline3DExporter deterministic render loop"
```

---

### Task 9: DI wiring

**Files:**
- Modify: `src/lib/shared/di/containers/animator-container.ts`

- [ ] **Step 1: Replace Realtime3DExporter with Offline3DExporter in DI**

In `animator-container.ts`, change the imports:

Find:
```typescript
import { Realtime3DExporter } from "$lib/shared/3d/services/implementations/Realtime3DExporter";
```

Replace with:
```typescript
import { Offline3DExporter } from "$lib/shared/3d/services/implementations/Offline3DExporter";
import { CameraKeyframeInterpolator } from "$lib/shared/video-export/services/implementations/CameraKeyframeInterpolator";
```

Find the registration (lines 171-177):
```typescript
    .add((ctx) => ({
      realtime3DExporter: () =>
        new Realtime3DExporter(
          ctx.backgroundVideoEncoder,
          ctx.canvasFrameCapturer
        ),
    }))
```

Replace with:
```typescript
    .add(() => ({
      cameraKeyframeInterpolator: () => new CameraKeyframeInterpolator(),
    }))
    .add((ctx) => ({
      offline3DExporter: () =>
        new Offline3DExporter(
          ctx.backgroundVideoEncoder,
          ctx.canvasFrameCapturer,
          ctx.cameraKeyframeInterpolator
        ),
    }))
```

- [ ] **Step 2: Update container type exports**

Check `src/lib/shared/di/container-types.ts` — if `realtime3DExporter` is referenced there, update the type to `offline3DExporter`. The ITI container infers types automatically, so this may just require updating any explicit type references.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build may fail with references to `realtime3DExporter` in SequenceModalExporter. That's expected — Task 10 fixes it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/animator-container.ts
git commit -m "feat(video-export): register Offline3DExporter in DI container"
```

---

## Phase 4: Integration

### Task 10: Update SequenceModalExporter and export dependencies

Wire the new offline exporter into the existing export flow.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/contracts/ISequenceModalExporter.ts`
- Modify: `src/lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte.ts`

- [ ] **Step 1: Update Video3DExportDependencies**

In `ISequenceModalExporter.ts`, find the `Video3DExportDependencies` interface:
```typescript
export interface Video3DExportDependencies {
  webglCanvas: HTMLCanvasElement;
  startPlayback: () => void;
  stopPlayback: () => void;
  getTotalDurationSeconds: () => number;
}
```

Replace with:
```typescript
import type { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface Video3DExportDependencies {
  webglCanvas: HTMLCanvasElement;
  /** The Three.js renderer from useThrelte() */
  renderer: { render(scene: any, camera: any): void };
  /** The Three.js scene from useThrelte() */
  scene: any;
  /** The Three.js camera from useThrelte() */
  camera: any;
  /** All performers to drive during offline render */
  performers: Array<{
    goToStep(index: number): void;
    setProgress(value: number): void;
    totalSteps: number;
  }>;
  /** Formation transition updater */
  updateFormationTransition(timestamp: number): void;
  /** Effect orchestrator update callback */
  updateEffects(dt: number): void;
  /** Beats per second */
  beatsPerSecond: number;
  /** Duration of one loop in seconds */
  getTotalDurationSeconds: () => number;
  /** Camera keyframes from pass 1 or static capture */
  cameraKeyframes: CameraKeyframeBuffer;
  /** Pause/resume Threlte rendering */
  pauseAutoRender(): void;
  resumeAutoRender(): void;
}
```

- [ ] **Step 2: Update SequenceModalExporter.export3DAnimation**

In `SequenceModalExporter.svelte.ts`, find `export3DAnimation` (line 124-175):

Replace the method body:
```typescript
  async export3DAnimation(
    options: VideoExportOptions,
    deps: Video3DExportDependencies,
    callbacks: ExportCallbacks
  ): Promise<void> {
    const exporter = container.items.offline3DExporter as IOffline3DExporter;
    if (!exporter) {
      this._error = "3D export services not ready.";
      return;
    }

    this._activeRealtime3DExporter = exporter;
    this._isExporting = true;
    this._error = null;
    this._progress = { progress: 0, stage: "capturing" };
    this.revokePreviewUrl();

    try {
      const blob = await exporter.exportOffline(
        {
          webglCanvas: deps.webglCanvas,
          renderer: deps.renderer,
          scene: deps.scene,
          camera: deps.camera,
          performers: deps.performers,
          updateFormationTransition: deps.updateFormationTransition,
          updateEffects: deps.updateEffects,
          beatsPerSecond: deps.beatsPerSecond,
          totalDurationSeconds: deps.getTotalDurationSeconds(),
          cameraKeyframes: deps.cameraKeyframes,
          pauseAutoRender: deps.pauseAutoRender,
          resumeAutoRender: deps.resumeAutoRender,
        },
        (progress) => {
          this._progress = progress;
          if (progress.stage === "complete") {
            callbacks.onHaptic("success");
            callbacks.onSuccess("3D video exported!");
          }
        },
        {
          fps: options.fps,
          resolution: options.resolution,
          loopCount: options.loopCount,
          includeStartPosition: options.includeStartPosition ?? true,
          includeEndHold: options.includeEndHold ?? false,
        }
      );

      this._previewBlobUrl = URL.createObjectURL(blob);
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        console.error("[SequenceModalExporter] 3D export failed:", error);
        this._error = "3D export failed. Please try again.";
        callbacks.onError(this._error);
      }
    } finally {
      this._activeRealtime3DExporter = null;
      this._isExporting = false;
      this._progress = null;
    }
  }
```

Update the imports at the top:
```typescript
import type { IOffline3DExporter } from "$lib/shared/3d/services/contracts/IOffline3DExporter";
```

Remove the old import:
```typescript
// Remove: import type { IRealtime3DExporter } from ...
```

Update the `_activeRealtime3DExporter` field type and the `cancel()` method to use the new exporter type. Rename the field to `_activeExporter` for clarity.

- [ ] **Step 3: Update the orchestrator call site**

In `SequenceViewerOrchestrator.svelte`, the `handleExport` function builds `Video3DExportDependencies`. This needs to supply the new fields (renderer, scene, camera, performers, etc.) instead of `startPlayback/stopPlayback`.

The orchestrator has access to `viewer3DState` which should expose the Threlte context. The exact wiring depends on how the orchestrator accesses the 3D scene — this may require reading from a Svelte context or adding getters to `viewer3DState`.

Key fields to wire:
- `renderer`, `scene`, `camera` — from `useThrelte()` exposed via the viewer state
- `performers` — from `performerManager.performers`
- `updateFormationTransition` — from `performerManager.updateFormationTransition`
- `updateEffects` — needs a reference to the effect orchestrator's update function (may need to expose this)
- `beatsPerSecond` — from playback state speed
- `cameraKeyframes` — create a `CameraKeyframeBuffer`, call `captureStatic(camera)` for quick export
- `pauseAutoRender/resumeAutoRender` — from Threlte context

This is the most integration-heavy step. The implementer should read `SequenceViewerOrchestrator.svelte` lines 1107-1190 and `viewer-3d-state.svelte.ts` to understand the current wiring, then adapt to supply the new dependency shape.

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/ISequenceModalExporter.ts src/lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte.ts
git commit -m "feat(video-export): wire Offline3DExporter into SequenceModalExporter"
```

---

### Task 11: Expose Threlte internals for offline render

The offline exporter needs direct access to the Three.js renderer, scene, camera, and the ability to pause/resume Threlte's auto-render. These must be exposed from the 3D viewer components.

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

- [ ] **Step 1: Add Threlte context accessors to viewer-3d-state**

Add fields for the renderer, scene, and camera to the viewer 3D state so the export orchestrator can access them. The implementer should read `viewer-3d-state.svelte.ts` and add:

```typescript
// In the state factory return object:
webglRenderer: null as WebGLRenderer | null,
threlteScene: null as Scene | null,
threlteCamera: null as PerspectiveCamera | null,
autoRenderEnabled: true,

setThrelteContext(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
  this.webglRenderer = renderer;
  this.threlteScene = scene;
  this.threlteCamera = camera;
},

pauseAutoRender() {
  this.autoRenderEnabled = false;
},

resumeAutoRender() {
  this.autoRenderEnabled = true;
},
```

- [ ] **Step 2: Set the Threlte context from Viewer3DScene**

In `Viewer3DScene.svelte`, after the `useThrelte()` call, register the renderer/scene/camera with the viewer state:

```typescript
const { renderer, scene, camera } = useThrelte();

// Expose Threlte internals for offline export
$effect(() => {
  const r = renderer?.current ?? renderer;
  const s = scene?.current ?? scene;
  const c = camera?.current ?? camera;
  if (r && s && c) {
    viewer3DState.setThrelteContext(r, s, c);
  }
});
```

- [ ] **Step 3: Gate useTask on autoRenderEnabled**

In `Viewer3DScene.svelte`, the puppet loop useTask should skip when offline export is in progress:

```typescript
useTask((delta) => {
  // Skip puppet updates during offline export — the exporter drives
  // performers directly with deterministic timing.
  if (!viewer3DState.autoRenderEnabled) return;

  // ... existing puppet loop code ...
});
```

Do the same in `Avatar3D.svelte`'s useTask.

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/shared/3d/components/Viewer3DScene.svelte src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): expose Threlte context and auto-render gate for offline export"
```

---

### Task 12: Wire orchestrator to supply new dependencies

Update `SequenceViewerOrchestrator.svelte` to build the new `Video3DExportDependencies` shape.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (lines ~1107-1190)

- [ ] **Step 1: Import CameraKeyframeBuffer**

```typescript
import { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";
```

- [ ] **Step 2: Update handleExport to build new deps**

The existing `handleExport` builds `startPlayback/stopPlayback` callbacks. Replace these with the new dependency shape. For the initial implementation, use "quick export" mode (static camera capture, no pass 1 recording):

```typescript
// Inside handleExport, replace the deps construction:
const cameraKeyframes = new CameraKeyframeBuffer();
cameraKeyframes.captureStatic(viewer3DState.threlteCamera!);

const deps: Video3DExportDependencies = {
  webglCanvas: viewer3DState.webglCanvas!,
  renderer: viewer3DState.webglRenderer!,
  scene: viewer3DState.threlteScene!,
  camera: viewer3DState.threlteCamera!,
  performers: performerManager.performers.map((p) => ({
    goToStep: (i: number) => p.goToStep(i),
    setProgress: (v: number) => p.setProgress(v),
    totalSteps: p.totalSteps,
  })),
  updateFormationTransition: (ts: number) =>
    performerManager.updateFormationTransition(ts),
  updateEffects: (dt: number) => {
    // The effect orchestrator runs inside its own useTask —
    // for offline mode, we need an imperative update hook.
    // This will be wired in Task 13 via a callback ref.
  },
  beatsPerSecond: playbackController.speed,
  getTotalDurationSeconds: () => { /* existing calculation */ },
  cameraKeyframes,
  pauseAutoRender: () => viewer3DState.pauseAutoRender(),
  resumeAutoRender: () => viewer3DState.resumeAutoRender(),
};
```

**Note for implementer:** The `updateEffects` callback is the hardest part. The EffectOrchestrator3D runs inside a Svelte component's `useTask`. For offline export, we need to call its update logic imperatively. The cleanest approach: extract the effect update logic into a callable function exposed via the viewer state or a context, similar to how `performerManager.updateFormationTransition` works. Read `EffectOrchestrator3D.svelte` carefully — the update logic at lines 330-620 computes tip positions, evaluates effects, and calls renderer updates. This may need to be refactored into a callable method.

- [ ] **Step 3: Verify build and test with a quick export**

Run: `npm run build 2>&1 | tail -5`
Then test a "quick export" (static camera) from the compose tab or sequence viewer. The diagnostics block should show offline-mode timings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(video-export): wire orchestrator for offline 3D export (quick-export mode)"
```

---

### Task 13: Expose effect orchestrator update for offline mode

The effect orchestrator's update logic runs inside a `useTask` callback in `EffectOrchestrator3D.svelte`. For offline export, we need to call it imperatively with a deterministic `dt`.

**Important:** `Trail3D.svelte` has its OWN `useTask` that calls `TrailRenderer3D.addPoint()` and `update()` independently of the orchestrator. This trail useTask must also be gated on `autoRenderEnabled`, and the trail update logic must be callable imperatively from the extracted function. The trail ring buffer's `push()` already accepts an optional `timestamp` parameter — pass a deterministic timestamp (`animationTime` in seconds) during offline mode instead of letting it fall through to `performance.now()`. Similarly, `TrailRenderer3D.update()` uses `performance.now() / 1000` for fade calculation (line 209) — this needs to accept an optional `now` parameter for deterministic fade timing.

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`
- Modify: `src/lib/shared/3d/effects/trails/TrailRenderer3D.ts` (add optional `now` parameter to `update()`)
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Extract effect update into a callable function**

In `EffectOrchestrator3D.svelte`, the `useTask` body (lines 214-620+) needs to be extractable. The approach:

1. Keep the `useTask` for live rendering (it calls the update function with real delta)
2. Extract the core update logic into a function that accepts `dt` as a parameter
3. Register that function on the viewer state so the offline exporter can call it

```typescript
// Inside EffectOrchestrator3D.svelte:

function updateEffectsImperative(dt: number) {
  // ... the entire body of the current useTask, but using the dt parameter
  // instead of the hardcoded 1/60 ...
}

// Register on viewer state for offline export access
$effect(() => {
  viewer3DState.updateEffects = updateEffectsImperative;
  return () => { viewer3DState.updateEffects = null; };
});

// Live rendering: useTask calls the same function with real delta
useTask((delta) => {
  if (!viewer3DState.autoRenderEnabled) return;
  if (!isPlaying) {
    // ... existing reset logic ...
    return;
  }
  updateEffectsImperative(Math.min(delta, 1 / 15));
});
```

- [ ] **Step 2: Add updateEffects slot to viewer-3d-state**

```typescript
// In viewer-3d-state:
updateEffects: null as ((dt: number) => void) | null,
```

- [ ] **Step 3: Wire the orchestrator's updateEffects callback**

In `SequenceViewerOrchestrator.svelte` (from Task 12), update the `updateEffects` field:

```typescript
updateEffects: (dt: number) => {
  viewer3DState.updateEffects?.(dt);
},
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/effects/EffectOrchestrator3D.svelte src/lib/shared/3d/state/viewer-3d-state.svelte.ts
git commit -m "feat(effects): expose imperative updateEffects for offline export"
```

---

## Phase 5: Cleanup

### Task 14: Remove Realtime3DExporter

**Files:**
- Delete: `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts`
- Delete: `src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts`

- [ ] **Step 1: Search for remaining references**

Run: `grep -r "Realtime3DExporter\|IRealtime3DExporter\|realtime3DExporter" src/ --include="*.ts" --include="*.svelte" -l`

Fix any remaining references (update imports, remove unused type references).

- [ ] **Step 2: Delete the files**

```bash
rm src/lib/shared/3d/services/implementations/Realtime3DExporter.ts
rm src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds with no references to deleted files.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/shared/3d/services/implementations/Realtime3DExporter.ts src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts
git commit -m "chore: remove Realtime3DExporter (replaced by Offline3DExporter)"
```

---

### Task 15: Run all tests and final verification

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run --config tests/config/vitest.config.ts`
Expected: All tests pass including the new CameraKeyframeBuffer and CameraKeyframeInterpolator tests.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "village/engine\|sequence-engine\|poi/services" | grep "error TS"`
Expected: No new type errors in the video-export or 3d directories.

- [ ] **Step 3: Smoke test**

Test a quick export (static camera) at 1080p/30 from:
1. Compose tab with a simple sequence
2. Collision lab with full audience

Both should produce smooth, artifact-free MP4 files. The diagnostics block should show offline-mode timings (no RAF intervals — just render/capture/encode per frame).

For collision lab specifically: every frame should be unique (no duplicate frames). The wall time will be longer than real-time (that's correct — we're rendering as fast as the GPU allows, not at 30fps real-time), but the output video should play back at exactly 30fps with smooth motion.

- [ ] **Step 4: Final commit if any adjustments needed**

```bash
git commit -m "test: verify two-pass deterministic export across scene types"
```
