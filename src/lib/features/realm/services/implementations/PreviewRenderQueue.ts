/**
 * PreviewRenderQueue
 *
 * Limits concurrent 3D preview renders to prevent GPU saturation.
 * WebGL contexts are limited (8-16 depending on browser), and each
 * canvas consumes significant GPU memory.
 *
 * Features:
 * - Queue-based rendering with configurable concurrency
 * - Priority support (viewport position determines priority)
 * - Deduplication (prevents duplicate renders for same destination)
 * - Cancellation support for unmounted components
 */

interface QueueTask {
  id: string;
  render: () => Promise<void>;
  priority: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface PreviewRenderQueue {
  /**
   * Enqueue a preview render task.
   * Returns a promise that resolves when rendering completes.
   */
  enqueue(id: string, render: () => Promise<void>, priority?: number): Promise<void>;

  /**
   * Cancel a pending render task.
   * Use when component unmounts before render completes.
   */
  cancel(id: string): void;

  /**
   * Get current queue status for debugging.
   */
  getStatus(): { activeCount: number; queueLength: number };
}

/**
 * Create a preview render queue with configurable concurrency.
 *
 * @param maxConcurrent Maximum number of concurrent renders (default: 2)
 */
export function createPreviewRenderQueue(maxConcurrent = 2): PreviewRenderQueue {
  let activeCount = 0;
  const queue: QueueTask[] = [];
  const pendingPromises = new Map<string, Promise<void>>();
  const cancelledIds = new Set<string>();

  /**
   * Process the next task in the queue if capacity available.
   */
  function processQueue(): void {
    while (queue.length > 0 && activeCount < maxConcurrent) {
      const task = queue.shift();
      if (!task) continue;

      // Skip if cancelled
      if (cancelledIds.has(task.id)) {
        cancelledIds.delete(task.id);
        pendingPromises.delete(task.id);
        task.reject(new Error("Cancelled"));
        continue;
      }

      activeCount++;

      task
        .render()
        .then(() => {
          task.resolve();
        })
        .catch((err) => {
          task.reject(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          activeCount--;
          pendingPromises.delete(task.id);
          processQueue();
        });
    }
  }

  return {
    enqueue(id: string, render: () => Promise<void>, priority = 0): Promise<void> {
      // Check for existing pending promise (deduplication)
      const existing = pendingPromises.get(id);
      if (existing) {
        return existing;
      }

      // Create new promise
      const promise = new Promise<void>((resolve, reject) => {
        const task: QueueTask = {
          id,
          render,
          priority,
          resolve,
          reject,
        };

        // Insert in priority order (higher priority = earlier in queue)
        const insertIndex = queue.findIndex((t) => t.priority < priority);
        if (insertIndex === -1) {
          queue.push(task);
        } else {
          queue.splice(insertIndex, 0, task);
        }
      });

      pendingPromises.set(id, promise);

      // Start processing if capacity available
      processQueue();

      return promise;
    },

    cancel(id: string): void {
      // Mark as cancelled (will be skipped when dequeued)
      cancelledIds.add(id);

      // Remove from queue if present
      const index = queue.findIndex((t) => t.id === id);
      if (index !== -1) {
        const task = queue.splice(index, 1)[0];
        if (task) {
          pendingPromises.delete(id);
          cancelledIds.delete(id);
          task.reject(new Error("Cancelled"));
        }
      }
    },

    getStatus(): { activeCount: number; queueLength: number } {
      return {
        activeCount,
        queueLength: queue.length,
      };
    },
  };
}

// Singleton instance for the Realm module
let instance: PreviewRenderQueue | null = null;

/**
 * Get the shared preview render queue instance.
 */
export function getPreviewRenderQueue(): PreviewRenderQueue {
  if (!instance) {
    instance = createPreviewRenderQueue(2);
  }
  return instance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetPreviewRenderQueue(): void {
  instance = null;
}
