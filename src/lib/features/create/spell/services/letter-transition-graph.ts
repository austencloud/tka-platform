/**
 * Letter Transition Graph Implementation
 *
 * Wrapper around the shared TransitionGraph for browser contexts.
 * Provides Letter-typed interface for type safety.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { TransitionGraph } from "$lib/shared/sequence-engine/services/transition-graph";
import { BrowserDataProvider } from "$lib/shared/sequence-engine/data/browser-data-provider";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

import type {
  LetterPositionInfo,
  LetterCategory,
} from "../domain/models/spell-models";
import type { PositionGroup } from "$lib/shared/sequence-engine/domain/models/sequence-engine-types";

/**
 * Browser-specific transition graph using the shared engine.
 */
export class LetterTransitionGraph {
  private sharedGraph: TransitionGraph | null = null;
  private letterQueryHandler: ILetterQueryHandler | null = null;
  private initialized = false;

  /**
   * Set the letter query handler for data loading.
   * Must be called before initialize().
   */
  setLetterQueryHandler(handler: ILetterQueryHandler): void {
    this.letterQueryHandler = handler;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.letterQueryHandler) {
      throw new Error(
        "LetterQueryHandler must be set before initialization. Call setLetterQueryHandler() first."
      );
    }

    // Create browser data provider wrapping the letter query handler
    const dataProvider = new BrowserDataProvider(this.letterQueryHandler);

    // Create and initialize the shared transition graph
    this.sharedGraph = new TransitionGraph(dataProvider);
    await this.sharedGraph.initialize();
    this.initialized = true;
  }

  canFollow(letterA: Letter, letterB: Letter): boolean {
    if (!this.sharedGraph) return false;
    return this.sharedGraph.canFollow(letterA, letterB);
  }

  getValidSuccessors(letter: Letter): Letter[] {
    if (!this.sharedGraph) return [];
    return this.sharedGraph.getValidSuccessors(letter) as Letter[];
  }

  getLettersStartingAt(positionGroup: GridPositionGroup): Letter[] {
    if (!this.sharedGraph) return [];
    const sharedGroup = this.toSharedPositionGroup(positionGroup);
    if (!sharedGroup) return [];
    return this.sharedGraph.getLettersStartingAt(sharedGroup) as Letter[];
  }

  getLettersEndingAt(positionGroup: GridPositionGroup): Letter[] {
    if (!this.sharedGraph) return [];
    const sharedGroup = this.toSharedPositionGroup(positionGroup);
    if (!sharedGroup) return [];
    return this.sharedGraph.getLettersEndingAt(sharedGroup) as Letter[];
  }

  getLetterPositionInfo(letter: Letter): LetterPositionInfo | null {
    if (!this.sharedGraph) return null;
    const sharedInfo = this.sharedGraph.getLetterPositionInfo(letter);
    if (!sharedInfo) return null;

    return {
      letter: sharedInfo.letter as Letter,
      startPositionGroup: this.toGridPositionGroup(sharedInfo.startPositionGroup),
      endPositionGroup: this.toGridPositionGroup(sharedInfo.endPositionGroup),
      category: (sharedInfo.category || "dual-shift") as LetterCategory,
    };
  }

  getStartPositionGroup(letter: Letter): GridPositionGroup | null {
    if (!this.sharedGraph) return null;
    const sharedGroup = this.sharedGraph.getStartPositionGroup(letter);
    if (!sharedGroup) return null;
    return this.toGridPositionGroup(sharedGroup);
  }

  getEndPositionGroup(letter: Letter): GridPositionGroup | null {
    if (!this.sharedGraph) return null;
    const sharedGroup = this.sharedGraph.getEndPositionGroup(letter);
    if (!sharedGroup) return null;
    return this.toGridPositionGroup(sharedGroup);
  }

  findBridgeLetters(letterA: Letter, letterB: Letter): Letter[] {
    if (!this.sharedGraph) return [];
    return this.sharedGraph.findBridgeLetters(letterA, letterB) as Letter[];
  }

  findAllBridgeOptions(letterA: Letter, letterB: Letter): Letter[] {
    if (!this.sharedGraph) return [];
    return this.sharedGraph.findAllBridgeOptions(letterA, letterB) as Letter[];
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Convert GridPositionGroup enum to shared PositionGroup string.
   */
  private toSharedPositionGroup(group: GridPositionGroup): PositionGroup | null {
    switch (group) {
      case GridPositionGroup.ALPHA:
        return "alpha";
      case GridPositionGroup.BETA:
        return "beta";
      case GridPositionGroup.GAMMA:
        return "gamma";
      default:
        return null;
    }
  }

  /**
   * Convert shared PositionGroup string to GridPositionGroup enum.
   */
  private toGridPositionGroup(group: PositionGroup): GridPositionGroup {
    switch (group) {
      case "alpha":
        return GridPositionGroup.ALPHA;
      case "beta":
        return GridPositionGroup.BETA;
      case "gamma":
        return GridPositionGroup.GAMMA;
      default:
        return GridPositionGroup.ALPHA;
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const letterTransitionGraph = new LetterTransitionGraph();
