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
import type { StepData } from "../../domain/models/StepData";

export interface IStepOperator {
  /**
   * Remove a beat and all subsequent steps from the sequence
   * Handles special case of removing start position (clears entire sequence)
   * Creates undo snapshot and manages beat selection after removal
   *
   * @param stepIndex Index of beat to remove (0 = start position)
   * @param CreateModuleState Create Module State for sequence and undo operations
   */
  removeStep(stepIndex: number, CreateModuleState: ICreateModuleState): void;

  /**
   * Apply batch changes to multiple selected steps
   * Creates undo snapshot before applying changes
   *
   * @param changes Partial step data to apply to all selected steps
   * @param CreateModuleState Create Module State for sequence operations
   */
  applyBatchChanges(
    changes: BatchEditChanges,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Update orientation for a specific prop color in a beat
   * Handles both start position (beat 0) and sequence steps
   *
   * @param stepNumber Beat number (0 = start position, 1+ = sequence steps)
   * @param color Prop color ('blue' or 'red')
   * @param orientation New orientation value
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current step data
   */
  updateStepOrientation(
    stepNumber: number,
    color: string,
    orientation: string,
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Update turn amount for a specific prop color in a beat
   * Handles both start position (beat 0) and sequence steps
   *
   * @param stepNumber Beat number (0 = start position, 1+ = sequence steps)
   * @param color Prop color ('blue' or 'red')
   * @param turnAmount New turn amount value (number or "fl" for float)
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current step data
   */
  updateStepTurns(
    stepNumber: number,
    color: string,
    turnAmount: number | "fl",
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Update prop type for a specific prop color in a beat
   * Handles both start position (beat 0) and sequence steps
   * Enables per-motion prop type selection (e.g., red hand + blue staff)
   *
   * @param stepNumber Beat number (0 = start position, 1+ = sequence steps)
   * @param color Prop color ('blue' or 'red')
   * @param propType New prop type value (from PropType enum)
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current step data
   */
  updateStepPropType(
    stepNumber: number,
    color: string,
    propType: PropType,
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Bulk update prop type for all motions of a specific color
   * Updates start position and all steps in the current sequence
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
   * Handles both start position (beat 0) and sequence steps
   *
   * @param stepNumber Beat number (0 = start position, 1+ = sequence steps)
   * @param color Prop color ('blue' or 'red')
   * @param rotationDirection New rotation direction ('cw' or 'ccw')
   * @param CreateModuleState Create Module State for sequence operations
   * @param panelState Panel state for current step data
   */
  updateRotationDirection(
    stepNumber: number,
    color: string,
    rotationDirection: string,
    CreateModuleState: ICreateModuleState,
    panelState: unknown
  ): void;

  /**
   * Update arrow manual adjustment for a specific prop color in a beat
   * Persists WASD arrow position adjustments to sequence state
   *
   * @param stepNumber Beat number (0 = start position, 1+ = sequence steps)
   * @param color Prop color ('blue' or 'red')
   * @param adjustmentX X offset in pixels
   * @param adjustmentY Y offset in pixels
   * @param CreateModuleState Create Module State for sequence operations
   */
  updateArrowAdjustment(
    stepNumber: number,
    color: string,
    adjustmentX: number,
    adjustmentY: number,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Persist complete step data with accumulated arrow adjustments
   * Called when adjustment panel closes to save all changes at once
   *
   * @param stepNumber Beat number (0 = start position, 1+ = sequence steps)
   * @param updatedStepData Complete step data with adjusted arrow positions
   * @param CreateModuleState Create Module State for sequence operations
   */
  persistBeatWithAdjustments(
    stepNumber: number,
    updatedStepData: StepData,
    CreateModuleState: ICreateModuleState
  ): void;

  /**
   * Update duration for a beat (musical subdivision system)
   * Duration determines how long a beat plays relative to the base tempo.
   * Does not apply to start position (beat 0).
   *
   * @param stepNumber Beat number (1+ = sequence steps, 0 = start position is invalid)
   * @param newDuration New duration value (1.0 to 4.0, in quarter-beat increments)
   * @param CreateModuleState Create Module State for sequence operations
   */
  updateStepDuration(
    stepNumber: number,
    newDuration: number,
    CreateModuleState: ICreateModuleState
  ): void;
}
