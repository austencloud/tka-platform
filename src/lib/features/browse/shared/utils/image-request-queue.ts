/**
 * Image Request Queue with Priority Support
 *
 * Prevents browser connection pool exhaustion by limiting concurrent image requests.
 * HTTP/1.1 has a limit of 6 concurrent connections per domain.
 *
 * Mobile networks often timeout when too many requests are queued.
 * This service ensures images load reliably even on slow connections.
 *
 * Priority Queue:
 * - Priority 10: Above-the-fold images (marked with priority prop)
 * - Priority 5: Manual retries (user-initiated)
 * - Priority 3: Mostly visible (75%+ in viewport)
 * - Priority 2: Half visible (50-75% in viewport)
 * - Priority 1: Partially visible (1-50% in viewport)
 * - Priority 0: Preload (not yet visible, triggered by rootMargin)
 */

interface QueuedRequest {
  url: string;
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  timeout: number;
  abortController: AbortController;
  priority: number; // Higher number = higher priority
}

class ImageRequestQueue {
  private pending: QueuedRequest[] = [];
  private active = 0;

  // Start with reasonable default - will be adjusted by connection detection
  private maxConcurrent = 12;

  // Default timeout: 30 seconds (generous for slow 3G)
  private defaultTimeout = 30000;

  /**
   * Load an image with automatic queuing and timeout handling
   *
   * @param url - Image URL to load
   * @param timeout - Request timeout in milliseconds
   * @param priority - Priority level (0=low, 1=normal, 2=high). Higher priority loads first.
   */
  async load(
    url: string,
    timeout: number = this.defaultTimeout,
    priority: number = 1
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const abortController = new AbortController();

      const request: QueuedRequest = {
        url,
        resolve,
        reject,
        timeout,
        abortController,
        priority,
      };

      this.enqueue(request);
    });
  }

  /**
   * Add request to queue or start immediately if slots available
   * Uses priority queue: higher priority requests are processed first
   */
  private enqueue(request: QueuedRequest): void {
    if (this.active < this.maxConcurrent) {
      void this.execute(request);
    } else {
      // Insert into queue based on priority (higher priority first)
      const insertIndex = this.pending.findIndex(
        (r) => r.priority < request.priority
      );
      if (insertIndex === -1) {
        this.pending.push(request);
      } else {
        this.pending.splice(insertIndex, 0, request);
      }
    }
  }

  /**
   * Execute a single request with timeout handling
   */
  private async execute(request: QueuedRequest): Promise<void> {
    this.active++;

    try {
      // Create timeout
      const timeoutId = setTimeout(() => {
        request.abortController.abort();
        request.reject(
          new Error(
            `Image load timeout after ${request.timeout}ms: ${request.url}`
          )
        );
      }, request.timeout);

      // Fetch with abort signal
      const response = await fetch(request.url, {
        signal: request.abortController.signal,
        // Use cache when available
        cache: "force-cache",
        // High priority for images
        priority: "high",
      } as RequestInit);

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${request.url}`);
      }

      const blob = await response.blob();
      request.resolve(blob);
    } catch (error) {
      if (error instanceof Error) {
        // Don't reject if already aborted (timeout handled above)
        if (error.name !== "AbortError") {
          request.reject(error);
        }
      } else {
        request.reject(new Error("Unknown error loading image"));
      }
    } finally {
      this.active--;
      this.processNext();
    }
  }

  /**
   * Process next queued request if available
   */
  private processNext(): void {
    if (this.pending.length === 0) return;

    const next = this.pending.shift();
    if (next) {
      void this.execute(next);
    }
  }

  /**
   * Get current queue statistics
   */
  getStats() {
    return {
      active: this.active,
      pending: this.pending.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Clear all pending requests (useful for navigation away)
   */
  clear(): void {
    // Abort all pending requests
    this.pending.forEach((request) => {
      request.abortController.abort();
      request.reject(new Error("Request queue cleared"));
    });

    this.pending = [];
  }

  /**
   * Adjust max concurrent requests based on connection quality
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, Math.min(max, 20)); // Allow up to 20 for localhost
  }
}

// Singleton instance
export const imageRequestQueue = new ImageRequestQueue();

/**
 * Check if running on localhost
 */
function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

/**
 * Adjust queue settings based on connection quality
 */
export function adjustQueueForConnection(
  quality: "slow" | "medium" | "fast"
): void {
  // Localhost gets maximum performance
  if (isLocalhost()) {
    imageRequestQueue.setMaxConcurrent(20);
    return;
  }

  // Production adjustments based on connection
  switch (quality) {
    case "slow":
      imageRequestQueue.setMaxConcurrent(2);
      break;
    case "medium":
      imageRequestQueue.setMaxConcurrent(6);
      break;
    case "fast":
      imageRequestQueue.setMaxConcurrent(12);
      break;
  }
}
