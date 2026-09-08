/**
 * The phase axis every inspection lab under `/test` scrubs on.
 *
 * A lab that studies one moment of one pose is useless unless the moment has a
 * name that survives leaving the page. That name is `phase=7.44`, and the whole
 * grid — the frame step, the clamp, the string the URL carries — has to be one
 * definition or the address bar and the scrub start disagreeing about which
 * frame is on screen. `staff-grip` owned this first; it moved here whole when a
 * second lab needed the same transport rather than being copied.
 *
 * This module holds no state. A lab brings its own state object and satisfies
 * `LabPhaseTransport`; the shared bar reads and drives it through that seam.
 */

/**
 * The finest addressable moment, in steps.
 *
 * Not a round number picked for feel. The pose is a continuous function of
 * phase — a lab stage hands it straight to the performer as
 * `phaseOffsetSteps` — so nothing downstream quantises it, and the only real
 * limit is what the address bar can carry. `formatLabPhase` writes two
 * decimals, so 0.01 of a step is the finest phase a link can express; anything
 * smaller is a moment that cannot be copied, and therefore cannot be reported.
 * Everything else addresses on this grid too: `clampLabPhase` reserves
 * `span - 0.01` as the last position, the scrub's `step` is 0.01, and a stage's
 * `data-phase` attribute is `toFixed(2)`.
 *
 * It is also strictly finer than playback. A lab clock at 1.2 steps per second
 * advances 0.02 in one frame of a 60Hz display — two of these. Nothing the eye
 * catches while it runs falls between two addressable stops.
 */
export const LAB_FRAME_STEP = 0.01;

/**
 * What the shared transport needs from a lab's state object.
 *
 * Deliberately the smallest surface that drives a frame-accurate bar: read the
 * phase two ways (the number the scrub binds and the string the URL carries),
 * read whether the clock is running, and four writes. A lab is free to own a
 * dozen other axes; the bar never learns about them.
 */
export interface LabPhaseTransport {
  /** Live phase, in steps. */
  readonly phase: number;
  /** The same moment as the `phase=` query parameter spells it. */
  readonly phaseParam: string;
  readonly playing: boolean;
  setPhase(next: number): void;
  /** Commit a coalesced scrub write immediately, before a discrete move. */
  flushPhase(): void;
  stepPhase(delta: number): void;
  setPlaying(playing: boolean): void;
}

/**
 * One annotation on the scrub track.
 *
 * The transport draws these and seeks to them; what they MEAN is the lab's
 * business. `staff-grip` fills them from the committed prop-continuity sweep.
 * A lab with nothing to annotate passes none and the lane holds its height.
 */
export interface ScrubMarker {
  readonly key: string;
  /** Fraction of the track where the marked span begins, 0 to 1. */
  readonly start: number;
  /** Fraction of the track the span covers. */
  readonly width: number;
  /** The phase pressing this marker lands on. */
  readonly seekPhase: number;
  /** Short label for the announcement a press makes. */
  readonly label: string;
  readonly ariaLabel: string;
  /** Hover text. The lab composes it; the bar only shows it. */
  readonly title: string;
  /** Whether the blue and red props each contribute to this mark. */
  readonly blue: boolean;
  readonly red: boolean;
}

/**
 * The scrub's own maximum, one frame short of the step count.
 *
 * Markers are placed against this rather than the step count, so a marker lands
 * on the pixel the range input puts that phase at instead of a fraction to its
 * left.
 */
export function labScrubMax(stepCount: number): number {
  return Math.max(stepCount - LAB_FRAME_STEP, LAB_FRAME_STEP);
}

/** The two decimals a `phase=` parameter carries, and nothing else. */
export function formatLabPhase(value: number): string {
  return value.toFixed(2);
}

/** Wrap into the loaded sequence, reserving `span - 0.01` as the last stop. */
export function clampLabPhase(value: number, stepCount: number): number {
  if (!Number.isFinite(value)) return 0;
  const span = Math.max(stepCount, 1);
  const wrapped = ((value % span) + span) % span;
  return Math.min(wrapped, span - LAB_FRAME_STEP);
}

/** Land on the addressable grid, so repeated stepping never drifts off it. */
export function snapLabPhase(value: number): number {
  return Math.round(value / LAB_FRAME_STEP) * LAB_FRAME_STEP;
}
