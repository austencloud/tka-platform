/**
 * Learn Module ITI Container
 *
 * Provides services for the Codex, Quiz, and Learning Progress features.
 * Services are organized by dependency order:
 * - Tier 1: No dependencies (standalone services)
 * - Tier 2: Depends on Tier 1 (QuizRepoManager, ConceptProgressTracker)
 * - Tier 3: Depends on Tier 1 + Tier 2 (Codex)
 */

import { createContainer } from "iti";
import { CodexLetterMappingRepo } from "$lib/features/learn/codex/services/implementations/CodexLetterMappingRepo";
import { CodexPictographUpdater } from "$lib/features/learn/codex/services/implementations/CodexPictographUpdater";
import { Codex } from "$lib/features/learn/codex/services/implementations/Codex";
import { QuizRepoManager } from "$lib/features/learn/quiz/services/implementations/QuizRepoManager";
import { QuizSessionManager } from "$lib/features/learn/quiz/services/implementations/QuizSessionManager";
import { QuizResultsAnalyzer } from "$lib/features/learn/quiz/QuizResultsAnalyzer";
import { ConceptProgressTracker } from "$lib/features/learn/services/implementations/ConceptProgressTracker";
import { UserKnowledgeProfilePersister } from "$lib/features/learn/services/implementations/UserKnowledgeProfilePersister";
import { QuizHistoryRecorder } from "$lib/features/learn/services/implementations/QuizHistoryRecorder";
import { ConceptRecommender } from "$lib/features/learn/services/implementations/ConceptRecommender";
import { SoundPlayer } from "$lib/shared/audio/services/implementations/SoundPlayer";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";

/**
 * Creates the learn container with required external dependencies.
 *
 * @param letterQueryHandler - The letter query handler for pictograph lookups
 */
export function createLearnContainer(letterQueryHandler: ILetterQueryHandler) {
  // Create the repo first so we can inject it into the letter query handler
  const codexLetterMappingRepo = new CodexLetterMappingRepo();

  // Inject the repo into the letter query handler if the method exists
  // This enables Codex-specific methods like getAllCodexPictographs
  if (letterQueryHandler.setLetterMappingRepo) {
    letterQueryHandler.setLetterMappingRepo(codexLetterMappingRepo);
  }

  return createContainer()
    // === Tier 1: Services with no internal dependencies ===
    .add({
      codexLetterMappingRepo: () => codexLetterMappingRepo,
      codexPictographUpdater: () => new CodexPictographUpdater(),
      quizSessionManager: () => new QuizSessionManager(),
      quizResultsAnalyzer: () => new QuizResultsAnalyzer(),
      userKnowledgeProfilePersister: () => new UserKnowledgeProfilePersister(),
      quizHistoryRecorder: () => new QuizHistoryRecorder(),
      conceptRecommender: () => new ConceptRecommender(),
      soundPlayer: () => new SoundPlayer(),
    })
    // === Tier 2: Services with internal dependencies ===
    .add((ctx) => ({
      quizRepoManager: () =>
        new QuizRepoManager(ctx.codexLetterMappingRepo),
      conceptProgressTracker: () =>
        new ConceptProgressTracker(ctx.userKnowledgeProfilePersister),
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
