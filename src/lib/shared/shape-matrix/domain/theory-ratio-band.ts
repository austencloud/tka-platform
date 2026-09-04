/**
 * The Theory surface's ratio bands — how much of the rational field is open.
 *
 * This is NOT a level. TKA levels name turn values, and a turn value is a
 * quantized thing: zero, whole, half, quarter. A band names denominators, and
 * the ladder is the Farey sequence by order, so each step is the
 * mathematically next-simplest set of ratios rather than an arbitrary cut.
 *
 * The two ladders happen to be four steps long and they are otherwise
 * unrelated. Presenting a band as a level claimed that a 4:9 flower sat at
 * Level 4, which is not true at any level: `tkaNamesTheoryRatio` below is the
 * whole of what the turn system reaches inside this field, and it is band 1.
 * Everything past band 1 is outside the level system, and neither TKA nor VTG
 * gives it a name.
 */
import {
  buildBoundedSpinRatios,
  spinRatioEquals,
  spinRatioKey,
  type SpinRatio,
} from "@vtg/domain";
import { STATIONARY_RATIO } from "./theory-flower";

/** How far the ratio field opens. Four steps, like the ladder it is not. */
export type TheoryBand = 1 | 2 | 3 | 4;

export const THEORY_BANDS: readonly TheoryBand[] = [1, 2, 3, 4];

export function asTheoryBand(value: number): TheoryBand {
  return (value >= 1 && value <= 4 ? Math.trunc(value) : 1) as TheoryBand;
}

/**
 * The band the surface opens on.
 *
 * Three cycles, because the default axis is 1:3 and this is the narrowest band
 * that holds it. It is also the first band past what the turn system names,
 * which is the whole reason the surface exists.
 */
export const DEFAULT_THEORY_BAND: TheoryBand = 2;

/**
 * Farey order per band: every reduced P:Q in [0:1, 1:1] with Q ≤ order.
 *
 * The order IS the hand-cycle bound, because Q is the number of hand cycles
 * the shape takes to close. That is what the bands are named for. 2, 3, 5, 9
 * roughly doubles the field at each step (3, 5, 11, 29 ratios); the gap at 4
 * is that pacing, not an omission - a bound of five already carries the
 * quarters.
 */
export const THEORY_BAND_ORDER: Record<TheoryBand, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 9,
};

/**
 * Band names are BOUNDS, in the unit the rest of the surface already counts in.
 *
 * They used to name a denominator - Halves, Thirds, Fifths, Ninths - and every
 * one of those names described what the band ADDED while the control presented
 * it as what the band IS. Fifths held the quarters. Ninths held the sixths,
 * sevenths and eighths. Halves held float and isolation, neither of which is a
 * half. Nothing about "Thirds" says it also contains 1:2.
 *
 * A band's Farey order is its hand-cycle bound, so naming the bound says the
 * true thing and says it in the vocabulary of the pane's own Closed path
 * readout: 1:3 closes in three hand cycles, and it lives in the band that
 * opens the field to three. Containment then reads off the labels - five
 * plainly includes three - instead of having to be learned.
 */
export const THEORY_BAND_DESCRIPTIONS: Record<
  TheoryBand,
  { name: string; blurb: string }
> = {
  1: {
    name: "2 cycles",
    blurb:
      "Every shape that closes within two hand cycles: float, 1:2, isolation. The whole of what TKA names.",
  },
  2: {
    name: "3 cycles",
    blurb:
      "Every shape that closes within three hand cycles. Adds 1:3 and 2:3. Outside the level system.",
  },
  3: {
    name: "5 cycles",
    blurb:
      "Every shape that closes within five hand cycles. Adds the quarters and the fifths. Outside the level system.",
  },
  4: {
    name: "9 cycles",
    blurb:
      "Every shape that closes within nine hand cycles, plus the stationary hand. Outside the level system.",
  },
};

/**
 * The ratios an axis may take in a band.
 *
 * The stationary hand joins only at the top. 1:0 sits outside the Farey field
 * entirely — it is the ratio with no hand path at all — so it reads as the far
 * edge of the vocabulary rather than one of its steps.
 */
export function theoryRatiosForBand(band: TheoryBand): SpinRatio[] {
  const field = buildBoundedSpinRatios(THEORY_BAND_ORDER[band]);
  return band === 4 ? [...field, STATIONARY_RATIO] : field;
}

/**
 * Whether the Kinetic Alphabet has a turn value for this ratio.
 *
 * TKA turns are quantized: a positive P:Q ratio maps to (P/Q − 1) / 2, and the
 * level palettes step by a quarter turn at their finest. Inside this field
 * that leaves exactly three — Float, the 1:2 quarter reduction, and isolation
 * — which is why band 1 holds them all and no wider band adds another. A 1:3
 * is a −1/3 turn, and TKA has no such value at any level.
 */
export function tkaNamesTheoryRatio(ratio: SpinRatio): boolean {
  return theoryRatiosForBand(1).some((named) =>
    spinRatioEquals(named, ratio)
  );
}

export function clampTheoryRatioToBand(
  ratio: SpinRatio,
  band: TheoryBand
): SpinRatio {
  const field = theoryRatiosForBand(band);
  const exact = field.find((candidate) => spinRatioEquals(candidate, ratio));
  if (exact) return exact;

  // Fall to the nearest available value rather than a fixed default: a band
  // change should move the axis a little, not throw the user's place away.
  const target =
    ratio.handCycles === 0 ? 1 : ratio.propRotations / ratio.handCycles;
  let best = field[0] as SpinRatio;
  let bestDistance = Infinity;
  for (const candidate of field) {
    if (candidate.handCycles === 0) continue;
    const distance = Math.abs(
      candidate.propRotations / candidate.handCycles - target
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

export function theoryRatioSpokenLabel(ratio: SpinRatio): string {
  const key = spinRatioKey(ratio);
  if (ratio.handCycles === 0) return `${key}, stationary hand`;
  if (ratio.propRotations === 0) return `${key}, float`;
  const cycles = ratio.handCycles;
  return `${key}, closes in ${cycles} hand ${cycles === 1 ? "cycle" : "cycles"}`;
}

/**
 * The narrowest band that already holds this ratio, or null if none does.
 *
 * Typing a ratio is bounded by the CATALOG, not by the band the field happens
 * to be open to, so a direct entry widens the band to hold what was asked for
 * rather than clamping the answer to something else. The band then reports
 * where that ratio lives: type 4 and 9 and the control moves to nine cycles,
 * which is the true statement that 4:9 needs nine of them.
 */
export function narrowestBandFor(ratio: SpinRatio): TheoryBand | null {
  for (const band of THEORY_BANDS) {
    if (theoryRatiosForBand(band).some((held) => spinRatioEquals(held, ratio))) {
      return band;
    }
  }
  return null;
}

/** Every ratio the surface can reach at all: the widest band's whole field. */
export function theoryRatioCatalog(): SpinRatio[] {
  return theoryRatiosForBand(THEORY_BANDS[THEORY_BANDS.length - 1] as TheoryBand);
}

/** The largest number either side of a typed ratio may carry. */
export const THEORY_RATIO_MAX_PART = Math.max(
  ...THEORY_BANDS.map((band) => THEORY_BAND_ORDER[band])
);
