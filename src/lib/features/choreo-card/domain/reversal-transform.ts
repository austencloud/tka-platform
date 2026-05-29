import { SIMPLE_PATTERNS } from "./reversal-patterns";

export type ReversalMotion = "pro" | "anti" | "static" | "dash";

/** Flip pro↔anti when reversed. Static/dash have no rotation to invert. */
export function applyReversalToMotion(motionType: string, isReversed: boolean): string {
  if (!isReversed) return motionType;
  switch (motionType) {
    case "pro": return "anti";
    case "anti": return "pro";
    default: return motionType;
  }
}

export interface ReversalFlags {
  blueReversal: boolean;
  redReversal: boolean;
}

/** Read pattern[beat % length] → which hands reverse. Symbols: P/R/B/-. */
export function getReversalFlagsForBeat(patternSequence: string, beatIndex: number): ReversalFlags {
  const symbol = patternSequence[beatIndex % patternSequence.length];
  switch (symbol) {
    case "P": return { blueReversal: true, redReversal: true };
    case "R": return { blueReversal: false, redReversal: true };
    case "B": return { blueReversal: true, redReversal: false };
    case "-": return { blueReversal: false, redReversal: false };
    default:
      throw new Error(`Unknown reversal symbol "${symbol}" in "${patternSequence}". Valid: P R B -.`);
  }
}

/**
 * Resolve per-beat CUMULATIVE reversal parity for each hand.
 *
 * A reversal is relative (reversal-detector.ts: a beat reverses when its spin
 * differs from the previous beat), so a pattern symbol TOGGLES a running parity
 * rather than flipping the beat absolutely. parity[i] === true means beat i's
 * motion is flipped from its base (pro↔anti, cw↔ccw); false means base.
 *
 * Example — PPPP over 4 beats → blue/red parity both [true,false,true,false]
 * (alternating), NOT [true,true,true,true] (which would be uniform-anti and read
 * back as continuous).
 */
export function cumulativeParities(
  patternSequence: string,
  beatCount: number,
): { blue: boolean[]; red: boolean[] } {
  const blue: boolean[] = [];
  const red: boolean[] = [];
  let blueParity = false;
  let redParity = false;
  for (let i = 0; i < beatCount; i++) {
    const { blueReversal, redReversal } = getReversalFlagsForBeat(patternSequence, i);
    if (blueReversal) blueParity = !blueParity;
    if (redReversal) redParity = !redParity;
    blue.push(blueParity);
    red.push(redParity);
  }
  return { blue, red };
}

export interface ResolvedReversalPattern {
  id: string;
  label: string;
  sequence: string;
  isNamed: boolean;
  isCleanLoop: boolean;
}

function toSequenceString(blue: boolean[], red: boolean[]): string {
  let out = "";
  for (let i = 0; i < blue.length; i++) {
    const b = blue[i];
    const r = red[i];
    if (b && r) out += "P";
    else if (r) out += "R";
    else if (b) out += "B";
    else out += "-";
  }
  return out;
}

/**
 * Returns true if `candidate` is fully covered by tiling `patternSequence`.
 * e.g. tilesTo("RBRB", "RBRB") → true
 *      tilesTo("----", "----") → true
 *      tilesTo("P-", "P-P-") → true
 */
function tilesTo(patternSequence: string, candidate: string): boolean {
  for (let i = 0; i < candidate.length; i++) {
    if (patternSequence[i % patternSequence.length] !== candidate[i]) return false;
  }
  return true;
}

/**
 * Convert two boolean arrays (blue toggles, red toggles per step) into a
 * canonical ResolvedReversalPattern. Matches against SIMPLE_PATTERNS first;
 * falls back to a custom pattern using the raw sequence string as the id.
 *
 * isCleanLoop is true when both hands reverse an even number of times — meaning
 * the prop returns to its starting rotation direction at the loop boundary.
 */
export function resolvePattern(blue: boolean[], red: boolean[]): ResolvedReversalPattern {
  const sequence = toSequenceString(blue, red);
  const blueCount = blue.filter(Boolean).length;
  const redCount = red.filter(Boolean).length;
  const isCleanLoop = blueCount % 2 === 0 && redCount % 2 === 0;

  const named = SIMPLE_PATTERNS.find((p) => tilesTo(p.sequence, sequence));
  if (named) {
    return { id: named.id, label: named.label, sequence, isNamed: true, isCleanLoop };
  }
  return { id: sequence, label: "Custom", sequence, isNamed: false, isCleanLoop };
}
