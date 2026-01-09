/**
 * Idle Callback Utilities - A+ Performance
 *
 * 🚀 PERFORMANCE: Defer non-critical work to idle periods.
 * Uses requestIdleCallback when available, with setTimeout fallback.
 *
 * Usage:
 *   import { runWhenIdle, runWhenIdleAsync } from '$lib/shared/utils/idle-callback';
 *
 *   // Fire and forget
 *   runWhenIdle(() => preloadImages(), { timeout: 5000 });
 *
 *   // Async/await
 *   await runWhenIdleAsync(() => computeExpensiveData());
 */

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

interface IdleCallbackOptions {
  timeout?: number; // Max wait time in ms (default: 2000)
}

type IdleCallbackFn = (deadline?: IdleDeadline) => void;

/**
 * Check if requestIdleCallback is available
 */
const hasIdleCallback =
  typeof window !== "undefined" && "requestIdleCallback" in window;

/**
 * Polyfill for requestIdleCallback
 * Falls back to setTimeout with 1ms delay
 */
function requestIdleCallbackPolyfill(
  callback: IdleCallbackFn,
  options?: IdleCallbackOptions
): number {
  const start = Date.now();

  return window.setTimeout(() => {
    callback({
      didTimeout: options?.timeout
        ? Date.now() - start >= options.timeout
        : false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1);
}

/**
 * Polyfill for cancelIdleCallback
 */
function cancelIdleCallbackPolyfill(id: number): void {
  clearTimeout(id);
}

/**
 * Run a callback when the browser is idle
 */
export function runWhenIdle(
  callback: IdleCallbackFn,
  options?: IdleCallbackOptions
): number {
  if (typeof window === "undefined") {
    // SSR: run immediately
    callback();
    return 0;
  }

  if (hasIdleCallback) {
    return (
      window as Window & {
        requestIdleCallback: typeof requestIdleCallbackPolyfill;
      }
    ).requestIdleCallback(callback, { timeout: options?.timeout ?? 2000 });
  }

  return requestIdleCallbackPolyfill(callback, options);
}

/**
 * Cancel a pending idle callback
 */
export function cancelIdle(id: number): void {
  if (typeof window === "undefined") return;

  if (hasIdleCallback) {
    (
      window as Window & {
        cancelIdleCallback: typeof cancelIdleCallbackPolyfill;
      }
    ).cancelIdleCallback(id);
  } else {
    cancelIdleCallbackPolyfill(id);
  }
}

/**
 * Run a callback when idle and return a promise
 */
export function runWhenIdleAsync<T>(
  callback: () => T | Promise<T>,
  options?: IdleCallbackOptions
): Promise<T> {
  return new Promise((resolve, reject) => {
    runWhenIdle(async () => {
      try {
        const result = await callback();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, options);
  });
}

/**
 * Split a heavy task into chunks that run during idle periods
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param options - Chunk size and timeout options
 */
export async function processInIdleChunks<T, R>(
  items: T[],
  processor: (item: T) => R | Promise<R>,
  options?: {
    chunkSize?: number;
    timeout?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<R[]> {
  const chunkSize = options?.chunkSize ?? 10;
  const timeout = options?.timeout ?? 2000;
  const results: R[] = [];
  let processed = 0;

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    await runWhenIdleAsync(
      async () => {
        for (const item of chunk) {
          const result = await processor(item);
          results.push(result);
          processed++;
        }

        options?.onProgress?.(processed, items.length);
      },
      { timeout }
    );
  }

  return results;
}

/**
 * Defer non-critical initialization until idle
 * Good for analytics, prefetching, etc.
 */
export function deferInit(
  initFn: () => void | Promise<void>,
  _label?: string
): void {
  runWhenIdle(
    async () => {
      await initFn();
    },
    { timeout: 5000 }
  );
}
