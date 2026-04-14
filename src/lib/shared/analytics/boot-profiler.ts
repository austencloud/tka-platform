/**
 * Boot Profiler — instruments the app initialization pipeline.
 *
 * Uses performance.mark/measure for DevTools timeline integration,
 * plus a clean console table summary at the end.
 *
 * Usage:
 *   bootProfiler.mark("di-container");
 *   // ... do work ...
 *   bootProfiler.end("di-container");
 *   // ... at the end ...
 *   bootProfiler.summary();
 */

interface PhaseEntry {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class BootProfiler {
  private phases = new Map<string, PhaseEntry>();
  private bootStart: number;
  private enabled: boolean;

  constructor() {
    this.bootStart = performance.now();
    this.enabled = typeof window !== "undefined";
  }

  /** Mark the start of a named phase */
  mark(label: string): void {
    if (!this.enabled) return;
    const now = performance.now();
    this.phases.set(label, { label, startTime: now });
    try {
      performance.mark(`boot:${label}:start`);
    } catch {
      // ignored — mark API not available
    }
  }

  /** Mark the end of a named phase */
  end(label: string): void {
    if (!this.enabled) return;
    const phase = this.phases.get(label);
    if (!phase) {
      console.warn(`[BootProfiler] No start mark for "${label}"`);
      return;
    }
    const now = performance.now();
    phase.endTime = now;
    phase.duration = now - phase.startTime;
    try {
      performance.mark(`boot:${label}:end`);
      performance.measure(`boot:${label}`, `boot:${label}:start`, `boot:${label}:end`);
    } catch {
      // ignored
    }
  }

  /** Print a summary table to the console */
  summary(): void {
    if (!this.enabled) return;

    const totalTime = performance.now() - this.bootStart;
    const entries = Array.from(this.phases.values())
      .filter((p) => p.duration !== undefined)
      .sort((a, b) => a.startTime - b.startTime);

    // Console table
    const tableData = entries.map((p) => ({
      Phase: p.label,
      "Start (ms)": Math.round(p.startTime - this.bootStart),
      "Duration (ms)": Math.round(p.duration!),
      "% of Total": `${((p.duration! / totalTime) * 100).toFixed(1)}%`,
    }));

    console.group(
      `%c⚡ Boot Profile — ${Math.round(totalTime)}ms total`,
      "font-size: 14px; font-weight: bold; color: #4fc3f7;"
    );
    console.table(tableData);

    // Highlight the top 3 slowest phases
    const slowest = [...entries].sort((a, b) => b.duration! - a.duration!).slice(0, 3);
    if (slowest.length > 0) {
      console.log(
        "%cSlowest phases:",
        "font-weight: bold; color: #ff7043;"
      );
      for (const p of slowest) {
        const bar = "█".repeat(Math.max(1, Math.round(p.duration! / 50)));
        console.log(
          `  %c${bar}%c ${p.label}: ${Math.round(p.duration!)}ms`,
          "color: #ff7043;",
          "color: inherit;"
        );
      }
    }

    // Phases still running (missing end call)
    const unfinished = Array.from(this.phases.values()).filter(
      (p) => p.duration === undefined
    );
    if (unfinished.length > 0) {
      console.warn(
        "Phases still running (missing .end()):",
        unfinished.map((p) => p.label)
      );
    }

    console.groupEnd();
  }

  /** Reset for a fresh measurement */
  reset(): void {
    this.phases.clear();
    this.bootStart = performance.now();
  }
}

export const bootProfiler = new BootProfiler();
