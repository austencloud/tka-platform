/**
 * TIKA Server-Side DI Container
 *
 * Contains services that require Node.js APIs (fs, path)
 * and can only run on the server. Used by the TIKA API endpoint.
 */

import { TikaPictographLoader } from "../tika-pictograph-loader";
import { TikaSequenceValidator } from "../tika-sequence-validator";
import { TikaSequenceGenerator } from "../tika-sequence-generator";
import { TikaQuizGenerator } from "../tika-quiz-generator";
import { TikaToolExecutor } from "../tika-tool-executor";
import { TikaModelProvider } from "../tika-model-provider";
import * as tikaProgressWriter from "./tika-progress-writer";
import type { VerificationResult } from "./tika-progress-writer";

export interface TikaServerContainerDeps {
  anthropicApiKey: string;
  deepseekApiKey: string;
}

interface ProgressWriter {
  validateConceptIds(conceptIds: string[], alreadyCompleted: string[]): { valid: string[]; rejected: Array<{ id: string; reason: string }> };
  writeCompletions(userId: string, conceptIds: string[], alreadyCompleted: string[], summary: string): Promise<VerificationResult>;
}

export interface TikaServerContainer {
  pictographLoader: TikaPictographLoader;
  sequenceValidator: TikaSequenceValidator;
  sequenceGenerator: TikaSequenceGenerator;
  quizGenerator: TikaQuizGenerator;
  toolExecutor: TikaToolExecutor;
  modelProvider: TikaModelProvider;
  progressWriter: ProgressWriter;
}

let _container: TikaServerContainer | null = null;

/**
 * Create or get the singleton TIKA server container.
 * Services are lazily initialized on first use.
 */
export function getTikaServerContainer(
  deps: TikaServerContainerDeps
): TikaServerContainer {
  if (_container) {
    return _container;
  }

  // Create instances with proper dependency injection
  const pictographLoader = new TikaPictographLoader();
  const sequenceValidator = new TikaSequenceValidator(pictographLoader);
  const sequenceGenerator = new TikaSequenceGenerator(pictographLoader);
  const quizGenerator = new TikaQuizGenerator();
  const toolExecutor = new TikaToolExecutor(
    pictographLoader,
    sequenceGenerator,
    sequenceValidator
  );
  const modelProvider = new TikaModelProvider(
    deps.anthropicApiKey,
    deps.deepseekApiKey
  );
  _container = {
    pictographLoader,
    sequenceValidator,
    sequenceGenerator,
    quizGenerator,
    toolExecutor,
    modelProvider,
    progressWriter: tikaProgressWriter,
  };

  return _container;
}

/**
 * Reset the container (for testing).
 */
export function resetTikaServerContainer(): void {
  _container = null;
}
