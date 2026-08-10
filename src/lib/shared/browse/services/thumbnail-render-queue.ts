/**
 * ThumbnailRenderQueue
 *
 * Concurrency limiter for thumbnail rendering.
 * Prevents the "thundering herd" problem where many thumbnails try to render
 * simultaneously, exhaust resources, and create cascading delays.
 *
 * Features:
 * - Limits concurrent renders (default: 3)
 * - Queues excess requests
 * - Deduplicates identical requests
 * - Supports cancellation
 */

export interface QueueStats {
  /** Number of tasks waiting in queue */
  queued: number;

  /** Number of tasks currently executing */
  active: number;

  /** IDs of currently executing tasks */
  activeIds: string[];
}

interface QueuedTask<T> {
  id: string;
  execute: (signal: AbortSignal) => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
}

// A QR-bearing thumbnail also warms its canonical scan cells before composing.
// Three active jobs keep that network and raster work below the timeout's
// contention cliff while queued cards remain priority ordered.
const DEFAULT_MAX_CONCURRENT = 3;

// If a render hangs (stalled fetch, infinite loop), reclaim the slot after this timeout
const RENDER_TIMEOUT_MS = 15_000;

export class ThumbnailRenderTimeoutError extends Error {
  readonly code = "THUMBNAIL_RENDER_TIMEOUT";

  constructor(readonly timeoutMs: number) {
    super(`Thumbnail render exceeded ${timeoutMs}ms`);
    this.name = "ThumbnailRenderTimeoutError";
  }
}

function normalizeQueueError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null) {
    const errorLike = error as { message?: unknown; name?: unknown };
    const normalized = new Error(
      typeof errorLike.message === "string" ? errorLike.message : String(error)
    );
    if (typeof errorLike.name === "string") normalized.name = errorLike.name;
    return normalized;
  }
  return new Error(String(error));
}

function cancellationError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException(
    typeof signal?.reason === "string" ? signal.reason : "Cancelled",
    "AbortError"
  );
}

export class ThumbnailRenderQueue {
  private queue: QueuedTask<unknown>[] = [];
  private activeCount = 0;
  private activeIds = new Set<string>();
  private activeControllers = new Map<string, AbortController>();
  private pendingPromises = new Map<string, Promise<unknown>>();
  private consumerCounts = new Map<string, number>();
  private maxConcurrent = DEFAULT_MAX_CONCURRENT;

  enqueue<T>(
    id: string,
    execute: (signal: AbortSignal) => Promise<T>,
    priority: number = Infinity,
    consumerSignal?: AbortSignal
  ): Promise<T> {
    if (consumerSignal?.aborted) {
      return Promise.reject(cancellationError(consumerSignal));
    }

    let corePromise = this.pendingPromises.get(id) as Promise<T> | undefined;
    if (!corePromise) {
      corePromise = new Promise<T>((resolve, reject) => {
        const task: QueuedTask<T> = { id, execute, resolve, reject, priority };

        // Insert in priority order (lower priority value = higher priority = front of queue)
        const insertIndex = this.queue.findIndex((t) => t.priority > priority);
        if (insertIndex === -1) {
          this.queue.push(task as QueuedTask<unknown>);
        } else {
          this.queue.splice(insertIndex, 0, task as QueuedTask<unknown>);
        }

        this.processQueue();
      });

      this.pendingPromises.set(id, corePromise);

      // Clean up on either outcome without creating an ignored rejected promise.
      // finally() returns a child promise that preserves the original rejection;
      // callers handled `corePromise`, but that unobserved child surfaced globally.
      const forgetPending = () => {
        if (this.pendingPromises.get(id) === corePromise) {
          this.pendingPromises.delete(id);
        }
      };
      void corePromise.then(forgetPending, forgetPending);
    }

    return this.attachConsumer(id, corePromise, consumerSignal);
  }

  cancel(id: string): void {
    this.consumerCounts.delete(id);
    this.cancelCoreTask(id);
  }

  cancelAll(): void {
    this.consumerCounts.clear();
    const queuedTasks = this.queue.splice(0);
    for (const task of queuedTasks) {
      this.pendingPromises.delete(task.id);
      task.reject(new DOMException("Cancelled", "AbortError"));
    }

    // Abort all actively running renders so they bail out between beats
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
  }

  private cancelCoreTask(id: string): void {
    const index = this.queue.findIndex((t) => t.id === id);
    if (index !== -1) {
      const [task] = this.queue.splice(index, 1);
      this.pendingPromises.delete(id);
      task?.reject(new DOMException("Cancelled", "AbortError"));
      return;
    }

    this.activeControllers.get(id)?.abort();
  }

  private attachConsumer<T>(
    id: string,
    corePromise: Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    this.consumerCounts.set(id, (this.consumerCounts.get(id) ?? 0) + 1);

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (cancelCoreIfLast: boolean): boolean => {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        this.releaseConsumer(id, cancelCoreIfLast);
        return true;
      };
      const onAbort = () => {
        if (finish(true)) reject(cancellationError(signal));
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      corePromise.then(
        (value) => {
          if (finish(false)) resolve(value);
        },
        (error) => {
          if (finish(false)) reject(error);
        }
      );
    });
  }

  private releaseConsumer(id: string, cancelCoreIfLast: boolean): void {
    const count = this.consumerCounts.get(id);
    if (count === undefined) return;
    if (count > 1) {
      this.consumerCounts.set(id, count - 1);
      return;
    }

    this.consumerCounts.delete(id);
    if (cancelCoreIfLast) this.cancelCoreTask(id);
  }

  getStats(): QueueStats {
    return {
      queued: this.queue.length,
      active: this.activeCount,
      activeIds: Array.from(this.activeIds),
    };
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, max);
    // Process queue in case we increased capacity
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    // Don't exceed max concurrent
    if (this.activeCount >= this.maxConcurrent) {
      return;
    }

    // Get next task
    const task = this.queue.shift();
    if (!task) {
      return;
    }

    this.activeCount++;
    this.activeIds.add(task.id);

    const controller = new AbortController();
    this.activeControllers.set(task.id, controller);

    // Hold the timer id so we can clear it once the render settles. Without the
    // clear, a render that wins the race leaves the timeout pending; it fires
    // later and rejects an orphaned promise → "UNHANDLED PROMISE REJECTION".
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      // Race the render against a timeout to reclaim the slot if it hangs
      const result = await Promise.race([
        task.execute(controller.signal),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            // Settle the race as a typed deadline before aborting the work.
            // Abort listeners run synchronously and may reject `execute` with
            // AbortError; aborting first would let that cancellation mask the
            // timeout that caused it. The signal is still aborted in this same
            // callback, before control returns to the event loop.
            reject(new ThumbnailRenderTimeoutError(RENDER_TIMEOUT_MS));
            controller.abort();
          }, RENDER_TIMEOUT_MS);
        }),
      ]);
      task.resolve(result);
    } catch (error) {
      task.reject(normalizeQueueError(error));
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      this.activeCount--;
      this.activeIds.delete(task.id);
      this.activeControllers.delete(task.id);

      // Process next item in queue
      this.processQueue();
    }
  }
}
