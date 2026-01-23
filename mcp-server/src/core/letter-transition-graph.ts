/**
 * Letter Transition Graph for MCP Server
 *
 * Thin wrapper around the shared TransitionGraph implementation.
 * Provides the same API for backward compatibility with existing MCP code.
 */

import { TransitionGraph } from "../../../src/lib/shared/sequence-engine/services/implementations/TransitionGraph.js";
import { getNodeDataProvider } from "../adapters/NodeDataProvider.js";
import type { PositionGroup, LetterPositionInfo } from "../../../src/lib/shared/sequence-engine/domain/models/SequenceEngineTypes.js";

/**
 * Legacy wrapper class that delegates to the shared TransitionGraph.
 * Maintains backward compatibility with existing MCP code.
 */
export class LetterTransitionGraph {
  private readonly sharedGraph: TransitionGraph;
  private initialized = false;

  constructor() {
    const dataProvider = getNodeDataProvider();
    this.sharedGraph = new TransitionGraph(dataProvider);
  }

  /**
   * Initialize the graph by loading letter mappings.
   * Note: This is synchronous for backward compatibility but internally async.
   */
  initialize(): void {
    if (this.initialized) return;

    // Load synchronously for backward compatibility
    // The data provider loads synchronously in Node.js
    this.sharedGraph.initialize()
      .then(() => {
        this.initialized = true;
      })
      .catch((error) => {
        console.error("[MCP] Failed to initialize LetterTransitionGraph:", error);
        throw error;
      });

    // Force synchronous behavior by checking initialization state
    // This works because NodeDataProvider uses fs.readFileSync
    this.initialized = true;
  }

  canFollow(letterA: string, letterB: string): boolean {
    return this.sharedGraph.canFollow(letterA, letterB);
  }

  getValidSuccessors(letter: string): string[] {
    return this.sharedGraph.getValidSuccessors(letter);
  }

  getLetterPositionInfo(letter: string): LetterPositionInfo | null {
    return this.sharedGraph.getLetterPositionInfo(letter);
  }

  getStartPositionGroup(letter: string): PositionGroup | null {
    return this.sharedGraph.getStartPositionGroup(letter);
  }

  getEndPositionGroup(letter: string): PositionGroup | null {
    return this.sharedGraph.getEndPositionGroup(letter);
  }

  findBridgeLetters(letterA: string, letterB: string): string[] {
    return this.sharedGraph.findBridgeLetters(letterA, letterB);
  }

  findAllBridgeOptions(letterA: string, letterB: string): string[] {
    return this.sharedGraph.findAllBridgeOptions(letterA, letterB);
  }

  isInitialized(): boolean {
    return this.initialized && this.sharedGraph.isInitialized();
  }

  getAllLetters(excludeLetters: Set<string> = new Set()): string[] {
    return this.sharedGraph.getAllLetters(excludeLetters);
  }
}

// Singleton instance
let transitionGraphInstance: LetterTransitionGraph | null = null;

/**
 * Get the singleton LetterTransitionGraph instance.
 */
export function getLetterTransitionGraph(): LetterTransitionGraph {
  if (!transitionGraphInstance) {
    transitionGraphInstance = new LetterTransitionGraph();
    transitionGraphInstance.initialize();
  }
  return transitionGraphInstance;
}

// Re-export types for convenience
export type { PositionGroup, LetterPositionInfo };
