/**
 * TIKA Server-Side DI Container
 *
 * Contains services that require Node.js APIs (fs, path)
 * and can only run on the server. Used by the TIKA API endpoint.
 */

import { TikaPictographLoader } from "../implementations/TikaPictographLoader";
import { TikaSequenceValidator } from "../implementations/TikaSequenceValidator";
import { TikaSequenceGenerator } from "../implementations/TikaSequenceGenerator";
import { TikaQuizGenerator } from "../implementations/TikaQuizGenerator";
import { TikaToolExecutor } from "../implementations/TikaToolExecutor";
import { TikaModelProvider } from "../implementations/TikaModelProvider";
import { TikaProgressWriter } from "./TikaProgressWriter";

import type { ITikaPictographLoader } from "../contracts/ITikaPictographLoader";
import type { ITikaSequenceValidator } from "../contracts/ITikaSequenceValidator";
import type { ITikaSequenceGenerator } from "../contracts/ITikaSequenceGenerator";
import type { ITikaQuizGenerator } from "../contracts/ITikaQuizGenerator";
import type { ITikaToolExecutor } from "../contracts/ITikaToolExecutor";
import type { ITikaModelProvider } from "../contracts/ITikaModelProvider";
import type { ITikaProgressWriter } from "../contracts/ITikaProgressWriter";

export interface TikaServerContainerDeps {
  anthropicApiKey: string;
  deepseekApiKey: string;
}

export interface TikaServerContainer {
  pictographLoader: ITikaPictographLoader;
  sequenceValidator: ITikaSequenceValidator;
  sequenceGenerator: ITikaSequenceGenerator;
  quizGenerator: ITikaQuizGenerator;
  toolExecutor: ITikaToolExecutor;
  modelProvider: ITikaModelProvider;
  progressWriter: ITikaProgressWriter;
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
  const progressWriter = new TikaProgressWriter();

  _container = {
    pictographLoader,
    sequenceValidator,
    sequenceGenerator,
    quizGenerator,
    toolExecutor,
    modelProvider,
    progressWriter,
  };

  return _container;
}

/**
 * Reset the container (for testing).
 */
export function resetTikaServerContainer(): void {
  _container = null;
}
