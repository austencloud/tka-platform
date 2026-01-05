/**
 * Extension Flow Coordinator
 *
 * Orchestrates the sequence extension workflow by coordinating
 * with ISequenceExtender for the actual operations.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "$lib/shared/inversify/di";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type {
  IExtensionFlowCoordinator,
  ExtensionFlowStart,
  BridgeAppendResult,
  ExtensionApplyResult,
} from "../contracts/IExtensionFlowCoordinator";
import type {
  ISequenceExtender,
  LOOPType,
} from "../contracts/ISequenceExtender";

@injectable()
export class ExtensionFlowCoordinator implements IExtensionFlowCoordinator {
  constructor(
    @inject(TYPES.ISequenceExtender)
    private readonly sequenceExtender: ISequenceExtender
  ) {}

  canExtend(sequence: SequenceData): boolean {
    try {
      const analysis = this.sequenceExtender.analyzeSequence(sequence);
      return analysis.canExtend;
    } catch {
      return false;
    }
  }

  async startFlow(sequence: SequenceData): Promise<ExtensionFlowStart> {
    try {
      // Analyze the sequence
      const analysis = this.sequenceExtender.analyzeSequence(sequence);

      // If direct LOOPs are available, we're good to go
      if (analysis.canExtend && analysis.availableLOOPOptions.length > 0) {
        return {
          canExtend: true,
          analysis,
          circularizationOptions: [],
          directUnavailableReason: null,
          errorMessage: null,
        };
      }

      // No direct LOOPs - try to get bridge options
      const circularizationOptions =
        await this.sequenceExtender.getCircularizationOptions(sequence);

      if (circularizationOptions.length === 0) {
        return {
          canExtend: false,
          analysis,
          circularizationOptions: [],
          directUnavailableReason: null,
          errorMessage: "Cannot extend this sequence",
        };
      }

      return {
        canExtend: true,
        analysis,
        circularizationOptions,
        directUnavailableReason:
          "Position groups don't match for direct extension",
        errorMessage: null,
      };
    } catch (error) {
      console.error("[ExtensionFlowCoordinator] startFlow failed:", error);
      return {
        canExtend: false,
        analysis: null,
        circularizationOptions: [],
        directUnavailableReason: null,
        errorMessage: "Failed to analyze sequence for extension",
      };
    }
  }

  async appendBridge(
    sequence: SequenceData,
    bridgeLetter: Letter
  ): Promise<BridgeAppendResult> {
    try {
      // Append the bridge beat
      const sequenceWithBridge = await this.sequenceExtender.appendBridgeBeat(
        sequence,
        bridgeLetter
      );

      // Re-analyze to get LOOP options
      const analysis =
        this.sequenceExtender.analyzeSequence(sequenceWithBridge);

      return {
        success: true,
        sequence: sequenceWithBridge,
        analysis,
        message: `Added "${bridgeLetter}" - now choose LOOP pattern`,
      };
    } catch (error) {
      console.error("[ExtensionFlowCoordinator] appendBridge failed:", error);
      return {
        success: false,
        sequence: null,
        analysis: null,
        message: "Could not add bridge letter",
      };
    }
  }

  async applyLoop(
    sequence: SequenceData,
    loopType: LOOPType
  ): Promise<ExtensionApplyResult> {
    try {
      const originalLength = sequence.beats?.length || 0;

      const extendedSequence = await this.sequenceExtender.extendSequence(
        sequence,
        { loopType }
      );

      const newLength = extendedSequence.beats?.length || 0;
      const beatsAdded = newLength - originalLength;

      if (beatsAdded === 0) {
        return {
          success: false,
          sequence: null,
          beatsAdded: 0,
          message: "No extension beats generated",
        };
      }

      const loopName = loopType.replace(/_/g, " ");
      return {
        success: true,
        sequence: extendedSequence,
        beatsAdded,
        message: `Extended with ${loopName}! Added ${beatsAdded} beats`,
      };
    } catch (error) {
      console.error("[ExtensionFlowCoordinator] applyLoop failed:", error);
      return {
        success: false,
        sequence: null,
        beatsAdded: 0,
        message: "Could not extend sequence",
      };
    }
  }
}
