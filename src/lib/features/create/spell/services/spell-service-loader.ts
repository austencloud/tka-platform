/**
 * Spell Service Loader
 *
 * Provides lazy-loaded access to spell-related services.
 * Uses direct singleton imports.
 */


import type { LetterTransitionGraph } from "./implementations/LetterTransitionGraph";
import type { WordSequenceGenerator } from "./implementations/WordSequenceGenerator";
import type { VariationConstraintBuilder } from "./implementations/VariationConstraintBuilder";
import type { RandomSequenceGenerator } from "./implementations/RandomSequenceGenerator";
import type { SequenceExtender } from "../../shared/services/implementations/SequenceExtender";

// Direct singleton imports
import { letterTransitionGraph as letterTransitionGraphSingleton } from "./implementations/LetterTransitionGraph";
import { wordSequenceGenerator as wordSequenceGeneratorSingleton } from "./implementations/WordSequenceGenerator";
import { variationConstraintBuilder as variationConstraintBuilderSingleton } from "./implementations/VariationConstraintBuilder";
import { randomSequenceGenerator as randomSequenceGeneratorSingleton } from "./implementations/RandomSequenceGenerator";
import { sequenceExtender as sequenceExtenderSingleton } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";

export async function getWordGenerator(): Promise<WordSequenceGenerator> {
  return wordSequenceGeneratorSingleton;
}

export async function getTransitionGraph(): Promise<LetterTransitionGraph> {
  if (!letterTransitionGraphSingleton.isInitialized()) {
    // Set the letter query handler before initialization (required by LetterTransitionGraph)
    letterTransitionGraphSingleton.setLetterQueryHandler(letterQueryHandler);
    await letterTransitionGraphSingleton.initialize();
  }
  return letterTransitionGraphSingleton;
}

export async function getSequenceExtender(): Promise<SequenceExtender> {
  return sequenceExtenderSingleton;
}

export async function getVariationConstraintBuilder(): Promise<VariationConstraintBuilder> {
  return variationConstraintBuilderSingleton;
}

export async function getRandomSequenceGenerator(): Promise<RandomSequenceGenerator> {
  return randomSequenceGeneratorSingleton;
}
