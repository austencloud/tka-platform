/**
 * Spell Generation Orchestrator Implementation
 *
 * Coordinates single word-to-sequence generation flow.
 * Handles generation, and extension options fetching.
 */

import { inject, injectable } from "inversify";
import { SPELL_TYPES } from "./spell-types";
import type { ISpellServiceLoader } from "../contracts/ISpellServiceLoader";
import type {
  ISpellGenerationOrchestrator,
  SpellGenerationOutcome,
} from "../contracts/ISpellGenerationOrchestrator";
import type { SpellPreferences } from "../../domain/models/spell-models";
import type { CircularizationOption } from "$lib/features/create/shared/services/contracts/ISequenceExtender";

@injectable()
export class SpellGenerationOrchestrator implements ISpellGenerationOrchestrator {
  constructor(
    @inject(SPELL_TYPES.ISpellServiceLoader)
    private serviceLoader: ISpellServiceLoader
  ) {}

  async generate(
    word: string,
    preferences: SpellPreferences
  ): Promise<SpellGenerationOutcome> {
    if (!word.trim()) {
      return { success: false, error: "No word provided" };
    }

    try {
      // Ensure transition graph is initialized
      await this.serviceLoader.getTransitionGraph();

      const generator = await this.serviceLoader.getWordGenerator();
      const result = await generator.generateFromWord({
        word,
        preferences,
      });

      if (!result.success || !result.sequence) {
        return {
          success: false,
          error: result.error || "Failed to generate sequence",
        };
      }

      // Fetch ALL extension options (pictograph-first UX)
      let extensionOptions: CircularizationOption[] = [];
      try {
        const extender = await this.serviceLoader.getSequenceExtender();
        extensionOptions = await extender.getAllExtensionOptions({
          ...result.sequence,
          name: result.originalWord,
          word: result.expandedWord,
        });
      } catch (extErr) {
        console.warn(
          "[SpellGenerationOrchestrator] Failed to fetch extension options:",
          extErr
        );
      }

      return {
        success: true,
        sequence: result.sequence,
        originalWord: result.originalWord,
        expandedWord: result.expandedWord,
        letterSources: result.letterSources,
        loopAnalysis: result.loopAnalysis,
        circularizationOptions: result.circularizationOptions ?? [],
        directLoopUnavailableReason: result.directLoopUnavailableReason ?? null,
        extensionOptions,
      };
    } catch (error) {
      console.error(
        "[SpellGenerationOrchestrator] Failed to generate sequence:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
