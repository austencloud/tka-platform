/**
 * Boot Profiler - instruments the app initialization pipeline.
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

/**
 * Verbose boot logging (DI container table, phase breakdown) is off by default.
 * Enable by appending `?profile=1` to the URL or setting `localStorage.bootProfile = '1'`.
 * Core Web Vitals (FCP, TTFB, etc.) always log - they flag regressions and are cheap.
 */
export function isBootProfileVerbose(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("profile") === "1") return true;
    return window.localStorage?.getItem("bootProfile") === "1";
  } catch {
    return false;
  }
}

interface PhaseEntry {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface VitalEntry {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta?: number;
}

const VITAL_EMOJI = {
  good: "🟢",
  "needs-improvement": "🟡",
  poor: "🔴",
} as const;

class BootProfiler {
  private phases = new Map<string, PhaseEntry>();
  private vitals = new Map<string, VitalEntry>();
  private bootStart: number;
  private enabled: boolean;
  private summaryPrinted = false;
  private pendingSummaryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.bootStart = performance.now();
    this.enabled = typeof window !== "undefined";
  }

  /** Record a Core Web Vital. Only logs when verbose profiling is opted in;
   *  metrics are still captured and available via getVitals() for analytics. */
  recordVital(entry: VitalEntry): void {
    if (!this.enabled) return;
    this.vitals.set(entry.name, entry);
    if (!isBootProfileVerbose()) return;
    const emoji = VITAL_EMOJI[entry.rating] ?? "⚪";
    const formatted =
      entry.name === "CLS" ? entry.value.toFixed(3) : `${Math.round(entry.value)}ms`;
    console.log(
      `%c${emoji} ${entry.name}: ${formatted} (${entry.rating})`,
      "font-weight: bold;"
    );
  }

  /** Snapshot vitals currently captured (may be incomplete - some arrive late). */
  getVitals(): VitalEntry[] {
    return Array.from(this.vitals.values());
  }

  /** Mark the start of a named phase */
  mark(label: string): void {
    if (!this.enabled) return;
    const now = performance.now();
    this.phases.set(label, { label, startTime: now });
    try {
      performance.mark(`boot:${label}:start`);
    } catch {
      // ignored - mark API not available
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

  /**
   * Schedule the final boot summary. Feature modules can call `signalReady(label)`
   * to add a final "route-ready" phase and trigger the summary immediately.
   * If no module signals within the timeout, summary prints anyway.
   */
  scheduleSummary(timeoutMs = 3000): void {
    if (!this.enabled || this.summaryPrinted || this.pendingSummaryTimer) return;
    this.pendingSummaryTimer = setTimeout(() => {
      this.pendingSummaryTimer = null;
      this.summary();
    }, timeoutMs);
  }

  /**
   * Signal that a feature module has finished its post-boot activation.
   * Records a "route:<label>" phase covering total time from boot start to now,
   * cancels any pending timeout, and prints the final summary.
   */
  signalReady(label: string): void {
    if (!this.enabled || this.summaryPrinted) return;
    const now = performance.now();
    this.phases.set(`route:${label}`, {
      label: `route:${label}`,
      startTime: this.bootStart,
      endTime: now,
      duration: now - this.bootStart,
    });
    try {
      performance.mark(`boot:route:${label}:ready`);
    } catch {
      // ignored
    }
    if (this.pendingSummaryTimer) {
      clearTimeout(this.pendingSummaryTimer);
      this.pendingSummaryTimer = null;
    }
    this.summary();
  }

  /** Print a summary table to the console */
  summary(): void {
    if (!this.enabled || this.summaryPrinted) return;
    this.summaryPrinted = true;

    // Performance marks/measures remain for DevTools timeline. Skip the verbose
    // console output unless the user opted in.
    if (!isBootProfileVerbose()) return;

    // Anchor everything to navigation start. performance.now()'s timeOrigin
    // IS navigationStart for the top document, so navStart === 0 in this clock.
    // Total reflects the WHOLE loading screen, not just post-bundle-eval work.
    const totalTime = performance.now();

    // Synthetic pre-JS phases from Navigation Timing so the table covers the
    // network + html-parse + bundle-eval segment that runs before any boot:* mark.
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming | undefined;
    const synthetic: PhaseEntry[] = [];
    if (nav) {
      const ttfb = nav.responseStart - nav.requestStart;
      if (ttfb > 0) {
        synthetic.push({
          label: "net:ttfb (request→response)",
          startTime: nav.requestStart,
          endTime: nav.responseStart,
          duration: ttfb,
        });
      }
      const parseEval = this.bootStart - nav.responseEnd;
      if (parseEval > 0) {
        synthetic.push({
          label: "html:download→bundle-eval",
          startTime: nav.responseEnd,
          endTime: this.bootStart,
          duration: parseEval,
        });
      }
    }

    const entries = [
      ...synthetic,
      ...Array.from(this.phases.values()).filter((p) => p.duration !== undefined),
    ].sort((a, b) => a.startTime - b.startTime);

    // Console table (Start is absolute ms since navigation start)
    const tableData = entries.map((p) => ({
      Phase: p.label,
      "Start (ms)": Math.round(p.startTime),
      "Duration (ms)": Math.round(p.duration!),
      "% of Total": `${((p.duration! / totalTime) * 100).toFixed(1)}%`,
    }));

    console.group(
      `%c⚡ Boot Profile - ${Math.round(totalTime)}ms total`,
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
    this.vitals.clear();
    this.summaryPrinted = false;
    if (this.pendingSummaryTimer) {
      clearTimeout(this.pendingSummaryTimer);
      this.pendingSummaryTimer = null;
    }
    this.bootStart = performance.now();
  }
}

export const bootProfiler = new BootProfiler();
