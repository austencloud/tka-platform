export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  fishCount: number;
  jellyfishCount: number;
  bubbleCount: number;
  updateTime: number;
  renderTime: number;
}

export interface IDeepOceanPerformanceMonitor {
  startFrame(): void;
  endUpdate(): void;
  endRender(
    fishCount: number,
    jellyfishCount: number,
    bubbleCount: number
  ): void;
  getMetrics(): PerformanceMetrics;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
}

/**
 * Lightweight performance monitor for deep ocean background.
 * Tracks FPS, frame times, and entity counts.
 * Disabled by default - enable via console or dev tools.
 */
export class DeepOceanPerformanceMonitor implements IDeepOceanPerformanceMonitor {
  private enabled = false;
  private frameStart = 0;
  private updateEnd = 0;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateInterval = 500; // Update FPS every 500ms
  private lastFpsUpdate = 0;
  private currentFps = 0;

  // Rolling averages
  private frameTimes: number[] = [];
  private updateTimes: number[] = [];
  private renderTimes: number[] = [];
  private readonly maxSamples = 60;

  private latestMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    fishCount: 0,
    jellyfishCount: 0,
    bubbleCount: 0,
    updateTime: 0,
    renderTime: 0,
  };

  startFrame(): void {
    if (!this.enabled) return;
    this.frameStart = performance.now();
  }

  endUpdate(): void {
    if (!this.enabled) return;
    this.updateEnd = performance.now();
    const updateTime = this.updateEnd - this.frameStart;
    this.updateTimes.push(updateTime);
    if (this.updateTimes.length > this.maxSamples) {
      this.updateTimes.shift();
    }
  }

  endRender(
    fishCount: number,
    jellyfishCount: number,
    bubbleCount: number
  ): void {
    if (!this.enabled) return;

    const now = performance.now();
    const renderTime = now - this.updateEnd;
    const frameTime = now - this.frameStart;

    this.renderTimes.push(renderTime);
    this.frameTimes.push(frameTime);

    if (this.renderTimes.length > this.maxSamples) {
      this.renderTimes.shift();
    }
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.currentFps = Math.round(
        (this.frameCount * 1000) / (now - this.lastFpsUpdate)
      );
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.lastFrameTime = frameTime;

    // Update metrics
    this.latestMetrics = {
      fps: this.currentFps,
      frameTime: this.average(this.frameTimes),
      fishCount,
      jellyfishCount,
      bubbleCount,
      updateTime: this.average(this.updateTimes),
      renderTime: this.average(this.renderTimes),
    };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.latestMetrics };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.reset();
    }
  }

  private reset(): void {
    this.frameTimes = [];
    this.updateTimes = [];
    this.renderTimes = [];
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Singleton instance for console access
let _monitorInstance: DeepOceanPerformanceMonitor | null = null;

export function setMonitorInstance(monitor: DeepOceanPerformanceMonitor): void {
  _monitorInstance = monitor;

  // Expose to console for debugging
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).enableDeepOceanPerf = () => {
      monitor.setEnabled(true);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).disableDeepOceanPerf = () => {
      monitor.setEnabled(false);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).getDeepOceanMetrics = () => {
      const m = monitor.getMetrics();
      console.table({
        FPS: m.fps,
        "Frame Time (ms)": m.frameTime.toFixed(2),
        "Update Time (ms)": m.updateTime.toFixed(2),
        "Render Time (ms)": m.renderTime.toFixed(2),
        "Fish Count": m.fishCount,
        "Jellyfish Count": m.jellyfishCount,
        "Bubble Count": m.bubbleCount,
      });
      return m;
    };
  }
}
