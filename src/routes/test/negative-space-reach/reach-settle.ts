/**
 * Whether a pane's rig has actually stopped moving since its last phase
 * change — cold load, a pasted URL, Finer, Coarser, or a body/route swap.
 *
 * Two independent verifications read this page's numbers mid-transient: one
 * caught `thumbEndAboveForearmMm` at −131 mm on one route, another at +20 mm
 * on a different one, both before the rig had finished arriving. Fifteen to
 * twenty seconds later, in a loaded browser, both settled to the same value.
 * A number read before settling is not a measurement. This module gives every
 * pane a way to say, on its own, whether the number it is currently showing
 * is one of those or the real thing.
 *
 * **Ticks and milliseconds are reported separately, on purpose.** They answer
 * two different questions that look identical from a single settle time:
 *
 * - If a pane always needs many ticks regardless of how long that takes in
 *   wall-clock time, the rig's own smoother is slow per rendered frame — the
 *   character is genuinely still mid-transition at performance tempo, and
 *   waiting longer in a faster browser would not help.
 * - If a pane needs few ticks but a long wall-clock time, the browser was
 *   simply slow to deliver frames — the rig itself settled quickly once it
 *   was given the chance to run, and the fix is not inside the smoother.
 *
 * Collapsing the two into one settle time would hide which of those it is.
 *
 * **Telemetry only.** Nothing here reads or writes pose, grip, or the solve —
 * it watches two numbers `reach-telemetry.ts` already produces and reports
 * when they stop changing.
 */

import { distanceMm, type ReachFrame, type Vec3 } from "./reach-telemetry";

export interface SettleReading {
  readonly settled: boolean;
  /** rAF ticks since the phase change — see the module doc for why this is kept apart from `ms`. */
  readonly ticks: number;
  /** Wall-clock milliseconds since the phase change. */
  readonly ms: number;
}

/**
 * How far the wrist may drift between ticks and still count as quiet, in
 * millimetres. A staff-grip solve settles with sub-millimetre float jitter;
 * half a millimetre sits above that noise floor and below anything a viewer
 * could see move on screen at this page's zoom levels.
 */
export const SETTLE_POSITION_THRESHOLD_MM = 0.5;

/**
 * The same threshold applied to `thumbEndVsForearmMm` directly, since that is
 * the number the compact readout actually shows — a wrist that has stopped
 * moving overall could still be carrying a thumb end that has not.
 */
export const SETTLE_DEPTH_THRESHOLD_MM = 0.5;

/**
 * Consecutive quiet ticks required before a pane counts as settled. One quiet
 * tick alone is not proof: collision detection and the arm solve share a
 * single task, and a mid-oscillation sample can land on an identical value by
 * chance. Thirty ticks is half a second at 60 fps — long enough that a lucky
 * single frame cannot pass, short enough that a pane that has genuinely
 * stopped still reports within a fraction of a second of doing so.
 */
export const SETTLE_CONSECUTIVE_TICKS = 30;

const UNOBSERVED: SettleReading = { settled: false, ticks: 0, ms: 0 };

/**
 * Per-pane settle state. One instance per filmstrip pane, matching how
 * `+page.svelte` already keys poses, grips, and shoulder points by the
 * pane's frame percent rather than array index.
 */
export class PaneSettleTracker {
  #tickCount = 0;
  #quietStreak = 0;
  #settledAtTick: number | null = null;
  #settledAtMs: number | null = null;
  #startMs = 0;
  #previousWrist: Vec3 | null = null;
  #previousDepthMm: number | null = null;
  #lastReading: SettleReading = UNOBSERVED;

  /** Call once when this pane's phase changes: a new frame percent, a body or route swap, cold load. */
  reset(nowMs: number): void {
    this.#tickCount = 0;
    this.#quietStreak = 0;
    this.#settledAtTick = null;
    this.#settledAtMs = null;
    this.#startMs = nowMs;
    this.#previousWrist = null;
    this.#previousDepthMm = null;
    this.#lastReading = UNOBSERVED;
  }

  /**
   * Call once per rendered frame for this pane, with whatever the rig
   * measured this tick. Returns the reading to show. Once settled, the
   * reading freezes — a subsequent tiny drift does not un-settle it, since
   * the question is only ever "has it arrived yet", not "is it perfectly
   * still forever after".
   */
  observe(wrist: Vec3 | null, depthMm: number | null, nowMs: number): SettleReading {
    if (this.#settledAtTick !== null) return this.#lastReading;

    this.#tickCount += 1;

    const wristMovedMm =
      wrist && this.#previousWrist ? distanceMm(wrist, this.#previousWrist) : null;
    const depthMovedMm =
      depthMm !== null && this.#previousDepthMm !== null
        ? Math.abs(depthMm - this.#previousDepthMm)
        : null;

    const quiet =
      wristMovedMm !== null &&
      depthMovedMm !== null &&
      wristMovedMm < SETTLE_POSITION_THRESHOLD_MM &&
      depthMovedMm < SETTLE_DEPTH_THRESHOLD_MM;

    this.#quietStreak = quiet ? this.#quietStreak + 1 : 0;
    this.#previousWrist = wrist;
    this.#previousDepthMm = depthMm;

    if (this.#quietStreak >= SETTLE_CONSECUTIVE_TICKS) {
      this.#settledAtTick = this.#tickCount;
      this.#settledAtMs = nowMs - this.#startMs;
    }

    this.#lastReading =
      this.#settledAtTick !== null
        ? { settled: true, ticks: this.#settledAtTick, ms: this.#settledAtMs! }
        : { settled: false, ticks: this.#tickCount, ms: nowMs - this.#startMs };
    return this.#lastReading;
  }
}

/** Convenience for callers that already have a measured frame rather than loose wrist/depth values. */
export function observeFrameSettle(
  tracker: PaneSettleTracker,
  frame: ReachFrame,
  nowMs: number
): SettleReading {
  return tracker.observe(frame.wrist, frame.thumbEndVsForearmMm, nowMs);
}

/** The tiny per-pane label text. No prose — a state word and, once settled, the two numbers behind it. */
export function formatSettleLabel(reading: SettleReading | undefined): string {
  if (!reading || !reading.settled) return "settling…";
  return `settled · ${reading.ticks} ticks · ${(reading.ms / 1000).toFixed(1)} s`;
}

/** The widest realistic label, for the reserved-width sizer — see `.claude/rules/no-layout-shift.md`. */
export const SETTLE_LABEL_SIZER_TEXT = "settled · 9999 ticks · 99.9 s";
