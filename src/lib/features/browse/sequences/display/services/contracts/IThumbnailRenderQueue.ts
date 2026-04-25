/**
 * IThumbnailRenderQueue
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

export interface IThumbnailRenderQueue {
  /**
   * Add a render task to the queue.
   * Returns a promise that resolves when the render completes.
   *
   * If a task with the same ID is already queued or active,
   * returns the existing promise (deduplication).
   *
   * @param id Unique identifier for this render (typically the cache key hash)
   * @param execute The render function to execute
   * @param priority Optional priority (lower = higher priority). Use element's Y position.
   * @returns Promise that resolves with the render result
   */
  enqueue<T>(id: string, execute: (signal: AbortSignal) => Promise<T>, priority?: number): Promise<T>;

  /**
   * Cancel a queued task.
   * Has no effect if task is already executing or completed.
   *
   * @param id The task ID to cancel
   */
  cancel(id: string): void;

  /**
   * Cancel all queued tasks.
   * Active tasks continue to completion.
   * Use this on bulk prop changes (e.g., light mode toggle).
   */
  cancelAll(): void;

  /**
   * Get current queue statistics.
   * Useful for debugging and status display.
   */
  getStats(): QueueStats;

  /**
   * Set maximum concurrent renders.
   * Takes effect for next queued item.
   *
   * @param max Maximum concurrent renders (default: 3)
   */
  setMaxConcurrent(max: number): void;
}
