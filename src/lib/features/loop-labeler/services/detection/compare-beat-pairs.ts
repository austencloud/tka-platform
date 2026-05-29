import type { ExtractedStep } from "../../domain/models/internal-step-models";
import type { StepComparisonOrchestrator } from "../comparison/step-comparison-orchestrator";
import type { ComparisonMatrix } from "./types";

export function compareBeatPairs(
  steps: ExtractedStep[],
  orchestrator: StepComparisonOrchestrator
): ComparisonMatrix {
  const halvedPairs = new Map<string, string[]>();
  const quarteredPairs = new Map<string, string[]>();

  if (steps.length >= 2 && steps.length % 2 === 0) {
    const halfLength = steps.length / 2;
    for (let i = 0; i < halfLength; i++) {
      const step1 = steps[i]!;
      const step2 = steps[halfLength + i]!;
      const labels = orchestrator.compareStepPair(step1, step2);
      halvedPairs.set(`${step1.stepNumber}-${step2.stepNumber}`, labels);
    }
  }

  if (steps.length >= 4 && steps.length % 4 === 0) {
    const quarterLength = steps.length / 4;
    for (let i = 0; i < steps.length; i++) {
      const step1 = steps[i]!;
      const step2 = steps[(i + quarterLength) % steps.length]!;
      const labels = orchestrator.compareStepPair(step1, step2);
      quarteredPairs.set(`${step1.stepNumber}-${step2.stepNumber}`, labels);
    }
  }

  return { halvedPairs, quarteredPairs };
}
