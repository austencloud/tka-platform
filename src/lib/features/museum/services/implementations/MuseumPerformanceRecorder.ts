import type {
  IMuseumPerformanceRecorder,
  MuseumFrameContext,
  MuseumHitchSample,
  MuseumPerformanceSnapshot,
  MuseumPhaseSummary,
  MuseumRendererSample,
} from "../contracts/IMuseumPerformanceRecorder";

const MAX_FRAME_SAMPLES = 1_800;
const MAX_PHASE_SAMPLES = 600;
const MAX_HITCH_SAMPLES = 80;
const HITCH_THRESHOLD_MS = 50;
const USER_TIMING_THRESHOLD_MS = 4;

interface LongAnimationFrameEntry extends PerformanceEntry {
  blockingDuration?: number;
  renderStart?: number;
  styleAndLayoutStart?: number;
  scripts?: Array<{
    sourceURL?: string;
    sourceFunctionName?: string;
    invoker?: string;
    duration?: number;
    forcedStyleAndLayoutDuration?: number;
  }>;
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(quantile * sorted.length) - 1)
  ]!;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function summarize(
  name: string,
  values: readonly number[]
): MuseumPhaseSummary {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    name,
    count: values.length,
    averageMs: rounded(total / Math.max(values.length, 1)),
    p50Ms: rounded(percentile(values, 0.5)),
    p95Ms: rounded(percentile(values, 0.95)),
    p99Ms: rounded(percentile(values, 0.99)),
    maxMs: rounded(Math.max(0, ...values)),
  };
}

export class MuseumPerformanceRecorder implements IMuseumPerformanceRecorder {
  enabled = false;

  private startedAt: number | null = null;
  private frameSamples: number[] = [];
  private readonly phaseSamples = new Map<string, number[]>();
  private rendererSample: MuseumRendererSample | null = null;
  private hitches: MuseumHitchSample[] = [];
  private currentContext: MuseumFrameContext | null = null;
  private currentFramePhases = new Map<string, number>();
  private observers: PerformanceObserver[] = [];

  start(options: { observeBrowser?: boolean } = {}): void {
    if (this.enabled) return;
    this.enabled = true;
    this.startedAt = performance.now();
    this.installBrowserObservers(options.observeBrowser ?? true);
    this.exposeBrowserApi();
  }

  stop(): void {
    this.enabled = false;
    for (const observer of this.observers) observer.disconnect();
    this.observers = [];
  }

  clear(): void {
    this.frameSamples = [];
    this.phaseSamples.clear();
    this.rendererSample = null;
    this.hitches = [];
    this.currentFramePhases.clear();
    this.startedAt = this.enabled ? performance.now() : null;
  }

  beginPhase(): number {
    return this.enabled ? performance.now() : 0;
  }

  endPhase(name: string, startedAt: number): number {
    if (!this.enabled || startedAt === 0) return 0;
    const durationMs = performance.now() - startedAt;
    this.recordPhaseDuration(name, durationMs);
    return durationMs;
  }

  recordPhaseDuration(name: string, durationMs: number): void {
    if (!this.enabled || !Number.isFinite(durationMs) || durationMs < 0) return;
    const samples = this.phaseSamples.get(name) ?? [];
    samples.push(durationMs);
    if (samples.length > MAX_PHASE_SAMPLES) samples.shift();
    this.phaseSamples.set(name, samples);
    this.currentFramePhases.set(name, durationMs);

    if (durationMs >= USER_TIMING_THRESHOLD_MS) {
      try {
        const measureName = `museum:${name}`;
        const measureEnd = performance.now();
        performance.measure(measureName, {
          start: measureEnd - durationMs,
          end: measureEnd,
        });
        performance.clearMeasures(measureName);
      } catch {
        // User Timing is supplementary. The recorder remains useful without it.
      }
    }
  }

  recordFrame(durationMs: number, context: MuseumFrameContext): void {
    if (!this.enabled || !Number.isFinite(durationMs) || durationMs < 0) return;
    this.currentContext = {
      ...context,
      position: { ...context.position },
    };
    this.frameSamples.push(durationMs);
    if (this.frameSamples.length > MAX_FRAME_SAMPLES) this.frameSamples.shift();

    if (durationMs >= HITCH_THRESHOLD_MS) {
      this.pushHitch({
        timestamp: performance.now(),
        frameMs: durationMs,
        blockingMs: null,
        renderMs: null,
        styleAndLayoutMs: null,
        worstPhase: this.getWorstCurrentPhase(),
        context: this.currentContext,
        scripts: [],
        source: "frame",
      });
    }
    this.currentFramePhases.clear();
  }

  recordRendererSample(sample: Omit<MuseumRendererSample, "timestamp">): void {
    if (!this.enabled) return;
    this.rendererSample = { ...sample, timestamp: performance.now() };
  }

  getSnapshot(): MuseumPerformanceSnapshot {
    const frames = summarize("frame", this.frameSamples);
    const phases = [...this.phaseSamples.entries()]
      .map(([name, samples]) => summarize(name, samples))
      .sort((a, b) => b.p95Ms - a.p95Ms || b.maxMs - a.maxMs);
    return {
      enabled: this.enabled,
      startedAt: this.startedAt,
      capturedAt: performance.now(),
      frames: {
        count: frames.count,
        averageMs: frames.averageMs,
        p50Ms: frames.p50Ms,
        p95Ms: frames.p95Ms,
        p99Ms: frames.p99Ms,
        maxMs: frames.maxMs,
        over33Ms: this.frameSamples.filter((value) => value >= 33.4).length,
        over50Ms: this.frameSamples.filter((value) => value >= 50).length,
        over100Ms: this.frameSamples.filter((value) => value >= 100).length,
      },
      phases,
      renderer: this.rendererSample ? { ...this.rendererSample } : null,
      hitches: this.hitches.map((hitch) => ({
        ...hitch,
        context: hitch.context
          ? { ...hitch.context, position: { ...hitch.context.position } }
          : null,
        scripts: hitch.scripts.map((script) => ({ ...script })),
      })),
    };
  }

  private getWorstCurrentPhase(): { name: string; durationMs: number } | null {
    let worst: { name: string; durationMs: number } | null = null;
    for (const [name, durationMs] of this.currentFramePhases) {
      if (!worst || durationMs > worst.durationMs) worst = { name, durationMs };
    }
    return worst ? { ...worst, durationMs: rounded(worst.durationMs) } : null;
  }

  private pushHitch(hitch: MuseumHitchSample): void {
    this.hitches.push(hitch);
    if (this.hitches.length > MAX_HITCH_SAMPLES) this.hitches.shift();
  }

  private installBrowserObservers(observeBrowser: boolean): void {
    if (!observeBrowser || typeof PerformanceObserver === "undefined") return;
    const supported = PerformanceObserver.supportedEntryTypes ?? [];

    if (supported.includes("long-animation-frame")) {
      const observer = new PerformanceObserver((list) => {
        if (!this.enabled) return;
        for (const rawEntry of list.getEntries()) {
          const entry = rawEntry as LongAnimationFrameEntry;
          const scripts = (entry.scripts ?? [])
            .map((script) => ({
              sourceURL: script.sourceURL ?? "",
              sourceFunctionName: script.sourceFunctionName ?? "",
              invoker: script.invoker ?? "",
              durationMs: rounded(script.duration ?? 0),
              forcedStyleAndLayoutMs: rounded(
                script.forcedStyleAndLayoutDuration ?? 0
              ),
            }))
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, 5);
          this.pushHitch({
            timestamp: entry.startTime,
            frameMs: rounded(entry.duration),
            blockingMs: rounded(entry.blockingDuration ?? 0),
            renderMs: entry.renderStart
              ? rounded(entry.startTime + entry.duration - entry.renderStart)
              : null,
            styleAndLayoutMs: entry.styleAndLayoutStart
              ? rounded(
                  entry.startTime + entry.duration - entry.styleAndLayoutStart
                )
              : null,
            worstPhase: this.getWorstCurrentPhase(),
            context: this.currentContext,
            scripts,
            source: "long-animation-frame",
          });
        }
      });
      observer.observe({
        type: "long-animation-frame",
        buffered: true,
      } as PerformanceObserverInit);
      this.observers.push(observer);
      return;
    }

    if (supported.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        if (!this.enabled) return;
        for (const entry of list.getEntries()) {
          this.pushHitch({
            timestamp: entry.startTime,
            frameMs: rounded(entry.duration),
            blockingMs: rounded(
              Math.max(0, entry.duration - HITCH_THRESHOLD_MS)
            ),
            renderMs: null,
            styleAndLayoutMs: null,
            worstPhase: this.getWorstCurrentPhase(),
            context: this.currentContext,
            scripts: [],
            source: "long-task",
          });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
      this.observers.push(observer);
    }
  }

  private exposeBrowserApi(): void {
    if (typeof window === "undefined") return;
    (
      window as unknown as {
        __museumPerformance?: {
          getSnapshot: () => MuseumPerformanceSnapshot;
          clear: () => void;
        };
      }
    ).__museumPerformance = {
      getSnapshot: () => this.getSnapshot(),
      clear: () => this.clear(),
    };
  }
}
