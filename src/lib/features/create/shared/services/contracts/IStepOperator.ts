/**
 * Beat Operations Service Contract
 *
 * Handles all beat manipulation business logic for CreateModule sequence construction.
 * Manages beat removal, batch editing, individual beat mutations, undo snapshots, and beat selection logic.
 *
 * Domain: Create module - Beat Manipulation within Sequence Construction
 * Extracted from CreateModule.svelte to achieve Single Responsibility Principle.
 */

import type {
  ICreateModuleState,
  BatchEditChanges,
} from "../../types/create-module-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { BeatData } from "../../domain/models/BeatData";

export interface IBeatOperator {
  /**
   * Remove a beat and all subsequent beats from the sequence
   * Handles special case of removing start position (clears entire sequence)
   * Creates undo snapshot and manages beat selection after removal
   *
   * @param beatIndex Index of beat to remove (0 = start position)
   * @param CreateModuleState Create Module State for sequence and undo operations
   */
  removeBeat(beatIndex: number, CreateModuleState: ICreateModuleState): void;

  /**
   * Apply batch changes to multiple selected beats
   * Creates undo snapshot before applying changes
   *
   * @param changes Partial beat data to apply to all selected beats
   * @param CreateModuleState Create Module State for sequence operations
   */
  applyBatchChanges(
    changes: BatchEditChanges,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Update orientation for a specific prop color in a beat
   * Handles both start position (beat 0) and sequence beats
   *
   * @param beatNumber Beat number (0 = start position, 1+ = sequence beats)
   * @param color Prop color ('blue' or 'red')
   * @param orientation New orientation value
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current beat data
   */
  updateBeatOrientation(
    beatNumber: number,
    color: string,
    orientation: string,
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Update turn amount for a specific prop color in a beat
   * Handles both start position (beat 0) and sequence beats
   *
   * @param beatNumber Beat number (0 = start position, 1+ = sequence beats)
   * @param color Prop color ('blue' or 'red')
   * @param turnAmount New turn amount value (number or "fl" for float)
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current beat data
   */
  updateBeatTurns(
    beatNumber: number,
    color: string,
    turnAmount: number | "fl",
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Update prop type for a specific prop color in a beat
   * Handles both start position (beat 0) and sequence beats
   * Enables per-motion prop type selection (e.g., red hand + blue staff)
   *
   * @param beatNumber Beat number (0 = start position, 1+ = sequence beats)
   * @param color Prop color ('blue' or 'red')
   * @param propType New prop type value (from PropType enum)
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current beat data
   */
  updateBeatPropType(
    beatNumber: number,
    color: string,
    propType: PropType,
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Bulk update prop type for all motions of a specific color
   * Updates start position and all beats in the current sequence
   * Called when user changes prop type in settings
   *
   * @param color Prop color ('blue' or 'red')
   * @param propType New prop type value (from PropType enum)
   * @param CreateModuleState Create Module State for sequence operations
   */
  bulkUpdatePropType(
    color: string,
    propType: PropType,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Update rotation direction for a specific prop color in a beat
   * Toggles between CLOCKWISE and COUNTER_CLOCKWISE for turn motions
   * Handles both start position (beat 0) and sequence beats
   *
   * @param beatNumber Beat number (0 = start position, 1+ = sequence beats)
   * @param color Prop color ('blue' or 'red')
   * @param rotationDirection New rotation direction ('cw' or 'ccw')
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current beat data
   */
  updateRotationDirection(
    beatNumber: number,
    color: string,
    rotationDirection: string,
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Update arrow manual adjustment for a specific prop color in a beat
   * Persists WASD arrow position adjustments to sequence state
   *
   * @param beatNumber Beat number (0 = start position, 1+ = sequence beats)
   * @param color Prop color ('blue' or 'red')
   * @param adjustmentX X offset in pixels
   * @param adjustmentY Y offset in pixels
   * @param CreateModuleState Create Module State for sequence operations
   */
  updateArrowAdjustment(
    beatNumber: number,
    color: string,
    adjustmentX: number,
    adjustmentY: number,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Persist complete beat data with accumulated arrow adjustments
   * Called when adjustment panel closes to save all changes at once
   *
   * @param beatNumber Beat number (0 = start position, 1+ = sequence beats)
   * @param updatedBeatData Complete beat data with adjusted arrow positions
   * @param CreateModuleState Create Module State for sequence operations
   */
  persistBeatWithAdjustments(
    beatNumber: number,
    updatedBeatData: BeatData,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Update duration for a beat (musical subdivision system)
   * Duration determines how long a beat plays relative to the base tempo.
   * Does not apply to start position (beat 0).
   *
   * @param beatNumber Beat number (1+ = sequence beats, 0 = start position is invalid)
   * @param newDuration New duration value (0.25 to 4.0, in quarter-beat increments)
   * @param CreateModuleState Create Module State for sequence operations
   */
  updateBeatDuration(
    beatNumber: number,
    newDuration: number,
    CreateModuleState: ICreateModuleState
  ): void;
}
