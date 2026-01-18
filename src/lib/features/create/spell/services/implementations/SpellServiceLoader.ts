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
import type { IVariationExplorer } from "../contracts/IVariationExplorer";
import type { IVariationDeduplicator } from "../contracts/IVariationDeduplicator";
import type { IVariationScorer } from "../contracts/IVariationScorer";
import type { IVariationConstraintBuilder } from "../contracts/IVariationConstraintBuilder";
import type { IRandomSequenceGenerator } from "../contracts/IRandomSequenceGenerator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";

export class SpellServiceLoader implements ISpellServiceLoader {
  private wordGenerator: IWordSequenceGenerator | null = null;
  private transitionGraph: ILetterTransitionGraph | null = null;
  private sequenceExtender: ISequenceExtender | null = null;
  private variationExplorer: IVariationExplorer | null = null;
  private variationDeduplicator: IVariationDeduplicator | null = null;
  private variationScorer: IVariationScorer | null = null;
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

  async getVariationExplorer(): Promise<IVariationExplorer> {
    if (!this.variationExplorer) {
      this.variationExplorer = container.items.variationExplorer as IVariationExplorer;
    }
    return this.variationExplorer;
  }

  async getVariationDeduplicator(): Promise<IVariationDeduplicator> {
    if (!this.variationDeduplicator) {
      this.variationDeduplicator = container.items.variationDeduplicator as IVariationDeduplicator;
    }
    return this.variationDeduplicator;
  }

  async getVariationScorer(): Promise<IVariationScorer> {
    if (!this.variationScorer) {
      this.variationScorer = container.items.variationScorer as IVariationScorer;
    }
    return this.variationScorer;
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
