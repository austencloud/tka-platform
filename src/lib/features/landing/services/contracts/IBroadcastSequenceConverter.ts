/**
 * Broadcast Sequence Converter Interface
 *
 * Contract for converting broadcast data formats to internal sequence formats.
 * Handles the transformation of BroadcastSequence/BroadcastStepData to
 * SequenceData/StepData used by the animation system.
 */

import type { BroadcastSequence, BroadcastStepData } from "../../domain/models/broadcast-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export interface IBroadcastSequenceConverter {
  /**
   * Convert a broadcast sequence to internal SequenceData format.
   * The first beat in the broadcast is treated as the start position (beat 0),
   * with remaining steps becoming actual sequence steps.
   */
  convertSequence(broadcast: BroadcastSequence): SequenceData;

  /**
   * Convert a single broadcast beat to internal StepData format.
   * @param beat The broadcast step data
   * @param index The beat index (0-based) for assigning beat number
   */
  convertBeat(beat: BroadcastStepData, index: number): StepData;
}
