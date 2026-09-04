import type { WorkerRendererSlotState } from "../domain/worker-renderer-handoff";
import {
  isWorkerRendererOutMessage,
  type WorkerCameraSnapshot,
  type WorkerEffectQualityTier,
  type WorkerRendererInMessage,
  type WorkerRendererOutMessage,
  type WorkerPerformerSnapshot,
  type WorkerSceneEffectsSnapshot,
  type WorkerViewport,
} from "../domain/worker-renderer-protocol";

const WORKER_DISPOSE_GRACE_MS = 100;

export interface WorkerRendererSlotOptions {
  container: HTMLElement;
  state: WorkerRendererSlotState;
  viewport: WorkerViewport;
  camera: WorkerCameraSnapshot;
  qualityTier: WorkerEffectQualityTier;
  performers?: readonly WorkerPerformerSnapshot[];
  effects?: WorkerSceneEffectsSnapshot;
  createWorker: () => Worker;
  onMessage: (
    slot: WorkerRendererSlot,
    message: WorkerRendererOutMessage
  ) => void;
  onError: (slot: WorkerRendererSlot, message: string) => void;
  onDestroyed: (slot: WorkerRendererSlot) => void;
}

function styleCanvas(canvas: HTMLCanvasElement): void {
  canvas.className = "worker-environment-renderer__canvas";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.opacity = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "0";
  canvas.setAttribute("aria-hidden", "true");
}

/**
 * Owns one transferred canvas and its worker from construction through the
 * bounded graceful-dispose window. The handoff controller owns which slot is
 * active; this class owns making each individual slot impossible to reuse or
 * destroy twice.
 */
export class WorkerRendererSlot {
  readonly state: WorkerRendererSlotState;
  readonly canvas: HTMLCanvasElement;
  private readonly worker: Worker;
  private readonly onDestroyed: (slot: WorkerRendererSlot) => void;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly afterDestroy = new Set<() => void>();

  constructor(options: WorkerRendererSlotOptions) {
    this.state = options.state;
    this.onDestroyed = options.onDestroyed;
    this.canvas = document.createElement("canvas");
    styleCanvas(this.canvas);
    options.container.append(this.canvas);

    try {
      this.worker = options.createWorker();
      this.worker.onmessage = (event: MessageEvent<unknown>) => {
        if (!isWorkerRendererOutMessage(event.data)) return;
        if (event.data.requestId !== this.state.requestId) return;
        if (event.data.type === "disposed") {
          this.finishDestroy();
          return;
        }
        options.onMessage(this, event.data);
      };
      this.worker.onerror = (event) => {
        options.onError(this, event.message || "Worker renderer failed");
      };

      const offscreen = this.canvas.transferControlToOffscreen();
      const message: WorkerRendererInMessage = {
        type: "initialize",
        requestId: this.state.requestId,
        canvas: offscreen,
        environment: this.state.environment,
        viewport: options.viewport,
        camera: options.camera,
        qualityTier: options.qualityTier,
        performers: options.performers ?? [],
        effects: options.effects,
      };
      this.worker.postMessage(message, [offscreen]);
    } catch (error) {
      this.canvas.remove();
      throw error;
    }
  }

  post(message: WorkerRendererInMessage): void {
    if (!this.destroyed) this.worker.postMessage(message);
  }

  show(): void {
    this.canvas.style.opacity = "1";
    this.canvas.style.zIndex = "1";
  }

  hide(): void {
    this.canvas.style.opacity = "0";
    this.canvas.style.zIndex = "0";
  }

  destroy(after?: () => void): void {
    if (after) this.afterDestroy.add(after);
    if (this.destroyed) {
      this.flushAfterDestroy();
      return;
    }
    if (this.cleanupTimer !== null) return;

    this.post({ type: "dispose", requestId: this.state.requestId });
    this.cleanupTimer = setTimeout(
      () => this.finishDestroy(),
      WORKER_DISPOSE_GRACE_MS
    );
  }

  terminate(after?: () => void): void {
    if (after) this.afterDestroy.add(after);
    this.finishDestroy();
  }

  private finishDestroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    this.worker.terminate();
    this.canvas.remove();
    this.onDestroyed(this);
    this.flushAfterDestroy();
  }

  private flushAfterDestroy(): void {
    for (const callback of this.afterDestroy) callback();
    this.afterDestroy.clear();
  }
}
