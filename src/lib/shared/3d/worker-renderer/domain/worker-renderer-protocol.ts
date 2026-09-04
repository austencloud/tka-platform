export type WorkerEnvironmentKey = "ocean" | "rainbow";

export interface WorkerViewport {
  width: number;
  height: number;
  dpr: number;
}

export interface WorkerCameraSnapshot {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
}

export interface WorkerRendererBootMetrics {
  acceptedAt: number;
  worldReadyAt: number;
  compiledAt: number;
  firstFrameAt: number;
  worldMs: number;
  compileMs: number;
  firstFrameMs: number;
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

export interface DisposeWorkerRendererMessage {
  type: "dispose";
  requestId: number;
}

export type WorkerRendererInMessage =
  | InitializeWorkerRendererMessage
  | ResizeWorkerRendererMessage
  | CameraWorkerRendererMessage
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
  phase: "assets" | "construct" | "compile" | "first-frame";
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

export type WorkerRendererOutMessage =
  | WorkerRendererBootingMessage
  | WorkerRendererProgressMessage
  | WorkerRendererFirstFrameMessage
  | WorkerRendererFrameMessage
  | WorkerRendererErrorMessage
  | WorkerRendererContextLostMessage
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
