/**
 * Learn Module ITI Container
 *
 * Provides services for the Codex and Quiz features in the Learn module.
 * Services are organized by dependency order:
 * - Tier 1: No dependencies (CodexLetterMappingRepo, CodexPictographUpdater, etc.)
 * - Tier 2: Depends on Tier 1 (QuizRepoManager, Codex)
 */

import { createContainer } from "iti";
import { CodexLetterMappingRepo } from "$lib/features/learn/codex/services/implementations/CodexLetterMappingRepo";
import { CodexPictographUpdater } from "$lib/features/learn/codex/services/implementations/CodexPictographUpdater";
import { Codex } from "$lib/features/learn/codex/services/implementations/Codex";
import { QuizRepoManager } from "$lib/features/learn/quiz/services/implementations/QuizRepoManager";
import { QuizSessionManager } from "$lib/features/learn/quiz/services/implementations/QuizSessionManager";
import { QuizResultsAnalyzer } from "$lib/features/learn/quiz/QuizResultsAnalyzer";
import { ConceptProgressTracker } from "$lib/features/learn/services/implementations/ConceptProgressTracker";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";

/**
 * Creates the learn container with required external dependencies.
 *
 * @param letterQueryHandler - The letter query handler for pictograph lookups
 */
export function createLearnContainer(letterQueryHandler: ILetterQueryHandler) {
  return createContainer()
    // === Tier 1: Services with no internal dependencies ===
    .add({
      codexLetterMappingRepo: () => new CodexLetterMappingRepo(),
      codexPictographUpdater: () => new CodexPictographUpdater(),
      quizSessionManager: () => new QuizSessionManager(),
      quizResultsAnalyzer: () => new QuizResultsAnalyzer(),
      conceptProgressTracker: () => new ConceptProgressTracker(),
    })
    // === Tier 2: Services with internal dependencies ===
    .add((ctx) => ({
      quizRepoManager: () =>
        new QuizRepoManager(ctx.codexLetterMappingRepo),
    }))
    // === Tier 3: Codex depends on multiple Tier 1 and Tier 2 services ===
    .add((ctx) => ({
      codex: () =>
        new Codex(
          ctx.codexLetterMappingRepo,
          ctx.quizRepoManager,
          ctx.codexPictographUpdater,
          letterQueryHandler
        ),
    }));
}

export type LearnContainer = ReturnType<typeof createLearnContainer>;
