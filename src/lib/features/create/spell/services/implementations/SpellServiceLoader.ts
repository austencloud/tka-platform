/**
 * Spell Service Loader Implementation
 *
 * Provides lazy-loaded access to spell-related services.
 * Handles DI module loading and service caching.
 */

import { container } from "$lib/shared/di";
import type { ISpellServiceLoader } from "../contracts/ISpellServiceLoader";
import type { ILetterTransitionGraph } from "../contracts/ILetterTransitionGraph";
import type { IWordSequenceGenerator } from "../contracts/IWordSequenceGenerator";
import type { IVariationConstraintBuilder } from "../contracts/IVariationConstraintBuilder";
import type { IRandomSequenceGenerator } from "../contracts/IRandomSequenceGenerator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";

export class SpellServiceLoader implements ISpellServiceLoader {
  private wordGenerator: IWordSequenceGenerator | null = null;
  private transitionGraph: ILetterTransitionGraph | null = null;
  private sequenceExtender: ISequenceExtender | null = null;
  private variationConstraintBuilder: IVariationConstraintBuilder | null = null;
  private randomSequenceGenerator: IRandomSequenceGenerator | null = null;

  async getWordGenerator(): Promise<IWordSequenceGenerator> {
    if (!this.wordGenerator) {
      this.wordGenerator = container.items.wordSequenceGenerator as IWordSequenceGenerator;
    }
    return this.wordGenerator;
  }

  async getTransitionGraph(): Promise<ILetterTransitionGraph> {
    if (!this.transitionGraph) {
      this.transitionGraph = container.items.letterTransitionGraph as ILetterTransitionGraph;
      if (!this.transitionGraph.isInitialized()) {
        await this.transitionGraph.initialize();
      }
    }
    return this.transitionGraph;
  }

  async getSequenceExtender(): Promise<ISequenceExtender> {
    if (!this.sequenceExtender) {
      this.sequenceExtender = container.items.sequenceExtender as ISequenceExtender;
    }
    return this.sequenceExtender;
  }

  async getVariationConstraintBuilder(): Promise<IVariationConstraintBuilder> {
    if (!this.variationConstraintBuilder) {
      this.variationConstraintBuilder = container.items.variationConstraintBuilder as IVariationConstraintBuilder;
    }
    return this.variationConstraintBuilder;
  }

  async getRandomSequenceGenerator(): Promise<IRandomSequenceGenerator> {
    if (!this.randomSequenceGenerator) {
      this.randomSequenceGenerator = container.items.randomSequenceGenerator as IRandomSequenceGenerator;
    }
    return this.randomSequenceGenerator;
  }
}
