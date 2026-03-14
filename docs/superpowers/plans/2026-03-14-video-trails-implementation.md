# Video Trails Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Video Trails lab tab that detects prop endpoints in uploaded video, renders TKA's existing effect stack (fire/LED/trails/charcoal) on detected points, and exports processed video.

**Architecture:** Single lab tab with internal sub-navigation (Workspace, Detection Studio, Library). State factory + context pattern. Services registered via ITI DI container. Reuses existing WebGLFireRenderer, WebGLLedRenderer, Canvas2DTrailRenderer, CharcoalSparkRenderer. IEndpointDetector interface abstracts detection strategy (LED thresholding MVP, color matching next, ML later).

**Tech Stack:** Svelte 5 (runes), TypeScript strict, ITI DI, Canvas2D + WebGL2, WebCodecs (MP4 export) with MediaRecorder fallback, IndexedDB + localStorage persistence.

**Design Spec:** `docs/superpowers/specs/2026-03-14-video-trails-design.md`

---

## Chunk 1: Foundation (Types, Services, DI, State, Context, Tab Registration)

### File Structure (Chunk 1)

| File | Responsibility |
|------|---------------|
| `src/lib/features/lab/tabs/video-trails/domain/types.ts` | All domain types: DetectedEndpoint, DetectionConfig, CorrectionFrame, VideoTrailsProject, EffectConfig, ExportState, etc. |
| `src/lib/features/lab/tabs/video-trails/services/contracts/IEndpointDetector.ts` | Detection interface + DetectorCapabilities |
| `src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTipAdapter.ts` | Adapter interface: DetectedEndpoint[] -> PropTipData/LedTipData/TrailPoint |
| `src/lib/features/lab/tabs/video-trails/services/contracts/IDetectionCorrector.ts` | Correction storage + application interface |
| `src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTrailsRepository.ts` | CRUD for VideoTrailsProject |
| `src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTrailsExporter.ts` | Export interface |
| `src/lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector.ts` | MVP brightness-based endpoint detection |
| `src/lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter.ts` | Stateful adapter with velocity tracking via finite differencing |
| `src/lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector.ts` | Correction storage, application, training pair generation |
| `src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository.ts` | IndexedDB + localStorage persistence |
| `src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter.ts` | Frame-by-frame compositing + encoding |
| `src/lib/features/lab/tabs/video-trails/state/video-trails-state.svelte.ts` | Shared reactive state factory |
| `src/lib/features/lab/tabs/video-trails/context/video-trails-context.ts` | setVideoTrailsContext / getVideoTrailsContext |
| `src/lib/shared/di/containers/video-trails-container.ts` | ITI container for all Video Trails services |
| Modify: `src/lib/shared/di/container-types.ts` | Add VideoTrailsItems to IAppContainerItems |
| Modify: `src/lib/shared/di/index.ts` | Import + wire videoTrailsContainer |
| Modify: `src/lib/shared/navigation/config/tab-definitions.ts` | Add video-trails entry to LAB_TABS |
| Modify: `src/lib/features/lab/LabModule.svelte` | Add video-trails to tabComponents map |

---

### Task 1: Domain Types

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/domain/types.ts`

- [ ] **Step 1: Create the types file with all domain models**

```typescript
// src/lib/features/lab/tabs/video-trails/domain/types.ts

import type { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";

// ============================================================================
// Detection
// ============================================================================

export interface DetectedEndpoint {
  x: number;
  y: number;
  brightness: number;           // 0-1
  confidence: number;           // 0-1
  propIndex: 0 | 1;
  tipIndex: number;
  frameIndex: number;
}

export interface DetectionConfig {
  threshold: number;            // 0-1, brightness cutoff
  sensitivity: number;          // 0-2, luminance multiplier
  colorWeights: { r: number; g: number; b: number };
  minArea: number;              // Minimum pixel cluster size
  maxEndpoints: number;         // Max detected points per frame
}

export interface DetectorCapabilities {
  supportsLive: boolean;
  supportsOcclusion: boolean;
  requiresGPU: boolean;
}

export interface DetectorRegistration {
  id: string;
  name: string;
  description: string;
  version: string;
  containerKey: string;
  capabilities: DetectorCapabilities;
}

// ============================================================================
// Corrections
// ============================================================================

export interface EndpointCorrection {
  propIndex: 0 | 1;
  tipIndex: number;
  detected: { x: number; y: number; confidence: number } | null;
  corrected: { x: number; y: number } | null;
  status: "accepted" | "corrected" | "occluded" | "interpolated";
  occlusionCause?: string;
}

export interface CorrectionFrame {
  frameIndex: number;
  timestamp: number;
  endpoints: EndpointCorrection[];
  metadata: {
    correctedBy: string;
    correctedAt: string;
    sourceDetector: string;
    notes?: string;
  };
}

export interface TrainingPair {
  frame: { width: number; height: number; dataUrl: string };
  detected: DetectedEndpoint[];
  corrected: EndpointCorrection[];
  metadata: CorrectionFrame["metadata"];
}

// ============================================================================
// Effects
// ============================================================================

export interface FireEffectConfig {
  enabled: boolean;
  intensity: number;
  flameHeight: number;
  colorBlend: number;
  preset: "white-gas" | "charcoal";
}

export interface LedEffectConfig {
  enabled: boolean;
  glowRadius: number;
  bloom: number;
  patternId: string;
  color: string;
  brightness: number;
}

export interface TrailEffectConfig {
  enabled: boolean;
  mode: TrailMode;
  length: number;
  fade: number;
  width: number;
  glow: boolean;
  color: { blue: string; red: string };
}

export interface CharcoalEffectConfig {
  enabled: boolean;
  gravity: number;
  burstThreshold: number;
}

export interface EffectConfig {
  fire: FireEffectConfig;
  led: LedEffectConfig;
  trails: TrailEffectConfig;
  charcoal: CharcoalEffectConfig;
}

// ============================================================================
// Video Source
// ============================================================================

export interface VideoSource {
  type: "file" | "camera" | "sequence";
  url: string;
  originalFileName?: string;
  duration: number;
  resolution: { width: number; height: number };
  frameCount: number;
  fps: number;
}

// ============================================================================
// Export
// ============================================================================

export type ExportPhase = "idle" | "preparing" | "recording" | "encoding" | "complete" | "error";

export interface ExportState {
  phase: ExportPhase;
  progress?: number;
  blob?: Blob;
  error?: string;
}

export interface ExportConfig {
  format: "mp4" | "webm";
  resolution: { width: number; height: number };
  fps: number;
  bitrate: number;
}

export interface VideoExportRecord {
  id: string;
  exportedAt: string;
  format: "mp4" | "webm";
  resolution: { width: number; height: number };
  effectsApplied: string[];
  fileSize: number;
  blobUrl?: string;
}

// ============================================================================
// Project
// ============================================================================

export interface VideoTrailsProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;

  source: {
    type: "file" | "camera" | "sequence";
    originalFileName?: string;
    duration: number;
    resolution: { width: number; height: number };
    frameCount: number;
    fps: number;
  };

  detection: {
    detectorId: string;
    config: DetectionConfig;
    results: Record<number, DetectedEndpoint[]>;
    corrections: Record<number, EndpointCorrection[]>;
    trainingDataExported: boolean;
  };

  effects: EffectConfig;
  exports: VideoExportRecord[];

  attachments: {
    sequenceId?: string;
    actId?: string;
    showId?: string;
  };

  thumbnail: string;
}

// ============================================================================
// Sub-navigation
// ============================================================================

export type VideoTrailsView = "workspace" | "detection-studio" | "library";

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  threshold: 0.7,
  sensitivity: 1.0,
  colorWeights: { r: 0.2126, g: 0.7152, b: 0.0722 },
  minArea: 4,
  maxEndpoints: 4,
};

export const DEFAULT_EFFECT_CONFIG: EffectConfig = {
  fire: { enabled: false, intensity: 1.0, flameHeight: 1.0, colorBlend: 0.5, preset: "white-gas" },
  led: { enabled: false, glowRadius: 1.5, bloom: 0.05, patternId: "solid", color: "#ffffff", brightness: 1.0 },
  trails: { enabled: true, mode: "fade" as TrailMode, length: 60, fade: 0.95, width: 3, glow: true, color: { blue: "#4a90d9", red: "#d94a4a" } },
  charcoal: { enabled: false, gravity: 50, burstThreshold: 500 },
};

export const DETECTOR_REGISTRY: DetectorRegistration[] = [
  {
    id: "led-threshold-v1",
    name: "LED Threshold",
    description: "Detects bright points via luminance thresholding. Best for LED props in dark environments.",
    version: "1.0.0",
    containerKey: "ledThresholdDetector",
    capabilities: { supportsLive: true, supportsOcclusion: false, requiresGPU: false },
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `video-trails/domain/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/domain/types.ts
git commit -m "feat(video-trails): add domain types for detection, corrections, effects, projects"
```

---

### Task 2: Service Contracts (Interfaces)

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/contracts/IEndpointDetector.ts`
- Create: `src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTipAdapter.ts`
- Create: `src/lib/features/lab/tabs/video-trails/services/contracts/IDetectionCorrector.ts`
- Create: `src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTrailsRepository.ts`
- Create: `src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTrailsExporter.ts`

- [ ] **Step 1: Create IEndpointDetector**

```typescript
// src/lib/features/lab/tabs/video-trails/services/contracts/IEndpointDetector.ts

import type { DetectedEndpoint, DetectionConfig, DetectorCapabilities } from "../../domain/types";

export interface IEndpointDetector {
  detect(frame: ImageData, config: DetectionConfig): DetectedEndpoint[];
  readonly name: string;
  readonly capabilities: DetectorCapabilities;
}
```

- [ ] **Step 2: Create IVideoTipAdapter**

```typescript
// src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTipAdapter.ts

import type { DetectedEndpoint } from "../../domain/types";
import type { PropTipData } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedTipData } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { TrailPoint } from "$lib/shared/animation-engine/domain/types/TrailTypes";
import type { LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";

export interface IVideoTipAdapter {
  mapToFireTips(endpoints: DetectedEndpoint[], canvasSize: number, currentTime: number): PropTipData[];
  mapToLedTips(endpoints: DetectedEndpoint[], currentTime: number, ledConfig: LedOverlayConfig): LedTipData[];
  mapToTrailPoints(endpoints: DetectedEndpoint[], currentTime: number): TrailPoint[];
  reset(): void;
}
```

- [ ] **Step 3: Create IDetectionCorrector**

```typescript
// src/lib/features/lab/tabs/video-trails/services/contracts/IDetectionCorrector.ts

import type { DetectedEndpoint, EndpointCorrection, TrainingPair } from "../../domain/types";

export interface IDetectionCorrector {
  applyCorrections(
    frameIndex: number,
    detected: DetectedEndpoint[],
    corrections: Record<number, EndpointCorrection[]>,
  ): DetectedEndpoint[];
  generateTrainingPairs(
    frameDetections: Record<number, DetectedEndpoint[]>,
    corrections: Record<number, EndpointCorrection[]>,
    getFrameImage: (frameIndex: number) => { width: number; height: number; dataUrl: string },
  ): TrainingPair[];
}
```

- [ ] **Step 4: Create IVideoTrailsRepository**

```typescript
// src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTrailsRepository.ts

import type { VideoTrailsProject } from "../../domain/types";

export interface IVideoTrailsRepository {
  save(project: VideoTrailsProject): Promise<void>;
  load(id: string): Promise<VideoTrailsProject | null>;
  list(): Promise<VideoTrailsProject[]>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 5: Create IVideoTrailsExporter**

```typescript
// src/lib/features/lab/tabs/video-trails/services/contracts/IVideoTrailsExporter.ts

import type { ExportConfig, ExportState } from "../../domain/types";

export interface IVideoTrailsExporter {
  export(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob>;
  cancel(): void;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/services/contracts/
git commit -m "feat(video-trails): add service contract interfaces"
```

---

### Task 3: LedThresholdDetector Implementation

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector.ts`
- Create: `tests/unit/video-trails/led-threshold-detector.test.ts`

- [ ] **Step 1: Write tests for the detector**

```typescript
// tests/unit/video-trails/led-threshold-detector.test.ts

import { describe, it, expect } from "vitest";
import { LedThresholdDetector } from "$lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector";
import type { DetectionConfig } from "$lib/features/lab/tabs/video-trails/domain/types";

const DEFAULT_CONFIG: DetectionConfig = {
  threshold: 0.5,
  sensitivity: 1.0,
  colorWeights: { r: 0.2126, g: 0.7152, b: 0.0722 },
  minArea: 1,
  maxEndpoints: 4,
};

function createTestFrame(width: number, height: number, brightSpots: { x: number; y: number; brightness: number }[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill with black
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
  }
  // Place bright spots
  for (const spot of brightSpots) {
    const idx = (spot.y * width + spot.x) * 4;
    const val = Math.round(spot.brightness * 255);
    data[idx] = val; data[idx + 1] = val; data[idx + 2] = val;
  }
  return new ImageData(data, width, height);
}

describe("LedThresholdDetector", () => {
  it("detects bright pixels above threshold", () => {
    const detector = new LedThresholdDetector();
    const frame = createTestFrame(10, 10, [{ x: 5, y: 5, brightness: 1.0 }]);
    const endpoints = detector.detect(frame, DEFAULT_CONFIG);
    expect(endpoints.length).toBeGreaterThan(0);
    expect(endpoints[0].x).toBe(5);
    expect(endpoints[0].y).toBe(5);
    expect(endpoints[0].brightness).toBeGreaterThan(0.5);
  });

  it("ignores pixels below threshold", () => {
    const detector = new LedThresholdDetector();
    const frame = createTestFrame(10, 10, [{ x: 5, y: 5, brightness: 0.2 }]);
    const endpoints = detector.detect(frame, { ...DEFAULT_CONFIG, threshold: 0.5 });
    expect(endpoints.length).toBe(0);
  });

  it("respects maxEndpoints limit", () => {
    const detector = new LedThresholdDetector();
    const frame = createTestFrame(20, 20, [
      { x: 2, y: 2, brightness: 1.0 },
      { x: 8, y: 8, brightness: 0.9 },
      { x: 14, y: 14, brightness: 0.8 },
      { x: 18, y: 18, brightness: 0.7 },
      { x: 4, y: 16, brightness: 0.6 },
    ]);
    const endpoints = detector.detect(frame, { ...DEFAULT_CONFIG, maxEndpoints: 2 });
    expect(endpoints.length).toBeLessThanOrEqual(2);
    // Should keep the brightest
    expect(endpoints[0].brightness).toBeGreaterThanOrEqual(endpoints[1]?.brightness ?? 0);
  });

  it("assigns propIndex via k-means clustering when 2+ endpoints", () => {
    const detector = new LedThresholdDetector();
    // Two bright spots far apart — should be assigned to different props
    const frame = createTestFrame(100, 10, [
      { x: 10, y: 5, brightness: 1.0 },
      { x: 90, y: 5, brightness: 1.0 },
    ]);
    const endpoints = detector.detect(frame, { ...DEFAULT_CONFIG, maxEndpoints: 4 });
    if (endpoints.length >= 2) {
      expect(endpoints[0].propIndex).not.toBe(endpoints[1].propIndex);
    }
  });

  it("has correct name and capabilities", () => {
    const detector = new LedThresholdDetector();
    expect(detector.name).toBe("LED Threshold");
    expect(detector.capabilities.supportsLive).toBe(true);
    expect(detector.capabilities.requiresGPU).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/video-trails/led-threshold-detector.test.ts 2>&1 | tail -20`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement LedThresholdDetector**

```typescript
// src/lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector.ts

import type { IEndpointDetector } from "../contracts/IEndpointDetector";
import type { DetectedEndpoint, DetectionConfig, DetectorCapabilities } from "../../domain/types";

interface BrightPixel {
  x: number;
  y: number;
  luminance: number;
}

interface Cluster {
  x: number;
  y: number;
  brightness: number;
  pixelCount: number;
}

export class LedThresholdDetector implements IEndpointDetector {
  readonly name = "LED Threshold";
  readonly capabilities: DetectorCapabilities = {
    supportsLive: true,
    supportsOcclusion: false,
    requiresGPU: false,
  };

  detect(frame: ImageData, config: DetectionConfig): DetectedEndpoint[] {
    const brightPixels = this.findBrightPixels(frame, config);
    if (brightPixels.length === 0) return [];

    const clusters = this.clusterPixels(brightPixels, config.minArea);
    if (clusters.length === 0) return [];

    // Sort by brightness descending, limit to maxEndpoints
    clusters.sort((a, b) => b.brightness - a.brightness);
    const topClusters = clusters.slice(0, config.maxEndpoints);

    // Assign prop indices via simple spatial clustering (k=2 if 2+ clusters)
    const withPropIndex = this.assignPropIndices(topClusters);

    return withPropIndex.map((cluster, i) => ({
      x: Math.round(cluster.x),
      y: Math.round(cluster.y),
      brightness: cluster.brightness,
      confidence: Math.min(1, cluster.brightness * cluster.pixelCount / config.minArea),
      propIndex: cluster.propIndex,
      tipIndex: cluster.tipIndex,
      frameIndex: 0,
    }));
  }

  private findBrightPixels(frame: ImageData, config: DetectionConfig): BrightPixel[] {
    const { data, width, height } = frame;
    const { threshold, sensitivity, colorWeights } = config;
    const pixels: BrightPixel[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx] / 255;
        const g = data[idx + 1] / 255;
        const b = data[idx + 2] / 255;

        const luminance = (colorWeights.r * r + colorWeights.g * g + colorWeights.b * b) * sensitivity;

        if (luminance >= threshold) {
          pixels.push({ x, y, luminance: Math.min(1, luminance) });
        }
      }
    }

    return pixels;
  }

  private clusterPixels(pixels: BrightPixel[], minArea: number): Cluster[] {
    // Simple connected-component clustering via flood fill on a grid
    if (pixels.length === 0) return [];

    // Build lookup set for fast neighbor checking
    const pixelMap = new Map<string, BrightPixel>();
    for (const p of pixels) {
      pixelMap.set(`${p.x},${p.y}`, p);
    }

    const visited = new Set<string>();
    const clusters: Cluster[] = [];

    for (const pixel of pixels) {
      const key = `${pixel.x},${pixel.y}`;
      if (visited.has(key)) continue;

      // BFS flood fill
      const queue: BrightPixel[] = [pixel];
      const component: BrightPixel[] = [];
      visited.add(key);

      while (queue.length > 0) {
        const current = queue.pop()!;
        component.push(current);

        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nk = `${current.x + dx},${current.y + dy}`;
            if (!visited.has(nk) && pixelMap.has(nk)) {
              visited.add(nk);
              queue.push(pixelMap.get(nk)!);
            }
          }
        }
      }

      if (component.length >= minArea) {
        // Centroid
        let sumX = 0, sumY = 0, sumL = 0;
        for (const p of component) {
          sumX += p.x * p.luminance;
          sumY += p.y * p.luminance;
          sumL += p.luminance;
        }
        clusters.push({
          x: sumX / sumL,
          y: sumY / sumL,
          brightness: sumL / component.length,
          pixelCount: component.length,
        });
      }
    }

    return clusters;
  }

  private assignPropIndices(clusters: Cluster[]): (Cluster & { propIndex: 0 | 1; tipIndex: number })[] {
    if (clusters.length <= 1) {
      return clusters.map((c, i) => ({ ...c, propIndex: 0 as const, tipIndex: i }));
    }

    // Simple k-means with k=2 for prop assignment
    // Initialize centroids as the two most distant clusters
    let maxDist = 0;
    let c1Idx = 0, c2Idx = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = Math.hypot(clusters[i].x - clusters[j].x, clusters[i].y - clusters[j].y);
        if (dist > maxDist) {
          maxDist = dist;
          c1Idx = i;
          c2Idx = j;
        }
      }
    }

    let centroid0 = { x: clusters[c1Idx].x, y: clusters[c1Idx].y };
    let centroid1 = { x: clusters[c2Idx].x, y: clusters[c2Idx].y };

    // Run 5 iterations of k-means
    let assignments: number[] = new Array(clusters.length).fill(0);
    for (let iter = 0; iter < 5; iter++) {
      // Assign
      for (let i = 0; i < clusters.length; i++) {
        const d0 = Math.hypot(clusters[i].x - centroid0.x, clusters[i].y - centroid0.y);
        const d1 = Math.hypot(clusters[i].x - centroid1.x, clusters[i].y - centroid1.y);
        assignments[i] = d0 <= d1 ? 0 : 1;
      }
      // Update centroids
      let sx0 = 0, sy0 = 0, n0 = 0, sx1 = 0, sy1 = 0, n1 = 0;
      for (let i = 0; i < clusters.length; i++) {
        if (assignments[i] === 0) { sx0 += clusters[i].x; sy0 += clusters[i].y; n0++; }
        else { sx1 += clusters[i].x; sy1 += clusters[i].y; n1++; }
      }
      if (n0 > 0) centroid0 = { x: sx0 / n0, y: sy0 / n0 };
      if (n1 > 0) centroid1 = { x: sx1 / n1, y: sy1 / n1 };
    }

    // Assign tipIndex within each prop group
    const tipCounters = [0, 0];
    return clusters.map((c, i) => {
      const propIndex = assignments[i] as 0 | 1;
      const tipIndex = tipCounters[propIndex]++;
      return { ...c, propIndex, tipIndex };
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/video-trails/led-threshold-detector.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector.ts tests/unit/video-trails/led-threshold-detector.test.ts
git commit -m "feat(video-trails): implement LedThresholdDetector with luminance thresholding and k-means prop assignment"
```

---

### Task 4: VideoTipAdapter Implementation

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter.ts`
- Create: `tests/unit/video-trails/video-tip-adapter.test.ts`

- [ ] **Step 1: Write tests for velocity calculation**

```typescript
// tests/unit/video-trails/video-tip-adapter.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { VideoTipAdapter } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter";
import type { DetectedEndpoint } from "$lib/features/lab/tabs/video-trails/domain/types";

function makeEndpoint(overrides: Partial<DetectedEndpoint> = {}): DetectedEndpoint {
  return {
    x: 100, y: 100, brightness: 1.0, confidence: 1.0,
    propIndex: 0, tipIndex: 0, frameIndex: 0,
    ...overrides,
  };
}

describe("VideoTipAdapter", () => {
  let adapter: VideoTipAdapter;

  beforeEach(() => {
    adapter = new VideoTipAdapter();
  });

  describe("mapToFireTips", () => {
    it("returns zero velocity on first frame", () => {
      const tips = adapter.mapToFireTips([makeEndpoint()], 500, 0);
      expect(tips.length).toBe(1);
      expect(tips[0].velocityX).toBe(0);
      expect(tips[0].velocityY).toBe(0);
    });

    it("calculates velocity from position delta", () => {
      adapter.mapToFireTips([makeEndpoint({ x: 100, y: 100 })], 500, 0);
      const tips = adapter.mapToFireTips([makeEndpoint({ x: 200, y: 100 })], 500, 1000);
      // Moved 100px in 1 second
      expect(tips[0].velocityX).toBeCloseTo(100, 0);
      expect(tips[0].velocityY).toBeCloseTo(0, 0);
    });

    it("clamps dt to prevent division by zero", () => {
      adapter.mapToFireTips([makeEndpoint({ x: 100 })], 500, 1000);
      // Same timestamp — dt should be clamped to 0.001
      const tips = adapter.mapToFireTips([makeEndpoint({ x: 200 })], 500, 1000);
      expect(Number.isFinite(tips[0].velocityX)).toBe(true);
    });

    it("maps brightness to flameScale", () => {
      const tips = adapter.mapToFireTips([makeEndpoint({ brightness: 0.7 })], 500, 0);
      expect(tips[0].flameScale).toBe(0.7);
    });
  });

  describe("mapToTrailPoints", () => {
    it("converts endpoints to TrailPoint format", () => {
      const points = adapter.mapToTrailPoints([makeEndpoint({ x: 50, y: 75, propIndex: 1 })], 1234);
      expect(points.length).toBe(1);
      expect(points[0]).toEqual({ x: 50, y: 75, timestamp: 1234, propIndex: 1, endType: 0 });
    });
  });

  describe("reset", () => {
    it("clears velocity tracking state", () => {
      adapter.mapToFireTips([makeEndpoint({ x: 100 })], 500, 0);
      adapter.reset();
      // After reset, should behave like first frame again
      const tips = adapter.mapToFireTips([makeEndpoint({ x: 200 })], 500, 1000);
      expect(tips[0].velocityX).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/video-trails/video-tip-adapter.test.ts 2>&1 | tail -20`
Expected: FAIL

- [ ] **Step 3: Implement VideoTipAdapter**

```typescript
// src/lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter.ts

import type { IVideoTipAdapter } from "../contracts/IVideoTipAdapter";
import type { DetectedEndpoint } from "../../domain/types";
import type { PropTipData } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedTipData, LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { TrailPoint } from "$lib/shared/animation-engine/domain/types/TrailTypes";

interface PreviousPosition {
  x: number;
  y: number;
  time: number;
}

export class VideoTipAdapter implements IVideoTipAdapter {
  private previousPositions = new Map<string, PreviousPosition>();

  mapToFireTips(endpoints: DetectedEndpoint[], canvasSize: number, currentTime: number): PropTipData[] {
    return endpoints.map((ep) => {
      const key = `${ep.propIndex}-${ep.tipIndex}`;
      const prev = this.previousPositions.get(key);
      const dt = Math.max(prev ? (currentTime - prev.time) / 1000 : 0, 0.001);
      const vx = prev ? (ep.x - prev.x) / dt : 0;
      const vy = prev ? (ep.y - prev.y) / dt : 0;

      this.previousPositions.set(key, { x: ep.x, y: ep.y, time: currentTime });

      return {
        x: ep.x,
        y: ep.y,
        velocityX: vx,
        velocityY: vy,
        speed: Math.sqrt(vx * vx + vy * vy),
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        flameScale: ep.brightness,
        jerk: 0,
      };
    });
  }

  mapToLedTips(endpoints: DetectedEndpoint[], currentTime: number, ledConfig: LedOverlayConfig): LedTipData[] {
    return endpoints.map((ep) => ({
      x: ep.x,
      y: ep.y,
      velocityX: 0,
      velocityY: 0,
      speed: 0,
      propIndex: ep.propIndex,
      tipIndex: ep.tipIndex,
      brightness: ep.brightness,
      r: 1,
      g: 1,
      b: 1,
    }));
  }

  mapToTrailPoints(endpoints: DetectedEndpoint[], currentTime: number): TrailPoint[] {
    return endpoints.map((ep) => ({
      x: ep.x,
      y: ep.y,
      timestamp: currentTime,
      propIndex: ep.propIndex as 0 | 1,
      endType: ep.tipIndex as 0 | 1,
    }));
  }

  reset(): void {
    this.previousPositions.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/video-trails/video-tip-adapter.test.ts 2>&1 | tail -20`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter.ts tests/unit/video-trails/video-tip-adapter.test.ts
git commit -m "feat(video-trails): implement VideoTipAdapter with finite-difference velocity tracking"
```

---

### Task 5: DetectionCorrector Implementation

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector.ts`
- Create: `tests/unit/video-trails/detection-corrector.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// tests/unit/video-trails/detection-corrector.test.ts

import { describe, it, expect } from "vitest";
import { DetectionCorrector } from "$lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector";
import type { DetectedEndpoint, EndpointCorrection } from "$lib/features/lab/tabs/video-trails/domain/types";

function makeEndpoint(overrides: Partial<DetectedEndpoint> = {}): DetectedEndpoint {
  return { x: 100, y: 100, brightness: 1, confidence: 0.9, propIndex: 0, tipIndex: 0, frameIndex: 5, ...overrides };
}

describe("DetectionCorrector", () => {
  it("returns original endpoints when no corrections exist", () => {
    const corrector = new DetectionCorrector();
    const detected = [makeEndpoint()];
    const result = corrector.applyCorrections(5, detected, {});
    expect(result).toEqual(detected);
  });

  it("overrides position with corrected values", () => {
    const corrector = new DetectionCorrector();
    const detected = [makeEndpoint({ x: 100, y: 100, propIndex: 0, tipIndex: 0 })];
    const corrections: Record<number, EndpointCorrection[]> = {
      5: [{ propIndex: 0, tipIndex: 0, detected: { x: 100, y: 100, confidence: 0.9 }, corrected: { x: 150, y: 160 }, status: "corrected" }],
    };
    const result = corrector.applyCorrections(5, detected, corrections);
    expect(result[0].x).toBe(150);
    expect(result[0].y).toBe(160);
    expect(result[0].confidence).toBe(1);
  });

  it("removes occluded endpoints", () => {
    const corrector = new DetectionCorrector();
    const detected = [makeEndpoint({ propIndex: 0, tipIndex: 0 }), makeEndpoint({ propIndex: 1, tipIndex: 0, x: 200 })];
    const corrections: Record<number, EndpointCorrection[]> = {
      5: [{ propIndex: 0, tipIndex: 0, detected: null, corrected: null, status: "occluded" }],
    };
    const result = corrector.applyCorrections(5, detected, corrections);
    // Occluded endpoint removed, other endpoint remains
    expect(result.length).toBe(1);
    expect(result[0].propIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/video-trails/detection-corrector.test.ts 2>&1 | tail -20`

- [ ] **Step 3: Implement DetectionCorrector**

```typescript
// src/lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector.ts

import type { IDetectionCorrector } from "../contracts/IDetectionCorrector";
import type { DetectedEndpoint, EndpointCorrection, TrainingPair } from "../../domain/types";

export class DetectionCorrector implements IDetectionCorrector {
  applyCorrections(
    frameIndex: number,
    detected: DetectedEndpoint[],
    corrections: Record<number, EndpointCorrection[]>,
  ): DetectedEndpoint[] {
    const frameCorrections = corrections[frameIndex];
    if (!frameCorrections || frameCorrections.length === 0) return detected;

    const result: DetectedEndpoint[] = [];

    for (const endpoint of detected) {
      const correction = frameCorrections.find(
        (c) => c.propIndex === endpoint.propIndex && c.tipIndex === endpoint.tipIndex,
      );

      if (!correction) {
        result.push(endpoint);
        continue;
      }

      if (correction.status === "occluded") {
        // Skip occluded endpoints
        continue;
      }

      if (correction.status === "corrected" || correction.status === "interpolated") {
        if (correction.corrected) {
          result.push({
            ...endpoint,
            x: correction.corrected.x,
            y: correction.corrected.y,
            confidence: 1,
          });
        }
        continue;
      }

      // "accepted" — keep as-is
      result.push(endpoint);
    }

    return result;
  }

  generateTrainingPairs(
    frameDetections: Record<number, DetectedEndpoint[]>,
    corrections: Record<number, EndpointCorrection[]>,
    getFrameImage: (frameIndex: number) => { width: number; height: number; dataUrl: string },
  ): TrainingPair[] {
    const pairs: TrainingPair[] = [];

    for (const frameStr of Object.keys(corrections)) {
      const frameIndex = Number(frameStr);
      const detected = frameDetections[frameIndex] ?? [];
      const corrected = corrections[frameIndex];
      if (!corrected || corrected.length === 0) continue;

      pairs.push({
        frame: getFrameImage(frameIndex),
        detected,
        corrected,
        metadata: {
          correctedBy: "user",
          correctedAt: new Date().toISOString(),
          sourceDetector: "led-threshold-v1",
        },
      });
    }

    return pairs;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/video-trails/detection-corrector.test.ts 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector.ts tests/unit/video-trails/detection-corrector.test.ts
git commit -m "feat(video-trails): implement DetectionCorrector with correction application and training pair generation"
```

---

### Task 6: VideoTrailsRepository Implementation

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository.ts`

- [ ] **Step 1: Implement IndexedDB + localStorage persistence**

```typescript
// src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository.ts

import type { IVideoTrailsRepository } from "../contracts/IVideoTrailsRepository";
import type { VideoTrailsProject } from "../../domain/types";

const DB_NAME = "tka-video-trails";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const INDEX_KEY = "video-trails-project-index";

export class VideoTrailsRepository implements IVideoTrailsRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async save(project: VideoTrailsProject): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(project);
      tx.oncomplete = () => {
        this.updateIndex(project);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(id: string): Promise<VideoTrailsProject | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<VideoTrailsProject[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        this.removeFromIndex(id);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  private updateIndex(project: VideoTrailsProject): void {
    const index = this.getIndex();
    const existing = index.findIndex((e) => e.id === project.id);
    const entry = { id: project.id, title: project.title, updatedAt: project.updatedAt };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  private removeFromIndex(id: string): void {
    const index = this.getIndex().filter((e) => e.id !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  private getIndex(): { id: string; title: string; updatedAt: string }[] {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository.ts
git commit -m "feat(video-trails): implement VideoTrailsRepository with IndexedDB persistence"
```

---

### Task 7: VideoTrailsExporter Implementation

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter.ts`

- [ ] **Step 1: Implement the exporter**

```typescript
// src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter.ts

import type { IVideoTrailsExporter } from "../contracts/IVideoTrailsExporter";
import type { ExportConfig, ExportState } from "../../domain/types";

export class VideoTrailsExporter implements IVideoTrailsExporter {
  private cancelled = false;

  async export(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob> {
    this.cancelled = false;
    onProgress({ phase: "preparing" });

    const { width, height } = config.resolution;
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const compositeCtx = compositeCanvas.getContext("2d")!;

    // Try WebCodecs first, fall back to MediaRecorder
    if (typeof VideoEncoder !== "undefined" && config.format === "mp4") {
      return this.exportWithWebCodecs(videoElement, canvases, compositeCanvas, compositeCtx, config, onProgress);
    }

    return this.exportWithMediaRecorder(videoElement, canvases, compositeCanvas, compositeCtx, config, onProgress);
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async exportWithMediaRecorder(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    compositeCanvas: HTMLCanvasElement,
    compositeCtx: CanvasRenderingContext2D,
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob> {
    onProgress({ phase: "recording", progress: 0 });

    const stream = compositeCanvas.captureStream(config.fps);
    const mimeType = config.format === "webm" ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: config.bitrate });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = (e) => reject(e);
    });

    recorder.start();

    const duration = videoElement.duration;
    const totalFrames = Math.ceil(duration * config.fps);
    const frameDuration = 1 / config.fps;

    for (let frame = 0; frame < totalFrames; frame++) {
      if (this.cancelled) { recorder.stop(); throw new Error("Export cancelled"); }

      videoElement.currentTime = frame * frameDuration;
      await new Promise((r) => { videoElement.onseeked = r; });

      // Composite: video first, then each effect canvas in order
      compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
      compositeCtx.drawImage(videoElement, 0, 0, compositeCanvas.width, compositeCanvas.height);
      for (const canvas of canvases) {
        compositeCtx.drawImage(canvas, 0, 0, compositeCanvas.width, compositeCanvas.height);
      }

      onProgress({ phase: "recording", progress: frame / totalFrames });

      // Small delay to let the MediaRecorder capture the frame
      await new Promise((r) => setTimeout(r, 1000 / config.fps));
    }

    recorder.stop();
    const blob = await done;
    onProgress({ phase: "complete", blob });
    return blob;
  }

  private async exportWithWebCodecs(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    compositeCanvas: HTMLCanvasElement,
    compositeCtx: CanvasRenderingContext2D,
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob> {
    // WebCodecs MP4 export — simplified version
    // Full implementation would use mp4-muxer or similar library
    // For now, fall back to MediaRecorder
    return this.exportWithMediaRecorder(videoElement, canvases, compositeCanvas, compositeCtx, config, onProgress);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter.ts
git commit -m "feat(video-trails): implement VideoTrailsExporter with MediaRecorder encoding"
```

---

### Task 8: DI Container + Wiring

**Files:**
- Create: `src/lib/shared/di/containers/video-trails-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create the container**

```typescript
// src/lib/shared/di/containers/video-trails-container.ts

import { createContainer } from "iti";
import { LedThresholdDetector } from "$lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector";
import { VideoTipAdapter } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter";
import { DetectionCorrector } from "$lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector";
import { VideoTrailsRepository } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository";
import { VideoTrailsExporter } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter";

export const videoTrailsContainer = createContainer()
  .add({
    ledThresholdDetector: () => new LedThresholdDetector(),
    videoTipAdapter: () => new VideoTipAdapter(),
    detectionCorrector: () => new DetectionCorrector(),
    videoTrailsRepository: () => new VideoTrailsRepository(),
    videoTrailsExporter: () => new VideoTrailsExporter(),
  });

export type VideoTrailsContainer = typeof videoTrailsContainer;
```

- [ ] **Step 2: Add VideoTrailsItems to container-types.ts**

In `src/lib/shared/di/container-types.ts`:
- Add import: `import type { VideoTrailsContainer } from "./containers/video-trails-container";`
- Add type extraction: `type VideoTrailsItems = ItemsOf<VideoTrailsContainer>;`
- Add to `IAppContainerItems` intersection before `StandaloneItems`: `VideoTrailsItems &`

- [ ] **Step 3: Wire into index.ts**

In `src/lib/shared/di/index.ts`:
- Add import: `import { videoTrailsContainer } from "./containers/video-trails-container";`
- Add in `buildAppContainer()` before the standalone services section:
  ```typescript
  // Video Trails services (endpoint detection, tip adaptation, export)
  c = c.add(videoTrailsContainer.items);
  ```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/video-trails-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(video-trails): add DI container and wire into app container"
```

---

### Task 9: State Factory + Context

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/state/video-trails-state.svelte.ts`
- Create: `src/lib/features/lab/tabs/video-trails/context/video-trails-context.ts`

- [ ] **Step 1: Create the context**

```typescript
// src/lib/features/lab/tabs/video-trails/context/video-trails-context.ts

import { getContext, setContext } from "svelte";
import type { VideoTrailsState } from "../state/video-trails-state.svelte";

const VIDEO_TRAILS_CTX_KEY = Symbol("video-trails");

export interface VideoTrailsContext {
  state: VideoTrailsState;
}

export function setVideoTrailsContext(ctx: VideoTrailsContext): void {
  setContext(VIDEO_TRAILS_CTX_KEY, ctx);
}

export function getVideoTrailsContext(): VideoTrailsContext {
  return getContext<VideoTrailsContext>(VIDEO_TRAILS_CTX_KEY);
}
```

- [ ] **Step 2: Create the state factory**

```typescript
// src/lib/features/lab/tabs/video-trails/state/video-trails-state.svelte.ts

import type { IVideoTrailsRepository } from "../services/contracts/IVideoTrailsRepository";
import type { IDetectionCorrector } from "../services/contracts/IDetectionCorrector";
import type { IVideoTipAdapter } from "../services/contracts/IVideoTipAdapter";
import type {
  VideoTrailsView,
  VideoSource,
  DetectedEndpoint,
  DetectionConfig,
  EndpointCorrection,
  EffectConfig,
  ExportState,
  ExportConfig,
  VideoTrailsProject,
} from "../domain/types";
import { DEFAULT_DETECTION_CONFIG, DEFAULT_EFFECT_CONFIG } from "../domain/types";

export function createVideoTrailsState(
  repository: IVideoTrailsRepository,
  corrector: IDetectionCorrector,
  tipAdapter: IVideoTipAdapter,
) {
  // Sub-navigation
  let activeView = $state<VideoTrailsView>("workspace");

  // Source
  let source = $state<VideoSource | null>(null);
  let sourceMode = $state<"file" | "camera" | "sequence">("file");

  // Playback
  let isPlaying = $state(false);
  let currentFrame = $state(0);
  let playbackSpeed = $state(1);
  let totalFrames = $state(0);

  // Detection
  let activeDetectorId = $state("led-threshold-v1");
  let detectionConfig = $state<DetectionConfig>({ ...DEFAULT_DETECTION_CONFIG });
  let frameDetections = $state<Record<number, DetectedEndpoint[]>>({});
  let isDetecting = $state(false);

  // Corrections
  let corrections = $state<Record<number, EndpointCorrection[]>>({});
  let correctionCount = $derived(Object.keys(corrections).length);

  // Effects
  let effectConfig = $state<EffectConfig>({ ...DEFAULT_EFFECT_CONFIG });

  // Project
  let currentProject = $state<VideoTrailsProject | null>(null);
  let projects = $state<VideoTrailsProject[]>([]);
  let isDirty = $state(false);

  // Export
  let exportState = $state<ExportState>({ phase: "idle" });

  // Derived: current frame's corrected endpoints
  let currentEndpoints = $derived.by(() => {
    const detected = frameDetections[currentFrame] ?? [];
    return corrector.applyCorrections(currentFrame, detected, corrections);
  });

  // Derived: frames with low-confidence detections
  let lowConfidenceFrames = $derived.by(() => {
    const frames: number[] = [];
    for (const [frame, endpoints] of Object.entries(frameDetections)) {
      if (endpoints.some((ep) => ep.confidence < 0.6)) frames.push(Number(frame));
    }
    return frames;
  });

  // Actions
  function loadVideo(file: File): void {
    const url = URL.createObjectURL(file);
    // Video metadata extraction happens in the component via HTMLVideoElement events
    source = {
      type: "file",
      url,
      originalFileName: file.name,
      duration: 0,
      resolution: { width: 0, height: 0 },
      frameCount: 0,
      fps: 30,
    };
    sourceMode = "file";
    frameDetections = {};
    corrections = {};
    tipAdapter.reset();
    isDirty = true;
  }

  function updateSourceMetadata(metadata: { duration: number; width: number; height: number; fps?: number }): void {
    if (!source) return;
    source = {
      ...source,
      duration: metadata.duration,
      resolution: { width: metadata.width, height: metadata.height },
      fps: metadata.fps ?? 30,
      frameCount: Math.ceil(metadata.duration * (metadata.fps ?? 30)),
    };
    totalFrames = source.frameCount;
  }

  function storeFrameDetection(frame: number, endpoints: DetectedEndpoint[]): void {
    frameDetections = { ...frameDetections, [frame]: endpoints };
    isDirty = true;
  }

  function correctEndpoint(frame: number, correction: EndpointCorrection): void {
    const existing = corrections[frame] ?? [];
    const idx = existing.findIndex(
      (c) => c.propIndex === correction.propIndex && c.tipIndex === correction.tipIndex,
    );
    const updated = [...existing];
    if (idx >= 0) updated[idx] = correction;
    else updated.push(correction);
    corrections = { ...corrections, [frame]: updated };
    isDirty = true;
  }

  function markOccluded(frame: number, propIndex: 0 | 1, tipIndex: number): void {
    correctEndpoint(frame, {
      propIndex,
      tipIndex,
      detected: null,
      corrected: null,
      status: "occluded",
    });
  }

  function interpolateGap(startFrame: number, endFrame: number, propIndex: 0 | 1, tipIndex: number): void {
    const startEndpoints = frameDetections[startFrame - 1];
    const endEndpoints = frameDetections[endFrame + 1];
    const startEp = startEndpoints?.find((e) => e.propIndex === propIndex && e.tipIndex === tipIndex);
    const endEp = endEndpoints?.find((e) => e.propIndex === propIndex && e.tipIndex === tipIndex);
    if (!startEp || !endEp) return;

    const span = endFrame - startFrame + 1;
    for (let f = startFrame; f <= endFrame; f++) {
      const t = span === 1 ? 0.5 : (f - startFrame) / (span - 1);
      correctEndpoint(f, {
        propIndex,
        tipIndex,
        detected: null,
        corrected: {
          x: startEp.x + (endEp.x - startEp.x) * t,
          y: startEp.y + (endEp.y - startEp.y) * t,
        },
        status: "interpolated",
      });
    }
  }

  async function saveProject(): Promise<void> {
    if (!currentProject) return;
    currentProject = {
      ...currentProject,
      updatedAt: new Date().toISOString(),
      detection: {
        ...currentProject.detection,
        results: frameDetections,
        corrections,
      },
      effects: effectConfig,
    };
    await repository.save(currentProject);
    isDirty = false;
  }

  async function loadProject(id: string): Promise<void> {
    const project = await repository.load(id);
    if (!project) return;
    currentProject = project;
    frameDetections = project.detection.results;
    corrections = project.detection.corrections;
    effectConfig = project.effects;
    activeDetectorId = project.detection.detectorId;
    detectionConfig = project.detection.config;
    isDirty = false;
  }

  async function loadProjectList(): Promise<void> {
    projects = await repository.list();
  }

  async function deleteProject(id: string): Promise<void> {
    await repository.delete(id);
    if (currentProject?.id === id) currentProject = null;
    await loadProjectList();
  }

  function destroy(): void {
    if (source?.url) URL.revokeObjectURL(source.url);
    tipAdapter.reset();
  }

  return {
    // View
    get activeView() { return activeView; },
    set activeView(v: VideoTrailsView) { activeView = v; },

    // Source
    get source() { return source; },
    get sourceMode() { return sourceMode; },

    // Playback
    get isPlaying() { return isPlaying; },
    get currentFrame() { return currentFrame; },
    get totalFrames() { return totalFrames; },
    get playbackSpeed() { return playbackSpeed; },

    // Detection
    get activeDetectorId() { return activeDetectorId; },
    get detectionConfig() { return detectionConfig; },
    get frameDetections() { return frameDetections; },
    get isDetecting() { return isDetecting; },
    get currentEndpoints() { return currentEndpoints; },

    // Corrections
    get corrections() { return corrections; },
    get correctionCount() { return correctionCount; },
    get lowConfidenceFrames() { return lowConfidenceFrames; },

    // Effects
    get effectConfig() { return effectConfig; },

    // Project
    get currentProject() { return currentProject; },
    get projects() { return projects; },
    get isDirty() { return isDirty; },

    // Export
    get exportState() { return exportState; },

    // Actions
    loadVideo,
    updateSourceMetadata,
    storeFrameDetection,
    correctEndpoint,
    markOccluded,
    interpolateGap,
    saveProject,
    loadProject,
    loadProjectList,
    deleteProject,
    destroy,

    // Setters
    setDetectionConfig: (config: Partial<DetectionConfig>) => {
      detectionConfig = { ...detectionConfig, ...config };
      isDirty = true;
    },
    setEffectConfig: (config: Partial<EffectConfig>) => {
      effectConfig = { ...effectConfig, ...config };
      isDirty = true;
    },
    setActiveDetector: (id: string) => { activeDetectorId = id; },
    setCurrentFrame: (frame: number) => { currentFrame = frame; },
    setPlaybackSpeed: (speed: number) => { playbackSpeed = speed; },
    togglePlayback: () => { isPlaying = !isPlaying; },
    setIsDetecting: (v: boolean) => { isDetecting = v; },
    setExportState: (state: ExportState) => { exportState = state; },
  };
}

export type VideoTrailsState = ReturnType<typeof createVideoTrailsState>;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/state/video-trails-state.svelte.ts src/lib/features/lab/tabs/video-trails/context/video-trails-context.ts
git commit -m "feat(video-trails): add state factory and context provider"
```

---

### Task 10: Tab Registration

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

- [ ] **Step 1: Add to LAB_TABS in tab-definitions.ts**

Add before the closing `];` of the LAB_TABS array (after hand-path-builder entry):

```typescript
  {
    id: "video-trails",
    label: "Video Trails",
    icon: '<i class="fas fa-magic-wand-sparkles" aria-hidden="true"></i>',
    description: "Detect prop endpoints in video, apply fire/LED/trail effects, build training data",
    color: "#f43f5e",
    gradient: "linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)",
  },
```

- [ ] **Step 2: Add to tabComponents in LabModule.svelte**

Add after the hand-path-builder entry:

```typescript
    "video-trails": () => import("./tabs/video-trails/VideoTrailsLab.svelte"),
```

- [ ] **Step 3: Commit (without VideoTrailsLab.svelte yet — it won't load until we create it in Chunk 2)**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts src/lib/features/lab/LabModule.svelte
git commit -m "feat(video-trails): register tab in navigation and lab module"
```

---

## Chunk 2: UI Components (Workspace View MVP)

### File Structure (Chunk 2)

| File | Responsibility |
|------|---------------|
| `src/lib/features/lab/tabs/video-trails/VideoTrailsLab.svelte` | Root component: sub-nav, context provider, view switching |
| `src/lib/features/lab/tabs/video-trails/views/WorkspaceView.svelte` | Main workspace: video + detection + effects |
| `src/lib/features/lab/tabs/video-trails/components/VideoSourcePanel.svelte` | File upload drag-drop |
| `src/lib/features/lab/tabs/video-trails/components/DetectionPreview.svelte` | Canvas with detected endpoint markers |
| `src/lib/features/lab/tabs/video-trails/components/PlaybackControls.svelte` | Play/pause, seek, speed |
| `src/lib/features/lab/tabs/video-trails/components/EffectsControlPanel.svelte` | Effect toggles + sliders |
| `src/lib/features/lab/tabs/video-trails/components/ExportPanel.svelte` | Export controls + progress |

---

### Task 11: VideoTrailsLab Root Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/VideoTrailsLab.svelte`

- [ ] **Step 1: Create the root component**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/VideoTrailsLab.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { createVideoTrailsState } from "./state/video-trails-state.svelte";
  import { setVideoTrailsContext } from "./context/video-trails-context";
  import type { VideoTrailsView } from "./domain/types";

  const state = createVideoTrailsState(
    container.items.videoTrailsRepository,
    container.items.detectionCorrector,
    container.items.videoTipAdapter,
  );
  setVideoTrailsContext({ state });

  const views: { id: VideoTrailsView; label: string; icon: string }[] = [
    { id: "workspace", label: "Workspace", icon: "fa-video" },
    { id: "detection-studio", label: "Detection Studio", icon: "fa-crosshairs" },
    { id: "library", label: "Library", icon: "fa-folder-open" },
  ];

  // Lazy-load views
  let WorkspaceView: any = $state(null);
  let DetectionStudioView: any = $state(null);
  let LibraryView: any = $state(null);

  $effect(() => {
    switch (state.activeView) {
      case "workspace":
        if (!WorkspaceView) {
          import("./views/WorkspaceView.svelte").then((m) => { WorkspaceView = m.default; });
        }
        break;
      case "detection-studio":
        if (!DetectionStudioView) {
          import("./views/DetectionStudioView.svelte").then((m) => { DetectionStudioView = m.default; });
        }
        break;
      case "library":
        if (!LibraryView) {
          import("./views/LibraryView.svelte").then((m) => { LibraryView = m.default; });
        }
        break;
    }
  });

  onDestroy(() => state.destroy());
</script>

<div class="video-trails-root">
  <nav class="sub-nav" role="tablist">
    {#each views as view}
      <button
        class="sub-nav-tab"
        class:active={state.activeView === view.id}
        role="tab"
        aria-selected={state.activeView === view.id}
        onclick={() => { state.activeView = view.id; }}
      >
        <i class="fas {view.icon}" aria-hidden="true"></i>
        <span>{view.label}</span>
      </button>
    {/each}
  </nav>

  <div class="view-container">
    {#if state.activeView === "workspace" && WorkspaceView}
      <WorkspaceView />
    {:else if state.activeView === "detection-studio" && DetectionStudioView}
      <DetectionStudioView />
    {:else if state.activeView === "library" && LibraryView}
      <LibraryView />
    {:else}
      <div class="loading-view">Loading...</div>
    {/if}
  </div>
</div>

<style>
  .video-trails-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .sub-nav {
    display: flex;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .sub-nav-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .sub-nav-tab:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .sub-nav-tab.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-accent, #f43f5e);
  }

  .view-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .loading-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
</style>
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/VideoTrailsLab.svelte
git commit -m "feat(video-trails): add root component with sub-navigation and lazy view loading"
```

---

### Task 12: VideoSourcePanel Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/components/VideoSourcePanel.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/components/VideoSourcePanel.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state } = getVideoTrailsContext();

  let isDragOver = $state(false);
  let fileInput: HTMLInputElement;

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("video/")) {
      state.loadVideo(file);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) state.loadVideo(file);
  }
</script>

<div
  class="source-panel"
  class:drag-over={isDragOver}
  role="button"
  tabindex="0"
  ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
  ondragleave={() => { isDragOver = false; }}
  ondrop={handleDrop}
  onclick={() => fileInput?.click()}
  onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") fileInput?.click(); }}
>
  {#if state.source}
    <div class="source-info">
      <i class="fas fa-film" aria-hidden="true"></i>
      <span class="file-name">{state.source.originalFileName ?? "Video loaded"}</span>
      {#if state.source.duration > 0}
        <span class="duration">{state.source.duration.toFixed(1)}s</span>
      {/if}
    </div>
  {:else}
    <div class="drop-prompt">
      <i class="fas fa-cloud-arrow-up" aria-hidden="true"></i>
      <span>Drop a video file or click to browse</span>
      <span class="hint">MP4, WebM, MOV</span>
    </div>
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    accept="video/*"
    class="hidden-input"
    onchange={handleFileSelect}
  />
</div>

<style>
  .source-panel {
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .source-panel:hover,
  .source-panel.drag-over {
    border-color: var(--theme-accent, #f43f5e);
    background: rgba(244, 63, 94, 0.05);
  }

  .drop-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .drop-prompt i {
    font-size: 32px;
    color: var(--theme-accent, #f43f5e);
    opacity: 0.6;
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.5;
  }

  .source-info {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    color: var(--theme-text, #ffffff);
  }

  .file-name {
    font-weight: 500;
  }

  .duration {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
  }

  .hidden-input {
    display: none;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/components/VideoSourcePanel.svelte
git commit -m "feat(video-trails): add VideoSourcePanel with drag-drop upload"
```

---

### Task 13: PlaybackControls Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/components/PlaybackControls.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/components/PlaybackControls.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state } = getVideoTrailsContext();

  const speedOptions = [0.25, 0.5, 1, 1.5, 2];

  function handleKeydown(e: KeyboardEvent) {
    if (e.target !== document.body) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        state.togglePlayback();
        break;
      case "ArrowLeft":
        state.setCurrentFrame(Math.max(0, state.currentFrame - (e.shiftKey ? 10 : 1)));
        break;
      case "ArrowRight":
        state.setCurrentFrame(Math.min(state.totalFrames - 1, state.currentFrame + (e.shiftKey ? 10 : 1)));
        break;
    }
  }

  function handleSeek(e: Event) {
    const input = e.target as HTMLInputElement;
    state.setCurrentFrame(Number(input.value));
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="playback-controls">
  <button class="play-btn" onclick={() => state.togglePlayback()} aria-label={state.isPlaying ? "Pause" : "Play"}>
    <i class="fas {state.isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>

  <input
    type="range"
    class="seek-bar"
    min="0"
    max={Math.max(0, state.totalFrames - 1)}
    value={state.currentFrame}
    oninput={handleSeek}
    aria-label="Seek"
  />

  <span class="frame-counter">
    {state.currentFrame} / {state.totalFrames}
  </span>

  <select
    class="speed-select"
    value={state.playbackSpeed}
    onchange={(e) => state.setPlaybackSpeed(Number((e.target as HTMLSelectElement).value))}
    aria-label="Playback speed"
  >
    {#each speedOptions as speed}
      <option value={speed}>{speed}x</option>
    {/each}
  </select>
</div>

<style>
  .playback-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: var(--theme-accent, #f43f5e);
    color: white;
    cursor: pointer;
    font-size: 14px;
    flex-shrink: 0;
  }

  .play-btn:hover {
    filter: brightness(1.1);
  }

  .seek-bar {
    flex: 1;
    height: 4px;
    accent-color: var(--theme-accent, #f43f5e);
  }

  .frame-counter {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    min-width: 80px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .speed-select {
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #ffffff);
    padding: 4px 8px;
    font-size: var(--font-size-compact, 12px);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/components/PlaybackControls.svelte
git commit -m "feat(video-trails): add PlaybackControls with keyboard shortcuts"
```

---

### Task 14: DetectionPreview Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/components/DetectionPreview.svelte`

- [ ] **Step 1: Implement the canvas with endpoint overlay**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/components/DetectionPreview.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  interface Props {
    videoElement: HTMLVideoElement | null;
    width: number;
    height: number;
  }

  let { videoElement, width, height }: Props = $props();

  const { state } = getVideoTrailsContext();

  let canvas: HTMLCanvasElement;

  $effect(() => {
    if (!canvas || !videoElement || width === 0 || height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video frame
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(videoElement, 0, 0, width, height);

    // Draw detected endpoints
    const endpoints = state.currentEndpoints;
    for (const ep of endpoints) {
      const radius = 8;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, radius, 0, Math.PI * 2);

      // Color by prop index
      const color = ep.propIndex === 0 ? "#4a90d9" : "#d94a4a";
      ctx.fillStyle = `${color}${Math.round(ep.confidence * 255).toString(16).padStart(2, "0")}`;
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Confidence label
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(ep.confidence * 100)}%`, ep.x, ep.y - radius - 4);
    }
  });
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  class="detection-canvas"
></canvas>

<style>
  .detection-canvas {
    border-radius: 8px;
    background: var(--theme-panel-bg, #000);
    max-width: 100%;
    height: auto;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/components/DetectionPreview.svelte
git commit -m "feat(video-trails): add DetectionPreview canvas with endpoint marker overlay"
```

---

### Task 15: EffectsControlPanel Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/components/EffectsControlPanel.svelte`

- [ ] **Step 1: Implement the effects panel**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/components/EffectsControlPanel.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";

  const { state } = getVideoTrailsContext();

  interface EffectSection {
    key: "fire" | "led" | "trails" | "charcoal";
    label: string;
    icon: string;
  }

  const sections: EffectSection[] = [
    { key: "trails", label: "Trails", icon: "fa-wave-square" },
    { key: "fire", label: "Fire", icon: "fa-fire" },
    { key: "led", label: "LED Glow", icon: "fa-lightbulb" },
    { key: "charcoal", label: "Charcoal", icon: "fa-meteor" },
  ];

  function toggleEffect(key: EffectSection["key"]) {
    const current = state.effectConfig[key];
    state.setEffectConfig({ [key]: { ...current, enabled: !current.enabled } });
  }
</script>

<div class="effects-panel">
  <h3 class="panel-title">Effects</h3>

  {#each sections as section}
    <div class="effect-section" class:enabled={state.effectConfig[section.key].enabled}>
      <button class="effect-toggle" onclick={() => toggleEffect(section.key)}>
        <i class="fas {section.icon}" aria-hidden="true"></i>
        <span>{section.label}</span>
        <span class="toggle-indicator">{state.effectConfig[section.key].enabled ? "ON" : "OFF"}</span>
      </button>
    </div>
  {/each}

  <div class="detection-section">
    <h3 class="panel-title">Detection</h3>

    <label class="slider-row">
      <span>Threshold</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={state.detectionConfig.threshold}
        oninput={(e) => state.setDetectionConfig({ threshold: Number((e.target as HTMLInputElement).value) })}
      />
      <span class="value">{state.detectionConfig.threshold.toFixed(2)}</span>
    </label>

    <label class="slider-row">
      <span>Sensitivity</span>
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={state.detectionConfig.sensitivity}
        oninput={(e) => state.setDetectionConfig({ sensitivity: Number((e.target as HTMLInputElement).value) })}
      />
      <span class="value">{state.detectionConfig.sensitivity.toFixed(1)}</span>
    </label>

    <label class="select-row">
      <span>Detector</span>
      <select
        value={state.activeDetectorId}
        onchange={(e) => state.setActiveDetector((e.target as HTMLSelectElement).value)}
      >
        {#each DETECTOR_REGISTRY as reg}
          <option value={reg.id}>{reg.name}</option>
        {/each}
      </select>
    </label>
  </div>
</div>

<style>
  .effects-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--theme-text, #ffffff);
  }

  .effect-section {
    border-radius: 6px;
    overflow: hidden;
  }

  .effect-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    text-align: left;
    transition: background 0.15s;
  }

  .effect-toggle:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .enabled .effect-toggle {
    color: var(--theme-text, #ffffff);
  }

  .toggle-indicator {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    opacity: 0.6;
  }

  .enabled .toggle-indicator {
    color: var(--theme-accent, #f43f5e);
    opacity: 1;
  }

  .detection-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .slider-row span:first-child {
    min-width: 70px;
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #f43f5e);
  }

  .value {
    min-width: 35px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .select-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .select-row span {
    min-width: 70px;
  }

  .select-row select {
    flex: 1;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #ffffff);
    padding: 4px 8px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/components/EffectsControlPanel.svelte
git commit -m "feat(video-trails): add EffectsControlPanel with toggles and detection sliders"
```

---

### Task 16: ExportPanel Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/components/ExportPanel.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/components/ExportPanel.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import type { ExportConfig } from "../domain/types";

  const { state } = getVideoTrailsContext();

  let format = $state<"mp4" | "webm">("webm");
  let resolution = $state<"720p" | "1080p" | "original">("1080p");

  const resolutionMap = {
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
    original: state.source?.resolution ?? { width: 1920, height: 1080 },
  };

  interface Props {
    onExport: (config: ExportConfig) => void;
  }

  let { onExport }: Props = $props();

  function handleExport() {
    onExport({
      format,
      resolution: resolutionMap[resolution],
      fps: state.source?.fps ?? 30,
      bitrate: resolution === "1080p" ? 8_000_000 : 4_000_000,
    });
  }

  function handleDownload() {
    if (state.exportState.phase !== "complete" || !state.exportState.blob) return;
    const url = URL.createObjectURL(state.exportState.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-trails-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="export-panel">
  <h3 class="panel-title">Export</h3>

  <div class="export-options">
    <label class="select-row">
      <span>Format</span>
      <select bind:value={format}>
        <option value="webm">WebM</option>
        <option value="mp4">MP4</option>
      </select>
    </label>

    <label class="select-row">
      <span>Resolution</span>
      <select bind:value={resolution}>
        <option value="720p">720p</option>
        <option value="1080p">1080p</option>
        <option value="original">Original</option>
      </select>
    </label>
  </div>

  {#if state.exportState.phase === "idle" || state.exportState.phase === "complete" || state.exportState.phase === "error"}
    <button class="export-btn" onclick={handleExport} disabled={!state.source}>
      <i class="fas fa-download" aria-hidden="true"></i>
      Export Video
    </button>
  {:else}
    <div class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {(state.exportState.progress ?? 0) * 100}%"></div>
      </div>
      <span class="progress-label">{state.exportState.phase}... {Math.round((state.exportState.progress ?? 0) * 100)}%</span>
    </div>
  {/if}

  {#if state.exportState.phase === "complete"}
    <button class="download-btn" onclick={handleDownload}>
      <i class="fas fa-file-video" aria-hidden="true"></i>
      Download
    </button>
  {/if}

  {#if state.exportState.phase === "error"}
    <p class="error-text">{state.exportState.error}</p>
  {/if}
</div>

<style>
  .export-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0;
  }

  .export-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .select-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .select-row span {
    min-width: 70px;
  }

  .select-row select {
    flex: 1;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #ffffff);
    padding: 4px 8px;
  }

  .export-btn,
  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border: none;
    border-radius: 6px;
    background: var(--theme-accent, #f43f5e);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .download-btn {
    background: var(--semantic-success, #22c55e);
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar {
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #f43f5e);
    transition: width 0.2s;
  }

  .progress-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: capitalize;
  }

  .error-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
    margin: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/components/ExportPanel.svelte
git commit -m "feat(video-trails): add ExportPanel with format/resolution selection and progress"
```

---

### Task 17: WorkspaceView (Main Workspace)

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/views/WorkspaceView.svelte`

- [ ] **Step 1: Implement the workspace view that ties all components together**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/views/WorkspaceView.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";
  import type { ExportConfig, DetectedEndpoint } from "../domain/types";
  import type { IEndpointDetector } from "../services/contracts/IEndpointDetector";
  import VideoSourcePanel from "../components/VideoSourcePanel.svelte";
  import DetectionPreview from "../components/DetectionPreview.svelte";
  import PlaybackControls from "../components/PlaybackControls.svelte";
  import EffectsControlPanel from "../components/EffectsControlPanel.svelte";
  import ExportPanel from "../components/ExportPanel.svelte";

  const { state } = getVideoTrailsContext();

  let videoElement: HTMLVideoElement | null = $state(null);
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let canvasWidth = $state(640);
  let canvasHeight = $state(360);

  // When source changes, create/update video element
  $effect(() => {
    if (!state.source?.url) return;

    if (!videoElement) {
      videoElement = document.createElement("video");
      videoElement.crossOrigin = "anonymous";
      videoElement.playsInline = true;
      videoElement.muted = true;
    }

    videoElement.src = state.source.url;
    videoElement.onloadedmetadata = () => {
      if (!videoElement) return;
      canvasWidth = videoElement.videoWidth;
      canvasHeight = videoElement.videoHeight;
      state.updateSourceMetadata({
        duration: videoElement.duration,
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
      });

      // Create offscreen canvas for detection
      offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = canvasWidth;
      offscreenCanvas.height = canvasHeight;
      offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    };
  });

  // Playback loop
  $effect(() => {
    if (state.isPlaying && videoElement) {
      videoElement.playbackRate = state.playbackSpeed;
      videoElement.play();
      startDetectionLoop();
    } else if (videoElement) {
      videoElement.pause();
      stopDetectionLoop();
    }
  });

  // Seek when frame changes while paused
  $effect(() => {
    if (!state.isPlaying && videoElement && state.source) {
      const time = state.currentFrame / state.source.fps;
      if (Math.abs(videoElement.currentTime - time) > 0.01) {
        videoElement.currentTime = time;
      }
    }
  });

  function getDetector(): IEndpointDetector {
    const reg = DETECTOR_REGISTRY.find((r) => r.id === state.activeDetectorId);
    const key = reg?.containerKey ?? "ledThresholdDetector";
    return (container.items as Record<string, unknown>)[key] as IEndpointDetector;
  }

  function processCurrentFrame(): void {
    if (!videoElement || !offscreenCtx || !offscreenCanvas) return;

    offscreenCtx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
    const frameData = offscreenCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    const detector = getDetector();
    const endpoints = detector.detect(frameData, state.detectionConfig);

    const frameIndex = Math.round(videoElement.currentTime * (state.source?.fps ?? 30));
    state.storeFrameDetection(frameIndex, endpoints);
    state.setCurrentFrame(frameIndex);
  }

  function startDetectionLoop(): void {
    if (animFrameId !== null) return;

    function loop() {
      processCurrentFrame();
      animFrameId = requestAnimationFrame(loop);
    }
    animFrameId = requestAnimationFrame(loop);
  }

  function stopDetectionLoop(): void {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  async function handleExport(config: ExportConfig): Promise<void> {
    if (!videoElement) return;
    const exporter = container.items.videoTrailsExporter;
    state.setExportState({ phase: "preparing" });

    try {
      const blob = await exporter.export(videoElement, [], config, (s) => state.setExportState(s));
      state.setExportState({ phase: "complete", blob });
    } catch (err) {
      state.setExportState({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  onDestroy(() => {
    stopDetectionLoop();
    if (videoElement) {
      videoElement.pause();
      videoElement.src = "";
    }
  });
</script>

<div class="workspace">
  <div class="main-area">
    {#if !state.source}
      <VideoSourcePanel />
    {:else}
      <div class="canvas-area">
        <DetectionPreview {videoElement} width={canvasWidth} height={canvasHeight} />
      </div>
      <PlaybackControls />
    {/if}
  </div>

  <aside class="sidebar">
    {#if state.source}
      <VideoSourcePanel />
    {/if}
    <EffectsControlPanel />
    <ExportPanel onExport={handleExport} />
  </aside>
</div>

<style>
  .workspace {
    display: flex;
    gap: 16px;
    padding: 16px;
    height: 100%;
    min-height: 0;
    container-type: inline-size;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  @container (max-width: 768px) {
    .workspace {
      flex-direction: column;
    }
    .sidebar {
      width: 100%;
    }
  }
</style>
```

- [ ] **Step 2: Create placeholder views for Detection Studio and Library**

```svelte
<!-- src/lib/features/lab/tabs/video-trails/views/DetectionStudioView.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state } = getVideoTrailsContext();
</script>

<div class="studio-placeholder">
  <i class="fas fa-crosshairs" aria-hidden="true"></i>
  <h2>Detection Studio</h2>
  <p>Frame-by-frame correction coming in Phase 3.</p>
  {#if state.correctionCount > 0}
    <p class="stat">{state.correctionCount} corrections recorded</p>
  {/if}
</div>

<style>
  .studio-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
  .studio-placeholder i { font-size: 48px; opacity: 0.3; }
  .studio-placeholder h2 { margin: 0; font-size: 20px; color: var(--theme-text, #fff); }
  .studio-placeholder p { margin: 0; font-size: var(--font-size-min, 14px); }
  .stat { color: var(--theme-accent, #f43f5e); }
</style>
```

```svelte
<!-- src/lib/features/lab/tabs/video-trails/views/LibraryView.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state } = getVideoTrailsContext();
</script>

<div class="library-placeholder">
  <i class="fas fa-folder-open" aria-hidden="true"></i>
  <h2>Video Library</h2>
  <p>Project management coming in Phase 5.</p>
</div>

<style>
  .library-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
  .library-placeholder i { font-size: 48px; opacity: 0.3; }
  .library-placeholder h2 { margin: 0; font-size: 20px; color: var(--theme-text, #fff); }
  .library-placeholder p { margin: 0; font-size: var(--font-size-min, 14px); }
</style>
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/video-trails/views/
git commit -m "feat(video-trails): add WorkspaceView with detection loop and placeholder views"
```

---

## Chunk 3: Integration Testing & Verification

### Task 18: Full Build Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npm run check 2>&1 | tail -30`
Expected: No errors in video-trails files

- [ ] **Step 2: Run all existing tests to ensure no regressions**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All existing tests still pass

- [ ] **Step 3: Run new video-trails tests**

Run: `npx vitest run tests/unit/video-trails/ 2>&1 | tail -20`
Expected: All pass

- [ ] **Step 4: Verify the tab loads in the app**

Navigate to the Lab module in the running app, select "Video Trails" tab. Verify:
- Sub-navigation renders (Workspace, Detection Studio, Library)
- Workspace view shows the file upload drop zone
- Drag-dropping a video file loads it
- Detection overlay appears with endpoint markers
- Playback controls work (play/pause, seek)
- Effects panel toggles work
- No console errors

---

## Phase Summary

| Phase | Status | What Ships |
|-------|--------|------------|
| **Phase 1 (Chunks 1-3)** | This plan | Types, services, DI, state, context, Workspace view with detection + playback + effects panel + export |
| **Phase 2** | Future plan | Fire + LED WebGL renderer integration into workspace canvas stack |
| **Phase 3** | Future plan | Detection Studio: TimelineScrubber, EndpointEditor, OcclusionMarker |
| **Phase 4** | Future plan | TrainingDataPanel, training pair export |
| **Phase 5** | Future plan | Library view: project persistence, sequence attachment |
| **Phase 6** | Future plan | ColorEndpointDetector |
| **Phase 7** | Future plan | ML inference via ONNX/TFLite WebWorker |

Each future phase builds on the foundation laid here and is independently plannable.
