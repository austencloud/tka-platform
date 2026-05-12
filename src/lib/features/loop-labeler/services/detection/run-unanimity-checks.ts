import type { LoopTypeDefinition } from "../../domain/constants/loop-type-definitions";
import type { ComparisonMatrix, UnanimityResult } from "./types";

function extractDirection(target: string): "cw" | "ccw" | null {
  if (target.includes("ccw")) return "ccw";
  if (target.includes("cw")) return "cw";
  return null;
}

function checkUnanimity(
  definition: LoopTypeDefinition,
  pairLabels: Map<string, string[]>,
  interval: 2 | 4
): UnanimityResult {
  const pairCount = pairLabels.size;

  if (pairCount === 0) {
    return {
      definition,
      interval,
      matches: false,
      matchedTarget: null,
      direction: null,
      beatPairCount: 0,
    };
  }

  const allLabelSets = [...pairLabels.values()];

  for (const target of definition.targets) {
    const unanimous = allLabelSets.every(labels => labels.includes(target));
    if (unanimous) {
      return {
        definition,
        interval,
        matches: true,
        matchedTarget: target,
        direction: definition.extractDirection ? extractDirection(target) : null,
        beatPairCount: pairCount,
      };
    }
  }

  return {
    definition,
    interval,
    matches: false,
    matchedTarget: null,
    direction: null,
    beatPairCount: pairCount,
  };
}

export function runUnanimityChecks(
  matrix: ComparisonMatrix,
  definitions: readonly LoopTypeDefinition[]
): UnanimityResult[] {
  const results: UnanimityResult[] = [];

  for (const def of definitions) {
    results.push(checkUnanimity(def, matrix.halvedPairs, 2));
    if (matrix.quarteredPairs.size > 0) {
      results.push(checkUnanimity(def, matrix.quarteredPairs, 4));
    }
  }

  return results;
}
