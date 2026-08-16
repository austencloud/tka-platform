/**
 * Layer signature — the orientation shape of a sequence, step by step.
 *
 * At any moment each prop is either RADIAL (pointing in or out along the line
 * from the centre) or NON-RADIAL (lying across it, clock or counter). Take both
 * props together and there are four combinations, and Austen has called them
 * "layers" since long before this file existed:
 *
 *   layer 1  both props radial
 *   layer 2  both props non-radial
 *   layer 3  blue radial, red non-radial
 *   layer 4  blue non-radial, red radial
 *
 * Read one layer per step and you get a string like `1233341112333411` — the
 * sequence's layer signature. It is what makes two sequences with the same
 * letters look completely different: layers 3 and 4 are the moments where one
 * prop is flat to the circle and the other is on edge, and they read as busy
 * even when the hand paths are simple.
 *
 * The useful surprise is that the signature does not depend on the letters at
 * all. Only two things move a prop between radial and non-radial: a half turn,
 * and a float. Whole turns leave it exactly where it was. So the signature is
 * decided entirely by the pattern of turns, and the same turn pattern laid over
 * a completely different word produces the same signature — which is why a turn
 * pattern is worth naming and saving on its own (see `LayerPattern` below).
 *
 * A consequence worth knowing before you go looking for variety: non-radial is
 * a level 3 idea. Level 1 has no turns and level 2 has only whole ones, and
 * only a half turn or a float can take a prop off radial, so nothing below
 * level 3 ever leaves layer 1. Their signature is not merely flat, it is
 * `111…1`, and it carries no information at all. The signature is a level 3
 * object; below that there is nothing to read.
 *
 * This lives in the engine, next to the orientation calculator whose behaviour
 * it summarises, because generation needs it too: knowing which turn values
 * flip a prop is what lets the builder aim at a signature instead of rolling
 * one at random. The app re-exports it from
 * `src/lib/shared/foundation/domain/layer-signature.ts`.
 */

import {
  RADIAL_CW_CYCLE,
  getHandpathDirection,
} from "./OrientationCalculator.js";

/** Which of the four both-prop combinations a step sits in. */
export type LayerId = 1 | 2 | 3 | 4;

/**
 * Layers 3 and 4 are mirror images of each other — mirroring a sequence swaps
 * blue and red, which turns every 3 into a 4. Collapsing them gives a reading
 * that survives mirroring, which is what you want on a badge or a filter.
 * Keep the four-way value for anything that has to do arithmetic; collapse only
 * for display.
 */
export type CollapsedLayerId = 1 | 2 | 3;

/**
 * What one step does to the layer, written as which props crossed between
 * radial and non-radial: nothing, blue only, red only, or both.
 */
export type FlipVector = "." | "B" | "R" | "X";

/**
 * A turn pattern, freed from the word it came from. Give it to any sequence of
 * the same length and you get the same signature back — that is the whole point
 * of pulling it out as its own thing.
 */
export interface LayerPattern {
  readonly startLayer: LayerId;
  readonly flips: readonly FlipVector[];
}

export interface LayerMetrics {
  /** How many of the four layers the sequence actually visits (1–4). */
  readonly breadth: number;
  /** Share of steps that change the layer at all (0–1). */
  readonly switchRate: number;
  /** Share of steps with the props in DIFFERENT layers — the busy-looking ones. */
  readonly desync: number;
  /** Length of the shortest repeating chunk of the signature. */
  readonly period: number;
  /** True when the signature never changes — always true below level 3. */
  readonly frozen: boolean;
}

/** The minimum a motion has to tell us for any of this to work. */
export interface LayerMotionInput {
  readonly motionType?: string | null;
  readonly turns?: number | string | null;
  readonly rotationDirection?: string | null;
  readonly startLocation?: string | null;
  readonly endLocation?: string | null;
  readonly startOrientation?: string | null;
  readonly endOrientation?: string | null;
}

export interface LayerStepInput {
  readonly motions?: {
    readonly blue?: LayerMotionInput | null;
    readonly red?: LayerMotionInput | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Where an orientation sits
// ---------------------------------------------------------------------------

/**
 * Position on the 8-point orientation cycle, folded to four classes:
 * 0 = radial (in/out), 2 = non-radial (clock/counter), 1 and 3 = the halfway
 * orientations that only exist at level 6. Returns null for centre-family
 * orientations, which are off this cycle entirely.
 */
export function orientationClass(
  orientation: string | null | undefined
): 0 | 1 | 2 | 3 | null {
  if (!orientation) return null;
  const index = RADIAL_CW_CYCLE.indexOf(orientation as never);
  if (index === -1) return null;
  return (index % 4) as 0 | 1 | 2 | 3;
}

export function isRadialOrientation(
  orientation: string | null | undefined
): boolean {
  return orientationClass(orientation) === 0;
}

/** The layer both props are in, or null if either orientation is off-cycle. */
export function layerOf(
  blueOrientation: string | null | undefined,
  redOrientation: string | null | undefined
): LayerId | null {
  const blue = orientationClass(blueOrientation);
  const red = orientationClass(redOrientation);
  if (blue === null || red === null) return null;
  const blueRadial = blue === 0;
  const redRadial = red === 0;
  if (blueRadial && redRadial) return 1;
  if (!blueRadial && !redRadial) return 2;
  return blueRadial ? 3 : 4;
}

export function collapseLayer(layer: LayerId): CollapsedLayerId {
  return layer === 4 ? 3 : (layer as CollapsedLayerId);
}

// ---------------------------------------------------------------------------
// What a motion does to the layer
// ---------------------------------------------------------------------------

const HALF_STEPS_PER_TURN = 4; // one turn is 180 degrees; the cycle steps 45 at a time

/**
 * How far around the four classes one motion carries a prop.
 *
 * The rule falls straight out of how end orientation is calculated. A whole
 * turn either leaves the orientation alone or flips it to its opposite, and
 * both of those land on the same class — so whole turns are invisible here, no
 * matter the motion type. A half turn moves two positions, which is exactly the
 * jump between radial and non-radial. A float moves two positions as well, but
 * only when the hand actually travels around the circle: a float whose hand
 * crosses through the middle or stays put leaves the prop where it was.
 *
 * Quarter turns (level 6 only) move an odd number of positions and land on the
 * halfway orientations, and that is the one case where which way the prop spins
 * changes the answer.
 */
export function layerClassDelta(
  motion: LayerMotionInput | null | undefined
): 0 | 1 | 2 | 3 {
  if (!motion) return 0;

  const type = (motion.motionType ?? "").toLowerCase();
  const isFloat = type === "float" || motion.turns === "fl";

  if (isFloat) {
    const handpath = getHandpathDirection(
      String(motion.startLocation ?? ""),
      String(motion.endLocation ?? "")
    );
    return handpath === "cw" || handpath === "ccw" ? 2 : 0;
  }

  const turns =
    typeof motion.turns === "number" ? motion.turns : Number(motion.turns ?? 0);
  if (!Number.isFinite(turns)) return 0;

  const steps = Math.round(turns * HALF_STEPS_PER_TURN);
  const magnitude = ((steps % 4) + 4) % 4;
  if (magnitude === 0 || magnitude === 2) return magnitude; // direction cannot change this

  // Odd steps only: an anti or dash walks the cycle the same way the prop
  // spins, a pro or static walks it the other way.
  const rotation = (motion.rotationDirection ?? "cw").toLowerCase();
  const isClockwise = rotation === "cw" || rotation === "clockwise";
  const isAntiLike = type === "anti" || type === "dash";
  const forward = isAntiLike ? isClockwise : !isClockwise;
  const signed = forward ? magnitude : -magnitude;
  return (((signed % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

/** True when this motion carries its prop between radial and non-radial. */
export function flipsLayer(motion: LayerMotionInput | null | undefined): boolean {
  return layerClassDelta(motion) === 2;
}

export function flipVectorOf(step: LayerStepInput | null | undefined): FlipVector {
  const blue = flipsLayer(step?.motions?.blue);
  const red = flipsLayer(step?.motions?.red);
  if (blue && red) return "X";
  if (blue) return "B";
  if (red) return "R";
  return ".";
}

// ---------------------------------------------------------------------------
// Walking the four layers
// ---------------------------------------------------------------------------

// Moving from a layer by a flip is the same shape as flipping two switches, so
// the whole thing is a four-by-four table and nothing more. Reading it: from
// layer 1, flipping blue lands on layer 4, because blue is now the non-radial one.
const LAYER_TRANSITIONS: Record<LayerId, Record<FlipVector, LayerId>> = {
  1: { ".": 1, B: 4, R: 3, X: 2 },
  2: { ".": 2, B: 3, R: 4, X: 1 },
  3: { ".": 3, B: 2, R: 1, X: 4 },
  4: { ".": 4, B: 1, R: 2, X: 3 },
};

export function applyFlip(layer: LayerId, flip: FlipVector): LayerId {
  return LAYER_TRANSITIONS[layer][flip];
}

/** The flip that carries `from` to `to` — the inverse of `applyFlip`. */
export function flipBetween(from: LayerId, to: LayerId): FlipVector {
  const flips: FlipVector[] = [".", "B", "R", "X"];
  for (const flip of flips) {
    if (LAYER_TRANSITIONS[from][flip] === to) return flip;
  }
  // Unreachable: the four flips are a group acting simply transitively on the
  // four layers, so every ordered pair has exactly one flip between them.
  return ".";
}

/**
 * The layer at the END of each step — the same reading you would take by
 * looking at the props in each pictograph in turn.
 *
 * Prefers the orientations already stored on each motion and falls back to
 * walking the turn pattern forward from the first step's starting orientations,
 * which is what makes this work on sequences saved before orientations were
 * written down.
 */
export function layerSignature(
  steps: readonly LayerStepInput[] | null | undefined
): LayerId[] {
  if (!steps || steps.length === 0) return [];

  const first = steps[0];
  const start = layerOf(
    first?.motions?.blue?.startOrientation,
    first?.motions?.red?.startOrientation
  );

  const signature: LayerId[] = [];
  let current: LayerId = start ?? 1;

  for (const step of steps) {
    const stored = layerOf(
      step?.motions?.blue?.endOrientation,
      step?.motions?.red?.endOrientation
    );
    current = stored ?? applyFlip(current, flipVectorOf(step));
    signature.push(current);
  }
  return signature;
}

/** Pull the turn pattern out of a sequence so it can be reused on another word. */
export function layerPatternOf(
  steps: readonly LayerStepInput[] | null | undefined
): LayerPattern {
  if (!steps || steps.length === 0) return { startLayer: 1, flips: [] };
  const first = steps[0];
  const startLayer =
    layerOf(
      first?.motions?.blue?.startOrientation,
      first?.motions?.red?.startOrientation
    ) ?? 1;
  return { startLayer, flips: steps.map(flipVectorOf) };
}

/** Lay a saved pattern over any sequence of the same length. */
export function signatureFromPattern(pattern: LayerPattern): LayerId[] {
  const signature: LayerId[] = [];
  let current = pattern.startLayer;
  for (const flip of pattern.flips) {
    current = applyFlip(current, flip);
    signature.push(current);
  }
  return signature;
}

/**
 * Read a written-out signature back as the pattern that produces it. The
 * inverse of `signatureFromPattern`: every signature comes from exactly one
 * pattern once you know where it started.
 */
export function patternFromSignature(
  signature: readonly LayerId[],
  startLayer: LayerId
): LayerPattern {
  const flips: FlipVector[] = [];
  let current = startLayer;
  for (const layer of signature) {
    flips.push(flipBetween(current, layer));
    current = layer;
  }
  return { startLayer, flips };
}

/**
 * Whether the pattern brings both props back to the layer they started in.
 * A sequence that repeats has to satisfy this or the second time through looks
 * different from the first — each prop needs an even number of flips.
 */
export function isLayerClosed(pattern: LayerPattern): boolean {
  let blue = 0;
  let red = 0;
  for (const flip of pattern.flips) {
    if (flip === "B" || flip === "X") blue++;
    if (flip === "R" || flip === "X") red++;
  }
  return blue % 2 === 0 && red % 2 === 0;
}

/** The same pattern with the props exchanged — what mirroring a sequence does. */
export function mirrorPattern(pattern: LayerPattern): LayerPattern {
  const swapLayer: Record<LayerId, LayerId> = { 1: 1, 2: 2, 3: 4, 4: 3 };
  const swapFlip: Record<FlipVector, FlipVector> = {
    ".": ".",
    B: "R",
    R: "B",
    X: "X",
  };
  return {
    startLayer: swapLayer[pattern.startLayer],
    flips: pattern.flips.map((f) => swapFlip[f]),
  };
}

// ---------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------

export function layerMetrics(signature: readonly LayerId[]): LayerMetrics {
  if (signature.length === 0) {
    return { breadth: 0, switchRate: 0, desync: 0, period: 0, frozen: true };
  }
  const switches = signature.filter(
    (layer, i) => i > 0 && layer !== signature[i - 1]
  ).length;
  const mixed = signature.filter((layer) => layer === 3 || layer === 4).length;
  const breadth = new Set(signature).size;
  return {
    breadth,
    switchRate: signature.length > 1 ? switches / (signature.length - 1) : 0,
    desync: mixed / signature.length,
    period: signaturePeriod(signature),
    frozen: breadth === 1,
  };
}

/** Length of the shortest chunk the signature repeats. */
export function signaturePeriod(signature: readonly LayerId[]): number {
  const n = signature.length;
  for (let p = 1; p <= n; p++) {
    if (n % p !== 0) continue;
    if (signature.every((layer, i) => layer === signature[i % p])) return p;
  }
  return n;
}

/** `1233341112333411` — the reading Austen writes down by eye. */
export function formatSignature(
  signature: readonly LayerId[],
  collapsed = false
): string {
  return signature.map((l) => (collapsed ? collapseLayer(l) : l)).join("");
}

/** `1:.XB.` — a start layer and the flips, small enough to store or name. */
export function formatPattern(pattern: LayerPattern): string {
  return `${pattern.startLayer}:${pattern.flips.join("")}`;
}

export function parsePattern(encoded: string): LayerPattern | null {
  const match = /^([1-4]):([.BRX]*)$/.exec(encoded.trim());
  if (!match) return null;
  return {
    startLayer: Number(match[1]) as LayerId,
    flips: [...match[2]!] as FlipVector[],
  };
}

/** Read a signature string like `1233` back into layers. */
export function parseSignature(encoded: string): LayerId[] | null {
  const trimmed = encoded.trim();
  if (!/^[1-4]+$/.test(trimmed)) return null;
  return [...trimmed].map((c) => Number(c) as LayerId);
}
