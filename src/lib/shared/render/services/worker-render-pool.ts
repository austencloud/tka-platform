import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { LayerRenderOptions, LayerVisibility } from "./contracts/types";
import type {
  WorkerInMessage,
  WorkerOutMessage,
  RenderResultMessage,
  ErrorMessage,
} from "../workers/pictograph-render.worker";
import { supportsWorkerRendering } from "./render-factory";
import type { LayerCompositor } from './layer-compositor';

interface PendingRender {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
}

interface WorkerEntry {
  worker: Worker;
  ready: boolean;
  pendingCount: number;
}

export class WorkerRenderPool {
  private workers: WorkerEntry[] = [];
  private pendingRenders = new Map<number, PendingRender>();
  private nextRequestId = 0;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private useWorkers: boolean;
  private terminated = false;

  private fallbackCompositor: InstanceType<typeof LayerCompositor> | null = null;

  constructor() {
    this.useWorkers = supportsWorkerRendering();
  }

  isUsingWorkers(): boolean {
    return this.useWorkers && !this.terminated;
  }

  async render(
    preparedData: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber?: number
  ): Promise<Blob> {
    if (this.terminated) {
      throw new Error("WorkerRenderPool has been terminated");
    }

    await this.ensureInitialized();

    if (this.useWorkers && this.workers.length > 0) {
      try {
        return await this.renderOnWorker(preparedData, options, visibility, stepNumber);
      } catch {
        return this.renderOnMainThread(preparedData, options, visibility, stepNumber);
      }
    }

    return this.renderOnMainThread(preparedData, options, visibility, stepNumber);
  }

  terminate(): void {
    this.terminated = true;
    for (const entry of this.workers) {
      entry.worker.terminate();
    }
    this.workers = [];

    for (const [, pending] of this.pendingRenders) {
      pending.reject(new Error("Worker pool terminated"));
    }
    this.pendingRenders.clear();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (this.initializing) {
      await this.initializing;
      return;
    }

    this.initializing = this.doInitialize();
    await this.initializing;
    this.initializing = null;
  }

  private async doInitialize(): Promise<void> {
    if (!this.useWorkers) {
      this.initialized = true;
      return;
    }

    try {
      const poolSize = Math.min(navigator.hardwareConcurrency || 2, 4);

      const workerEntries: WorkerEntry[] = [];
      const initPromises: Promise<void>[] = [];

      for (let i = 0; i < poolSize; i++) {
        try {
          const worker = new Worker(
            new URL("../../workers/pictograph-render.worker.ts", import.meta.url),
            { type: "module" }
          );

          const entry: WorkerEntry = {
            worker,
            ready: false,
            pendingCount: 0,
          };

          worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
            this.handleWorkerMessage(event.data);
          };

          workerEntries.push(entry);

          const initPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Worker ${i} init timeout (10s)`));
            }, 10000);

            worker.onerror = (error) => {
              clearTimeout(timeout);
              reject(new Error(`Worker ${i} module error: ${error.message}`));
            };

            const originalHandler = worker.onmessage;
            worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
              if (event.data.type === "init-done") {
                clearTimeout(timeout);
                entry.ready = true;
                worker.onmessage = originalHandler;
                worker.onerror = null;
                resolve();
              } else if (event.data.type === "error") {
                clearTimeout(timeout);
                worker.onmessage = originalHandler;
                worker.onerror = null;
                reject(new Error((event.data as ErrorMessage).message));
              }
            };

            const initMsg: WorkerInMessage = { type: "init" };
            worker.postMessage(initMsg);
          });

          initPromises.push(initPromise);
        } catch (error) {
          console.warn(`[WorkerRenderPool] Failed to create worker ${i}:`, error);
        }
      }

      const results = await Promise.allSettled(initPromises);

      for (let i = 0; i < workerEntries.length; i++) {
        const result = results[i];
        if (result?.status === "fulfilled") {
          this.workers.push(workerEntries[i]!);
        } else {
          workerEntries[i]?.worker.terminate();
          const reason = result?.status === "rejected" ? result.reason : "unknown";
          console.warn(`[WorkerRenderPool] Worker ${i} failed to initialize:`, reason);
        }
      }

      if (this.workers.length === 0) {
        console.warn("[WorkerRenderPool] No workers initialized, falling back to main thread");
        this.useWorkers = false;
      } else {
        for (const entry of this.workers) {
          entry.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
            this.handleWorkerMessage(event.data);
          };
        }
      }
    } catch (error) {
      console.warn("[WorkerRenderPool] Worker pool creation failed, falling back to main thread:", error);
      this.useWorkers = false;
    }

    this.initialized = true;
  }

  private renderOnWorker(
    preparedData: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber?: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;

      this.pendingRenders.set(id, { resolve, reject });

      const worker = this.pickWorker();
      worker.pendingCount++;

      const msg: WorkerInMessage = JSON.parse(JSON.stringify({
        type: "render",
        id,
        preparedData,
        options,
        visibility,
        stepNumber,
      }));

      worker.worker.postMessage(msg);
    });
  }

  private pickWorker(): WorkerEntry {
    let bestEntry = this.workers[0]!;
    let bestCount = bestEntry.pendingCount;

    for (let i = 1; i < this.workers.length; i++) {
      const entry = this.workers[i]!;
      if (entry.pendingCount < bestCount) {
        bestEntry = entry;
        bestCount = entry.pendingCount;
      }
    }

    return bestEntry;
  }

  private handleWorkerMessage(msg: WorkerOutMessage): void {
    switch (msg.type) {
      case "render-result": {
        const result = msg as RenderResultMessage;
        const pending = this.pendingRenders.get(result.id);
        if (pending) {
          this.pendingRenders.delete(result.id);
          this.decrementPendingCount();
          pending.resolve(result.blob);
        }
        break;
      }

      case "error": {
        const error = msg as ErrorMessage;
        const pending = this.pendingRenders.get(error.id);
        if (pending) {
          this.pendingRenders.delete(error.id);
          this.decrementPendingCount();
          pending.reject(new Error(error.message));
        }
        break;
      }
    }
  }

  private decrementPendingCount(): void {
    let maxEntry: WorkerEntry | null = null;
    let maxCount = 0;
    for (const entry of this.workers) {
      if (entry.pendingCount > maxCount) {
        maxEntry = entry;
        maxCount = entry.pendingCount;
      }
    }
    if (maxEntry && maxEntry.pendingCount > 0) {
      maxEntry.pendingCount--;
    }
  }

  private async renderOnMainThread(
    preparedData: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber?: number
  ): Promise<Blob> {
    if (!this.fallbackCompositor) {
      const { LayerCompositor } = await import("./layer-compositor");
      this.fallbackCompositor = new LayerCompositor();
    }

    const result = await this.fallbackCompositor.compose(
      preparedData,
      options,
      visibility,
      stepNumber
    );

    const canvas = result.canvas;
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: "image/png" });
    }

    return new Promise((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
        "image/png"
      );
    });
  }
}

let poolInstance: WorkerRenderPool | null = null;

export function getWorkerRenderPool(): WorkerRenderPool {
  if (!poolInstance) {
    poolInstance = new WorkerRenderPool();
  }
  return poolInstance;
}
