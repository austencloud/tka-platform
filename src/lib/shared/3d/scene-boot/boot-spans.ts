import {
  finishBootProfile,
  markBootPhaseEnd,
  markBootPhaseStart,
  recordBootFeatureReady,
  startBootProfile,
} from "./boot-profiler";
import type { FrameGateVerdict } from "./frame-gate";

export type BootPhase = "assets" | "compile" | "settle";

export interface SceneBootSummary {
  assetsMs: number | null;
  compileMs: number | null;
  settleMs: number | null;
  frameGate: FrameGateVerdict | null;
  revealedAt: number | null;
}

declare global {
  interface Window {
    __sceneBoot?: SceneBootSummary;
  }
}

function emptySummary(): SceneBootSummary {
  return {
    assetsMs: null,
    compileMs: null,
    settleMs: null,
    frameGate: null,
    revealedAt: null,
  };
}

function getSummary(): SceneBootSummary | null {
  if (typeof window === "undefined") return null;
  if (!window.__sceneBoot) window.__sceneBoot = emptySummary();
  return window.__sceneBoot;
}

function hasPerformance(): boolean {
  return (
    typeof performance !== "undefined" &&
    typeof performance.mark === "function" &&
    typeof performance.measure === "function"
  );
}

export function resetBootSpans(): void {
  if (typeof window === "undefined") return;
  window.__sceneBoot = emptySummary();
  // Attribution has to be armed before the first asset moves, so it starts
  // with the span it explains. Opt-in; a no-op unless the flag is set.
  startBootProfile();
  if (!hasPerformance() || typeof performance.clearMarks !== "function") return;
  for (const phase of ["assets", "compile", "settle"] as const) {
    performance.clearMarks(`scene-boot:${phase}:start`);
    performance.clearMarks(`scene-boot:${phase}:end`);
    performance.clearMeasures?.(`scene-boot:${phase}`);
  }
}

export function beginBootSpan(phase: BootPhase): void {
  markBootPhaseStart(phase);
  if (!hasPerformance()) return;
  performance.mark(`scene-boot:${phase}:start`);
}

export function endBootSpan(phase: BootPhase): void {
  markBootPhaseEnd(phase);
  if (!hasPerformance()) return;
  performance.mark(`scene-boot:${phase}:end`);
  let durationMs: number | null = null;
  try {
    const measure = performance.measure(
      `scene-boot:${phase}`,
      `scene-boot:${phase}:start`,
      `scene-boot:${phase}:end`
    );
    durationMs = measure?.duration ?? null;
  } catch {
    // A span can end without a start when a warm-up is cancelled mid-flight.
    // The timing is lost; readiness is not.
    return;
  }
  const summary = getSummary();
  if (!summary || durationMs === null) return;
  if (phase === "assets") summary.assetsMs = durationMs;
  else if (phase === "compile") summary.compileMs = durationMs;
  else summary.settleMs = durationMs;
}

export function recordFrameGateVerdict(verdict: FrameGateVerdict): void {
  const summary = getSummary();
  if (summary) summary.frameGate = verdict;
}

export function recordReveal(): void {
  finishBootProfile();
  const summary = getSummary();
  if (!summary) return;
  summary.revealedAt = hasPerformance() ? performance.now() : null;
}

/**
 * Which scene feature finished when. The long pole across features is the
 * first thing worth knowing about a slow boot, and only the feature state
 * knows the moment readiness flips.
 */
export function recordFeatureReady(key: string): void {
  recordBootFeatureReady(key);
}
