/**
 * Spell Service Loader Implementation
 *
 * Provides lazy-loaded access to spell-related services.
 * Uses direct singleton imports.
 */


import type { LetterTransitionGraph } from "../implementations/LetterTransitionGraph";
import type { WordSequenceGenerator } from "../implementations/WordSequenceGenerator";
import type { VariationConstraintBuilder } from "../implementations/VariationConstraintBuilder";
import type { RandomSequenceGenerator } from "./RandomSequenceGenerator";
import type { SequenceExtender } from "../../../shared/services/implementations/SequenceExtender";

// Direct singleton imports
import { letterTransitionGraph as letterTransitionGraphSingleton } from "./LetterTransitionGraph";
import { wordSequenceGenerator as wordSequenceGeneratorSingleton } from "./WordSequenceGenerator";
import { variationConstraintBuilder as variationConstraintBuilderSingleton } from "./VariationConstraintBuilder";
import { randomSequenceGenerator as randomSequenceGeneratorSingleton } from "./RandomSequenceGenerator";
import { sequenceExtender as sequenceExtenderSingleton } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";

export class SpellServiceLoader {
  async getWordGenerator(): Promise<WordSequenceGenerator> {
    return wordSequenceGeneratorSingleton;
  }

  async getTransitionGraph(): Promise<LetterTransitionGraph> {
    if (!letterTransitionGraphSingleton.isInitialized()) {
      // Set the letter query handler before initialization (required by LetterTransitionGraph)
      letterTransitionGraphSingleton.setLetterQueryHandler(letterQueryHandler);
      await letterTransitionGraphSingleton.initialize();
    }
    return letterTransitionGraphSingleton;
  }

  async getSequenceExtender(): Promise<SequenceExtender> {
    return sequenceExtenderSingleton;
  }

  async getVariationConstraintBuilder(): Promise<VariationConstraintBuilder> {
    return variationConstraintBuilderSingleton;
  }

  async getRandomSequenceGenerator(): Promise<RandomSequenceGenerator> {
    return randomSequenceGeneratorSingleton;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const spellServiceLoader = new SpellServiceLoader();
