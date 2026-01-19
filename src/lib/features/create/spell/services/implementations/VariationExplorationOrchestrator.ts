/**
 * Variation Exploration Orchestrator Implementation
 *
 * Handles word parsing and bridge letter insertion for spell generation.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
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

      // Build expanded letters with bridge letters
      const expandedLetters: Letter[] = [];
      for (let i = 0; i < originalLetters.length; i++) {
        const letter = originalLetters[i];
        if (!letter) continue;

        if (i === 0) {
          expandedLetters.push(letter);
        } else {
          const prevLetter = expandedLetters[expandedLetters.length - 1];
          if (prevLetter) {
            const bridgeLetters = graph.findBridgeLetters(prevLetter, letter);
            if (bridgeLetters.length > 0 && bridgeLetters[0]) {
              expandedLetters.push(bridgeLetters[0]);
            }
          }
          expandedLetters.push(letter);
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
