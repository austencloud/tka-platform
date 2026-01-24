/**
 * Spell Service Loader Implementation
 *
 * Provides lazy-loaded access to spell-related services.
 * Uses direct singleton imports.
 */

import type { ISpellServiceLoader } from "../contracts/ISpellServiceLoader";
import type { ILetterTransitionGraph } from "../contracts/ILetterTransitionGraph";
import type { IWordSequenceGenerator } from "../contracts/IWordSequenceGenerator";
import type { IVariationConstraintBuilder } from "../contracts/IVariationConstraintBuilder";
import type { IRandomSequenceGenerator } from "../contracts/IRandomSequenceGenerator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";

// Direct singleton imports
import { letterTransitionGraph as letterTransitionGraphSingleton } from "./LetterTransitionGraph";
import { wordSequenceGenerator as wordSequenceGeneratorSingleton } from "./WordSequenceGenerator";
import { variationConstraintBuilder as variationConstraintBuilderSingleton } from "./VariationConstraintBuilder";
import { randomSequenceGenerator as randomSequenceGeneratorSingleton } from "./RandomSequenceGenerator";
import { sequenceExtender as sequenceExtenderSingleton } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";

export class SpellServiceLoader implements ISpellServiceLoader {
  async getWordGenerator(): Promise<IWordSequenceGenerator> {
    return wordSequenceGeneratorSingleton;
  }

  async getTransitionGraph(): Promise<ILetterTransitionGraph> {
    if (!letterTransitionGraphSingleton.isInitialized()) {
      // Set the letter query handler before initialization (required by LetterTransitionGraph)
      letterTransitionGraphSingleton.setLetterQueryHandler(letterQueryHandler);
      await letterTransitionGraphSingleton.initialize();
    }
    return letterTransitionGraphSingleton;
  }

  async getSequenceExtender(): Promise<ISequenceExtender> {
    return sequenceExtenderSingleton;
  }

  async getVariationConstraintBuilder(): Promise<IVariationConstraintBuilder> {
    return variationConstraintBuilderSingleton;
  }

  async getRandomSequenceGenerator(): Promise<IRandomSequenceGenerator> {
    return randomSequenceGeneratorSingleton;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const spellServiceLoader = new SpellServiceLoader();
