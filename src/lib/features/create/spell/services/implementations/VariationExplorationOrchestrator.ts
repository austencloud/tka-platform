/**
 * Variation Exploration Orchestrator Implementation
 *
 * Handles word parsing and bridge letter insertion for spell generation.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { LetterSource } from "../../domain/models/spell-models";
import type { ISpellServiceLoader } from "../contracts/ISpellServiceLoader";
import type {
  IVariationExplorationOrchestrator,
  WordParseResult,
} from "../contracts/IVariationExplorationOrchestrator";

export class VariationExplorationOrchestrator implements IVariationExplorationOrchestrator {
  constructor(private serviceLoader: ISpellServiceLoader) {}

  async parseWord(word: string): Promise<WordParseResult> {
    try {
      const graph = await this.serviceLoader.getTransitionGraph();
      const generator = await this.serviceLoader.getWordGenerator();

      const parseResult = generator.parseWord(word);
      if (!parseResult || parseResult.error) {
        return {
          success: false,
          error: parseResult?.error || "Could not parse word",
        };
      }

      const originalLetters = parseResult.letters;
      if (originalLetters.length === 0) {
        return { success: false, error: "No valid letters in word" };
      }

      // Build expanded letters with bridge letters AND track letter sources
      const expandedLetters: Letter[] = [];
      const letterSources: LetterSource[] = [];

      for (let i = 0; i < originalLetters.length; i++) {
        const letter = originalLetters[i];
        if (!letter) continue;

        if (i === 0) {
          expandedLetters.push(letter);
          letterSources.push({
            letter,
            isOriginal: true,
            stepIndex: expandedLetters.length,
          });
        } else {
          const prevLetter = expandedLetters[expandedLetters.length - 1];
          if (prevLetter) {
            const bridgeLetters = graph.findBridgeLetters(prevLetter, letter);
            if (bridgeLetters.length > 0 && bridgeLetters[0]) {
              const bridgeLetter = bridgeLetters[0];
              expandedLetters.push(bridgeLetter);
              letterSources.push({
                letter: bridgeLetter,
                isOriginal: false,
                stepIndex: expandedLetters.length,
              });
            }
          }
          expandedLetters.push(letter);
          letterSources.push({
            letter,
            isOriginal: true,
            stepIndex: expandedLetters.length,
          });
        }
      }

      if (expandedLetters.length === 0) {
        return {
          success: false,
          error: "Could not expand word to valid letters",
        };
      }

      return {
        success: true,
        originalLetters,
        expandedLetters,
        expandedWord: expandedLetters.join(""),
        letterSources,
      };
    } catch (error) {
      console.error(
        "[VariationExplorationOrchestrator] Failed to parse word:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { spellServiceLoader } from "./SpellServiceLoader";

export const variationExplorationOrchestrator = new VariationExplorationOrchestrator(
  spellServiceLoader
);
