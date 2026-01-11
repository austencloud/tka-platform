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

import type { IThumbnailRenderQueue, QueueStats } from "../contracts/IThumbnailRenderQueue";

interface QueuedTask<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
}

// Increased from 3 to 12 since Canvas2D rendering is lighter than SVG parsing
const DEFAULT_MAX_CONCURRENT = 12;

export class ThumbnailRenderQueue implements IThumbnailRenderQueue {
  private queue: QueuedTask<unknown>[] = [];
  private activeCount = 0;
  private activeIds = new Set<string>();
  private pendingPromises = new Map<string, Promise<unknown>>();
  private maxConcurrent = DEFAULT_MAX_CONCURRENT;

  enqueue<T>(id: string, execute: () => Promise<T>, priority: number = Infinity): Promise<T> {
    // If this ID already has a pending promise, return it (deduplication)
    const existing = this.pendingPromises.get(id);
    if (existing) {
      return existing as Promise<T>;
    }

    // Create new promise for this task
    const promise = new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = { id, execute, resolve, reject, priority };

      // Insert in priority order (lower priority value = higher priority = front of queue)
      const insertIndex = this.queue.findIndex(t => t.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(task as QueuedTask<unknown>);
      } else {
        this.queue.splice(insertIndex, 0, task as QueuedTask<unknown>);
      }

      this.processQueue();
    });

    // Store for deduplication
    this.pendingPromises.set(id, promise);

    // Clean up when done
    promise.finally(() => {
      this.pendingPromises.delete(id);
    });

    return promise;
  }

  cancel(id: string): void {
    const index = this.queue.findIndex((t) => t.id === id);
    if (index !== -1) {
      // Remove from queue without rejecting - the component is being destroyed
      // or switching to a new key, so no one is waiting for this promise anymore.
      // Let the promise hang rather than creating unhandled rejections.
      this.queue.splice(index, 1);
      this.pendingPromises.delete(id);
    }
  }

  cancelAll(): void {
    // Clear all pending promises without rejecting - avoids unhandled rejections
    for (const task of this.queue) {
      this.pendingPromises.delete(task.id);
    }
    this.queue = [];
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

    try {
      const result = await task.execute();
      task.resolve(result);
    } catch (error) {
      task.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeCount--;
      this.activeIds.delete(task.id);

      // Process next item in queue
      this.processQueue();
    }
  }
}
