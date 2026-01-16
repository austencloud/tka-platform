/**
 * Broadcast Sequence Converter Interface
 *
 * Contract for converting broadcast data formats to internal sequence formats.
 * Handles the transformation of BroadcastSequence/BroadcastBeatData to
 * SequenceData/BeatData used by the animation system.
 */

import type { BroadcastSequence, BroadcastBeatData } from "../../domain/models/broadcast-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";

export interface IBroadcastSequenceConverter {
  /**
   * Convert a broadcast sequence to internal SequenceData format.
   * The first beat in the broadcast is treated as the start position (beat 0),
   * with remaining beats becoming actual sequence beats.
   */
  convertSequence(broadcast: BroadcastSequence): SequenceData;

  /**
   * Convert a single broadcast beat to internal BeatData format.
   * @param beat The broadcast beat data
   * @param index The beat index (0-based) for assigning beat number
   */
  convertBeat(beat: BroadcastBeatData, index: number): BeatData;
}
