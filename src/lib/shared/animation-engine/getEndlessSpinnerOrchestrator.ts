import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { EndState, SpinnerStats } from "$lib/shared/landing/domain/types";

/**
 * Interface for the EndlessSpinnerOrchestrator.
 * Manages continuous sequence playback by chaining sequences together seamlessly.
 */
export interface IEndlessSpinnerOrchestrator {
  initialize(): Promise<void>;
  isReady(): boolean;
  getInitialSequence(): Promise<SequenceData | null>;
  getNextSequence(endState: EndState): Promise<SequenceData | null>;
  getStats(): SpinnerStats;
  resetStats(): void;
}

export type EndlessSpinnerOrchestratorFactory = () => IEndlessSpinnerOrchestrator;

let factory: EndlessSpinnerOrchestratorFactory | null = null;

/**
 * Register the factory that creates EndlessSpinnerOrchestrator instances.
 * Called once from bootstrap.ts to avoid a reverse import (shared/ -> features/).
 */
export function registerEndlessSpinnerOrchestratorFactory(
  fn: EndlessSpinnerOrchestratorFactory
): void {
  factory = fn;
}

export function createEndlessSpinnerOrchestrator(): IEndlessSpinnerOrchestrator {
  if (!factory) {
    throw new Error(
      "EndlessSpinnerOrchestrator factory not registered. " +
      "Ensure registerEndlessSpinnerOrchestratorFactory() is called at app startup."
    );
  }
  return factory();
}
