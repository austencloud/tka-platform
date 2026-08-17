import type {
  PronunciationCue,
  PronunciationToken,
  PronunciationTokenBank,
} from "../pronunciation-plan";

/**
 * Weights are tuned by ear, not by test. A neighbour mismatch is the dominant
 * penalty because coarticulation is what the bank exists to preserve; the join
 * costs are deliberately small so they act as tie-breakers between tokens that
 * already match context, not as overrides of it.
 */
const NEIGHBOUR_MISMATCH_COST = 1;
const LENGTH_MISMATCH_COST = 0.15;
const F0_JOIN_COST_PER_HZ = 0.01;
const RMS_JOIN_COST_PER_DB = 0.1;

/**
 * Charged when either side of a join has no measurable pitch, in place of a Hz
 * difference. `f0StartHz`/`f0EndHz` carry 0 as the unvoiced sentinel, and a
 * literal subtraction against it produces `0.01 * 130 = 1.3` — larger than a
 * full neighbour mismatch, which inverts the weighting this module is built on.
 *
 * It is not only the unvoiced token that suffers. A pitch difference measured
 * against a fixed 0 is smallest for whichever neighbour is quietest in pitch,
 * so a literal subtraction also drags the OTHER side of the join toward the
 * most creaky, devoiced candidate available. A constant cannot do that: it is
 * the same for every candidate, so an unvoiced edge simply stops carrying
 * information rather than carrying false information.
 */
const UNKNOWN_F0_JOIN_COST = 0.3;

/** Below this, an F0 reading is the unvoiced sentinel rather than a pitch. */
const MIN_MEASURABLE_F0_HZ = 1;

interface CueNeighbours {
  previousLetter: string | null;
  nextLetter: string | null;
}

/**
 * A cue's real neighbours inside its own group. Position already encodes the
 * group edges, so an initial cue reports no predecessor even when another group
 * precedes it; a token recorded at a word edge is the right match there.
 */
export function cueNeighbours(
  cues: readonly PronunciationCue[],
  index: number
): CueNeighbours {
  const cue = cues[index]!;
  const atStart = cue.position === "initial" || cue.position === "isolated";
  const atEnd = cue.position === "final" || cue.position === "isolated";

  return {
    previousLetter: atStart ? null : (cues[index - 1]?.letter ?? null),
    nextLetter: atEnd ? null : (cues[index + 1]?.letter ?? null),
  };
}

export function targetCost(
  token: PronunciationToken,
  cue: PronunciationCue,
  neighbours: CueNeighbours
): number {
  let cost = 0;
  if (token.previousLetter !== neighbours.previousLetter) {
    cost += NEIGHBOUR_MISMATCH_COST;
  }
  if (token.nextLetter !== neighbours.nextLetter) {
    cost += NEIGHBOUR_MISMATCH_COST;
  }
  cost += LENGTH_MISMATCH_COST * Math.abs(token.groupLength - cue.groupLength);
  return cost;
}

export function joinCost(
  left: PronunciationToken,
  right: PronunciationToken
): number {
  const bothVoiced =
    left.f0EndHz >= MIN_MEASURABLE_F0_HZ &&
    right.f0StartHz >= MIN_MEASURABLE_F0_HZ;
  const pitchCost = bothVoiced
    ? F0_JOIN_COST_PER_HZ * Math.abs(left.f0EndHz - right.f0StartHz)
    : UNKNOWN_F0_JOIN_COST;

  return pitchCost + RMS_JOIN_COST_PER_DB * Math.abs(left.rmsDb - right.rmsDb);
}

/**
 * Cheapest path through the candidate tokens for a plan. Returns null when any
 * cue has no candidate, which keeps the caller's all-or-nothing rule intact so
 * a word never mixes recorded and synthetic voices.
 */
export function selectTokenPath(
  cues: readonly PronunciationCue[],
  bank: PronunciationTokenBank
): PronunciationToken[] | null {
  if (cues.length === 0) return null;

  const candidates = cues.map((cue) =>
    (bank.tokens[cue.assetKey] ?? []).filter(
      (token) => token.position === cue.position
    )
  );
  if (candidates.some((options) => options.length === 0)) return null;

  interface PathCost {
    cost: number;
    path: number[];
  }

  let frontier: PathCost[] = candidates[0]!.map((token, tokenIndex) => ({
    cost: targetCost(token, cues[0]!, cueNeighbours(cues, 0)),
    path: [tokenIndex],
  }));

  for (let index = 1; index < cues.length; index++) {
    const neighbours = cueNeighbours(cues, index);
    const previousOptions = candidates[index - 1]!;
    // Bound before the assignment below. Reading `frontier` inside the `.map`
    // that reassigns it is correct only because the right-hand side is fully
    // evaluated first — a silent trap for anyone who later rewrites this as a
    // `for` loop that assigns as it goes.
    const previousFrontier = frontier;

    frontier = candidates[index]!.map((token, tokenIndex) => {
      let best: PathCost | null = null;

      for (const entry of previousFrontier) {
        const leftToken = previousOptions[entry.path.at(-1)!]!;
        const cost = entry.cost + joinCost(leftToken, token);
        if (best === null || cost < best.cost) {
          best = { cost, path: [...entry.path, tokenIndex] };
        }
      }

      return {
        cost: best!.cost + targetCost(token, cues[index]!, neighbours),
        path: best!.path,
      };
    });
  }

  const winner = frontier.reduce((best, entry) =>
    entry.cost < best.cost ? entry : best
  );

  return winner.path.map((tokenIndex, index) => candidates[index]![tokenIndex]!);
}
