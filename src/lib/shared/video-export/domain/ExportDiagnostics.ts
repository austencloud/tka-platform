/**
 * Export Diagnostics
 *
 * Lightweight timing collector for the real-time export capture loop.
 * Measures every step of every frame and dumps a console summary at the
 * end of the export so we can see exactly where time is going.
 *
 * Usage:
 *   const diag = new ExportDiagnostics(width, height, fps, totalFrames, capturePath);
 *   // inside RAF:
 *   diag.rafTick(timestamp);
 *   diag.startFrame();
 *   diag.markDrawImage();    // after drawImage completes
 *   diag.markCapture();      // after capturer.capture() completes
 *   diag.markAddFrame();     // after addFrameCaptured() completes
 *   diag.endFrame();
 *   // after loop:
 *   diag.finish();           // dumps the summary
 */

interface FrameSample {
  drawImageMs: number;
  captureMs: number;
  addFrameMs: number;
  totalMs: number;
}

export class ExportDiagnostics {
  private readonly rafTimestamps: number[] = [];
  private readonly framesPerTick: number[] = [];
  private readonly samples: FrameSample[] = [];

  private exportStartMs = 0;
  private currentTickFrameCount = 0;
  private lastRafTimestamp = -1;

  // Per-frame scratch - set by startFrame, consumed by mark* methods
  private frameStart = 0;
  private afterDrawImage = 0;
  private afterCapture = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly fps: number,
    private readonly totalFrames: number,
    private readonly capturePath: "video-frame" | "image-data"
  ) {
    this.exportStartMs = performance.now();
  }

  /** Call once per requestAnimationFrame callback, before the while loop. */
  rafTick(timestamp: number): void {
    // Close out the previous tick's frame count
    if (this.lastRafTimestamp >= 0) {
      this.framesPerTick.push(this.currentTickFrameCount);
    }
    this.rafTimestamps.push(timestamp);
    this.currentTickFrameCount = 0;
    this.lastRafTimestamp = timestamp;
  }

  /** Call at the start of each frame inside the while loop. */
  startFrame(): void {
    this.frameStart = performance.now();
    this.currentTickFrameCount++;
  }

  /** Call immediately after drawImage completes. */
  markDrawImage(): void {
    this.afterDrawImage = performance.now();
  }

  /** Call immediately after capturer.capture() completes. */
  markCapture(): void {
    this.afterCapture = performance.now();
  }

  /** Call immediately after addFrameCaptured completes. */
  markAddFrame(): void {
    const now = performance.now();
    this.samples.push({
      drawImageMs: this.afterDrawImage - this.frameStart,
      captureMs: this.afterCapture - this.afterDrawImage,
      addFrameMs: now - this.afterCapture,
      totalMs: now - this.frameStart,
    });
  }

  /** Finalize and dump the summary to console. */
  finish(): void {
    // Close out the last tick's frame count
    this.framesPerTick.push(this.currentTickFrameCount);

    const wallTimeMs = performance.now() - this.exportStartMs;
    const expectedMs = (this.totalFrames / this.fps) * 1000;

    // RAF interval stats
    const rafIntervals: number[] = [];
    for (let i = 1; i < this.rafTimestamps.length; i++) {
      rafIntervals.push(this.rafTimestamps[i]! - this.rafTimestamps[i - 1]!);
    }

    // Frames-per-tick histogram
    const fptHistogram: Record<number, number> = {};
    for (const count of this.framesPerTick) {
      fptHistogram[count] = (fptHistogram[count] ?? 0) + 1;
    }

    // Heavy ticks: ticks where we captured 3+ frames (falling behind)
    const heavyTicks = this.framesPerTick.filter((c) => c >= 3).length;

    // Long RAF gaps: intervals > 2x the expected frame budget
    const frameBudgetMs = 1000 / this.fps;
    const longGaps = rafIntervals.filter((i) => i > frameBudgetMs * 2).length;

    const drawImageMs = this.samples.map((s) => s.drawImageMs);
    const captureMs = this.samples.map((s) => s.captureMs);
    const addFrameMs = this.samples.map((s) => s.addFrameMs);
    const totalMs = this.samples.map((s) => s.totalMs);

    const pct = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(
        Math.floor(sorted.length * (p / 100)),
        sorted.length - 1
      );
      return sorted[idx]!;
    };
    const mean = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = (arr: number[]) =>
      arr.length === 0 ? 0 : Math.max(...arr);
    const fmt = (n: number) => n.toFixed(2);

    // Build the histogram string sorted by key
    const histKeys = Object.keys(fptHistogram)
      .map(Number)
      .sort((a, b) => a - b);
    const histStr = histKeys
      .map((k) => `${k}: ${fptHistogram[k] ?? 0}`)
      .join(", ");

    console.group(
      "%c=== Export Diagnostics ===",
      "color: #4fc3f7; font-weight: bold; font-size: 14px"
    );
    console.log(
      `Config: ${this.width}x${this.height} @ ${this.fps}fps, ${this.totalFrames} frames`
    );
    console.log(`Capture path: ${this.capturePath}`);
    console.log(
      `Wall time: ${fmt(wallTimeMs / 1000)}s (expected: ${fmt(expectedMs / 1000)}s, ratio: ${fmt(wallTimeMs / expectedMs)}x)`
    );
    console.log("");

    console.log(
      `RAF ticks: ${this.rafTimestamps.length}  |  ` +
        `interval: p50=${fmt(pct(rafIntervals, 50))}ms, p95=${fmt(pct(rafIntervals, 95))}ms, max=${fmt(max(rafIntervals))}ms`
    );
    console.log(
      `Frames/tick: mean=${fmt(mean(this.framesPerTick))}, max=${max(this.framesPerTick)}  |  histogram: {${histStr}}`
    );
    console.log(
      `Long RAF gaps (>2x budget): ${longGaps}  |  Heavy ticks (3+ frames): ${heavyTicks}`
    );
    console.log("");

    console.log("Per-frame timings (ms):");
    console.log(
      `  drawImage:  p50=${fmt(pct(drawImageMs, 50))}, p95=${fmt(pct(drawImageMs, 95))}, max=${fmt(max(drawImageMs))}`
    );
    console.log(
      `  capture:    p50=${fmt(pct(captureMs, 50))}, p95=${fmt(pct(captureMs, 95))}, max=${fmt(max(captureMs))}`
    );
    console.log(
      `  addFrame:   p50=${fmt(pct(addFrameMs, 50))}, p95=${fmt(pct(addFrameMs, 95))}, max=${fmt(max(addFrameMs))}`
    );
    console.log(
      `  total:      p50=${fmt(pct(totalMs, 50))}, p95=${fmt(pct(totalMs, 95))}, max=${fmt(max(totalMs))}`
    );
    console.log("");

    // Frame budget analysis
    const overBudget = totalMs.filter((t) => t > frameBudgetMs).length;
    console.log(
      `Frame budget: ${fmt(frameBudgetMs)}ms  |  Over budget: ${overBudget}/${this.samples.length} frames (${fmt((overBudget / Math.max(this.samples.length, 1)) * 100)}%)`
    );

    console.groupEnd();
  }
}
