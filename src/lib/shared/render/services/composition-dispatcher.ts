// src/lib/shared/render/services/implementations/CompositionDispatcher.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";
import type { CompositionProgressCallback, RenderCanvas } from "./types";
import type { ImageComposer } from "./image-composer";
import type { TextRenderer } from "./text-renderer";
import { convertGlyphCacheToBitmaps } from "./glyph-bitmap-loader";
import { bundleTransferables } from "./card-asset-bundle";

// ---- Protocol types (shared with composition.worker.ts) ----

export interface GlyphTransferEntry {
  letter: string;
  naturalWidth: number;
  naturalHeight: number;
  isDash: boolean;
}

export type CompositionWorkerInMessage =
  | {
      type: "init";
      glyphs: ImageBitmap[];
      glyphMeta: GlyphTransferEntry[];
      bundle: import("./card-asset-bundle").AssetBundle;
      overrideBundle: import("./override-placement-bundle").OverridePlacementBundle;
    }
  | {
      type: "compose";
      id: number;
      sequence: SequenceData;
      options: Partial<SequenceExportOptions>;
      qrBitmap: ImageBitmap | null;
    }
  | { type: "cancel"; id: number }
  | { type: "probe" };

export type CompositionWorkerOutMessage =
  | { type: "init-done" }
  | { type: "result"; id: number; bitmap: ImageBitmap }
  | { type: "progress"; id: number; current: number; total: number; stage: string }
  | { type: "error"; id: number; message: string }
  | { type: "probe-result"; ok: boolean; error?: string };

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
  // When set, the `result` branch resolves the raw inner ImageBitmap directly
  // (no webp Blob conversion, no bitmap close — the caller owns it). Used by
  // composeFrontBitmap so the main thread keeps the cheap stripe/bleed wrap.
  resolveBitmap?: (bitmap: ImageBitmap) => void;
}

// One in-flight 1644x2244 RGBA card canvas per worker ≈ 14.7 MB. Reserve a core
// for the main thread and cap at 8 — past ~8 the seed/memory cost outweighs the
// throughput gain (a 32-core box would otherwise spawn 31 workers ≈ 455 MB).
export function computePoolSize(hardwareConcurrency: number | undefined): number {
  const cores = hardwareConcurrency || 4;
  return Math.max(2, Math.min(cores - 1, 8));
}

const POOL_SIZE = computePoolSize(
  typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined,
);
const INIT_TIMEOUT_MS = 15_000;

export class CompositionDispatcher {
  private workers: WorkerEntry[] = [];
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private pendingBundle: import("./card-asset-bundle").AssetBundle | null = null;
  private pendingOverrideBundle: import("./override-placement-bundle").OverridePlacementBundle | null = null;
  private pendingSignature: string | null = null;
  private seededSignature: string | null = null;
  // Open while a pre-warm builds its asset bundle. ensureInitialized awaits it so
  // a composeFrontBitmap that races in during the build can't seed the pool empty.
  private seedGate: Promise<void> | null = null;

  private static workerSupport: boolean | null = null;
  private static probing: Promise<boolean> | null = null;

  constructor(
    private readonly imageComposer: ImageComposer,
    private readonly textRenderer: TextRenderer,
  ) {}

  /** Set the AssetBundle seeded into each worker's SVG caches at init time. */
  setAssetBundle(bundle: import("./card-asset-bundle").AssetBundle): void {
    this.pendingBundle = bundle;
  }

  /** Set the override placement bundle seeded into each worker at init. */
  setOverrideBundle(bundle: import("./override-placement-bundle").OverridePlacementBundle): void {
    this.pendingOverrideBundle = bundle;
  }

  /** Record the bundle signature that the next initPool will mark as seeded. */
  setPendingSignature(signature: string): void {
    this.pendingSignature = signature;
  }

  /** The signature of the bundle the pool is currently seeded with (null if unseeded). */
  getSeededSignature(): string | null {
    return this.seededSignature;
  }

  /**
   * Reserve an upcoming seed. Called SYNCHRONOUSLY by prewarmCardPool BEFORE its
   * async asset-bundle build, so any composeFrontBitmap that races in during the
   * build waits (via the seed gate in ensureInitialized) for the real bundle
   * instead of seeding the pool empty. A signature change tears down the stale
   * pool. Returns a resolver to call once the bundle has been set (or the build
   * failed) — it opens the gate so waiters proceed.
   */
  beginSeed(signature: string): () => void {
    this.pendingSignature = signature;
    if (this.seededSignature !== null && this.seededSignature !== signature) {
      this.terminate();
    }
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    this.seedGate = gate;
    return () => {
      resolve();
      // Only clear if still our gate — a later beginSeed may have replaced it.
      if (this.seedGate === gate) this.seedGate = null;
    };
  }

  static canUseWorker(): boolean {
    // Returns the cached probe result. `false` until probeWorkerSupport() has
    // run and confirmed the worker can boot + paint. A later task wires the
    // probe call at the dispatch call site.
    return CompositionDispatcher.workerSupport === true;
  }

  /**
   * Probe-once worker capability check. Boots a throwaway worker and verifies
   * it can paint an SVG-free back job end to end (init → OffscreenCanvas →
   * paint → transfer). Caches the result so subsequent calls are free.
   */
  static async probeWorkerSupport(): Promise<boolean> {
    if (CompositionDispatcher.workerSupport !== null) return CompositionDispatcher.workerSupport;
    // In-flight dedup: concurrent callers share the single probe in progress
    // (mirrors the `initializing` guard) instead of each spawning a worker.
    if (CompositionDispatcher.probing) return CompositionDispatcher.probing;
    CompositionDispatcher.probing = (async () => {
      try {
        if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
          return (CompositionDispatcher.workerSupport = false);
        }
        try {
          const ok = await CompositionDispatcher.runProbe();
          return (CompositionDispatcher.workerSupport = ok);
        } catch {
          return (CompositionDispatcher.workerSupport = false);
        }
      } finally {
        CompositionDispatcher.probing = null;
      }
    })();
    return CompositionDispatcher.probing;
  }

  // Bootstraps via the SVG-free back paint path: a minimal proof-mode BackJob
  // needs NO seeded bundle (mandala null, decorations null), so it verifies
  // init -> OffscreenCanvas -> paint -> transfer end to end.
  private static runProbe(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const w = new Worker(new URL("../workers/composition.worker.ts", import.meta.url), {
        type: "module",
      });
      const timeout = setTimeout(() => {
        console.warn("[CompositionDispatcher] worker probe timed out");
        w.terminate();
        resolve(false);
      }, 8000);
      w.onerror = (err) => {
        console.warn("[CompositionDispatcher] worker probe errored:", err);
        clearTimeout(timeout);
        w.terminate();
        resolve(false);
      };
      w.onmessage = (e: MessageEvent) => {
        const d = e.data as CompositionWorkerOutMessage;
        if (d?.type === "probe-result") {
          clearTimeout(timeout);
          w.terminate();
          if (!d.ok) {
            console.warn(
              "[CompositionDispatcher] worker probe failed:",
              d.error ?? "(no detail)",
            );
          }
          resolve(!!d.ok);
        }
      };
      w.postMessage({ type: "probe" } satisfies CompositionWorkerInMessage);
    });
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

  /**
   * Compose the front pictograph composite on a pool worker and return the raw
   * inner sequence ImageBitmap. The worker runs the same composeSequenceImage
   * path; the main thread keeps the cheap, deterministic stripe/bleed wrap.
   * The caller owns (and must dispose of) the returned bitmap.
   */
  async composeFrontBitmap(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    qrBitmap: ImageBitmap | null = null,
    signal?: AbortSignal,
    onProgress?: CompositionProgressCallback,
  ): Promise<ImageBitmap> {
    await this.ensureInitialized();

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const id = this.nextRequestId++;
    const worker = this.pickWorker();
    worker.pendingCount++;

    return new Promise<ImageBitmap>((resolve, reject) => {
      const pending: PendingRequest = {
        resolve: () => {}, // unused for the bitmap path
        reject,
        onProgress,
        signal,
        workerEntry: worker,
        resolveBitmap: resolve,
      };

      if (signal) {
        pending.abortHandler = () => {
          worker.worker.postMessage({ type: "cancel", id } satisfies CompositionWorkerInMessage);
        };
        signal.addEventListener("abort", pending.abortHandler, { once: true });
      }

      this.pendingRequests.set(id, pending);

      const plainSequence = JSON.parse(JSON.stringify(sequence));
      const plainOptions = JSON.parse(JSON.stringify(options));

      const message: CompositionWorkerInMessage = {
        type: "compose",
        id,
        sequence: plainSequence,
        options: plainOptions,
        qrBitmap,
      };

      worker.worker.postMessage(message, qrBitmap ? [qrBitmap] : []);
    });
  }

  private handleWorkerMessage(data: CompositionWorkerOutMessage): void {
    // init-done is handled during init; probe-result is only seen by the
    // throwaway probe worker, never the pool — both lack a request id.
    if (data.type === "init-done" || data.type === "probe-result") return;

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
      // Bitmap path (composeFrontBitmap): hand the raw inner bitmap to the
      // caller without webp conversion. Cleanup above already ran. The caller
      // owns the bitmap, so do NOT close it here.
      if (pending.resolveBitmap) {
        pending.resolveBitmap(data.bitmap);
        return;
      }
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

  async ensureInitialized(): Promise<void> {
    // If a pre-warm is mid-flight (building its bundle), wait for it to set the
    // bundle before seeding — otherwise this call would seed the pool empty and
    // cache asset-less renders. The gate opens once prewarm has set the bundle.
    if (this.seedGate) await this.seedGate;
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
    console.log("[CompositionDispatcher] initPool glyphEntries:", glyphEntries.length, "bundle keys:", this.pendingBundle?.keys.length ?? 0, "grids:", this.pendingBundle ? Object.values(this.pendingBundle.grids).filter(Boolean).length : 0);

    const glyphMeta: GlyphTransferEntry[] = glyphEntries.map((e) => ({
      letter: e.letter,
      naturalWidth: e.naturalWidth,
      naturalHeight: e.naturalHeight,
      isDash: e.isDash,
    }));

    // Spawn + seed every worker concurrently. `transfer` detaches the source
    // bitmaps, so each worker needs its own clone; running the N clone-sets in
    // parallel (instead of awaiting each inside a serial loop) is what turns the
    // ~3.7s seed into a sub-second one.
    const spawnWorker = async (i: number): Promise<void> => {
      try {
        const worker = new Worker(
          new URL("../workers/composition.worker.ts", import.meta.url),
          { type: "module" },
        );

        const entry: WorkerEntry = { worker, ready: false, pendingCount: 0 };
        worker.onerror = (err) => {
          console.error(`[CompositionDispatcher] Worker ${i} error:`, err);
        };
        this.workers.push(entry);

        const ready = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Worker ${i} init timeout`)),
            INIT_TIMEOUT_MS,
          );
          worker.onmessage = (event: MessageEvent<CompositionWorkerOutMessage>) => {
            if (event.data.type === "init-done") {
              clearTimeout(timeout);
              entry.ready = true;
              worker.onmessage = (ev: MessageEvent<CompositionWorkerOutMessage>) =>
                this.handleWorkerMessage(ev.data);
              resolve();
            }
          };
        });

        // Clone glyph bitmaps for this worker (transfer consumes the original).
        const clonedBitmaps = await Promise.all(
          glyphEntries.map((e) => createImageBitmap(e.bitmap)),
        );

        // Clone the AssetBundle per worker. Empty bundle when none was set —
        // the worker simply seeds nothing.
        const bundle = this.pendingBundle;
        let bundleClone: import("./card-asset-bundle").AssetBundle = {
          keys: [],
          bitmaps: [],
          grids: { diamond: null, box: null, diamondNonRadial: null, boxNonRadial: null },
          icons: [],
        };
        if (bundle) {
          const clonedBmps = await Promise.all(
            bundle.bitmaps.map((b) => createImageBitmap(b)),
          );
          type GridSlot = import("./card-asset-bundle").AssetBundle["grids"]["diamond"];
          const cloneGrid = async (g: GridSlot): Promise<ImageBitmap | null> =>
            g ? await createImageBitmap(g as ImageBitmapSource) : null;
          // Clone footer icons per worker (transfer detaches the source).
          const clonedIcons = await Promise.all(
            bundle.icons.map(async (icon) => ({
              path: icon.path,
              bitmap: await createImageBitmap(icon.bitmap),
            })),
          );
          bundleClone = {
            keys: [...bundle.keys],
            bitmaps: clonedBmps,
            grids: {
              diamond: await cloneGrid(bundle.grids.diamond),
              box: await cloneGrid(bundle.grids.box),
              diamondNonRadial: await cloneGrid(bundle.grids.diamondNonRadial),
              boxNonRadial: await cloneGrid(bundle.grids.boxNonRadial),
            },
            icons: clonedIcons,
          };
        }

        const initMessage: CompositionWorkerInMessage = {
          type: "init",
          glyphs: clonedBitmaps,
          glyphMeta,
          bundle: bundleClone,
          overrideBundle: this.pendingOverrideBundle ?? { default: [], special: [], global: [], propGeometry: [] },
        };
        worker.postMessage(initMessage, [
          ...clonedBitmaps,
          ...bundleTransferables(bundleClone),
        ]);

        await ready;
      } catch (err) {
        console.error(`[CompositionDispatcher] Failed to create worker ${i}:`, err);
      }
    };

    await Promise.all(Array.from({ length: POOL_SIZE }, (_, i) => spawnWorker(i)));

    // Close the source glyph bitmaps — workers have their own clones
    for (const entry of glyphEntries) {
      entry.bitmap.close();
    }

    this.initialized = true;
    this.initializing = null;
    this.seededSignature = this.pendingSignature;
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
    this.seededSignature = null;

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error("Dispatcher terminated"));
    }
    this.pendingRequests.clear();
  }
}
