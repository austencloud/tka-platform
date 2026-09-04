import type { SceneEffectTipSource3D } from "../../effects/scene-effects/scene-effect-source-3d";

export type WorkerEnvironmentKey = "ocean" | "rainbow" | "void";

export interface WorkerViewport {
  width: number;
  height: number;
  dpr: number;
}

export interface WorkerCameraSnapshot {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  /** Exact rendered orientation, including viewer roll when present. */
  quaternion?: WorkerQuaternion;
  up?: WorkerVector3;
}

export type WorkerVector3 = readonly [number, number, number];
export type WorkerQuaternion = readonly [number, number, number, number];

/**
 * Structured-clone-safe form of the already-resolved choreography state.
 *
 * The application remains the authority for Choreo timing and plane math.
 * Workers receive final transforms, so this renderer boundary cannot change
 * what a card or sequence means.
 */
export interface WorkerPropSnapshot {
  centerPathAngle: number;
  staffRotationAngle: number;
  plane: string;
  worldPosition: WorkerVector3;
  worldRotation: WorkerQuaternion;
  gripType?: string;
}

export interface WorkerStanceSegments {
  spine1Rad: number;
  spine2Rad: number;
  headLagRad: number;
}

export interface WorkerPerformerSnapshot {
  id: string;
  avatarId: string;
  position: WorkerVector3;
  facingAngle: number;
  avatarHeightCm: number;
  groundY: number;
  staffLength: number;
  staffThickness: number;
  leftPropType: string;
  rightPropType: string;
  leftProp: WorkerPropSnapshot | null;
  rightProp: WorkerPropSnapshot | null;
  stanceYaw: number;
  stanceSegments: WorkerStanceSegments | null;
  spinePitchOffset: number;
}

/**
 * Structured-clone-safe output of the app-owned effect resolver.
 *
 * Effect selection and Choreo timing stay on the application thread. The
 * worker receives the final world-space tip sources and owns only their
 * heavyweight Three.js renderers.
 */
export interface WorkerSceneEffectsSnapshot {
  playing: boolean;
  sources: readonly SceneEffectTipSource3D[];
}

export type WorkerRendererProgressPhase =
  | "renderer"
  | "assets"
  | "construct"
  | "performer"
  | "compile"
  | "prime"
  | "finalize"
  | "preflight"
  | "first-frame";

export interface WorkerRendererProgramMetric {
  label: string;
  durationMs: number;
}

export interface WorkerPerformerDiagnostics {
  count: number;
  renderables: number;
  visibleRenderables: number;
  effectivelyVisibleRenderables: number;
  layerMasks: readonly number[];
  rootVisible: boolean;
  rootLayerMask: number;
  materialOpacity: readonly [number, number] | null;
  boundsCenter: WorkerVector3 | null;
  boundsSize: WorkerVector3 | null;
  projectedCenter: WorkerVector3 | null;
}

export interface WorkerRendererBootMetrics {
  acceptedAt: number;
  rendererReadyAt: number;
  environmentReadyAt: number;
  performerReadyAt: number;
  worldReadyAt: number;
  compiledAt: number;
  primedAt: number;
  finalizedAt: number;
  preflightedAt: number;
  firstFrameAt: number;
  rendererMs: number;
  environmentMs: number;
  performerMs: number;
  worldMs: number;
  compileMs: number;
  primeMs: number;
  primeTargets: number;
  finalizeCompileMs: number;
  preflightMs: number;
  firstRenderMs: number;
  presentationWaitMs: number;
  confirmationRenderMs: number;
  firstFrameWaitMs: number;
  firstFrameMs: number;
  compileTargets: readonly WorkerRendererProgramMetric[];
  memoryAfterCompile: WorkerRendererMemoryMetric;
  memoryAfterPrime: WorkerRendererMemoryMetric;
  memoryAfterFinalize: WorkerRendererMemoryMetric;
  memoryAfterPreflight: WorkerRendererMemoryMetric;
  memoryAfterFirstRender: WorkerRendererMemoryMetric;
  performers: WorkerPerformerDiagnostics;
  geometries: number;
  textures: number;
  programs: number;
}

export interface WorkerRendererMemoryMetric {
  geometries: number;
  textures: number;
  programs: number;
}

export interface InitializeWorkerRendererMessage {
  type: "initialize";
  requestId: number;
  canvas: OffscreenCanvas;
  environment: WorkerEnvironmentKey;
  viewport: WorkerViewport;
  camera: WorkerCameraSnapshot;
  performers: readonly WorkerPerformerSnapshot[];
  effects?: WorkerSceneEffectsSnapshot;
}

export interface ResizeWorkerRendererMessage {
  type: "resize";
  requestId: number;
  viewport: WorkerViewport;
}

export interface CameraWorkerRendererMessage {
  type: "camera";
  requestId: number;
  camera: WorkerCameraSnapshot;
}

export interface VisibilityWorkerRendererMessage {
  type: "visibility";
  requestId: number;
  visible: boolean;
}

export interface PerformersWorkerRendererMessage {
  type: "performers";
  requestId: number;
  performers: readonly WorkerPerformerSnapshot[];
}

export interface EffectsWorkerRendererMessage {
  type: "effects";
  requestId: number;
  effects: WorkerSceneEffectsSnapshot;
}

export interface PointerWorkerRendererMessage {
  type: "pointer";
  requestId: number;
  action: "move" | "down" | "leave";
  ndcX: number;
  ndcY: number;
}

export interface DisposeWorkerRendererMessage {
  type: "dispose";
  requestId: number;
}

export type WorkerRendererInMessage =
  | InitializeWorkerRendererMessage
  | ResizeWorkerRendererMessage
  | CameraWorkerRendererMessage
  | PerformersWorkerRendererMessage
  | EffectsWorkerRendererMessage
  | PointerWorkerRendererMessage
  | VisibilityWorkerRendererMessage
  | DisposeWorkerRendererMessage;

export interface WorkerRendererBootingMessage {
  type: "booting";
  requestId: number;
  environment: WorkerEnvironmentKey;
  acceptedAt: number;
}

export interface WorkerRendererProgressMessage {
  type: "progress";
  requestId: number;
  phase: WorkerRendererProgressPhase;
  fraction: number;
}

export interface WorkerRendererFirstFrameMessage {
  type: "first-frame";
  requestId: number;
  environment: WorkerEnvironmentKey;
  metrics: WorkerRendererBootMetrics;
}

export interface WorkerRendererFrameMessage {
  type: "frame";
  requestId: number;
  environment: WorkerEnvironmentKey;
  frame: number;
  renderedAt: number;
  deltaMs: number;
}

export interface WorkerRendererErrorMessage {
  type: "error";
  requestId: number;
  environment: WorkerEnvironmentKey | null;
  message: string;
  stack?: string;
}

export interface WorkerRendererContextLostMessage {
  type: "context-lost";
  requestId: number;
  environment: WorkerEnvironmentKey | null;
}

export interface WorkerRendererDisposedMessage {
  type: "disposed";
  requestId: number;
}

export interface WorkerRendererInteractionMessage {
  type: "interaction";
  requestId: number;
  environment: WorkerEnvironmentKey;
  hover: boolean;
  chime: { frequencyHz: number; pan: number } | null;
}

export type WorkerRendererOutMessage =
  | WorkerRendererBootingMessage
  | WorkerRendererProgressMessage
  | WorkerRendererFirstFrameMessage
  | WorkerRendererFrameMessage
  | WorkerRendererErrorMessage
  | WorkerRendererContextLostMessage
  | WorkerRendererInteractionMessage
  | WorkerRendererDisposedMessage;

export function isWorkerRendererOutMessage(
  value: unknown
): value is WorkerRendererOutMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; requestId?: unknown };
  return (
    typeof candidate.requestId === "number" &&
    (candidate.type === "booting" ||
      candidate.type === "progress" ||
      candidate.type === "first-frame" ||
      candidate.type === "frame" ||
      candidate.type === "error" ||
      candidate.type === "context-lost" ||
      candidate.type === "interaction" ||
      candidate.type === "disposed")
  );
}

export function clampWorkerViewport(viewport: WorkerViewport): WorkerViewport {
  return {
    width: Math.max(1, Math.round(viewport.width)),
    height: Math.max(1, Math.round(viewport.height)),
    dpr: Math.max(0.5, Math.min(2, viewport.dpr)),
  };
}
