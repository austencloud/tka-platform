import {
  acceptWorkerFirstFrame,
  createWorkerRendererHandoffState,
  rejectWorkerEnvironment,
  requestWorkerEnvironment,
  type WorkerRendererHandoffState,
  type WorkerRendererSlotState,
} from "../domain/worker-renderer-handoff";
import {
  clampWorkerViewport,
  type WorkerCameraSnapshot,
  type WorkerEnvironmentKey,
  type WorkerRendererBootMetrics,
  type WorkerRendererInMessage,
  type WorkerRendererOutMessage,
  type WorkerViewport,
} from "../domain/worker-renderer-protocol";
import { WorkerRendererResponsivenessProbe } from "./worker-renderer-responsiveness-probe";
import { WorkerRendererSlot } from "./worker-renderer-slot";

const CAMERA_BY_ENVIRONMENT: Readonly<
  Record<WorkerEnvironmentKey, WorkerCameraSnapshot>
> = {
  ocean: {
    position: [0, 4.5, 19],
    target: [0, 1.6, -2],
    fov: 46,
  },
  rainbow: {
    position: [0, 4.2, 17],
    target: [0, 1.1, -1],
    fov: 48,
  },
};

export interface WorkerSceneSwitchMeasurement {
  requestId: number;
  environment: WorkerEnvironmentKey;
  requestedAt: number;
  swappedAt: number;
  clickToSwapMs: number;
  workerBoot: WorkerRendererBootMetrics;
  mainThreadMaxGapMs: number;
  mainThreadGapsOver50Ms: number;
  outgoingWorkerMaxFrameGapMs: number;
  handoffDelayMs: number;
  liveWorkersAtSwap: number;
  liveWorkersAfterCleanup: number | null;
  passedInputGate: boolean;
  passedFrameGate: boolean;
  passedWorkerBound: boolean;
}

export interface WorkerSceneSwitchSnapshot {
  supported: boolean;
  active: WorkerEnvironmentKey | null;
  staging: WorkerEnvironmentKey | null;
  phase: "unsupported" | "idle" | "booting" | "swapping" | "error";
  progress: number;
  progressPhase: string | null;
  liveWorkers: number;
  lastError: string | null;
  lastMeasurement: WorkerSceneSwitchMeasurement | null;
  history: readonly WorkerSceneSwitchMeasurement[];
}

export interface WorkerEnvironmentRendererOptions {
  container: HTMLElement;
  onSnapshot?: (snapshot: WorkerSceneSwitchSnapshot) => void;
  createWorker?: () => Worker;
}

function supportsWorkerRenderer(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype
  );
}

function createRendererWorker(): Worker {
  return new Worker(
    new URL("../workers/environment-renderer.worker.ts", import.meta.url),
    { type: "module", name: "tka-environment-renderer" }
  );
}

export class WorkerEnvironmentRenderer {
  private readonly container: HTMLElement;
  private readonly onSnapshot?: (snapshot: WorkerSceneSwitchSnapshot) => void;
  private readonly createWorker: () => Worker;
  private readonly supported: boolean;
  private handoff: WorkerRendererHandoffState =
    createWorkerRendererHandoffState();
  private readonly slots = new Map<number, WorkerRendererSlot>();
  private viewport: WorkerViewport = { width: 1, height: 1, dpr: 1 };
  private resizeObserver: ResizeObserver | null = null;
  private readonly responsiveness = new WorkerRendererResponsivenessProbe();
  private progress = 0;
  private progressPhase: string | null = null;
  private phase: WorkerSceneSwitchSnapshot["phase"] = "idle";
  private lastError: string | null = null;
  private lastMeasurement: WorkerSceneSwitchMeasurement | null = null;
  private history: WorkerSceneSwitchMeasurement[] = [];
  private disposed = false;

  constructor(options: WorkerEnvironmentRendererOptions) {
    this.container = options.container;
    this.onSnapshot = options.onSnapshot;
    this.createWorker = options.createWorker ?? createRendererWorker;
    this.supported = supportsWorkerRenderer();
    if (!this.supported) {
      this.phase = "unsupported";
      this.publish();
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.measureViewport());
    this.resizeObserver.observe(this.container);
    this.measureViewport();
    this.publish();
  }

  get snapshot(): WorkerSceneSwitchSnapshot {
    return {
      supported: this.supported,
      active: this.handoff.active?.environment ?? null,
      staging: this.handoff.staging?.environment ?? null,
      phase: this.phase,
      progress: this.progress,
      progressPhase: this.progressPhase,
      liveWorkers: this.slots.size,
      lastError: this.lastError,
      lastMeasurement: this.lastMeasurement,
      history: [...this.history],
    };
  }

  switchTo(environment: WorkerEnvironmentKey): void {
    if (!this.supported || this.disposed) return;
    const decision = requestWorkerEnvironment(this.handoff, environment);
    if (decision.type === "ignored") return;
    this.handoff = decision.state;
    if (decision.type === "cancel") {
      this.destroySlot(decision.dispose.requestId);
      this.endProbe();
      this.phase = "idle";
      this.progress = 1;
      this.progressPhase = null;
      this.publish();
      return;
    }
    if (decision.dispose) this.destroySlot(decision.dispose.requestId);

    this.lastError = null;
    this.progress = 0;
    this.progressPhase = "worker";
    this.phase = "booting";
    this.beginProbe(decision.slot.requestId);
    this.createSlot(decision.slot);
    this.publish();
  }

  setCamera(camera: WorkerCameraSnapshot): void {
    for (const slot of this.slots.values()) {
      this.post(slot, {
        type: "camera",
        requestId: slot.state.requestId,
        camera,
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.endProbe();
    for (const requestId of [...this.slots.keys()]) this.destroySlot(requestId);
    this.handoff = createWorkerRendererHandoffState();
  }

  private createSlot(state: WorkerRendererSlotState): void {
    try {
      const slot = new WorkerRendererSlot({
        container: this.container,
        state,
        viewport: this.viewport,
        camera: CAMERA_BY_ENVIRONMENT[state.environment],
        createWorker: this.createWorker,
        onMessage: (source, message) =>
          this.handleWorkerMessage(source, message),
        onError: (source, message) =>
          this.handleFailure(source.state.requestId, message),
        onDestroyed: (source) => {
          this.slots.delete(source.state.requestId);
        },
      });
      this.slots.set(state.requestId, slot);
    } catch (error) {
      this.handleFailure(
        state.requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleWorkerMessage(
    slot: WorkerRendererSlot,
    message: WorkerRendererOutMessage
  ): void {
    if (message.requestId !== slot.state.requestId) return;
    switch (message.type) {
      case "progress":
        if (this.handoff.staging?.requestId === message.requestId) {
          this.progress = message.fraction;
          this.progressPhase = message.phase;
          this.publish();
        }
        return;
      case "first-frame":
        this.handleFirstFrame(slot, message.metrics);
        return;
      case "frame":
        if (this.handoff.active?.requestId === message.requestId) {
          this.responsiveness.recordOutgoingFrame(message.deltaMs);
        }
        return;
      case "error":
        this.handleFailure(slot.state.requestId, message.message);
        return;
      case "context-lost":
        this.handleFailure(
          slot.state.requestId,
          "Worker WebGL context was lost"
        );
        return;
      case "disposed":
        return;
      case "booting":
        return;
    }
  }

  private handleFirstFrame(
    slot: WorkerRendererSlot,
    workerBoot: WorkerRendererBootMetrics
  ): void {
    const decision = acceptWorkerFirstFrame(this.handoff, slot.state.requestId);
    if (decision.type !== "swap") {
      this.destroySlot(slot.state.requestId);
      return;
    }
    this.handoff = decision.state;
    this.phase = "swapping";
    this.progress = 1;
    this.progressPhase = "handoff";
    const receivedAt = performance.now();
    this.publish();

    requestAnimationFrame(() => {
      if (
        this.disposed ||
        this.handoff.active?.requestId !== slot.state.requestId
      )
        return;
      const outgoing = decision.outgoing
        ? this.slots.get(decision.outgoing.requestId)
        : null;
      slot.show();
      outgoing?.hide();
      const swappedAt = performance.now();
      const probe = this.endProbe();
      const measurement: WorkerSceneSwitchMeasurement = {
        requestId: slot.state.requestId,
        environment: slot.state.environment,
        requestedAt: probe?.requestedAt ?? receivedAt,
        swappedAt,
        clickToSwapMs: swappedAt - (probe?.requestedAt ?? receivedAt),
        workerBoot,
        mainThreadMaxGapMs: probe?.mainThreadMaxGapMs ?? 0,
        mainThreadGapsOver50Ms: probe?.mainThreadGapsOver50Ms ?? 0,
        outgoingWorkerMaxFrameGapMs: probe?.outgoingWorkerMaxFrameGapMs ?? 0,
        handoffDelayMs: swappedAt - receivedAt,
        liveWorkersAtSwap: this.slots.size,
        liveWorkersAfterCleanup: null,
        passedInputGate: (probe?.mainThreadMaxGapMs ?? 0) <= 50,
        passedFrameGate:
          !decision.outgoing ||
          (probe?.outgoingWorkerMaxFrameGapMs ?? Infinity) <= 100,
        passedWorkerBound: this.slots.size <= 2,
      };
      this.lastMeasurement = measurement;
      this.history = [...this.history, measurement].slice(-20);
      this.phase = "idle";
      this.progressPhase = null;
      this.publish();

      requestAnimationFrame(() => {
        if (decision.outgoing) {
          this.destroySlot(decision.outgoing.requestId, () => {
            measurement.liveWorkersAfterCleanup = this.slots.size;
            measurement.passedWorkerBound =
              measurement.passedWorkerBound && this.slots.size === 1;
            this.publish();
          });
        } else {
          measurement.liveWorkersAfterCleanup = this.slots.size;
          this.publish();
        }
      });
    });
  }

  private handleFailure(requestId: number, message: string): void {
    const decision = rejectWorkerEnvironment(this.handoff, requestId);
    if (decision.type === "ignored") {
      this.destroySlot(requestId);
      return;
    }
    this.handoff = decision.state;
    this.lastError = message;
    if (decision.role === "staging") {
      this.endProbe();
      this.phase = "error";
    } else {
      // A context loss in the visible worker must not leave the state pointing
      // at a dead canvas. If a replacement is already booting, let it finish;
      // otherwise expose the failure rather than entering an unbounded restart
      // loop on a device that cannot sustain another WebGL context.
      this.phase = this.handoff.staging ? "booting" : "error";
    }
    this.destroySlot(requestId);
    this.publish();
  }

  private beginProbe(nextRequestId: number): void {
    this.responsiveness.begin(nextRequestId);
  }

  private endProbe() {
    return this.responsiveness.end();
  }

  private measureViewport(): void {
    const rect = this.container.getBoundingClientRect();
    this.viewport = clampWorkerViewport({
      width: rect.width,
      height: rect.height,
      dpr: window.devicePixelRatio,
    });
    for (const slot of this.slots.values()) {
      this.post(slot, {
        type: "resize",
        requestId: slot.state.requestId,
        viewport: this.viewport,
      });
    }
  }

  private post(
    slot: WorkerRendererSlot,
    message: WorkerRendererInMessage
  ): void {
    slot.post(message);
  }

  private destroySlot(requestId: number, after?: () => void): void {
    const slot = this.slots.get(requestId);
    if (!slot) {
      after?.();
      return;
    }
    slot.destroy(after);
  }

  private publish(): void {
    this.onSnapshot?.(this.snapshot);
  }
}
