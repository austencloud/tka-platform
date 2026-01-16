/**
 * ITI Container for LOOP Labeler Services
 *
 * Provides LOOP detection pipeline including beat data conversion,
 * transformation comparison, and pattern analysis services.
 */

import { createContainer } from "iti";

// Services with no dependencies
import { StepDataConverter } from "$lib/features/loop-labeler/services/implementations/StepDataConverter";
import { StepPairAnalyzer } from "$lib/features/loop-labeler/services/implementations/StepPairAnalyzer";
import { LOOPDesignator } from "$lib/features/loop-labeler/services/implementations/LOOPDesignator";
import { PolyrhythmicDetector } from "$lib/features/loop-labeler/services/implementations/PolyrhythmicDetector";
import { LayeredPathDetector } from "$lib/features/loop-labeler/services/implementations/LayeredPathDetector";
import { CandidateFormatter } from "$lib/features/loop-labeler/services/implementations/CandidateFormatter";
import { RotationComparer } from "$lib/features/loop-labeler/services/implementations/comparison/RotationComparer";
import { ReflectionComparer } from "$lib/features/loop-labeler/services/implementations/comparison/ReflectionComparer";
import { SwapInvertComparer } from "$lib/features/loop-labeler/services/implementations/comparison/SwapInvertComparer";
import { LOOPLabelsFirebaseRepository } from "$lib/features/loop-labeler/services/implementations/LOOPLabelsFirebaseRepository";
import { SequenceLoader } from "$lib/features/loop-labeler/services/implementations/SequenceLoader";
import { Navigator } from "$lib/features/loop-labeler/services/implementations/Navigator";
import { RuleBasedTagger } from "$lib/features/loop-labeler/services/implementations/RuleBasedTagger";

// Services with internal dependencies
import { StepComparisonOrchestrator } from "$lib/features/loop-labeler/services/implementations/comparison/StepComparisonOrchestrator";
import { TransformationAnalyzer } from "$lib/features/loop-labeler/services/implementations/TransformationAnalyzer";
import { LOOPDetector } from "$lib/features/loop-labeler/services/implementations/LOOPDetector";

// Services with external dependencies
import { SequenceFeatureExtractor } from "$lib/features/loop-labeler/services/implementations/SequenceFeatureExtractor";

// Type imports for external dependencies
import type { ISequenceAnalyzer } from "$lib/features/create/shared/services/contracts/ISequenceAnalyzer";

/**
 * Creates the LOOP Labeler container with all services configured.
 *
 * @param externalDeps - External dependencies from other modules
 * @returns Configured ITI container with all LOOP labeler services
 */
export function createLoopLabelerContainer(externalDeps: {
  sequenceAnalyzer: ISequenceAnalyzer;
}) {
  return (
    createContainer()
      // === Layer 1: Services with no dependencies ===
      .add({
        stepDataConverter: () => new StepDataConverter(),
        beatPairAnalyzer: () => new StepPairAnalyzer(),
        loopDesignator: () => new LOOPDesignator(),
        polyrhythmicDetector: () => new PolyrhythmicDetector(),
        layeredPathDetector: () => new LayeredPathDetector(),
        candidateFormatter: () => new CandidateFormatter(),
        rotationComparer: () => new RotationComparer(),
        reflectionComparer: () => new ReflectionComparer(),
        swapInvertComparer: () => new SwapInvertComparer(),
        loopLabelsFirebaseRepository: () => new LOOPLabelsFirebaseRepository(),
        sequenceLoader: () => new SequenceLoader(),
        navigator: () => new Navigator(),
        ruleBasedTagger: () => new RuleBasedTagger(),
      })

      // === Layer 2: Services with internal dependencies ===
      .add((deps) => ({
        beatComparisonOrchestrator: () =>
          new StepComparisonOrchestrator(
            deps.rotationComparer,
            deps.reflectionComparer,
            deps.swapInvertComparer,
            deps.candidateFormatter
          ),
        transformationAnalyzer: () =>
          new TransformationAnalyzer(deps.candidateFormatter),
      }))

      // === Layer 3: Services depending on Layer 2 ===
      .add((deps) => ({
        loopDetector: () =>
          new LOOPDetector(
            deps.beatComparisonOrchestrator,
            deps.transformationAnalyzer,
            deps.candidateFormatter,
            deps.polyrhythmicDetector,
            deps.layeredPathDetector
          ),
      }))

      // === Layer 4: Services with external dependencies ===
      .add(() => ({
        sequenceFeatureExtractor: () =>
          new SequenceFeatureExtractor(externalDeps.sequenceAnalyzer),
      }))
  );
}

// Type for the container's items
export type LoopLabelerContainerItems = ReturnType<
  typeof createLoopLabelerContainer
>["items"];
