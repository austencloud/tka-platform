/**
 * Extension Flow Coordinator Interface
 *
 * Orchestrates the sequence extension workflow:
 * 1. Analyze sequence → determine if direct LOOPs available or need bridge
 * 2. If bridge needed → append bridge beat → re-analyze
 * 3. Apply selected LOOP to extend sequence
 *
 * Manages the flow state and coordinates with ISequenceExtender for operations.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type {
  ExtensionAnalysis,
  CircularizationOption,
  LOOPType,
} from "./ISequenceExtender";

/**
 * Result of starting an extension flow
 */
export interface ExtensionFlowStart {
  /** Whether extension is possible at all */
  canExtend: boolean;
  /** Analysis of the sequence's extension potential */
  analysis: ExtensionAnalysis | null;
  /** Bridge options if direct LOOPs not available */
  circularizationOptions: CircularizationOption[];
  /** Reason direct extension isn't available (if applicable) */
  directUnavailableReason: string | null;
  /** Error message if extension is impossible */
  errorMessage: string | null;
}

/**
 * Result of appending a bridge beat
 */
export interface BridgeAppendResult {
  /** Whether the bridge was successfully appended */
  success: boolean;
  /** The sequence with bridge appended (if successful) */
  sequence: SequenceData | null;
  /** Updated analysis after adding bridge */
  analysis: ExtensionAnalysis | null;
  /** Message to display to user */
  message: string;
}

/**
 * Result of applying a LOOP extension
 */
export interface ExtensionApplyResult {
  /** Whether the extension was successful */
  success: boolean;
  /** The extended sequence (if successful) */
  sequence: SequenceData | null;
  /** Number of steps added */
  stepsAdded: number;
  /** Message to display to user */
  message: string;
}

export interface IExtensionFlowCoordinator {
  /**
   * Quick synchronous check if extension is possible (for UI enablement)
   * @param sequence The sequence to check
   * @returns true if extension is possible
   */
  canExtend(sequence: SequenceData): boolean;

  /**
   * Start the extension flow by analyzing the sequence
   * @param sequence The sequence to analyze for extension
   * @returns Flow start result with analysis and options
   */
  startFlow(sequence: SequenceData): Promise<ExtensionFlowStart>;

  /**
   * Append a bridge beat to make sequence loopable
   * @param sequence Current sequence
   * @param bridgeLetter Bridge letter to append
   * @returns Result with updated sequence and analysis
   */
  appendBridge(
    sequence: SequenceData,
    bridgeLetter: Letter
  ): Promise<BridgeAppendResult>;

  /**
   * Apply a LOOP to extend the sequence
   * @param sequence Current sequence (with or without bridge)
   * @param loopType The LOOP type to apply
   * @returns Result with extended sequence
   */
  applyLoop(
    sequence: SequenceData,
    loopType: LOOPType
  ): Promise<ExtensionApplyResult>;
}
