export interface FrameGateConfig {
  /** Consecutive frames inside budget before the scene counts as smooth. */
  requiredConsecutive: number;
  /** A frame slower than this resets the streak (20ms ≈ under 50fps). */
  frameBudgetMs: number;
  /** A weak GPU never holds the curtain hostage past this point. */
  capMs: number;
}

export const DEFAULT_FRAME_GATE: FrameGateConfig = {
  requiredConsecutive: 5,
  frameBudgetMs: 20,
  capMs: 1500,
};

export type FrameGateVerdict = "passed" | "capped";

export interface FrameGate {
  /** Feed one frame; returns true once the scene may be revealed. */
  observe(deltaMs: number, elapsedMs: number): boolean;
  /** How far along the streak is, 0–1 — drives the last sliver of the bar. */
  readonly streakFraction: number;
  /** Null until the gate opens, then how it opened. */
  readonly verdict: FrameGateVerdict | null;
}

export function createFrameGate(config?: Partial<FrameGateConfig>): FrameGate {
  const { requiredConsecutive, frameBudgetMs, capMs } = {
    ...DEFAULT_FRAME_GATE,
    ...config,
  };

  let streak = 0;
  let verdict: FrameGateVerdict | null = null;

  return {
    observe(deltaMs: number, elapsedMs: number): boolean {
      if (verdict) return true;

      streak = deltaMs <= frameBudgetMs ? streak + 1 : 0;

      if (streak >= requiredConsecutive) {
        verdict = "passed";
        return true;
      }
      // The cap is checked after the streak so a frame that completes the
      // streak on the very last millisecond still reports an honest pass.
      if (elapsedMs >= capMs) {
        verdict = "capped";
        return true;
      }
      return false;
    },
    get streakFraction(): number {
      if (verdict) return 1;
      return Math.min(1, streak / requiredConsecutive);
    },
    get verdict(): FrameGateVerdict | null {
      return verdict;
    },
  };
}
