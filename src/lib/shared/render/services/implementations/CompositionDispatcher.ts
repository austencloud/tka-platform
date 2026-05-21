// src/lib/shared/render/services/implementations/CompositionDispatcher.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { CompositionProgressCallback, RenderCanvas } from "../contracts/types";
import type { ImageComposer } from "./ImageComposer";
import type { TextRenderer } from "./TextRenderer";
import { convertGlyphCacheToBitmaps } from "./glyph-bitmap-loader";

// ---- Protocol types (shared with composition.worker.ts) ----

export interface GlyphTransferEntry {
  letter: string;
  naturalWidth: number;
  naturalHeight: number;
  isDash: boolean;
}

export type CompositionWorkerInMessage =
  | { type: "init"; glyphs: ImageBitmap[]; glyphMeta: GlyphTransferEntry[] }
  | {
      type: "compose";
      id: number;
      sequence: SequenceData;
      options: Partial<SequenceExportOptions>;
      qrBitmap: ImageBitmap | null;
    }
  | { type: "cancel"; id: number };

export type CompositionWorkerOutMessage =
  | { type: "init-done" }
  | { type: "result"; id: number; bitmap: ImageBitmap }
  | { type: "progress"; id: number; current: number; total: number; stage: string }
  | { type: "error"; id: number; message: string };

// ---- Pool management ----

interface WorkerEntry {
  worker: Worker;
  ready: boolean;
  pendingCount: number;
}

interface PendingRequest {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  onProgress?: CompositionProgressCallback;
  signal?: AbortSignal;
  abortHandler?: () => void;
  workerEntry: WorkerEntry;
}

const POOL_SIZE = Math.max(1, Math.min((navigator?.hardwareConcurrency || 4) - 1, 4));
const INIT_TIMEOUT_MS = 15_000;

export class CompositionDispatcher {
  private workers: WorkerEntry[] = [];
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();

  private static workerSupport: boolean | null = null;

  constructor(
    private readonly imageComposer: ImageComposer,
    private readonly textRenderer: TextRenderer,
  ) {}

  static canUseWorker(): boolean {
    if (CompositionDispatcher.workerSupport !== null) {
      return CompositionDispatcher.workerSupport;
    }
    CompositionDispatcher.workerSupport = CompositionDispatcher.detectWorkerSupport();
    return CompositionDispatcher.workerSupport;
  }

  private static detectWorkerSupport(): boolean {
    // Workers disabled: the render pipeline imports SvelteKit-only modules
    // ($env/dynamic/public, Firebase auth → window) that crash in Worker scope.
    // Main-thread rendering works identically (same ImageComposer path) and
    // is proven reliable via the print-preview pipeline.
    return false;
  }

  async compose(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob> {
    if (CompositionDispatcher.canUseWorker()) {
      try {
        return await this.composeOnWorker(sequence, options, onProgress, signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        console.warn("[CompositionDispatcher] Worker failed, falling back to main thread:", error);
        return this.composeOnMainThread(sequence, options, onProgress, signal);
      }
    }
    return this.composeOnMainThread(sequence, options, onProgress, signal);
  }

  // ---- Worker path ----

  private async composeOnWorker(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob> {
    await this.ensureInitialized();

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const id = this.nextRequestId++;
    const worker = this.pickWorker();
    worker.pendingCount++;

    const qrBitmap: ImageBitmap | null = null;

    return new Promise<Blob>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject, onProgress, signal, workerEntry: worker };

      if (signal) {
        pending.abortHandler = () => {
          worker.worker.postMessage({ type: "cancel", id } satisfies CompositionWorkerInMessage);
        };
        signal.addEventListener("abort", pending.abortHandler, { once: true });
      }

      this.pendingRequests.set(id, pending);

      const plainSequence = JSON.parse(JSON.stringify(sequence));
      const plainOptions = JSON.parse(JSON.stringify(options));

      const transferList: Transferable[] = [];
      if (qrBitmap) transferList.push(qrBitmap);

      const message: CompositionWorkerInMessage = {
        type: "compose",
        id,
        sequence: plainSequence,
        options: plainOptions,
        qrBitmap,
      };

      worker.worker.postMessage(message, transferList);
    });
  }

  private handleWorkerMessage(data: CompositionWorkerOutMessage): void {
    if (data.type === "init-done") return;

    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    if (data.type === "progress") {
      pending.onProgress?.({
        current: data.current,
        total: data.total,
        stage: data.stage as "preparing" | "rendering" | "finalizing",
      });
      return;
    }

    // Terminal messages — clean up
    this.pendingRequests.delete(data.id);
    if (pending.signal && pending.abortHandler) {
      pending.signal.removeEventListener("abort", pending.abortHandler);
    }
    pending.workerEntry.pendingCount--;

    if (data.type === "result") {
      const canvas = new OffscreenCanvas(data.bitmap.width, data.bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(data.bitmap, 0, 0);
      data.bitmap.close();

      canvas.convertToBlob({ type: "image/webp", quality: 0.9 }).then(
        (blob) => pending.resolve(blob),
        (err) => pending.reject(err instanceof Error ? err : new Error(String(err))),
      );
    } else if (data.type === "error") {
      if (data.message.includes("AbortError") || data.message.includes("cancelled")) {
        pending.reject(new DOMException(data.message, "AbortError"));
      } else {
        pending.reject(new Error(data.message));
      }
    }
  }

  // ---- Main-thread fallback path ----

  private async composeOnMainThread(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const canvas: RenderCanvas = options.cardMode
      ? await this.imageComposer.composeCardImage(sequence, options, onProgress, signal)
      : await this.imageComposer.composeSequenceImage(sequence, options, onProgress, signal);

    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
    }
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/webp",
        0.9,
      );
    });
  }

  // ---- Pool lifecycle ----

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initPool();
    await this.initializing;
  }

  private async initPool(): Promise<void> {
    await this.textRenderer.preloadGlyphImages();
    const glyphEntries = await convertGlyphCacheToBitmaps(
      this.textRenderer.getGlyphCache(),
    );

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      try {
        const worker = new Worker(
          new URL("../../workers/composition.worker.ts", import.meta.url),
          { type: "module" },
        );

        const entry: WorkerEntry = { worker, ready: false, pendingCount: 0 };

        worker.onerror = (err) => {
          console.error(`[CompositionDispatcher] Worker ${i} error:`, err);
        };

        this.workers.push(entry);

        const initPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Worker ${i} init timeout`)),
            INIT_TIMEOUT_MS,
          );

          const initHandler = (event: MessageEvent<CompositionWorkerOutMessage>) => {
            if (event.data.type === "init-done") {
              clearTimeout(timeout);
              entry.ready = true;
              // Switch to the normal message handler
              worker.onmessage = (ev: MessageEvent<CompositionWorkerOutMessage>) => {
                this.handleWorkerMessage(ev.data);
              };
              resolve();
            }
          };
          worker.onmessage = initHandler;
        });

        initPromises.push(initPromise);

        // Clone glyph bitmaps for each worker (transfer consumes the original)
        const clonedBitmaps = await Promise.all(
          glyphEntries.map(async (e) => createImageBitmap(e.bitmap)),
        );

        const glyphMeta: GlyphTransferEntry[] = glyphEntries.map((e) => ({
          letter: e.letter,
          naturalWidth: e.naturalWidth,
          naturalHeight: e.naturalHeight,
          isDash: e.isDash,
        }));

        const initMessage: CompositionWorkerInMessage = {
          type: "init",
          glyphs: clonedBitmaps,
          glyphMeta,
        };

        worker.postMessage(initMessage, clonedBitmaps);
      } catch (err) {
        console.error(`[CompositionDispatcher] Failed to create worker ${i}:`, err);
      }
    }

    await Promise.allSettled(initPromises);

    // Close the source glyph bitmaps — workers have their own clones
    for (const entry of glyphEntries) {
      entry.bitmap.close();
    }

    this.initialized = true;
    this.initializing = null;
  }

  private pickWorker(): WorkerEntry {
    let best = this.workers[0]!;
    for (const entry of this.workers) {
      if (entry.ready && entry.pendingCount < best.pendingCount) {
        best = entry;
      }
    }
    return best;
  }

  terminate(): void {
    for (const entry of this.workers) {
      entry.worker.terminate();
    }
    this.workers = [];
    this.initialized = false;
    this.initializing = null;

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error("Dispatcher terminated"));
    }
    this.pendingRequests.clear();
  }
}
