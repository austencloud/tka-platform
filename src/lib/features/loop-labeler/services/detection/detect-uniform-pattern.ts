import type { ExtractedStep } from "../../domain/models/internal-step-models";
import type { CandidateDesignation } from "../../domain/models/label-models";
import type { StepComparisonOrchestrator } from "../comparison/step-comparison-orchestrator";
import { LOOP_TYPE_DEFINITIONS } from "../../domain/constants/loop-type-definitions";
import { compareBeatPairs } from "./compare-beat-pairs";
import { runUnanimityChecks } from "./run-unanimity-checks";
import { mergeIntervals } from "./merge-intervals";
import { applyStrictPrefix } from "./apply-strict-prefix";
import { checkRewound } from "./check-rewound";
import { buildCandidates } from "./build-candidates";

export function detectUniformPattern(
  steps: ExtractedStep[],
  orchestrator: StepComparisonOrchestrator
): CandidateDesignation[] {
  const matrix  = compareBeatPairs(steps, orchestrator);
  const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
  const merged  = mergeIntervals(results);
  const strict  = applyStrictPrefix(merged);
  const rewound = checkRewound(steps);
  return buildCandidates(strict, rewound);
}
