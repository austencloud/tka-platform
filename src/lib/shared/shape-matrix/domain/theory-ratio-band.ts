/**
 * The Theory surface's ratio bands — how much of the rational field is open.
 *
 * This is NOT a level. TKA levels name turn values, and a turn value is a
 * quantized thing: zero, whole, half, quarter. A band names the hand-cycle
 * denominator bound while the numerator remains independently available from
 * 0 through 15.
 *
 * The band ladder and the TKA level ladder are unrelated. Some ratios have an
 * exact TKA turn equivalent and many do not; `tkaNamesTheoryRatio` owns that
 * distinction instead of inferring it from a band's position.
 */
import {
  buildTheorySpinRatioAtlas,
  spinRatioEquals,
  spinRatioKey,
  spinRatioToTkaTurnFraction,
  THEORY_SPIN_RATIO_MAX_PART,
  type SpinRatio,
} from "@vtg/domain";
/** How far the ratio field opens. */
export type TheoryBand = 1 | 2 | 3 | 4 | 5;

export const THEORY_BANDS: readonly TheoryBand[] = [1, 2, 3, 4, 5];

export function asTheoryBand(value: number): TheoryBand {
  return (value >= 1 && value <= 5 ? Math.trunc(value) : 1) as TheoryBand;
}

/**
 * The band the surface opens on.
 *
 * Three cycles, because the default axis is 1:3 and this is the narrowest band
 * that holds it.
 */
export const DEFAULT_THEORY_BAND: TheoryBand = 2;

/**
 * Hand-cycle bound per band. Every band includes the complete 0–15 prop range;
 * the band only describes how many hand cycles the closed path needs.
 *
 * The order IS the hand-cycle bound, because Q is the number of hand cycles
 * the shape takes to close. The 2, 3, 5, 9, 15 pacing opens useful intermediate
 * fields while ending at the editor's complete range.
 */
export const THEORY_BAND_ORDER: Record<TheoryBand, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 9,
  5: 15,
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
 * A band's order is its hand-cycle bound, so naming the bound says the true
 * thing and says it in the vocabulary of the pane's own Closed path
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
      "Every 0–15 prop ratio that closes within two hand cycles, including the ratios TKA names.",
  },
  2: {
    name: "3 cycles",
    blurb: "Every 0–15 prop ratio that closes within three hand cycles.",
  },
  3: {
    name: "5 cycles",
    blurb: "Every 0–15 prop ratio that closes within five hand cycles.",
  },
  4: {
    name: "9 cycles",
    blurb:
      "Every 0–15 prop ratio that closes within nine hand cycles, plus the stationary hand.",
  },
  5: {
    name: "15 cycles",
    blurb: "The complete field: any two values from 0 through 15, except 0:0.",
  },
};

/**
 * The ratios an axis may take in a band.
 *
 * The stationary hand has no cycle bound. It remains available from the
 * nine-cycle band onward for compatibility with existing links.
 */
const THEORY_RATIO_ATLAS = buildTheorySpinRatioAtlas();

export function theoryRatiosForBand(band: TheoryBand): SpinRatio[] {
  const cycleBound = THEORY_BAND_ORDER[band];
  return THEORY_RATIO_ATLAS.filter((ratio) =>
    ratio.handCycles === 0 ? band >= 4 : ratio.handCycles <= cycleBound
  );
}

/**
 * Whether the Kinetic Alphabet has a turn value for this ratio.
 *
 * TKA turns are quantized: a positive P:Q ratio maps to (P/Q − 1) / 2. The
 * current turn ladder runs from −1/4 through 3 in quarter-turn steps, plus
 * Float. A 1:3 is −1/3 and therefore remains outside that named set.
 */
export function tkaNamesTheoryRatio(ratio: SpinRatio): boolean {
  const fraction = spinRatioToTkaTurnFraction(ratio);
  if (fraction === "fl") return true;
  if (fraction === null) return false;
  const quarters = (fraction.numerator * 4) / fraction.denominator;
  return Number.isInteger(quarters) && quarters >= -1 && quarters <= 12;
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
 * Typing a ratio is bounded by the 0–15 input range, not by the band the field
 * happens to be open to, so a direct entry widens the band to hold what was asked for
 * rather than clamping the answer to something else. The band then reports
 * where that ratio lives: type 4 and 9 and the control moves to nine cycles,
 * which is the true statement that 4:9 needs nine of them.
 */
export function narrowestBandFor(ratio: SpinRatio): TheoryBand | null {
  for (const band of THEORY_BANDS) {
    if (
      theoryRatiosForBand(band).some((held) => spinRatioEquals(held, ratio))
    ) {
      return band;
    }
  }
  return null;
}

/** Every ratio the surface can reach at all: the widest band's whole field. */
export function theoryRatioCatalog(): SpinRatio[] {
  return theoryRatiosForBand(
    THEORY_BANDS[THEORY_BANDS.length - 1] as TheoryBand
  );
}

/** The largest number either side of a typed ratio may carry. */
export const THEORY_RATIO_MAX_PART = THEORY_SPIN_RATIO_MAX_PART;
