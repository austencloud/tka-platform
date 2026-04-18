/**
 * IThumbnailMetricsCollector
 *
 * Lightweight instrumentation for thumbnail caching performance.
 * Answers key questions:
 * - What's the hit rate per cache layer?
 * - How long do users wait for thumbnails?
 * - What percentage of operations fail?
 * - Are users scrolling away before renders complete?
 *
 * This data informs whether optimizations are worth implementing.
 */

export type CacheLayer = "memory" | "static" | "local" | "cloud" | "render";

export interface ThumbnailRequestMetrics {
  /** Unique request ID for correlation */
  requestId: string;

  /** Which cache layer served this request */
  layer: CacheLayer | "failed";

  /** Time from request start to URL available (ms) */
  timeToUrl: number;

  /** Was the thumbnail visible when request started? */
  wasVisibleAtStart: boolean;

  /** Did the user scroll away before completion? */
  wasCancelled: boolean;

  /** For renders: time spent in queue before render started */
  queueWaitTime?: number;

  /** For renders: actual render duration */
  renderTime?: number;

  /** For cloud: upload succeeded? */
  uploadSucceeded?: boolean;
}

/** Statistical distribution for a set of timing measurements */
export interface TimingDistribution {
  /** Number of samples */
  count: number;
  /** Mean (average) in ms */
  mean: number;
  /** Standard deviation in ms */
  stdDev: number;
  /** Minimum value in ms */
  min: number;
  /** Maximum value in ms */
  max: number;
  /** 50th percentile (median) in ms */
  p50: number;
  /** 95th percentile in ms - 95% of requests faster than this */
  p95: number;
  /** 99th percentile in ms - 99% of requests faster than this */
  p99: number;
}

export interface ThumbnailMetricsSummary {
  /** Total requests tracked */
  totalRequests: number;

  /** Requests by layer */
  byLayer: Record<CacheLayer | "failed", number>;

  /** Average time to URL by layer (ms) */
  avgTimeByLayer: Record<CacheLayer | "failed", number>;

  /** Hit rate per layer (as percentage of total) */
  hitRateByLayer: Record<CacheLayer | "failed", number>;

  /** Percentage of requests cancelled before completion */
  cancelRate: number;

  /** Percentage of render attempts that failed */
  renderFailureRate: number;

  /** Percentage of cloud uploads that succeeded */
  uploadSuccessRate: number;

  /** Highest queue depth observed */
  queueHighWaterMark: number;

  /** Average queue wait time for rendered items (ms) */
  avgQueueWaitTime: number;

  /** Average render time (ms) */
  avgRenderTime: number;

  /** Session duration (ms) */
  sessionDuration: number;

  /** Full timing distribution across all requests */
  timeDistribution: TimingDistribution;

  /** Timing distribution by layer (only layers with data) */
  timeDistributionByLayer: Partial<Record<CacheLayer | "failed", TimingDistribution>>;
}

export interface IThumbnailMetricsCollector {
  /**
   * Start tracking a new thumbnail request.
   * Call when getThumbnail() begins.
   * @returns requestId to pass to subsequent calls
   */
  startRequest(isVisible: boolean): string;

  /**
   * Record which cache layer served the request.
   * Call when URL is available or request fails.
   */
  endRequest(
    requestId: string,
    layer: CacheLayer | "failed",
    details?: {
      queueWaitTime?: number;
      renderTime?: number;
    }
  ): void;

  /**
   * Record that a request was cancelled (user scrolled away).
   */
  cancelRequest(requestId: string): void;

  /**
   * Record a cloud upload result.
   */
  recordUpload(succeeded: boolean): void;

  /**
   * Record current queue depth (call periodically or on change).
   */
  recordQueueDepth(depth: number): void;

  /**
   * Get aggregated metrics summary.
   */
  getSummary(): ThumbnailMetricsSummary;

  /**
   * Reset all metrics (for new session).
   */
  reset(): void;

  /**
   * No-op. Kept for interface compatibility.
   * Call logNow() from DevTools console for on-demand metrics.
   */
  startLogging(): void;

  /**
   * Stop periodic console logging.
   */
  stopLogging(): void;

  /**
   * Log current summary to console immediately.
   */
  logNow(): void;
}
