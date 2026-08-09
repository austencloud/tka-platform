export interface MuseumRendererSample {
  timestamp: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

export interface MuseumFrameContext {
  roomId: string | null;
  cameraMode: "top-down" | "first-person" | "third-person" | "editor";
  position: { x: number; y: number; z: number };
  activeRooms: number;
  pendingMounts: number;
}

export interface MuseumPhaseSummary {
  name: string;
  count: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface MuseumHitchSample {
  timestamp: number;
  frameMs: number;
  blockingMs: number | null;
  renderMs: number | null;
  styleAndLayoutMs: number | null;
  worstPhase: { name: string; durationMs: number } | null;
  context: MuseumFrameContext | null;
  scripts: Array<{
    sourceURL: string;
    sourceFunctionName: string;
    invoker: string;
    durationMs: number;
    forcedStyleAndLayoutMs: number;
  }>;
  source: "frame" | "long-animation-frame" | "long-task";
}

export interface MuseumPerformanceSnapshot {
  enabled: boolean;
  startedAt: number | null;
  capturedAt: number;
  frames: {
    count: number;
    averageMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    over33Ms: number;
    over50Ms: number;
    over100Ms: number;
  };
  phases: MuseumPhaseSummary[];
  renderer: MuseumRendererSample | null;
  hitches: MuseumHitchSample[];
}

export interface IMuseumPerformanceRecorder {
  readonly enabled: boolean;
  start(options?: { observeBrowser?: boolean }): void;
  stop(): void;
  clear(): void;
  beginPhase(): number;
  endPhase(name: string, startedAt: number): number;
  recordPhaseDuration(name: string, durationMs: number): void;
  recordFrame(durationMs: number, context: MuseumFrameContext): void;
  recordRendererSample(sample: Omit<MuseumRendererSample, "timestamp">): void;
  getSnapshot(): MuseumPerformanceSnapshot;
}
