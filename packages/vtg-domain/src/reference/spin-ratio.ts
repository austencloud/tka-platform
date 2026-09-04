export interface SpinRatio {
  propRotations: number;
  handCycles: number;
}

export type SpinStyle = "pro" | "anti";
export type TkaTurnEquivalent = "fl" | number | null;
export interface ExactTurnFraction {
  numerator: number;
  denominator: number;
}

/** Largest value accepted in either field of the Theory ratio editor. */
export const THEORY_SPIN_RATIO_MAX_PART = 15;

function assertRatioPart(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = a;
  let right = b;

  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }

  return left;
}

function leastCommonMultiple(a: number, b: number): number {
  if (a === 0) return b;
  if (b === 0) return a;
  return Math.abs((a / greatestCommonDivisor(a, b)) * b);
}

export function makeSpinRatio(
  propRotations: number,
  handCycles: number
): SpinRatio {
  assertRatioPart(propRotations, "propRotations");
  assertRatioPart(handCycles, "handCycles");

  if (propRotations === 0 && handCycles === 0) {
    throw new RangeError("A spin ratio cannot be 0:0");
  }

  const divisor = greatestCommonDivisor(propRotations, handCycles);
  return {
    propRotations: propRotations / divisor,
    handCycles: handCycles / divisor,
  };
}

export function spinRatioKey(ratio: SpinRatio): string {
  const reduced = makeSpinRatio(ratio.propRotations, ratio.handCycles);
  return `${reduced.propRotations}:${reduced.handCycles}`;
}

export function parseSpinRatio(value: string): SpinRatio | null {
  const match = /^(\d+):(\d+)$/.exec(value.trim());
  if (!match) return null;

  const propRotations = Number(match[1]);
  const handCycles = Number(match[2]);

  try {
    return makeSpinRatio(propRotations, handCycles);
  } catch {
    return null;
  }
}

export function spinRatioEquals(left: SpinRatio, right: SpinRatio): boolean {
  return spinRatioKey(left) === spinRatioKey(right);
}

/**
 * Translate an exact VTG ratio into the nearest TKA turn-domain concept.
 *
 * Float is deliberately preserved as Float instead of exposing the algebraic
 * -0.5. A stationary hand has no finite turn equivalent.
 */
export function spinRatioToTkaTurns(ratio: SpinRatio): TkaTurnEquivalent {
  const reduced = makeSpinRatio(ratio.propRotations, ratio.handCycles);

  if (reduced.handCycles === 0) return null;
  if (reduced.propRotations === 0) return "fl";

  return (
    (reduced.propRotations - reduced.handCycles) / (2 * reduced.handCycles)
  );
}

export function spinRatioToTkaTurnFraction(
  ratio: SpinRatio
): "fl" | ExactTurnFraction | null {
  const reduced = makeSpinRatio(ratio.propRotations, ratio.handCycles);

  if (reduced.handCycles === 0) return null;
  if (reduced.propRotations === 0) return "fl";

  const numerator = reduced.propRotations - reduced.handCycles;
  const denominator = 2 * reduced.handCycles;
  const divisor = greatestCommonDivisor(Math.abs(numerator), denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

/** Number of hand circles in the exact closed path. Static has no hand circle. */
export function spinRatioClosureHandCycles(ratio: SpinRatio): number {
  return makeSpinRatio(ratio.propRotations, ratio.handCycles).handCycles;
}

/** Closure for ratios sharing one hand tempo. Static ratios add no period. */
export function jointSpinRatioClosureHandCycles(
  ratios: readonly SpinRatio[]
): number {
  const nonStaticCycles = ratios
    .map(spinRatioClosureHandCycles)
    .filter((cycles) => cycles > 0);

  if (nonStaticCycles.length === 0) return 1;
  return nonStaticCycles.reduce(leastCommonMultiple, 1);
}

export function spinRatioPetals(ratio: SpinRatio, style: SpinStyle): number {
  const reduced = makeSpinRatio(ratio.propRotations, ratio.handCycles);
  return style === "pro"
    ? Math.abs(reduced.propRotations - reduced.handCycles)
    : reduced.propRotations + reduced.handCycles;
}

/**
 * Every reduced ratio P:Q in [0:1, 1:1] whose denominator is at most `order`.
 * This is the Farey sequence of the requested order, expressed as VTG ratios.
 */
export function buildBoundedSpinRatios(order: number): SpinRatio[] {
  if (!Number.isSafeInteger(order) || order < 1) {
    throw new RangeError("order must be a positive safe integer");
  }

  const ratios: SpinRatio[] = [];

  for (let handCycles = 1; handCycles <= order; handCycles += 1) {
    for (
      let propRotations = 0;
      propRotations <= handCycles;
      propRotations += 1
    ) {
      if (greatestCommonDivisor(propRotations, handCycles) !== 1) continue;
      ratios.push({ propRotations, handCycles });
    }
  }

  return ratios.sort(
    (left, right) =>
      left.propRotations * right.handCycles -
      right.propRotations * left.handCycles
  );
}

/**
 * Every reduced ratio reachable by entering two values from 0 through 15.
 *
 * The editor bounds the values a person types, not the resulting fraction.
 * Building the atlas from the same square keeps ratios above 1:1, floats, and
 * the stationary-hand endpoint under one domain owner.
 */
export function buildTheorySpinRatioAtlas(): SpinRatio[] {
  const ratios = new Map<string, SpinRatio>();
  for (
    let propRotations = 0;
    propRotations <= THEORY_SPIN_RATIO_MAX_PART;
    propRotations += 1
  ) {
    for (
      let handCycles = 0;
      handCycles <= THEORY_SPIN_RATIO_MAX_PART;
      handCycles += 1
    ) {
      if (propRotations === 0 && handCycles === 0) continue;
      const ratio = makeSpinRatio(propRotations, handCycles);
      ratios.set(spinRatioKey(ratio), ratio);
    }
  }

  return [...ratios.values()].sort((left, right) => {
    if (left.handCycles === 0) return 1;
    if (right.handCycles === 0) return -1;
    return (
      left.propRotations * right.handCycles -
      right.propRotations * left.handCycles
    );
  });
}
