/**
 * Browser-lifetime instrumentation for the thumbnail cache and render path.
 *
 * The collector keeps request data bounded while retaining enough context to
 * reproduce a failed public thumbnail without collecting sequence content.
 */

import { LogCollapsingLowestDenseDDSketch } from "@datadog/sketches-js";
import type { ThumbnailVariant } from "./thumbnail-key-deriver";

export type CacheLayer = "memory" | "static" | "local" | "cloud" | "render";
type SummaryLayer = CacheLayer | "failed";

export const THUMBNAIL_STAGES = [
  "static_manifest",
  "local_cache",
  "cloud_lookup",
  "queue_wait",
  "sequence_load",
  "loop_and_start",
  "qr_bitmap",
  "composition",
  "finalize",
] as const;

export type ThumbnailStage = (typeof THUMBNAIL_STAGES)[number];

export interface ThumbnailProgressSnapshot {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}

/**
 * The complete production allowlist for per-request thumbnail context.
 * Sequence steps, names, notes, creator data, and profile fields never enter it.
 */
export interface ThumbnailRequestContext {
  cacheKeyHash: string;
  sequenceId: string | null;
  variant: ThumbnailVariant;
  propKey: string;
  qrRequested: boolean;
  lightMode: boolean;
  usesDefaults: boolean;
  initialStepCount: number;
  queueDepthAtEnqueue: number | null;
  activeAtEnqueue: number | null;
  workerEligible: boolean | null;
}

export interface ThumbnailRequestMetrics {
  requestId: string;
  layer: CacheLayer | "failed";
  timeToUrl: number;
  wasVisibleAtStart: boolean;
  wasCancelled: boolean;
  context: ThumbnailRequestContext;
  stageDurations: Partial<Record<ThumbnailStage, number>>;
  lastStage?: ThumbnailStage;
  lastStageElapsedTime?: number;
  latestProgress?: ThumbnailProgressSnapshot;
  queueWaitTime?: number;
  renderTime?: number;
  errorCode?: string;
}

export interface TimingDistribution {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ThumbnailMetricsSummary {
  totalRequests: number;
  renderRequests: number;
  byLayer: Record<CacheLayer | "failed", number>;
  avgTimeByLayer: Record<CacheLayer | "failed", number>;
  hitRateByLayer: Record<CacheLayer | "failed", number>;
  cancelRate: number;
  renderFailureRate: number;
  uploadSuccessRate: number;
  queueHighWaterMark: number;
  avgQueueWaitTime: number;
  avgRenderTime: number;
  sessionDuration: number;
  timeDistribution: TimingDistribution;
  timeDistributionByLayer: Partial<
    Record<CacheLayer | "failed", TimingDistribution>
  >;
  queueWaitDistribution: TimingDistribution;
  renderTimeDistribution: TimingDistribution;
  stageDistributions: Partial<Record<ThumbnailStage, TimingDistribution>>;
  byVariantAndProp: Record<string, number>;
  timeoutCount: number;
  orphanedSequenceCount: number;
  orphanedSequenceIds: string[];
  longestStage: { stage: ThumbnailStage; duration: number } | null;
}

interface PendingRequest {
  startTime: number;
  isVisible: boolean;
  context: ThumbnailRequestContext;
  stageDurations: Partial<Record<ThumbnailStage, number>>;
  currentStage?: ThumbnailStage;
  stageStartTime?: number;
  latestProgress?: ThumbnailProgressSnapshot;
}

export type ThumbnailMetricsClock = () => number;

const MAX_STORED_REQUESTS = 1000;
const MAX_ORPHANED_SEQUENCE_IDS = 25;
const TIMING_RELATIVE_ACCURACY = 0.01;
const TIMING_SKETCH_BIN_LIMIT = 1024;
const SUMMARY_LAYERS: readonly SummaryLayer[] = [
  "memory",
  "static",
  "local",
  "cloud",
  "render",
  "failed",
];

/**
 * Keeps exact scalar statistics while DDSketch bounds the memory needed for
 * page-lifetime latency percentiles. Collapsing low bins preserves resolution
 * in the high tail that this incident needs to diagnose.
 */
class TimingAccumulator {
  private readonly sketch = new LogCollapsingLowestDenseDDSketch({
    relativeAccuracy: TIMING_RELATIVE_ACCURACY,
    binLimit: TIMING_SKETCH_BIN_LIMIT,
  });
  private runningMean = 0;
  private squaredDifferenceTotal = 0;

  get count(): number {
    return this.sketch.count;
  }

  record(value: number): void {
    const nextCount = this.sketch.count + 1;
    const delta = value - this.runningMean;
    this.runningMean += delta / nextCount;
    this.squaredDifferenceTotal += delta * (value - this.runningMean);
    this.sketch.accept(value);
  }

  distribution(): TimingDistribution {
    if (this.sketch.count === 0) {
      return {
        count: 0,
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const exactSingleValue =
      this.sketch.count === 1 ? this.sketch.min : undefined;
    return {
      count: this.sketch.count,
      mean: this.runningMean,
      stdDev: Math.sqrt(
        Math.max(0, this.squaredDifferenceTotal / this.sketch.count)
      ),
      min: this.sketch.min,
      max: this.sketch.max,
      p50: exactSingleValue ?? this.sketch.getValueAtQuantile(0.5),
      p95: exactSingleValue ?? this.sketch.getValueAtQuantile(0.95),
      p99: exactSingleValue ?? this.sketch.getValueAtQuantile(0.99),
    };
  }
}

interface LifetimeThumbnailMetrics {
  totalRequests: number;
  byLayer: Record<SummaryLayer, number>;
  time: TimingAccumulator;
  timeByLayer: Record<SummaryLayer, TimingAccumulator>;
  queueWait: TimingAccumulator;
  renderTime: TimingAccumulator;
  stages: Record<ThumbnailStage, TimingAccumulator>;
  cancelledCount: number;
  renderFailures: number;
  timeoutCount: number;
  orphanedSequenceCount: number;
  orphanedSequenceIds: Set<string>;
  byVariantAndProp: Record<string, number>;
  longestStage: ThumbnailMetricsSummary["longestStage"];
}

function createLayerRecord<T>(createValue: () => T): Record<SummaryLayer, T> {
  return Object.fromEntries(
    SUMMARY_LAYERS.map((layer) => [layer, createValue()])
  ) as Record<SummaryLayer, T>;
}

function createLifetimeMetrics(): LifetimeThumbnailMetrics {
  return {
    totalRequests: 0,
    byLayer: createLayerRecord(() => 0),
    time: new TimingAccumulator(),
    timeByLayer: createLayerRecord(() => new TimingAccumulator()),
    queueWait: new TimingAccumulator(),
    renderTime: new TimingAccumulator(),
    stages: Object.fromEntries(
      THUMBNAIL_STAGES.map((stage) => [stage, new TimingAccumulator()])
    ) as Record<ThumbnailStage, TimingAccumulator>,
    cancelledCount: 0,
    renderFailures: 0,
    timeoutCount: 0,
    orphanedSequenceCount: 0,
    orphanedSequenceIds: new Set(),
    byVariantAndProp: {},
    longestStage: null,
  };
}

export class ThumbnailMetricsCollector {
  private sessionStart: number;
  private requestCounter = 0;
  private pendingRequests = new Map<string, PendingRequest>();
  private completedRequests: ThumbnailRequestMetrics[] = [];
  private lifetime: LifetimeThumbnailMetrics;
  private queueHighWaterMark = 0;
  private uploadSuccesses = 0;
  private uploadFailures = 0;

  constructor(
    private readonly now: ThumbnailMetricsClock = () => performance.now(),
    private readonly wallNow: ThumbnailMetricsClock = () => Date.now()
  ) {
    this.sessionStart = this.wallNow();
    this.lifetime = createLifetimeMetrics();
  }

  startRequest(isVisible: boolean, context: ThumbnailRequestContext): string {
    const requestId = `req_${++this.requestCounter}`;
    this.pendingRequests.set(requestId, {
      startTime: this.now(),
      isVisible,
      context: { ...context },
      stageDurations: {},
    });
    return requestId;
  }

  startStage(
    requestId: string,
    stage: ThumbnailStage,
    details?: { workerEligible?: boolean }
  ): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    if (details?.workerEligible !== undefined) {
      pending.context.workerEligible = details.workerEligible;
    }

    if (pending.currentStage === stage) return;

    const now = this.now();
    this.finishCurrentStage(pending, now);
    pending.currentStage = stage;
    pending.stageStartTime = now;
  }

  recordQueueState(
    requestId: string,
    state: { queued: number; active: number }
  ): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;
    pending.context.queueDepthAtEnqueue = state.queued;
    pending.context.activeAtEnqueue = state.active;
    this.recordQueueDepth(state.queued + state.active);
  }

  recordProgress(requestId: string, progress: ThumbnailProgressSnapshot): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;
    pending.latestProgress = { ...progress };
  }

  endRequest(
    requestId: string,
    layer: CacheLayer | "failed",
    details?: {
      queueWaitTime?: number;
      renderTime?: number;
      errorCode?: string;
    }
  ): ThumbnailRequestMetrics | null {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return null;

    this.pendingRequests.delete(requestId);
    const metrics = this.completePendingRequest(
      requestId,
      pending,
      layer,
      false,
      details
    );
    this.addCompletedRequest(metrics);
    return metrics;
  }

  cancelRequest(requestId: string): ThumbnailRequestMetrics | null {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return null;

    this.pendingRequests.delete(requestId);
    const metrics = this.completePendingRequest(
      requestId,
      pending,
      "failed",
      true
    );
    this.addCompletedRequest(metrics);
    return metrics;
  }

  recordUpload(succeeded: boolean): void {
    if (succeeded) {
      this.uploadSuccesses++;
    } else {
      this.uploadFailures++;
    }
  }

  recordQueueDepth(depth: number): void {
    this.queueHighWaterMark = Math.max(this.queueHighWaterMark, depth);
  }

  getCompletedRequests(): readonly ThumbnailRequestMetrics[] {
    return this.completedRequests.map((request) => ({
      ...request,
      context: { ...request.context },
      stageDurations: { ...request.stageDurations },
      latestProgress: request.latestProgress
        ? { ...request.latestProgress }
        : undefined,
    }));
  }

  getSummary(): ThumbnailMetricsSummary {
    const total = this.lifetime.totalRequests;
    const byLayer = { ...this.lifetime.byLayer };
    const renderRequests = byLayer.render + this.lifetime.renderFailures;
    const totalUploads = this.uploadSuccesses + this.uploadFailures;
    const avgTimeByLayer = createLayerRecord(() => 0);
    const hitRateByLayer = createLayerRecord(() => 0);
    const timeDistributionByLayer: ThumbnailMetricsSummary["timeDistributionByLayer"] =
      {};
    for (const layer of SUMMARY_LAYERS) {
      const distribution = this.lifetime.timeByLayer[layer].distribution();
      avgTimeByLayer[layer] = distribution.mean;
      hitRateByLayer[layer] = total > 0 ? (byLayer[layer] / total) * 100 : 0;
      if (distribution.count > 0) {
        timeDistributionByLayer[layer] = distribution;
      }
    }
    const stageDistributions: ThumbnailMetricsSummary["stageDistributions"] =
      {};
    for (const stage of THUMBNAIL_STAGES) {
      const distribution = this.lifetime.stages[stage].distribution();
      if (distribution.count > 0) {
        stageDistributions[stage] = distribution;
      }
    }

    return {
      totalRequests: total,
      renderRequests,
      byLayer,
      avgTimeByLayer,
      hitRateByLayer,
      cancelRate: total > 0 ? (this.lifetime.cancelledCount / total) * 100 : 0,
      renderFailureRate:
        renderRequests > 0
          ? (this.lifetime.renderFailures / renderRequests) * 100
          : 0,
      uploadSuccessRate:
        totalUploads > 0 ? (this.uploadSuccesses / totalUploads) * 100 : 0,
      queueHighWaterMark: this.queueHighWaterMark,
      avgQueueWaitTime: this.lifetime.queueWait.distribution().mean,
      avgRenderTime: this.lifetime.renderTime.distribution().mean,
      sessionDuration: this.wallNow() - this.sessionStart,
      timeDistribution: this.lifetime.time.distribution(),
      timeDistributionByLayer,
      queueWaitDistribution: this.lifetime.queueWait.distribution(),
      renderTimeDistribution: this.lifetime.renderTime.distribution(),
      stageDistributions,
      byVariantAndProp: { ...this.lifetime.byVariantAndProp },
      timeoutCount: this.lifetime.timeoutCount,
      orphanedSequenceCount: this.lifetime.orphanedSequenceCount,
      orphanedSequenceIds: [...this.lifetime.orphanedSequenceIds],
      longestStage: this.lifetime.longestStage
        ? { ...this.lifetime.longestStage }
        : null,
    };
  }

  reset(): void {
    this.sessionStart = this.wallNow();
    this.requestCounter = 0;
    this.pendingRequests.clear();
    this.completedRequests = [];
    this.lifetime = createLifetimeMetrics();
    this.queueHighWaterMark = 0;
    this.uploadSuccesses = 0;
    this.uploadFailures = 0;
  }

  startLogging(): void {
    // Metrics are collected at the call sites. DevTools can call logNow().
  }

  stopLogging(): void {
    // There are no polling listeners to stop.
  }

  logNow(): void {
    const summary = this.getSummary();
    if (summary.totalRequests === 0) return;

    console.log("Thumbnail cache outcomes:");
    console.table(
      Object.fromEntries(
        SUMMARY_LAYERS.map((layer) => [
          layer,
          {
            count: summary.byLayer[layer],
            rate: `${summary.hitRateByLayer[layer].toFixed(1)}%`,
            average: `${summary.avgTimeByLayer[layer].toFixed(0)}ms`,
          },
        ])
      )
    );
    console.log("Thumbnail tail latency:");
    console.table({
      "Time to URL p50": `${summary.timeDistribution.p50.toFixed(0)}ms`,
      "Time to URL p95": `${summary.timeDistribution.p95.toFixed(0)}ms`,
      "Time to URL p99": `${summary.timeDistribution.p99.toFixed(0)}ms`,
      "Render p95": `${summary.renderTimeDistribution.p95.toFixed(0)}ms`,
      "Queue p95": `${summary.queueWaitDistribution.p95.toFixed(0)}ms`,
      "Queue high water": summary.queueHighWaterMark,
      Timeouts: summary.timeoutCount,
    });
  }

  private completePendingRequest(
    requestId: string,
    pending: PendingRequest,
    layer: CacheLayer | "failed",
    wasCancelled: boolean,
    details?: {
      queueWaitTime?: number;
      renderTime?: number;
      errorCode?: string;
    }
  ): ThumbnailRequestMetrics {
    const now = this.now();
    const lastStage = pending.currentStage;
    const lastStageElapsedTime =
      pending.stageStartTime === undefined
        ? undefined
        : now - pending.stageStartTime;
    this.finishCurrentStage(pending, now);

    return {
      requestId,
      layer,
      timeToUrl: now - pending.startTime,
      wasVisibleAtStart: pending.isVisible,
      wasCancelled,
      context: { ...pending.context },
      stageDurations: { ...pending.stageDurations },
      lastStage,
      lastStageElapsedTime,
      latestProgress: pending.latestProgress
        ? { ...pending.latestProgress }
        : undefined,
      queueWaitTime: details?.queueWaitTime,
      renderTime: details?.renderTime,
      errorCode: details?.errorCode,
    };
  }

  private finishCurrentStage(pending: PendingRequest, now: number): void {
    if (
      pending.currentStage === undefined ||
      pending.stageStartTime === undefined
    ) {
      return;
    }
    const previous = pending.stageDurations[pending.currentStage] ?? 0;
    pending.stageDurations[pending.currentStage] =
      previous + Math.max(0, now - pending.stageStartTime);
  }

  private addCompletedRequest(metrics: ThumbnailRequestMetrics): void {
    this.recordLifetimeMetrics(metrics);
    this.completedRequests.push(metrics);
    if (this.completedRequests.length > MAX_STORED_REQUESTS) {
      this.completedRequests =
        this.completedRequests.slice(-MAX_STORED_REQUESTS);
    }
  }

  private recordLifetimeMetrics(metrics: ThumbnailRequestMetrics): void {
    const lifetime = this.lifetime;
    lifetime.totalRequests++;
    lifetime.byLayer[metrics.layer]++;
    lifetime.time.record(metrics.timeToUrl);
    lifetime.timeByLayer[metrics.layer].record(metrics.timeToUrl);

    const groupKey = `${metrics.context.variant}:${metrics.context.propKey}`;
    lifetime.byVariantAndProp[groupKey] =
      (lifetime.byVariantAndProp[groupKey] ?? 0) + 1;

    if (metrics.wasCancelled) lifetime.cancelledCount++;
    if (metrics.layer === "failed" && !metrics.wasCancelled) {
      lifetime.renderFailures++;
    }
    if (metrics.errorCode === "THUMBNAIL_RENDER_TIMEOUT") {
      lifetime.timeoutCount++;
    }
    if (metrics.errorCode === "ORPHANED_SEQUENCE") {
      lifetime.orphanedSequenceCount++;
      if (
        metrics.context.sequenceId &&
        lifetime.orphanedSequenceIds.size < MAX_ORPHANED_SEQUENCE_IDS
      ) {
        lifetime.orphanedSequenceIds.add(metrics.context.sequenceId);
      }
    }

    if (metrics.queueWaitTime !== undefined) {
      lifetime.queueWait.record(metrics.queueWaitTime);
    }
    if (metrics.renderTime !== undefined) {
      lifetime.renderTime.record(metrics.renderTime);
    }

    for (const stage of THUMBNAIL_STAGES) {
      const duration = metrics.stageDurations[stage];
      if (duration === undefined) continue;
      lifetime.stages[stage].record(duration);
      if (!lifetime.longestStage || duration > lifetime.longestStage.duration) {
        lifetime.longestStage = { stage, duration };
      }
    }
  }
}
