/**
 * LOOP Selection Coordinator Implementation
 *
 * Coordinates the two-phase LOOP selection flow:
 * Phase 1: Pictograph/Bridge Selection
 * Phase 2: LOOP Selection
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { CircularizationOption } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { ISpellServiceLoader } from "../contracts/ISpellServiceLoader";
import type {
  ILOOPSelectionCoordinator,
  BridgeApplicationResult,
  LOOPApplicationResult,
} from "../contracts/ILOOPSelectionCoordinator";
import type { SpellPreferences } from "../../domain/models/spell-models";

export class LOOPSelectionCoordinator implements ILOOPSelectionCoordinator {
  constructor(private serviceLoader: ISpellServiceLoader) {}

  async applyBridge(
    sequence: SequenceData,
    option: CircularizationOption
  ): Promise<BridgeApplicationResult> {
    try {
      const bridgeLetter = option.bridgeLetters[0] as Letter;
      if (!bridgeLetter) {
        return { success: false, error: "No bridge letter in option" };
      }

      const extender = await this.serviceLoader.getSequenceExtender();
      const sequenceWithBridge = await extender.appendBridgeBeat(
        sequence,
        bridgeLetter
      );

      return {
        success: true,
        sequence: sequenceWithBridge,
        availableLOOPs: option.availableLOOPs,
      };
    } catch (error) {
      console.error(
        "[LOOPSelectionCoordinator] Failed to apply bridge:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add bridge",
      };
    }
  }

  async applyLOOP(
    word: string,
    preferences: SpellPreferences,
    bridgeLetter: Letter | null,
    loopType: LOOPType
  ): Promise<LOOPApplicationResult> {
    try {
      // Ensure transition graph is initialized
      await this.serviceLoader.getTransitionGraph();

      const generator = await this.serviceLoader.getWordGenerator();

      // Generate with the specified LOOP and optional bridge letter
      const result = await generator.generateFromWord({
        word,
        preferences: {
          ...preferences,
          makeCircular: true,
          selectedLOOPType: loopType,
        },
        forceBridgeLetter: bridgeLetter ?? undefined,
      });

      if (!result.success || !result.sequence) {
        return {
          success: false,
          error: result.error || "Failed to apply LOOP",
        };
      }

      return {
        success: true,
        sequence: result.sequence,
        expandedWord: result.expandedWord,
      };
    } catch (error) {
      console.error("[LOOPSelectionCoordinator] Failed to apply LOOP:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
