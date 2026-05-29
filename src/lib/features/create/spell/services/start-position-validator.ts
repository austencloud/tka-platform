/**
 * Start Position Validator Implementation
 *
 * Validates that start positions are static pictographs (Type 6 letters only).
 * Start positions must have startPosition === endPosition (no movement).
 */

import type { LetterTransitionGraph } from "./letter-transition-graph";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getLetterType } from "$lib/shared/foundation/domain/models/Letter";
import { LetterType } from "$lib/shared/foundation/domain/models/LetterType";

export class StartPositionValidator {
  constructor(
    private readonly letterTransitionGraph: LetterTransitionGraph,
    private readonly letterQueryHandler: ILetterQueryHandler
  ) {}

  async getValidStartPositions(
    firstLetter: Letter,
    gridMode: GridMode
  ): Promise<PictographData[]> {
    // Get the position group where the first letter starts
    const startGroup = this.letterTransitionGraph.getStartPositionGroup(firstLetter);
    if (!startGroup) {
      throw new Error(
        `Cannot determine start position group for letter: ${firstLetter}`
      );
    }

    // Get all pictograph variations
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Filter for valid start positions that end at the required group
    const validStartPositions = allPictographs.filter((p) => {
      // Must be a valid static pictograph
      if (!this.isValidStartPosition(p)) {
        return false;
      }

      // Must end at the required position group
      const endPos = this.getEndPosition(p);
      const endGroup = this.positionToGroup(endPos);
      return endGroup === startGroup;
    });

    if (validStartPositions.length === 0) {
      throw new Error(
        `No valid start positions found for letter ${firstLetter} in ${gridMode} mode. ` +
          `Start positions must be Type 6 (static) letters ending at position group: ${startGroup}`
      );
    }

    return validStartPositions;
  }

  isValidStartPosition(pictograph: PictographData): boolean {
    // Check 1: Must be a Type 6 (static) letter
    if (!pictograph.letter) {
      return false;
    }

    const letterType = getLetterType(pictograph.letter);
    if (letterType !== LetterType.TYPE6) {
      return false;
    }

    // Check 2: Must have startPosition === endPosition (static/no movement)
    if (pictograph.startPosition !== pictograph.endPosition) {
      return false;
    }

    return true;
  }

  /**
   * Helper: Get the end position from a pictograph
   */
  private getEndPosition(pictograph: PictographData): string {
    return (pictograph.endPosition || pictograph.startPosition || "") as string;
  }

  /**
   * Helper: Convert a position string to its group (alpha, beta, gamma)
   */
  private positionToGroup(position: string): string | null {
    if (!position) return null;
    if (position.startsWith("alpha")) return "alpha";
    if (position.startsWith("beta")) return "beta";
    if (position.startsWith("gamma")) return "gamma";
    if (position.startsWith("zeta")) return "zeta";
    if (position.startsWith("eta")) return "eta";
    return null;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { letterTransitionGraph } from "./letter-transition-graph";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";

export const startPositionValidator = new StartPositionValidator(
  letterTransitionGraph,
  letterQueryHandler
);
