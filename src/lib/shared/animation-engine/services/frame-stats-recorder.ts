/**
 * Frame Stats Recorder — dev-only playback smoothness instrumentation.
 *
 * Answers "how bad is the stutter, exactly" with numbers instead of feel, and
 * gives a before/after yardstick for perf work on the animation panel. It is a
 * MEASUREMENT tool; FrameBudgetMonitor (same directory) is the runtime
 * quality-tier adapter — different job, do not merge them.
 *
 * Two signals per frame, recorded by AnimationLoop:
 *  - rafDelta: gap between consecutive rAF timestamps. Total frame cost —
 *    script + Svelte flush + style/layout/paint + anything else on the main
 *    thread. Gaps ≫ the display interval are the stutter the eye sees.
 *  - updateMs: time spent inside the playback update callback (engine
 *    interpolation + prop-state writes). If rafDelta spikes but updateMs stays
 *    small, the cost is downstream of the loop (rendering/reactivity), not in
 *    the engine math.
 *
 * Reporting: `window.__tkaFrameStats.summary()` provides an on-demand
 * cumulative readout and `.reset()` starts a fresh measurement window. Set
 * localStorage "tka-frame-stats-live" to "1" when automatic five-second
 * console reports are useful for a focused profiling session.
 *
 * Cost & gating: enabled only in dev builds, or when localStorage
 * "tka-frame-stats" === "1" (prod debugging escape hatch). When disabled,
 * record() is a single boolean check — no arrays, no logging, nothing on the
 * hot path in production.
 */

const REPORT_INTERVAL_MS = 5000;
// A frame slower than this is a visible hitch at 60Hz (2+ missed vsyncs).
const HITCH_THRESHOLD_MS = 25;
// Ignore pathological gaps (tab hidden, breakpoint) so they don't poison stats.
const OUTLIER_CUTOFF_MS = 1000;

interface WindowStats {
  frames: number;
  avgMs: number;
  p95Ms: number;
  worstMs: number;
  hitches: number;
  hitchPct: number;
  effectiveFps: number;
  avgUpdateMs: number;
  worstUpdateMs: number;
}

function computeStats(deltas: number[], updates: number[]): WindowStats | null {
  if (deltas.length === 0) return null;
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const hitches = sorted.filter((d) => d > HITCH_THRESHOLD_MS).length;
  const updateSum = updates.reduce((a, b) => a + b, 0);
  return {
    frames: sorted.length,
    avgMs: sum / sorted.length,
    p95Ms:
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!,
    worstMs: sorted[sorted.length - 1]!,
    hitches,
    hitchPct: (hitches / sorted.length) * 100,
    effectiveFps: 1000 / (sum / sorted.length),
    avgUpdateMs: updates.length ? updateSum / updates.length : 0,
    worstUpdateMs: updates.length ? Math.max(...updates) : 0,
  };
}

function fmt(s: WindowStats): string {
  return (
    `${s.frames} frames | avg ${s.avgMs.toFixed(1)}ms (${s.effectiveFps.toFixed(0)}fps) | ` +
    `p95 ${s.p95Ms.toFixed(1)}ms | worst ${s.worstMs.toFixed(1)}ms | ` +
    `hitches(>${HITCH_THRESHOLD_MS}ms) ${s.hitches} (${s.hitchPct.toFixed(1)}%) | ` +
    `update cb avg ${s.avgUpdateMs.toFixed(2)}ms / worst ${s.worstUpdateMs.toFixed(1)}ms`
  );
}

class FrameStatsRecorder {
  readonly enabled: boolean;
  readonly liveReporting: boolean;

  // Rolling window (flushed each report)
  #deltas: number[] = [];
  #updates: number[] = [];
  // Cumulative since last reset() (for summary())
  #allDeltas: number[] = [];
  #allUpdates: number[] = [];
  #lastReport = 0;

  constructor() {
    let liveReporting = false;
    try {
      liveReporting = localStorage.getItem("tka-frame-stats-live") === "1";
    } catch {
      // Storage is optional; on-demand dev measurements still work without it.
    }
    this.liveReporting = liveReporting;
    this.enabled =
      typeof window !== "undefined" &&
      (import.meta.env.DEV ||
        liveReporting ||
        (() => {
          try {
            return localStorage.getItem("tka-frame-stats") === "1";
          } catch {
            return false;
          }
        })());
    if (this.enabled) {
      (window as unknown as Record<string, unknown>)["__tkaFrameStats"] = {
        summary: () => this.summary(),
        reset: () => this.reset(),
      };
    }
  }

  record(rafDelta: number, updateMs: number): void {
    if (!this.enabled) return;
    if (rafDelta <= 0 || rafDelta > OUTLIER_CUTOFF_MS) return;
    this.#allDeltas.push(rafDelta);
    this.#allUpdates.push(updateMs);

    if (!this.liveReporting) return;
    this.#deltas.push(rafDelta);
    this.#updates.push(updateMs);

    const now = performance.now();
    if (this.#lastReport === 0) this.#lastReport = now;
    if (now - this.#lastReport >= REPORT_INTERVAL_MS) {
      const stats = computeStats(this.#deltas, this.#updates);
      if (stats)
        console.info(
          `[FrameStats] last ${((now - this.#lastReport) / 1000).toFixed(1)}s: ${fmt(stats)}`
        );
      this.#deltas = [];
      this.#updates = [];
      this.#lastReport = now;
    }
  }

  /** Cumulative stats since load/reset — call window.__tkaFrameStats.summary(). */
  summary(): WindowStats | null {
    const stats = computeStats(this.#allDeltas, this.#allUpdates);
    if (stats) console.info(`[FrameStats] cumulative: ${fmt(stats)}`);
    else
      console.info(
        "[FrameStats] no frames recorded yet — start playback first"
      );
    return stats;
  }

  reset(): void {
    this.#deltas = [];
    this.#updates = [];
    this.#allDeltas = [];
    this.#allUpdates = [];
    this.#lastReport = 0;
    console.info("[FrameStats] reset");
  }
}

/** Module singleton — all AnimationLoop instances feed one recorder. Fine in
 *  practice: hosts run one playing loop at a time (the guide companion, a
 *  gallery detail). If two ever play at once the stats blend — acceptable for
 *  a dev diagnostic, noted here so nobody trusts blended numbers. */
export const frameStatsRecorder = new FrameStatsRecorder();
