/**
 * ThumbnailMetricsCollector
 *
 * Lightweight instrumentation for thumbnail caching performance.
 * Collects timing and hit rate data to inform optimization decisions.
 *
 * Usage:
 * - Call logNow() from DevTools console for a formatted dump
 * - Call getSummary() programmatically
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

interface PendingRequest {
  startTime: number;
  isVisible: boolean;
}

export class ThumbnailMetricsCollector {
  private sessionStart = Date.now();
  private requestCounter = 0;
  private pendingRequests = new Map<string, PendingRequest>();
  private completedRequests: ThumbnailRequestMetrics[] = [];
  private queueHighWaterMark = 0;
  private uploadSuccesses = 0;
  private uploadFailures = 0;

  // Keep only last N requests to prevent memory bloat
  private readonly MAX_STORED_REQUESTS = 1000;

  startRequest(isVisible: boolean): string {
    const requestId = `req_${++this.requestCounter}`;
    this.pendingRequests.set(requestId, {
      startTime: performance.now(),
      isVisible,
    });
    return requestId;
  }

  endRequest(
    requestId: string,
    layer: CacheLayer | "failed",
    details?: { queueWaitTime?: number; renderTime?: number }
  ): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);

    const metrics: ThumbnailRequestMetrics = {
      requestId,
      layer,
      timeToUrl: performance.now() - pending.startTime,
      wasVisibleAtStart: pending.isVisible,
      wasCancelled: false,
      queueWaitTime: details?.queueWaitTime,
      renderTime: details?.renderTime,
    };

    this.addCompletedRequest(metrics);
  }

  cancelRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);

    const metrics: ThumbnailRequestMetrics = {
      requestId,
      layer: "failed",
      timeToUrl: performance.now() - pending.startTime,
      wasVisibleAtStart: pending.isVisible,
      wasCancelled: true,
    };

    this.addCompletedRequest(metrics);
  }

  recordUpload(succeeded: boolean): void {
    if (succeeded) {
      this.uploadSuccesses++;
    } else {
      this.uploadFailures++;
    }
  }

  recordQueueDepth(depth: number): void {
    if (depth > this.queueHighWaterMark) {
      this.queueHighWaterMark = depth;
    }
  }

  getSummary(): ThumbnailMetricsSummary {
    const byLayer: Record<CacheLayer | "failed", number> = {
      memory: 0,
      static: 0,
      local: 0,
      cloud: 0,
      render: 0,
      failed: 0,
    };

    const timesByLayer: Record<CacheLayer | "failed", number[]> = {
      memory: [],
      static: [],
      local: [],
      cloud: [],
      render: [],
      failed: [],
    };

    let cancelledCount = 0;
    let renderFailures = 0;
    const queueWaitTimes: number[] = [];
    const renderTimes: number[] = [];

    for (const req of this.completedRequests) {
      byLayer[req.layer]++;
      timesByLayer[req.layer].push(req.timeToUrl);

      if (req.wasCancelled) {
        cancelledCount++;
      }

      if (req.layer === "failed" && !req.wasCancelled) {
        renderFailures++;
      }

      if (req.queueWaitTime !== undefined) {
        queueWaitTimes.push(req.queueWaitTime);
      }

      if (req.renderTime !== undefined) {
        renderTimes.push(req.renderTime);
      }
    }

    const total = this.completedRequests.length;
    const renderAttempts = byLayer.render + renderFailures;
    const totalUploads = this.uploadSuccesses + this.uploadFailures;

    const avgTimeByLayer: Record<CacheLayer | "failed", number> = {
      memory: this.avg(timesByLayer.memory),
      static: this.avg(timesByLayer.static),
      local: this.avg(timesByLayer.local),
      cloud: this.avg(timesByLayer.cloud),
      render: this.avg(timesByLayer.render),
      failed: this.avg(timesByLayer.failed),
    };

    const hitRateByLayer: Record<CacheLayer | "failed", number> = {
      memory: total > 0 ? (byLayer.memory / total) * 100 : 0,
      static: total > 0 ? (byLayer.static / total) * 100 : 0,
      local: total > 0 ? (byLayer.local / total) * 100 : 0,
      cloud: total > 0 ? (byLayer.cloud / total) * 100 : 0,
      render: total > 0 ? (byLayer.render / total) * 100 : 0,
      failed: total > 0 ? (byLayer.failed / total) * 100 : 0,
    };

    // Build timing distributions
    const allTimes = this.completedRequests.map((r) => r.timeToUrl);
    const timeDistribution = this.buildDistribution(allTimes);

    const timeDistributionByLayer: Partial<Record<CacheLayer | "failed", TimingDistribution>> = {};
    for (const layer of ["memory", "static", "local", "cloud", "render", "failed"] as const) {
      if (timesByLayer[layer].length > 0) {
        timeDistributionByLayer[layer] = this.buildDistribution(timesByLayer[layer]);
      }
    }

    return {
      totalRequests: total,
      byLayer,
      avgTimeByLayer,
      hitRateByLayer,
      cancelRate: total > 0 ? (cancelledCount / total) * 100 : 0,
      renderFailureRate:
        renderAttempts > 0 ? (renderFailures / renderAttempts) * 100 : 0,
      uploadSuccessRate:
        totalUploads > 0 ? (this.uploadSuccesses / totalUploads) * 100 : 0,
      queueHighWaterMark: this.queueHighWaterMark,
      avgQueueWaitTime: this.avg(queueWaitTimes),
      avgRenderTime: this.avg(renderTimes),
      sessionDuration: Date.now() - this.sessionStart,
      timeDistribution,
      timeDistributionByLayer,
    };
  }

  reset(): void {
    this.sessionStart = Date.now();
    this.requestCounter = 0;
    this.pendingRequests.clear();
    this.completedRequests = [];
    this.queueHighWaterMark = 0;
    this.uploadSuccesses = 0;
    this.uploadFailures = 0;
  }

  startLogging(): void {
    // No-op - metrics are collected silently.
    // Call logNow() from DevTools console if needed.
  }

  stopLogging(): void {
    // No-op - no active listeners to clean up.
  }

  logNow(): void {
    const summary = this.getSummary();

    if (summary.totalRequests === 0) {
      return;
    }

    const _sessionMins = (summary.sessionDuration / 60000).toFixed(1);



    // Cache hit rates
    console.log("📊 Cache Hit Rates:");
    console.table({
      Static: {
        hits: summary.byLayer.static,
        rate: `${summary.hitRateByLayer.static.toFixed(1)}%`,
        avgTime: `${summary.avgTimeByLayer.static.toFixed(0)}ms`,
      },
      Local: {
        hits: summary.byLayer.local,
        rate: `${summary.hitRateByLayer.local.toFixed(1)}%`,
        avgTime: `${summary.avgTimeByLayer.local.toFixed(0)}ms`,
      },
      Cloud: {
        hits: summary.byLayer.cloud,
        rate: `${summary.hitRateByLayer.cloud.toFixed(1)}%`,
        avgTime: `${summary.avgTimeByLayer.cloud.toFixed(0)}ms`,
      },
      Render: {
        hits: summary.byLayer.render,
        rate: `${summary.hitRateByLayer.render.toFixed(1)}%`,
        avgTime: `${summary.avgTimeByLayer.render.toFixed(0)}ms`,
      },
      Failed: {
        hits: summary.byLayer.failed,
        rate: `${summary.hitRateByLayer.failed.toFixed(1)}%`,
        avgTime: `${summary.avgTimeByLayer.failed.toFixed(0)}ms`,
      },
    });

    // Key metrics
    console.log("📈 Key Metrics:");
    console.table({
      "Cancel Rate": `${summary.cancelRate.toFixed(1)}%`,
      "Render Failure Rate": `${summary.renderFailureRate.toFixed(1)}%`,
      "Upload Success Rate": `${summary.uploadSuccessRate.toFixed(1)}%`,
      "Queue High Water Mark": summary.queueHighWaterMark,
      "Avg Queue Wait": `${summary.avgQueueWaitTime.toFixed(0)}ms`,
      "Avg Render Time": `${summary.avgRenderTime.toFixed(0)}ms`,
    });

    // Timing distribution (the stats that matter for user experience)
    const d = summary.timeDistribution;
    if (d.count > 0) {
      console.log("⏱️ Timing Distribution (all requests):");
      console.table({
        "P50 (median)": `${d.p50.toFixed(0)}ms`,
        "P95 (95% faster)": `${d.p95.toFixed(0)}ms`,
        "P99 (99% faster)": `${d.p99.toFixed(0)}ms`,
        "Std Dev": `${d.stdDev.toFixed(0)}ms`,
        "Min / Max": `${d.min.toFixed(0)}ms / ${d.max.toFixed(0)}ms`,
      });
    }

    // Recommendations based on data
    this.logRecommendations(summary);

    console.groupEnd();
  }

  private logRecommendations(summary: ThumbnailMetricsSummary): void {
    const recommendations: string[] = [];

    // High cancel rate suggests preloading would help
    if (summary.cancelRate > 20) {
      recommendations.push(
        `⚠️ High cancel rate (${summary.cancelRate.toFixed(0)}%) - preloading might help`
      );
    }

    // Low static hit rate means bundling isn't helping much
    if (
      summary.hitRateByLayer.static < 10 &&
      summary.totalRequests > 50
    ) {
      recommendations.push(
        `📦 Low static hit rate (${summary.hitRateByLayer.static.toFixed(0)}%) - bundling strategy needs review`
      );
    }

    // High local hit rate is good
    if (summary.hitRateByLayer.local > 50) {
      recommendations.push(
        `✅ Great local cache hit rate (${summary.hitRateByLayer.local.toFixed(0)}%)`
      );
    }

    // Queue backing up suggests need more concurrency
    if (summary.queueHighWaterMark > 10) {
      recommendations.push(
        `🔄 Queue peaked at ${summary.queueHighWaterMark} - consider increasing concurrency`
      );
    }

    // Render failures suggest retry logic needed
    if (summary.renderFailureRate > 5) {
      recommendations.push(
        `❌ Render failure rate ${summary.renderFailureRate.toFixed(0)}% - retry logic would help`
      );
    }

    // Upload failures mean crowd-sourcing isn't working
    if (summary.uploadSuccessRate < 90 && this.uploadSuccesses + this.uploadFailures > 10) {
      recommendations.push(
        `☁️ Upload success rate only ${summary.uploadSuccessRate.toFixed(0)}% - check cloud connectivity`
      );
    }

    // P95-based recommendations (user experience focused)
    const d = summary.timeDistribution;
    if (d.count >= 20) {
      // High variance suggests inconsistent performance
      if (d.stdDev > d.mean * 0.8) {
        recommendations.push(
          `📊 High variance (stdDev ${d.stdDev.toFixed(0)}ms vs mean ${d.mean.toFixed(0)}ms) - performance is inconsistent`
        );
      }
      // P95 much higher than median suggests tail latency issues
      if (d.p95 > d.p50 * 3 && d.p95 > 500) {
        recommendations.push(
          `🐢 Tail latency: P95 (${d.p95.toFixed(0)}ms) is ${(d.p95 / d.p50).toFixed(1)}x the median - 5% of users waiting much longer`
        );
      }
      // Good P95 is a positive signal
      if (d.p95 < 200) {
        recommendations.push(
          `✅ Excellent P95 (${d.p95.toFixed(0)}ms) - 95% of thumbnails load quickly`
        );
      }
    }

    if (recommendations.length > 0) {
      console.log("💡 Recommendations:");
      recommendations.forEach((r) => console.log(`   ${r}`));
    }
  }

  private addCompletedRequest(metrics: ThumbnailRequestMetrics): void {
    this.completedRequests.push(metrics);

    // Trim old requests to prevent memory bloat
    if (this.completedRequests.length > this.MAX_STORED_REQUESTS) {
      this.completedRequests = this.completedRequests.slice(-this.MAX_STORED_REQUESTS);
    }
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0]!;
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower]!;
    // Linear interpolation
    const fraction = index - lower;
    return sortedValues[lower]! + fraction * (sortedValues[upper]! - sortedValues[lower]!);
  }

  private buildDistribution(values: number[]): TimingDistribution {
    if (values.length === 0) {
      return { count: 0, mean: 0, stdDev: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mean = this.avg(values);
    return {
      count: values.length,
      mean,
      stdDev: this.stdDev(values, mean),
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }
}
