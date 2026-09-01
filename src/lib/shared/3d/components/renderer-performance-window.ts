export interface RendererFrameWindowSnapshot {
  sampleCount: number;
  frameP50Ms: number;
  frameP95Ms: number;
  frameP99Ms: number;
  longFrameRate: number;
  /** Relative median-frame slowdown between the first and final 30-second windows. */
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

export interface RendererInfoFrameCounters {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

interface RendererInfoSource {
  autoReset: boolean;
  render: { calls: number; triangles: number };
  memory: { geometries: number; textures: number };
  programs?: readonly unknown[] | null;
  reset(): void;
}

export interface RendererInfoFrameSampler {
  sampleAndReset(): RendererInfoFrameCounters;
  dispose(): void;
}

/**
 * Three resets renderer.info after each renderer.render() by default. A
 * post-processing composer renders several times, so reading at frame end can
 * otherwise report only the final fullscreen pass. This owner disables those
 * per-pass resets and performs exactly one reset at the next frame boundary.
 */
export function createRendererInfoFrameSampler(
  info: RendererInfoSource
): RendererInfoFrameSampler {
  const originalAutoReset = info.autoReset;
  info.autoReset = false;

  return {
    sampleAndReset() {
      const sample = {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
      };
      info.reset();
      return sample;
    },
    dispose() {
      info.autoReset = originalAutoReset;
    },
  };
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

const THERMAL_EDGE_WINDOW_MS = 30_000;

function takeDurationEdge(
  values: readonly number[],
  fromStart: boolean
): number[] {
  const edge: number[] = [];
  let durationMs = 0;
  for (
    let index = fromStart ? 0 : values.length - 1;
    index >= 0 && index < values.length && durationMs < THERMAL_EDGE_WINDOW_MS;
    index += fromStart ? 1 : -1
  ) {
    const frameMs = values[index] ?? 0;
    edge.push(frameMs);
    durationMs += frameMs;
  }
  return edge;
}

export function createRendererPerformanceWindow(
  maximumSamples = 14_400
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
      const measuredDurationMs = frameTimes.reduce(
        (total, frameMs) => total + frameMs,
        0
      );
      const hasThermalWindow = measuredDurationMs >= THERMAL_EDGE_WINDOW_MS * 2;
      const openingMedian = hasThermalWindow
        ? median(takeDurationEdge(frameTimes, true))
        : 0;
      const closingMedian = hasThermalWindow
        ? median(takeDurationEdge(frameTimes, false))
        : 0;

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
