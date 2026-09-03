/**
 * The Theory surface's axis vocabulary: the Shape Matrix's own row-and-column
 * idea, carried onto rational prop-to-hand ratios TKA has no turn value for.
 *
 * A matrix row is one hand doing one thing. On the Matrix surface that thing
 * is a TKA turn value, which pins the ratio to (2t+1):1 — only three points of
 * the Farey line ever appear (0:1, 1:2, 1:1). Here the ratio is chosen
 * directly, so the same four variants per hand open onto twenty-nine more.
 *
 * Timing and direction stay where VTG puts them: BETWEEN the two hands. The
 * QfT model already carries both as knobs (`handPhase`, `handDirection`), so
 * they belong to the pairing rather than to either axis, exactly as split /
 * together / quarter and same / opposite do in the alphabet. The pairing is
 * named by the app's own `VtgMode`, so a Theory pairing and a Matrix cell's
 * realization are the same six things under the same six element names.
 */
import {
  makeSpinRatio,
  parseSpinRatio,
  spinRatioKey,
  spinRatioPetals,
  type SpinRatio,
  type SpinStyle,
} from "@vtg/domain";
import type { QftKnobs } from "$lib/shared/notation/qft/qft-model";
import type { VtgMode } from "../services/shape-matrix-realizations";

/** Where the prop points at the downbeat, relative to the hand's bearing. */
export type TheoryOri = "in" | "out" | "clock" | "counter";

export interface TheoryFlower {
  readonly ratio: SpinRatio;
  /** Prospin or antispin, relative to the hand. Float ratios have neither. */
  readonly style: SpinStyle;
  readonly ori: TheoryOri;
  readonly petals: number;
}

/** Compass eighths between the two hands' starting points, by VTG timing. */
const TIMING_OFFSET: Record<string, number> = {
  S: 4,
  T: 0,
  Q: 2,
};

/** Prop offset from the hand's own bearing, in compass eighths. */
const ORI_PHASE: Record<TheoryOri, number> = {
  out: 0,
  clock: 2,
  in: 4,
  counter: 6,
};

/** QfT publishes every table starting the hand at 8, straight up. */
const HAND_HOME = 8;

export function isFloatRatio(ratio: SpinRatio): boolean {
  return ratio.propRotations === 0;
}

export function isStationaryRatio(ratio: SpinRatio): boolean {
  return ratio.handCycles === 0;
}

export function theoryFlowerKey(flower: TheoryFlower): string {
  return `${spinRatioKey(flower.ratio)}-${flower.style}-${flower.ori}`;
}

/**
 * The inverse of `theoryFlowerKey`, for restoring a shared link. Rebuilding
 * from the axis rather than from the key's own parts keeps petals and the
 * endpoint collapses (float, stationary) authoritative in one place.
 */
export function parseTheoryFlowerKey(key: string): TheoryFlower | null {
  const parts = key.split("-");
  if (parts.length !== 3) return null;
  const [ratioKey] = parts;
  const ratio = parseSpinRatio(ratioKey ?? "");
  if (!ratio) return null;
  return (
    buildTheoryAxis(ratio).find(
      (candidate) => theoryFlowerKey(candidate) === key
    ) ?? null
  );
}

export function theoryFlowerLabel(flower: TheoryFlower): string {
  const key = spinRatioKey(flower.ratio);
  if (isStationaryRatio(flower.ratio)) return `${key} stationary hand`;
  if (isFloatRatio(flower.ratio)) return `${key} float ${flower.ori}`;
  const style = flower.style === "pro" ? "prospin" : "antispin";
  return `${key} ${style} ${flower.ori} · ${flower.petals}p`;
}

/**
 * The variants one hand has at a ratio.
 *
 * Four for an ordinary ratio, the same two-by-two the Matrix axis uses:
 * prospin and antispin, each starting with the prop pointing in or out.
 *
 * The two endpoints are not four-way, and padding them out with copies would
 * be a lie the grid tells four times. A float prop never rotates, so pro and
 * anti are the same motion and the four DISTINCT starts are the four compass
 * quarters — the float axis the Matrix already builds. A stationary hand has
 * no bearing for the prop to be offset from, so 1:0 traces one circle and
 * gets one row.
 */
export function buildTheoryAxis(ratio: SpinRatio): TheoryFlower[] {
  const petalsFor = (style: SpinStyle) => spinRatioPetals(ratio, style);

  if (isStationaryRatio(ratio)) {
    return [{ ratio, style: "pro", ori: "out", petals: petalsFor("pro") }];
  }

  if (isFloatRatio(ratio)) {
    return (["in", "out", "clock", "counter"] as const).map((ori) => ({
      ratio,
      style: "pro" as const,
      ori,
      petals: petalsFor("pro"),
    }));
  }

  const variants: TheoryFlower[] = [];
  for (const style of ["pro", "anti"] as const) {
    for (const ori of ["in", "out"] as const) {
      variants.push({ ratio, style, ori, petals: petalsFor(style) });
    }
  }
  return variants;
}

/**
 * QfT knobs for one hand of a pairing.
 *
 * The left hand always starts at home and travels clockwise; timing and
 * direction are expressed entirely as the right hand's offset and sign. That
 * is a choice of frame, not of physics — rotating both hands together would
 * spin the whole picture without changing a single relationship in it.
 */
export function theoryKnobs(
  flower: TheoryFlower,
  hand: "left" | "right",
  mode: VtgMode
): QftKnobs {
  const stationary = isStationaryRatio(flower.ratio);
  const opposed = hand === "right" && mode.charAt(1) === "O";
  return {
    radius: stationary ? 0 : 1,
    downbeats: stationary
      ? flower.ratio.propRotations
      : flower.ratio.propRotations / flower.ratio.handCycles,
    ratio: flower.ratio,
    spin: flower.style === "pro" ? "inspin" : "antispin",
    phase: ORI_PHASE[flower.ori],
    handPhase:
      HAND_HOME +
      (hand === "right" ? (TIMING_OFFSET[mode.charAt(0)] ?? 0) : 0),
    handDirection: opposed ? -1 : 1,
  };
}

/** The stationary-hand endpoint, kept out of `buildBoundedSpinRatios`. */
export const STATIONARY_RATIO: SpinRatio = makeSpinRatio(1, 0);
