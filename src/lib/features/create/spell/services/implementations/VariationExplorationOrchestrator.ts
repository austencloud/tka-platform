/**
 * Variation Exploration Orchestrator Implementation
 *
 * Coordinates the "Generate All" flow that explores all possible
 * sequence variations for a given word.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ISpellServiceLoader } from "../contracts/ISpellServiceLoader";
import type {
  IVariationExplorationOrchestrator,
  ExplorationCallbacks,
  ExplorationResult,
  WordParseResult,
} from "../contracts/IVariationExplorationOrchestrator";
import type { SpellPreferences } from "../../domain/models/spell-models";

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

  async estimateVariationCount(
    expandedLetters: Letter[],
    gridMode: GridMode
  ): Promise<number> {
    const explorer = await this.serviceLoader.getVariationExplorer();
    return explorer.estimateVariationCount(expandedLetters, gridMode);
  }

  resetDeduplicator(): void {
    // Get deduplicator synchronously if already loaded
    this.serviceLoader.getVariationDeduplicator().then((dedup) => {
      dedup.reset();
    });
  }

  async exploreVariations(
    expandedLetters: Letter[],
    preferences: SpellPreferences,
    gridMode: GridMode,
    callbacks: ExplorationCallbacks,
    signal: AbortSignal
  ): Promise<ExplorationResult> {
    const explorer = await this.serviceLoader.getVariationExplorer();
    const deduplicator = await this.serviceLoader.getVariationDeduplicator();
    const scorer = await this.serviceLoader.getVariationScorer();
    const constraintBuilder = await this.serviceLoader.getVariationConstraintBuilder();

    // Reset deduplicator for new exploration
    deduplicator.reset();

    // Build constraints from preferences for efficient exploration
    const constraints = constraintBuilder.buildConstraints(
      preferences,
      expandedLetters
    );

    let totalExplored = 0;
    let uniqueCount = 0;

    try {
      const variationGenerator = explorer.exploreVariations(expandedLetters, {
        gridMode,
        signal,
        constraints, // Pass constraints for "constrain → generate-only-matching" flow
      });

      for await (const variation of variationGenerator) {
        if (signal.aborted) {
          return {
            totalExplored,
            uniqueCount,
            wasCancelled: true,
          };
        }

        totalExplored++;
        callbacks.onProgress(totalExplored);

        // Deduplicate using canonical hash
        if (!(await deduplicator.tryAdd(variation.sequence))) {
          continue; // Skip rotational duplicate
        }

        uniqueCount++;

        // Score the unique variation
        const score = scorer.scoreSequence(variation.sequence, preferences);

        // Generate unique ID
        const id = `var-${Date.now()}-${uniqueCount}`;

        // Notify callback
        callbacks.onVariationFound({
          id,
          sequence: variation.sequence,
          score,
          branchPath: variation.branchPath,
        });

        // Yield to UI periodically (every 10 variations)
        if (totalExplored % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      return {
        totalExplored,
        uniqueCount,
        wasCancelled: false,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          totalExplored,
          uniqueCount,
          wasCancelled: true,
        };
      }

      console.error(
        "[VariationExplorationOrchestrator] Exploration failed:",
        error
      );
      return {
        totalExplored,
        uniqueCount,
        wasCancelled: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
