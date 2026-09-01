export interface RendererFrameWindowSnapshot {
  sampleCount: number;
  frameP50Ms: number;
  frameP95Ms: number;
  frameP99Ms: number;
  longFrameRate: number;
  /** Relative median-frame slowdown between the first and final fifth. */
  thermalDrift: number;
}

export interface RendererPerformanceSample extends RendererFrameWindowSnapshot {
  fps: number;
  peakFrameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  gpuTimingSupported: boolean;
  gpuSampleCount: number;
  gpuP50Ms: number;
  gpuP95Ms: number;
  gpuP99Ms: number;
}

export interface RendererPerformanceWindow {
  record(frameMs: number): void;
  reset(): void;
  snapshot(): RendererFrameWindowSnapshot;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.floor((sorted.length - 1) * ratio);
  return sorted[index] ?? 0;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export function createRendererPerformanceWindow(
  maximumSamples = 7_200
): RendererPerformanceWindow {
  const frameTimes: number[] = [];

  return {
    record(frameMs) {
      if (!Number.isFinite(frameMs) || frameMs <= 0) return;
      frameTimes.push(frameMs);
      if (frameTimes.length > maximumSamples) frameTimes.shift();
    },
    reset() {
      frameTimes.length = 0;
    },
    snapshot() {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const sampleCount = sorted.length;
      const fifthSize = Math.max(1, Math.floor(frameTimes.length / 5));
      const openingMedian = median(frameTimes.slice(0, fifthSize));
      const closingMedian = median(frameTimes.slice(-fifthSize));

      return {
        sampleCount,
        frameP50Ms: percentile(sorted, 0.5),
        frameP95Ms: percentile(sorted, 0.95),
        frameP99Ms: percentile(sorted, 0.99),
        longFrameRate:
          sampleCount === 0
            ? 0
            : sorted.filter((frameMs) => frameMs > 33).length / sampleCount,
        thermalDrift:
          openingMedian > 0
            ? (closingMedian - openingMedian) / openingMedian
            : 0,
      };
    },
  };
}
