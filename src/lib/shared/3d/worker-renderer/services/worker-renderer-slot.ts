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

export interface WorkerRendererSlotStart {
  state: WorkerRendererSlotState;
  viewport: WorkerViewport;
  camera: WorkerCameraSnapshot;
  qualityTier: WorkerEffectQualityTier;
  performers?: readonly WorkerPerformerSnapshot[];
  effects?: WorkerSceneEffectsSnapshot;
}

export interface WorkerRendererSlotOptions extends WorkerRendererSlotStart {
  container: HTMLElement;
  createWorker: () => Worker;
  onMessage: (
    slot: WorkerRendererSlot,
    message: WorkerRendererOutMessage
  ) => void;
  onError: (slot: WorkerRendererSlot, message: string) => void;
  onDestroyed: (slot: WorkerRendererSlot) => void;
}

function styleRenderCanvas(canvas: HTMLCanvasElement): void {
  canvas.className = "worker-environment-renderer__canvas";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.opacity = "1";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1";
  canvas.setAttribute("aria-hidden", "true");
}

function stylePosterCanvas(canvas: HTMLCanvasElement): void {
  canvas.className = "worker-environment-renderer__poster";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.opacity = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2";
  canvas.setAttribute("aria-hidden", "true");
}

/**
 * Owns one permanent transferred canvas, worker, and WebGL context. Scene
 * switches reuse that session and place a bitmap copy of the outgoing frame on
 * a separate canvas. If the WebGL context fails, restart() replaces only the
 * render canvas and worker while the poster keeps the last good frame visible.
 */
export class WorkerRendererSlot {
  state: WorkerRendererSlotState;
  canvas: HTMLCanvasElement;
  readonly posterCanvas: HTMLCanvasElement;
  private worker: Worker | null = null;
  private readonly container: HTMLElement;
  private readonly createWorker: () => Worker;
  private readonly onMessage: WorkerRendererSlotOptions["onMessage"];
  private readonly onError: WorkerRendererSlotOptions["onError"];
  private readonly onDestroyed: WorkerRendererSlotOptions["onDestroyed"];
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly afterDestroy = new Set<() => void>();

  constructor(options: WorkerRendererSlotOptions) {
    this.state = options.state;
    this.container = options.container;
    this.createWorker = options.createWorker;
    this.onMessage = options.onMessage;
    this.onError = options.onError;
    this.onDestroyed = options.onDestroyed;
    this.canvas = document.createElement("canvas");
    this.posterCanvas = document.createElement("canvas");
    styleRenderCanvas(this.canvas);
    stylePosterCanvas(this.posterCanvas);
    this.container.append(this.canvas, this.posterCanvas);
    this.start(options);
  }

  get isLive(): boolean {
    return this.worker !== null && !this.destroyed;
  }

  get isPosterVisible(): boolean {
    return this.posterCanvas.style.opacity === "1";
  }

  post(
    message: WorkerRendererInMessage,
    transfer: Transferable[] = []
  ): void {
    if (!this.destroyed) this.worker?.postMessage(message, transfer);
  }

  installPoster(bitmap: ImageBitmap): void {
    if (this.destroyed) {
      bitmap.close();
      return;
    }

    const bitmapContext = this.posterCanvas.getContext("bitmaprenderer");
    if (bitmapContext) {
      bitmapContext.transferFromImageBitmap(bitmap);
    } else {
      const context = this.posterCanvas.getContext("2d");
      if (!context) {
        bitmap.close();
        throw new Error("Bitmap poster canvas is unavailable");
      }
      if (this.posterCanvas.width !== bitmap.width) {
        this.posterCanvas.width = bitmap.width;
      }
      if (this.posterCanvas.height !== bitmap.height) {
        this.posterCanvas.height = bitmap.height;
      }
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
    }
    this.posterCanvas.style.opacity = "1";
  }

  clearPoster(): void {
    this.posterCanvas.style.opacity = "0";
  }

  /**
   * Context loss is the exceptional restart path. The poster is deliberately
   * left alone while a fresh transferred canvas replaces the failed one.
   */
  restart(start: WorkerRendererSlotStart): void {
    if (this.destroyed) return;
    this.stopWorker();
    this.canvas.remove();
    this.state = start.state;
    this.canvas = document.createElement("canvas");
    styleRenderCanvas(this.canvas);
    this.container.insertBefore(this.canvas, this.posterCanvas);
    this.start(start);
  }

  suspend(): void {
    if (this.destroyed) return;
    this.stopWorker();
    this.canvas.remove();
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

  private start(start: WorkerRendererSlotStart): void {
    try {
      const worker = this.createWorker();
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (!isWorkerRendererOutMessage(event.data)) return;
        if (event.data.type === "disposed") {
          this.finishDestroy();
          return;
        }
        this.onMessage(this, event.data);
      };
      worker.onerror = (event) => {
        this.onError(this, event.message || "Worker renderer failed");
      };

      const offscreen = this.canvas.transferControlToOffscreen();
      const message: WorkerRendererInMessage = {
        type: "initialize",
        requestId: start.state.requestId,
        canvas: offscreen,
        environment: start.state.environment,
        viewport: start.viewport,
        camera: start.camera,
        qualityTier: start.qualityTier,
        performers: start.performers ?? [],
        effects: start.effects,
      };
      worker.postMessage(message, [offscreen]);
    } catch (error) {
      this.stopWorker();
      this.canvas.remove();
      if (!this.isPosterVisible) this.posterCanvas.remove();
      throw error;
    }
  }

  private stopWorker(): void {
    const worker = this.worker;
    this.worker = null;
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }

  private finishDestroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    this.stopWorker();
    this.canvas.remove();
    this.posterCanvas.remove();
    this.onDestroyed(this);
    this.flushAfterDestroy();
  }

  private flushAfterDestroy(): void {
    for (const callback of this.afterDestroy) callback();
    this.afterDestroy.clear();
  }
}
