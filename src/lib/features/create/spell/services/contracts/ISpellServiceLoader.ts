/**
 * Spell Service Loader Interface
 *
 * Provides lazy-loaded access to spell-related services.
 * Handles DI module loading and service caching.
 */

import type { ILetterTransitionGraph } from "./ILetterTransitionGraph";
import type { IWordSequenceGenerator } from "./IWordSequenceGenerator";
import type { IVariationExplorer } from "./IVariationExplorer";
import type { IVariationDeduplicator } from "./IVariationDeduplicator";
import type { IVariationScorer } from "./IVariationScorer";
import type { IVariationConstraintBuilder } from "./IVariationConstraintBuilder";
import type { IRandomSequenceGenerator } from "./IRandomSequenceGenerator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";

export interface ISpellServiceLoader {
  /**
   * Get the word sequence generator service
   * @returns Promise resolving to the word generator
   */
  getWordGenerator(): Promise<IWordSequenceGenerator>;

  /**
   * Get the letter transition graph service
   * Ensures the graph is initialized before returning
   * @returns Promise resolving to the initialized transition graph
   */
  getTransitionGraph(): Promise<ILetterTransitionGraph>;

  /**
   * Get the sequence extender service
   * @returns Promise resolving to the sequence extender
   */
  getSequenceExtender(): Promise<ISequenceExtender>;

  /**
   * Get the variation explorer service
   * @returns Promise resolving to the variation explorer
   */
  getVariationExplorer(): Promise<IVariationExplorer>;

  /**
   * Get the variation deduplicator service
   * @returns Promise resolving to the variation deduplicator
   */
  getVariationDeduplicator(): Promise<IVariationDeduplicator>;

  /**
   * Get the variation scorer service
   * @returns Promise resolving to the variation scorer
   */
  getVariationScorer(): Promise<IVariationScorer>;

  /**
   * Get the variation constraint builder service
   * @returns Promise resolving to the variation constraint builder
   */
  getVariationConstraintBuilder(): Promise<IVariationConstraintBuilder>;

  /**
   * Get the random sequence generator service
   * @returns Promise resolving to the random sequence generator
   */
  getRandomSequenceGenerator(): Promise<IRandomSequenceGenerator>;
}
