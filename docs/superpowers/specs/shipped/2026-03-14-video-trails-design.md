# Video Trails — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Location:** TKA Platform Lab module, single tab with internal sub-navigation

---

## Vision

Video Trails brings real-world video analysis into TKA Platform. Upload or capture video of flow arts performances, detect prop endpoints via LED brightness or color matching, render TKA's existing effect stack (fire, LED glow, trails, charcoal) on the detected points, and export for social media or attach to TKA sequence data.

Long-term: ML-based prop detection with skeletal awareness, occlusion prediction, and 3D spatial mapping of real spinning.

---

## Use Cases

1. **Social media content** — Record yourself spinning, add trail/fire/LED effects, export processed video
2. **Sequence attachment** — Attach processed video to TKA sequences, acts, and shows
3. **Detection refinement** — Frame-by-frame correction of detection errors, generating training data for future ML models
4. **Practice analysis** — Review spinning with enhanced visualization of prop paths
5. **3D mapping foundation** — Build toward understanding how props move in 3D space (in front of / behind the body)

---

## Architecture

### Single Lab Tab with Internal Sub-Navigation

Video Trails registers as ONE Lab tab entry. Internally, it manages three views via sub-navigation:

| View | Purpose |
|------|---------|
| **Workspace** | Main workspace — video source, live detection, effect toggles, export |
| **Detection Studio** | Frame-by-frame correction — endpoint dragging, occlusion marking, training data |
| **Library** | Project management — browse, attach to sequences, re-export |

This avoids the Svelte context sharing problem: since all three views live under one component tree (`VideoTrailsLab.svelte`), state is set once in the root and consumed by any descendant. Switching views does not destroy/recreate the component tree.

State is shared via Svelte context (`setVideoTrailsContext` / `getVideoTrailsContext`), created once in `VideoTrailsLab.svelte` on mount.

### File Structure

All imports use direct file paths per TKA convention. No index.ts barrel exports.

```
src/lib/features/lab/tabs/video-trails/
├── VideoTrailsLab.svelte              # Root tab (sub-navigation + context provider)
├── views/
│   ├── WorkspaceView.svelte           # Main workspace view
│   ├── DetectionStudioView.svelte     # Frame-by-frame correction view
│   └── LibraryView.svelte             # Video management view
├── components/
│   ├── VideoSourcePanel.svelte        # Upload / camera / sequence source selector
│   ├── DualVideoCanvas.svelte         # Side-by-side original + processed canvases
│   ├── DetectionPreview.svelte        # Live canvas showing detected endpoints
│   ├── EffectsControlPanel.svelte     # Fire/LED/trail/charcoal toggles + sliders
│   ├── ExportPanel.svelte             # Export controls + progress
│   ├── PlaybackControls.svelte        # Play/pause, seek, speed, keyboard shortcuts
│   ├── TimelineScrubber.svelte        # Frame-level navigation (Detection Studio)
│   ├── EndpointEditor.svelte          # Drag-to-correct endpoint positions
│   ├── OcclusionMarker.svelte         # Mark frames where prop is hidden
│   ├── VideoAttachmentPanel.svelte    # Attach video to sequence/act/show
│   └── TrainingDataPanel.svelte       # View correction pairs, export training sets
├── services/
│   ├── contracts/
│   │   ├── IEndpointDetector.ts       # Abstract detection interface
│   │   ├── IVideoTipAdapter.ts        # Converts DetectedEndpoint -> TKA tip formats
│   │   ├── IVideoTrailsExporter.ts    # Export with effects
│   │   ├── IDetectionCorrector.ts     # Correction storage + training data
│   │   └── IVideoTrailsRepository.ts  # CRUD for projects
│   └── implementations/
│       ├── LedThresholdDetector.ts    # MVP: brightness-based detection
│       ├── ColorEndpointDetector.ts   # Color-based detection variant
│       ├── VideoTipAdapter.ts         # Stateful adapter (tracks velocities via finite diff)
│       ├── VideoTrailsExporter.ts     # Composites video + effects -> export
│       ├── DetectionCorrector.ts      # Stores corrections, generates training pairs
│       └── VideoTrailsRepository.ts   # IndexedDB + localStorage persistence
├── domain/
│   └── types.ts                       # All type definitions
├── state/
│   └── video-trails-state.svelte.ts   # Shared state factory across all 3 tabs
└── context/
    └── video-trails-context.ts        # setVideoTrailsContext / getVideoTrailsContext
```

---

## Data Flow

```
Video Source (file / camera / TKA sequence)
    |
    v
IEndpointDetector.detect(frame)
    |
    v
DetectedEndpoint[] (x, y, brightness, propIndex, confidence)
    |
    v
+--- Correction layer (Detection Studio applies manual fixes) ---+
|    CorrectedEndpoint[] overrides DetectedEndpoint[] per frame  |
+----------------------------------------------------------------+
    |
    v
VideoTipAdapter: maps to PropTipData[] / LedTipData[] / TrailPoint[]
    |
    v
TKA Effect Renderers (via AnimationVisibilityStateManager)
    |-- WebGLFireRenderer (fire on detected points)
    |-- WebGLLedRenderer (glow + bloom on detected points)
    |-- Canvas2DTrailRenderer (persistent trails)
    +-- CharcoalSparkRenderer (charcoal sparks)
    |
    v
Composited output canvas (video + effects overlay)
    |
    v
Export (social media MP4) OR Attach (to sequence/act/show in TKA data)
```

---

## Core Abstractions

### IEndpointDetector

```typescript
interface IEndpointDetector {
  detect(frame: ImageData, config: DetectionConfig): DetectedEndpoint[];
  readonly name: string;
  readonly capabilities: DetectorCapabilities;
}

interface DetectedEndpoint {
  x: number;
  y: number;
  brightness: number;           // 0-1
  confidence: number;           // 0-1
  propIndex: 0 | 1;
  tipIndex: number;
  frameIndex: number;
}

interface DetectionConfig {
  threshold: number;            // 0-1, brightness cutoff
  sensitivity: number;          // 0-2, luminance multiplier
  colorWeights: { r: number; g: number; b: number };
  minArea: number;              // Minimum pixel cluster size
  maxEndpoints: number;         // Max detected points per frame
}

interface DetectorCapabilities {
  supportsLive: boolean;
  supportsOcclusion: boolean;
  requiresGPU: boolean;
}
```

### Detector Registry

Detectors are instantiated via the DI container, not factory functions. The registry is metadata only — it maps IDs to container keys.

```typescript
interface DetectorRegistration {
  id: string;
  name: string;
  description: string;
  version: string;
  containerKey: string;         // Maps to DI container key
  capabilities: DetectorCapabilities;
}

const DETECTOR_REGISTRY: DetectorRegistration[] = [
  {
    id: 'led-threshold-v1',
    name: 'LED Threshold',
    description: 'Detects bright points via luminance thresholding. Best for LED props in dark environments.',
    version: '1.0.0',
    containerKey: 'ledThresholdDetector',
    capabilities: { supportsLive: true, supportsOcclusion: false, requiresGPU: false },
  },
  {
    id: 'color-match-v1',
    name: 'Color Match',
    description: 'Detects endpoints by matching specific colors. Works in varied lighting.',
    version: '1.0.0',
    containerKey: 'colorEndpointDetector',
    capabilities: { supportsLive: true, supportsOcclusion: false, requiresGPU: false },
  },
];

// Resolving a detector:
const registration = DETECTOR_REGISTRY.find(r => r.id === activeDetectorId);
const detector = container.items[registration.containerKey] as IEndpointDetector;
```
```

### VideoTipAdapter (DI-registered service)

Converts DetectedEndpoint[] to the formats TKA's renderers expect. Registered in DI because it has mutable state (velocity tracking via finite differencing).

**Contract:** `IVideoTipAdapter`

```typescript
interface IVideoTipAdapter {
  mapToFireTips(endpoints: DetectedEndpoint[], canvasSize: number, currentTime: number): PropTipData[];
  mapToLedTips(endpoints: DetectedEndpoint[], currentTime: number, ledConfig: LedOverlayConfig): LedTipData[];
  mapToTrailPoints(endpoints: DetectedEndpoint[], currentTime: number): TrailPoint[];
  reset(): void;
}
```

**Implementation:** `VideoTipAdapter`

```typescript
class VideoTipAdapter implements IVideoTipAdapter {
  private previousPositions = new Map<string, { x: number; y: number; time: number }>();

  mapToFireTips(endpoints: DetectedEndpoint[], canvasSize: number, currentTime: number): PropTipData[] {
    return endpoints.map(ep => {
      const key = `${ep.propIndex}-${ep.tipIndex}`;
      const prev = this.previousPositions.get(key);
      // Clamp dt to prevent division by zero on duplicate timestamps
      const dt = Math.max(prev ? (currentTime - prev.time) / 1000 : 0.016, 0.001);
      const vx = prev ? (ep.x - prev.x) / dt : 0;
      const vy = prev ? (ep.y - prev.y) / dt : 0;

      this.previousPositions.set(key, { x: ep.x, y: ep.y, time: currentTime });

      return {
        x: ep.x, y: ep.y,
        velocityX: vx, velocityY: vy,
        speed: Math.sqrt(vx * vx + vy * vy),
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        flameScale: ep.brightness,
        jerk: 0,
      };
    });
  }

  mapToLedTips(endpoints: DetectedEndpoint[], currentTime: number, ledConfig: LedOverlayConfig): LedTipData[] {
    return endpoints.map(ep => {
      const color = evaluatePattern(ledConfig.patternId, ep.tipIndex, currentTime, ledConfig);
      return {
        x: ep.x, y: ep.y,
        velocityX: 0, velocityY: 0, speed: 0,
        propIndex: ep.propIndex, tipIndex: ep.tipIndex,
        brightness: ep.brightness,
        r: color.r, g: color.g, b: color.b,
      };
    });
  }

  mapToTrailPoints(endpoints: DetectedEndpoint[], currentTime: number): TrailPoint[] {
    return endpoints.map(ep => ({
      x: ep.x, y: ep.y,
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

---

## Tab 1: Video Trails (Main Workspace)

### Layout

Side-by-side canvases: original video with endpoint markers (left), processed output with effects (right). Below: playback controls, effects panel, export controls.

### Components

**VideoSourcePanel** (~80 lines)
- Three source modes: File (drag-drop), Camera (device selector, front/back, mirror), Sequence (TKA sequence picker)
- Source switching preserves effect config

**DualVideoCanvas** (~100 lines)
- Container-queried: side-by-side on desktop, stacked on narrow viewports
- Original canvas: video frame + colored circles at detected endpoints (opacity = confidence)
- Processed canvas: video frame + effect overlays (fire/LED/trail WebGL canvases layered via z-index)

**PlaybackControls** (~60 lines)
- Play/pause, seek bar, speed control (0.25x-2x), frame counter
- Keyboard: Space (play/pause), arrows (frame step), J/K/L (shuttle)

**EffectsControlPanel** (~120 lines)
- Maps directly to AnimationVisibilityStateManager:
  - Fire: enabled, intensity, flame height, color blend, physics preset (white gas / charcoal)
  - LED: enabled, glow radius, bloom, pattern, color, brightness
  - Trails: enabled, mode (fade/persistent/loop-clear), length, fade, width, glow, color
  - Charcoal: enabled, gravity, burst threshold
- Detection-specific controls: threshold, sensitivity, color weights
- Detector selector dropdown

**ExportPanel** (~70 lines)
- Format: MP4 (WebCodecs) or WebM (MediaRecorder fallback)
- Resolution: 720p, 1080p, original
- Attach to Sequence button (opens sequence picker)
- Progress bar with phase indicator

### Real-Time Detection Loop

```typescript
function processFrame(videoElement: HTMLVideoElement, ctx: CanvasRenderingContext2D) {
  offscreenCtx.drawImage(videoElement, 0, 0, width, height);
  const frameData = offscreenCtx.getImageData(0, 0, width, height);

  const endpoints = detector.detect(frameData, detectionConfig);
  const corrected = corrector.applyCorrections(currentFrame, endpoints);
  const tipData = tipAdapter.mapToFireTips(corrected, canvasSize, currentTime);

  if (fireEnabled) fireRenderer.renderFire({ tips: tipData, currentTime, ... }, fireConfig);
  if (ledEnabled) ledRenderer.renderLeds({ tips: tipData, currentTime, ... }, ledConfig);
  if (trailsEnabled) trailRenderer.renderTrails(ctx, bluePoints, redPoints, trailSettings, currentTime, ...);

  state.storeFrameDetection(currentFrame, endpoints);
}
```

### Rendering Stack (DOM Layer Order)

```html
<div class="video-trails-container" style="position: relative">
  <canvas class="video-layer" style="z-index: 1" />
  <canvas class="trail-layer" style="z-index: 2" />
  <canvas class="fire-layer" style="z-index: 3" />
  <canvas class="led-layer" style="z-index: 4" />
  <svg class="detection-overlay" style="z-index: 5" />
</div>
```

Same layering pattern as AnimationEngine. Export compositor walks layers via querySelectorAll('canvas').

---

## Tab 2: Detection Studio

### Layout

Full-width zoomed canvas of current frame with draggable endpoint markers. Below: frame-level timeline scrubber with color-coded markers. Side panel: endpoint details, correction tools, training data stats.

### Components

**TimelineScrubber** (~90 lines)
- Frame-level precision (not time-based)
- Color-coded markers: red (corrections), yellow (low confidence), green (accepted)
- Skip-to: next low-confidence frame, next corrected frame, next gap
- Keyboard: arrows (1 frame), shift+arrows (10 frames)

**EndpointEditor** (~110 lines)
- Zoomed canvas with draggable endpoint markers
- Color by confidence: solid (high), half-filled (medium), outline (low), crossed-out (occluded)
- Tools:
  - Snap to Brightest: search radius for brightest pixel cluster, snap endpoint
  - Copy from Previous Frame: use last known position when detection fails
  - Interpolate Gap: linear interpolation across occluded frame ranges
- Keyboard: Tab (cycle endpoints), arrows (nudge 1px), shift+arrows (nudge 5px), O (mark occluded), Enter (accept + next frame)

**OcclusionMarker** (~50 lines)
- Mark frame ranges where prop is behind body
- Metadata: which endpoint, start/end frame, blocking cause (future: body part)
- Occluded frames get interpolated endpoints with "predicted" confidence

**TrainingDataPanel** (~70 lines)
- Stats: total frames, corrected frames, correction magnitude histogram
- Each correction = training pair: { frame ImageData, detected points, corrected points, occlusion flags }
- Export as JSON dataset
- Quality metrics: average drift, worst frames, occlusion frequency

### Correction Data Model

```typescript
interface CorrectionFrame {
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

interface EndpointCorrection {
  propIndex: 0 | 1;
  tipIndex: number;
  detected: { x: number; y: number; confidence: number } | null;
  corrected: { x: number; y: number } | null;
  status: 'accepted' | 'corrected' | 'occluded' | 'interpolated';
  occlusionCause?: string;
}

interface TrainingPair {
  frame: { width: number; height: number; dataUrl: string };
  detected: DetectedEndpoint[];
  corrected: EndpointCorrection[];
  metadata: CorrectionFrame['metadata'];
}
```

---

## Tab 3: Video Library

### Layout

Grid of video project thumbnails with metadata (duration, attached sequence, correction count). Detail panel on selection with actions: open in Video Trails, open in Detection Studio, attach to sequence, re-export, delete.

### Video Project Data Model

```typescript
interface VideoTrailsProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;

  source: {
    type: 'file' | 'camera' | 'sequence';
    originalFileName?: string;
    duration: number;
    resolution: { width: number; height: number };
    frameCount: number;
    fps: number;
  };

  detection: {
    detectorId: string;
    config: DetectionConfig;
    results: DetectedEndpoint[][];
    corrections: CorrectionFrame[];
    trainingDataExported: boolean;
  };

  effects: {
    fire: FireOverlayConfig;
    led: LedOverlayConfig;
    trails: TrailSettings;
    charcoal: CharcoalSparkParams;
  };

  exports: VideoExportRecord[];

  attachments: {
    sequenceId?: string;
    actId?: string;
    showId?: string;
  };

  thumbnail: string;
}

interface VideoExportRecord {
  id: string;
  exportedAt: string;
  format: 'mp4' | 'webm';
  resolution: { width: number; height: number };
  effectsApplied: string[];
  fileSize: number;
  blobUrl?: string;
}

interface SequenceVideoAttachment {
  videoTrailsProjectId: string;
  thumbnailUrl: string;
  duration: number;
  attachedAt: string;
  attachedBy: string;
  effectsSnapshot: EffectConfig;
}
```

### Storage Strategy

**MVP:** Project metadata in localStorage, video blobs and frame data in IndexedDB, detection results compressed with run-length encoding.

**Future:** Firestore for metadata (cross-device sync), Cloud Storage for video files, training data exportable as downloadable dataset, sequence attachment references in Firestore sequence documents.

---

## DI Container Integration

Video Trails services get their own container file following TKA's per-domain pattern.

**File:** `src/lib/shared/di/containers/video-trails-container.ts`

```typescript
import { createContainer } from 'iti';
import { LedThresholdDetector } from '$lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector';
import { ColorEndpointDetector } from '$lib/features/lab/tabs/video-trails/services/implementations/ColorEndpointDetector';
import { VideoTipAdapter } from '$lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter';
import { DetectionCorrector } from '$lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector';
import { VideoTrailsRepository } from '$lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository';
import { VideoTrailsExporter } from '$lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter';

export const videoTrailsContainer = createContainer()
  .add({
    ledThresholdDetector: () => new LedThresholdDetector(),
    colorEndpointDetector: () => new ColorEndpointDetector(),
    videoTipAdapter: () => new VideoTipAdapter(),
    detectionCorrector: () => new DetectionCorrector(),
    videoTrailsRepository: () => new VideoTrailsRepository(),
  })
  .add((ctx) => ({
    videoTrailsExporter: () => new VideoTrailsExporter(ctx.videoTrailsRepository),
  }));

export type VideoTrailsContainer = typeof videoTrailsContainer;
```

Then add `VideoTrailsItems` to `container-types.ts` and wire into `buildAppContainer()` in `src/lib/shared/di/index.ts`.

### Module Root Mounting (Three-Layer Pattern)

```typescript
// In VideoTrailsLab.svelte (the root component)
import { container } from '$lib/shared/di';
import { createVideoTrailsState } from './state/video-trails-state.svelte';
import { setVideoTrailsContext } from './context/video-trails-context';

const state = createVideoTrailsState(
  container.items.videoTrailsRepository,
  container.items.detectionCorrector,
  container.items.videoTipAdapter,
);
setVideoTrailsContext({ state });

// Children (WorkspaceView, DetectionStudioView, LibraryView) consume via:
// const { state } = getVideoTrailsContext();
```

### Service Naming (TKA Convention)

| Service | Suffix | Job |
|---------|--------|-----|
| LedThresholdDetector | Detector | Brightness-based endpoint detection |
| ColorEndpointDetector | Detector | Color-matching endpoint detection |
| VideoTipAdapter | Adapter | Converts DetectedEndpoint to PropTipData/LedTipData/TrailPoint |
| DetectionCorrector | Corrector | Stores corrections, applies to detections, generates training pairs |
| VideoTrailsExporter | Exporter | Composites video + effects, encodes to MP4/WebM (WebCodecs primary, MediaRecorder fallback) |
| VideoTrailsRepository | Repository | CRUD for VideoTrailsProject in IndexedDB + localStorage |

---

## Navigation Integration

### Tab Definition (add to LAB_TABS in tab-definitions.ts)

Single tab entry. Internal sub-navigation handled by `VideoTrailsLab.svelte`.

```typescript
{
  id: 'video-trails',
  label: 'Video Trails',
  icon: '<i class="fas fa-magic-wand-sparkles" aria-hidden="true"></i>',
  description: 'Detect prop endpoints in video, apply fire/LED/trail effects, build training data',
  color: '#f43f5e',
  gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)',
},
```

### LabModule.svelte (add to tabComponents map)

```typescript
'video-trails': () => import('./tabs/video-trails/VideoTrailsLab.svelte'),
```

### Internal Sub-Navigation

`VideoTrailsLab.svelte` manages three views internally:

```typescript
type VideoTrailsView = 'workspace' | 'detection-studio' | 'library';
let activeView = $state<VideoTrailsView>('workspace');

// Sub-nav rendered as a segmented control or tab bar at the top of the component
```

---

## Shared State Factory

```typescript
// video-trails-state.svelte.ts

export function createVideoTrailsState(
  repository: IVideoTrailsRepository,
  corrector: IDetectionCorrector,
) {
  // Source
  let source = $state<VideoSource | null>(null);
  let sourceMode = $state<'file' | 'camera' | 'sequence'>('file');

  // Playback
  let isPlaying = $state(false);
  let currentFrame = $state(0);
  let playbackSpeed = $state(1);
  let totalFrames = $state(0);

  // Detection
  // Note: Using Record instead of Map for Svelte 5 proxy reactivity.
  // Map.set() does not trigger reactive updates through $state proxies.
  let activeDetectorId = $state('led-threshold-v1');
  let detectionConfig = $state<DetectionConfig>(DEFAULT_DETECTION_CONFIG);
  let frameDetections = $state<Record<number, DetectedEndpoint[]>>({});
  let isDetecting = $state(false);

  // Corrections
  let corrections = $state<Record<number, EndpointCorrection[]>>({});
  let correctionCount = $derived(Object.keys(corrections).length);

  // Effects
  // EffectConfig aggregates toggle + slider values for all effect types.
  // Defined in domain/types.ts:
  //   interface EffectConfig {
  //     fire: { enabled: boolean; intensity: number; flameHeight: number; colorBlend: number; preset: 'white-gas' | 'charcoal' };
  //     led: { enabled: boolean; glowRadius: number; bloom: number; patternId: string; color: string; brightness: number };
  //     trails: { enabled: boolean; mode: TrailMode; length: number; fade: number; width: number; glow: boolean; color: { blue: string; red: string } };
  //     charcoal: { enabled: boolean; gravity: number; burstThreshold: number };
  //   }
  let effectConfig = $state<EffectConfig>(DEFAULT_EFFECT_CONFIG);

  // Project
  let currentProject = $state<VideoTrailsProject | null>(null);
  let projects = $state<VideoTrailsProject[]>([]);
  let isDirty = $state(false);

  // Export
  let exportState = $state<ExportState>({ phase: 'idle' });

  // Derived
  let currentEndpoints = $derived.by(() => {
    const detected = frameDetections[currentFrame] ?? [];
    return corrector.applyCorrections(currentFrame, detected, corrections);
  });

  let lowConfidenceFrames = $derived.by(() => {
    const frames: number[] = [];
    for (const [frame, endpoints] of Object.entries(frameDetections)) {
      if (endpoints.some(ep => ep.confidence < 0.6)) frames.push(Number(frame));
    }
    return frames;
  });

  let trainingPairCount = $derived(corrections.size);

  // Actions
  function loadVideo(file: File) { /* validate, create object URL, extract metadata */ }
  function startCamera(deviceId?: string) { /* enumerate, getUserMedia, set source */ }
  function loadSequence(sequenceId: string) { /* load from TKA, feed AnimationEngine frames */ }

  function storeFrameDetection(frame: number, endpoints: DetectedEndpoint[]) {
    frameDetections.set(frame, endpoints);
    isDirty = true;
  }

  function correctEndpoint(frame: number, correction: EndpointCorrection) {
    const existing = corrections.get(frame) ?? [];
    const idx = existing.findIndex(c => c.propIndex === correction.propIndex && c.tipIndex === correction.tipIndex);
    if (idx >= 0) existing[idx] = correction;
    else existing.push(correction);
    corrections.set(frame, existing);
    isDirty = true;
  }

  function markOccluded(frame: number, propIndex: number, tipIndex: number) {
    correctEndpoint(frame, {
      propIndex: propIndex as 0 | 1,
      tipIndex,
      detected: null,
      corrected: null,
      status: 'occluded',
    });
  }

  function interpolateGap(startFrame: number, endFrame: number, propIndex: number, tipIndex: number) {
    const startPos = findLastKnownPosition(startFrame, propIndex, tipIndex);
    const endPos = findNextKnownPosition(endFrame, propIndex, tipIndex);
    if (!startPos || !endPos) return;

    for (let f = startFrame; f <= endFrame; f++) {
      const t = (f - startFrame) / (endFrame - startFrame);
      correctEndpoint(f, {
        propIndex: propIndex as 0 | 1,
        tipIndex,
        detected: null,
        corrected: { x: lerp(startPos.x, endPos.x, t), y: lerp(startPos.y, endPos.y, t) },
        status: 'interpolated',
      });
    }
  }

  async function saveProject() { /* serialize to repository */ }
  async function loadProject(id: string) { /* deserialize from repository */ }
  async function exportVideo(config: ExportConfig) { /* frame-by-frame compositing + encoding */ }
  async function attachToSequence(sequenceId: string) { /* store reference in sequence data */ }
  async function exportTrainingData(): Promise<TrainingPair[]> { /* generate pairs from corrections */ }

  function destroy() { /* cleanup video elements, revoke URLs, dispose renderers */ }

  return {
    get source() { return source; },
    get sourceMode() { return sourceMode; },
    get isPlaying() { return isPlaying; },
    get currentFrame() { return currentFrame; },
    get totalFrames() { return totalFrames; },
    get playbackSpeed() { return playbackSpeed; },
    get currentEndpoints() { return currentEndpoints; },
    get corrections() { return corrections; },
    get correctionCount() { return correctionCount; },
    get lowConfidenceFrames() { return lowConfidenceFrames; },
    get effectConfig() { return effectConfig; },
    get currentProject() { return currentProject; },
    get projects() { return projects; },
    get exportState() { return exportState; },
    get trainingPairCount() { return trainingPairCount; },
    get isDirty() { return isDirty; },
    get activeDetectorId() { return activeDetectorId; },
    get detectionConfig() { return detectionConfig; },
    get isDetecting() { return isDetecting; },

    loadVideo, startCamera, loadSequence,
    storeFrameDetection, correctEndpoint, markOccluded, interpolateGap,
    saveProject, loadProject, exportVideo, attachToSequence, exportTrainingData,
    setDetectionConfig: (config: Partial<DetectionConfig>) => { detectionConfig = { ...detectionConfig, ...config }; isDirty = true; },
    setEffectConfig: (config: Partial<EffectConfig>) => { effectConfig = { ...effectConfig, ...config }; isDirty = true; },
    setActiveDetector: (id: string) => { activeDetectorId = id; },
    setCurrentFrame: (frame: number) => { currentFrame = frame; },
    setPlaybackSpeed: (speed: number) => { playbackSpeed = speed; },
    togglePlayback: () => { isPlaying = !isPlaying; },
    destroy,
  };
}
```

---

## Export Pipeline

### Social Media Export (standalone video file)

Frame-by-frame compositing using TKA's VideoExportOrchestrator pattern:

```typescript
async function* exportVideo(project: VideoTrailsProject, config: ExportConfig): AsyncGenerator<ExportProgress> {
  const encoder = new BackgroundVideoEncoder(config.resolution, config.fps, config.bitrate);

  for (let frame = 0; frame < project.source.frameCount; frame++) {
    await seekToFrame(videoElement, frame, project.source.fps);
    offscreenCtx.drawImage(videoElement, 0, 0, width, height);

    const endpoints = corrector.getCorrectedEndpoints(frame, project.detection);
    const tipData = tipAdapter.mapToFireTips(endpoints, canvasSize, frameTime);

    if (project.effects.fire.enabled) fireRenderer.renderFire({ tips: tipData, ... }, project.effects.fire);
    if (project.effects.led.enabled) ledRenderer.renderLeds({ tips: tipData, ... }, project.effects.led);
    if (project.effects.trails.enabled) trailRenderer.renderTrails(trailCtx, ...);

    compositeCtx.drawImage(offscreenCanvas, 0, 0);
    compositeCtx.drawImage(trailCanvas, 0, 0);
    compositeCtx.drawImage(fireRenderer.getCanvas(), 0, 0);
    compositeCtx.drawImage(ledRenderer.getCanvas(), 0, 0);

    encoder.addFrame(compositeCtx.getImageData(0, 0, width, height));
    yield { phase: 'recording', progress: frame / totalFrames };
  }

  const blob = await encoder.finalize();
  yield { phase: 'complete', blob };
}
```

### Sequence Attachment (reference)

Stores VideoTrailsProject ID in the sequence's Firestore document. Video stays in IndexedDB (local) or Cloud Storage (future).

---

## Prop Assignment Strategy

When the detector finds bright clusters, it assigns them to props:

1. **Spatial clustering** — k-means (k=2) to group detected points into two props
2. **Consistency tracking** — Minimize position delta from previous frame to maintain identity
3. **User hint** — In Detection Studio, manually tag "this is blue, this is red"

Designed to be replaced by ML that understands prop identity from visual features.

---

## Implementation Phases

| Phase | Ships | Tabs |
|-------|-------|------|
| **1: Core Pipeline** | Video upload, LED detection, trail rendering on real video, basic export | Video Trails |
| **2: Full Effects** | Fire + LED glow + charcoal on detected points, effect toggle panel | Video Trails |
| **3: Correction Studio** | Frame-by-frame scrubbing, endpoint dragging, occlusion marking, interpolation | Video Trails + Detection Studio |
| **4: Training Pipeline** | Training data export, correction statistics, model evaluation | Detection Studio |
| **5: Video Library** | Project persistence, sequence attachment, export history | All three tabs |
| **6: Color Detection** | ColorEndpointDetector, works in varied lighting | All three tabs |
| **7: ML Foundation** | Model inference via ONNX/TFLite in WebWorker | All three tabs |

Each phase is independently shippable.

---

## Effect Lifecycle

```typescript
// In VideoTrailsLab.svelte
let fireRenderer: WebGLFireRenderer | null = null;
let ledRenderer: WebGLLedRenderer | null = null;
let trailRenderer: Canvas2DTrailRenderer | null = null;
let tipAdapter = new VideoTipAdapter();

$effect(() => {
  const vm = getAnimationVisibilityManager();

  if (vm.isFireEffectEnabled() && !fireRenderer?.isInitialized()) {
    fireRenderer = new WebGLFireRenderer();
    fireRenderer.initialize(containerElement, width, height);
  }

  if (vm.isLedEffectEnabled() && !ledRenderer?.isInitialized()) {
    ledRenderer = new WebGLLedRenderer();
    ledRenderer.initialize(containerElement, width, height);
  }

  if (!trailRenderer) {
    trailRenderer = new Canvas2DTrailRenderer();
  }
});
```

---

## Testing Strategy (Earned Tests)

Following TKA's earned tests philosophy, test only where bugs would be silent:

| What to Test | Why |
|--------------|-----|
| LedThresholdDetector.detect() | Pure algorithm, subtle math bugs |
| VideoTipAdapter velocity calculation | Finite differencing errors compound silently |
| DetectionCorrector.applyCorrections() | Wrong correction application corrupts training data |
| Interpolation math (lerp across gap) | Subtle off-by-one in frame ranges |
| Prop assignment (k-means clustering) | Wrong prop identity assignment is silent |

Do NOT test: UI components, effect toggles (visual), export flow (you see if it works).

---

## Long-Term Vision (Not in This Spec)

- ML models with spatial awareness (ONNX/TFLite in WebWorker)
- Skeletal pose estimation for occlusion prediction
- 3D spatial mapping of real spinning (depth from monocular video)
- Fire video processing (enhance real fire footage)
- Community sharing of processed videos
- Comparison view: synthetic TKA animation side-by-side with real video
