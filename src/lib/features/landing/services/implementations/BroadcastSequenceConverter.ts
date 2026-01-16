/**
 * Broadcast Sequence Converter Implementation
 *
 * Transforms broadcast data formats (from the live broadcast system) into
 * internal sequence formats used by the animation engine.
 */

import type { BroadcastSequence, BroadcastBeatData } from "../../domain/models/broadcast-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { IBroadcastSequenceConverter } from "../contracts/IBroadcastSequenceConverter";
import type { GridPosition, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

export class BroadcastSequenceConverter implements IBroadcastSequenceConverter {
  convertBeat(beat: BroadcastBeatData, index: number): BeatData {
    const gridMode = GridMode.DIAMOND; // Default for broadcast sequences

    return {
      id: beat.id,
      letter: beat.letter as BeatData["letter"],
      startPosition: beat.startPosition as GridPosition,
      endPosition: beat.endPosition as GridPosition,
      motions: {
        blue: createMotionData({
          motionType: beat.blue.motionType as MotionType,
          rotationDirection: beat.blue.rotationDirection as RotationDirection,
          startLocation: beat.blue.startLocation as GridLocation,
          endLocation: beat.blue.endLocation as GridLocation,
          startOrientation: (beat.blue.startOrientation as Orientation) ?? Orientation.IN,
          endOrientation: (beat.blue.endOrientation as Orientation) ?? Orientation.IN,
          color: MotionColor.BLUE,
          gridMode,
        }),
        red: createMotionData({
          motionType: beat.red.motionType as MotionType,
          rotationDirection: beat.red.rotationDirection as RotationDirection,
          startLocation: beat.red.startLocation as GridLocation,
          endLocation: beat.red.endLocation as GridLocation,
          startOrientation: (beat.red.startOrientation as Orientation) ?? Orientation.IN,
          endOrientation: (beat.red.endOrientation as Orientation) ?? Orientation.IN,
          color: MotionColor.RED,
          gridMode,
        }),
      },
      beatNumber: beat.beatNumber ?? index + 1,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    };
  }

  convertSequence(broadcast: BroadcastSequence): SequenceData {
    // First beat is start position (beat 0), rest are actual beats
    const startBeat = broadcast.beats[0];
    const actualBeats = broadcast.beats.slice(1);
    const gridMode = (broadcast.gridMode as GridMode) ?? GridMode.DIAMOND;

    const startPosition: StartPositionData | undefined = startBeat
      ? {
          isStartPosition: true as const,
          id: startBeat.id,
          letter: startBeat.letter as StartPositionData["letter"],
          startPosition: startBeat.startPosition as GridPosition,
          endPosition: startBeat.endPosition as GridPosition,
          motions: {
            blue: createMotionData({
              motionType: startBeat.blue.motionType as MotionType,
              rotationDirection: startBeat.blue.rotationDirection as RotationDirection,
              startLocation: startBeat.blue.startLocation as GridLocation,
              endLocation: startBeat.blue.endLocation as GridLocation,
              startOrientation: (startBeat.blue.startOrientation as Orientation) ?? Orientation.IN,
              endOrientation: (startBeat.blue.endOrientation as Orientation) ?? Orientation.IN,
              color: MotionColor.BLUE,
              gridMode,
            }),
            red: createMotionData({
              motionType: startBeat.red.motionType as MotionType,
              rotationDirection: startBeat.red.rotationDirection as RotationDirection,
              startLocation: startBeat.red.startLocation as GridLocation,
              endLocation: startBeat.red.endLocation as GridLocation,
              startOrientation: (startBeat.red.startOrientation as Orientation) ?? Orientation.IN,
              endOrientation: (startBeat.red.endOrientation as Orientation) ?? Orientation.IN,
              color: MotionColor.RED,
              gridMode,
            }),
          },
        }
      : undefined;

    return {
      id: broadcast.id,
      name: broadcast.word,
      word: broadcast.word,
      beats: actualBeats.map((b, i) => this.convertBeat(b, i)),
      startPosition,
      thumbnails: [],
      isFavorite: false,
      isCircular: broadcast.isCircular,
      loopType: broadcast.loopType,
      gridMode,
      tags: [],
      metadata: {},
    };
  }
}
