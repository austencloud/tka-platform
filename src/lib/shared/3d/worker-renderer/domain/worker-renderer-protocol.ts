import type { SceneEffectTipSource3D } from "../../effects/scene-effects/scene-effect-source-3d";
import type { StripPattern } from "$lib/shared/poi/domain/strip-pattern";
import type {
  LateralGait,
  ScheduledGaitTimingSample,
  TerminalStepPlan,
  TurnRequest,
} from "@austencloud/scene-3d";

export type WorkerEnvironmentKey =
  | "ocean"
  | "rainbow"
  | "void"
  | "winter"
  | "celestial"
  | "cosmic"
  | "forest"
  | "blossom"
  | "autumn"
  | "ember";

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
 * Prop visuals the worker can reproduce through a renderer-neutral canonical
 * owner. The staff aliases all route through scene-3d's `createStaffObject`;
 * `hand` deliberately mounts no prop mesh, matching Prop3D's bare-hand branch.
 *
 * Every other production prop remains fail-closed until scene-3d exports its
 * existing geometry as a worker-safe factory. Importing the package's Svelte
 * components into an OffscreenCanvas worker, or copying their geometry here,
 * would create a second renderer that can silently drift from the app.
 */
export const WORKER_PERFORMER_PROP_TYPES = [
  "staff",
  "simple_staff",
  "staff_v2",
  "bigstaff",
  "hand",
] as const;

export type WorkerPerformerPropType =
  (typeof WORKER_PERFORMER_PROP_TYPES)[number];

const WORKER_PERFORMER_PROP_TYPE_SET = new Set<string>(
  WORKER_PERFORMER_PROP_TYPES
);

export function isWorkerPerformerPropType(
  value: string
): value is WorkerPerformerPropType {
  return WORKER_PERFORMER_PROP_TYPE_SET.has(value);
}

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

export interface WorkerPerformerBadgeSnapshot {
  index: number;
  color: string;
  opacity: number;
  selected: boolean;
}

export interface WorkerPerformerLocomotionSnapshot {
  isMoving: boolean;
  moveSpeed: number;
  moveDirection: { x: number; z: number };
  lateralGait: LateralGait;
  gaitTimingSample: ScheduledGaitTimingSample | null;
  terminalStepPlan: TerminalStepPlan | null;
  turnRequest: TurnRequest | null;
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
  leftPropType: WorkerPerformerPropType;
  rightPropType: WorkerPerformerPropType;
  leftProp: WorkerPropSnapshot | null;
  rightProp: WorkerPropSnapshot | null;
  stanceYaw: number;
  stanceSegments: WorkerStanceSegments | null;
  spinePitchOffset: number;
  badge?: WorkerPerformerBadgeSnapshot | null;
  locomotion?: WorkerPerformerLocomotionSnapshot | null;
}

export type WorkerEffectQualityTier = "high" | "medium" | "low";

export interface WorkerTrailEffectConfig {
  maxPoints: number;
  width: number;
  color: string;
  opacity: number;
  rainbow: boolean;
  qualityTier: WorkerEffectQualityTier;
  mode: "fade" | "loop_clear" | "persistent";
  fadeDuration: number;
  emissiveStrength: number;
}

export interface WorkerTrailEffectFrame {
  renderer: "trail";
  sourceId: string;
  sampleSequence: number;
  enabled: boolean;
  position: WorkerVector3;
  config: WorkerTrailEffectConfig;
}

export interface WorkerLedTipFrame {
  position: WorkerVector3;
  r: number;
  g: number;
  b: number;
  brightness: number;
  velocity: WorkerVector3;
  speed: number;
}

export interface WorkerLedEffectFrame {
  renderer: "led";
  sourceId: string;
  sampleSequence: number;
  enabled: boolean;
  qualityTier: WorkerEffectQualityTier;
  sampledAtSeconds: number;
  tips: readonly WorkerLedTipFrame[];
}

export interface WorkerPovEffectFrame {
  renderer: "pov";
  sourceId: string;
  sampleSequence: number;
  enabled: boolean;
  qualityTier: WorkerEffectQualityTier;
  ledCount: number;
  staffAxis: WorkerVector3;
  staffCenter: WorkerVector3;
  staffHalfLength: number;
  frameIndex: number;
  pattern: StripPattern;
  sampledAtSeconds: number;
  brightness: number;
  persistenceDuration: number;
}

export interface WorkerMoonFanEffectFrame {
  renderer: "moon-fan";
  sourceId: string;
  sampleSequence: number;
  enabled: boolean;
  worldCenter: WorkerVector3;
  worldRotation: WorkerQuaternion;
  ledColors: readonly { r: number; g: number; b: number }[];
  brightness: number;
  scale: number;
}

/**
 * Final renderer inputs produced by the app-owned effect resolver.
 *
 * The worker never chooses an effect, samples a Choreo beat, or interprets an
 * LED source. It only advances the canonical heavyweight renderer named by
 * each frame. Typed arrays inside StripPattern are structured-clone-safe.
 */
export type WorkerImperativeEffectFrame =
  | WorkerTrailEffectFrame
  | WorkerLedEffectFrame
  | WorkerPovEffectFrame
  | WorkerMoonFanEffectFrame;

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
  imperative?: readonly WorkerImperativeEffectFrame[];
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
